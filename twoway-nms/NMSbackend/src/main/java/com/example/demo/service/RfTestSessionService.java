package com.example.demo.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;


@Service
public class RfTestSessionService {

    public enum Mode { READ, SET }

    /** Request DTO populated by the controller. */
    public static class Params {
        public Mode mode;
        public String readTarget;     // READ: only "STATUS" accepted
        public String settingKey;     // SET: kebab-case key from SettingDefinition
        public Double value;          // SET: numeric value
        public int timeoutSec;        // 1~30
        public int intervalSec;       // 0~60, pause between cycles after a matched RX (0 = chain immediately)
    }

    /** A single TX or RX log entry kept in the per-session ring buffer. */
    private static final class LogEvent {
        final long tsMillis;
        final String direction;     // "TX" | "RX" | "—" (synthetic timeout/error row)
        final String type;          // "STATUS" or settingKey
        final Long rttMs;           // null on TX / non-matched
        final Integer rssi;         // null on TX / TIMEOUT
        final String status;        // "SENT" | "OK" | "TIMEOUT" | "ERROR"

        LogEvent(long ts, String dir, String type, Long rtt, Integer rssi, String status) {
            this.tsMillis  = ts;
            this.direction = dir;
            this.type      = type;
            this.rttMs     = rtt;
            this.rssi      = rssi;
            this.status    = status;
        }

        Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("tsMillis",  tsMillis);
            m.put("direction", direction);
            m.put("type",      type);
            m.put("rttMs",     rttMs);
            m.put("rssi",      rssi);
            m.put("status",    status);
            return m;
        }
    }

    /** Live state for one device's link test session. */
    private static final class Session {
        final Mode mode;
        final String readTarget;
        final String settingKey;
        final Double value;
        final int timeoutSec;
        final int intervalSec;
        final long startedAtMillis;

        // Outstanding TX waiting for uplink. null = no TX in flight.
        // Guarded by `this` (Session monitor).
        Long pendingSentAtMillis = null;
        ScheduledFuture<?> pendingTimeoutFuture = null;
        // Pending interval pause between matched RX and next TX. null = not in
        // an inter-cycle wait. Cancelled on stop() so Stop is always immediate.
        ScheduledFuture<?> pendingIntervalFuture = null;

        // Stats — counters atomic, RTT vars under Session monitor
        final AtomicLong downlinksSent   = new AtomicLong(0);
        final AtomicLong uplinksReceived = new AtomicLong(0);
        long rttCount = 0;
        long rttSumMs = 0;
        long rttMinMs = Long.MAX_VALUE;
        long rttMaxMs = 0;
        Integer lastRssi = null;
        Long lastUplinkAtMillis = null;

        // Log ring buffer — guarded by `this`
        final Deque<LogEvent> events = new ArrayDeque<>();

        Session(Params p, long now) {
            this.mode = p.mode;
            this.readTarget = p.readTarget;
            this.settingKey = p.settingKey;
            this.value = p.value;
            this.timeoutSec = p.timeoutSec;
            this.intervalSec = p.intervalSec;
            this.startedAtMillis = now;
        }
    }

    // Hard caps — service-level guardrails, controller mirrors for clean 400s
    public static final int MIN_TIMEOUT_SEC  = 1;
    public static final int MAX_TIMEOUT_SEC  = 30;
    public static final int MIN_INTERVAL_SEC = 0;
    public static final int MAX_INTERVAL_SEC = 60;
    public static final int MAX_LOG_EVENTS   = 1000;

    private final Map<String, Session> sessions = new ConcurrentHashMap<>();

    private final Map<String, Map<String, Object>> recentStops = new ConcurrentHashMap<>();

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(
            2,
            r -> {
                Thread t = new Thread(r, "rf-ping-test");
                t.setDaemon(true);
                return t;
            });

    @Autowired
    private DeviceService deviceService;

    // ==========================================================================
    // Public API — invoked by IotController
    // ==========================================================================

    public synchronized Map<String, Object> start(String devEui, Params p) {
        validate(p);

        if (sessions.containsKey(devEui)) {
            throw new IllegalStateException("Link test already running on " + devEui);
        }

        recentStops.remove(devEui);  // Clear stale snapshot so chip resets.

        long now = System.currentTimeMillis();
        Session s = new Session(p, now);
        sessions.put(devEui, s);

        System.out.println(" [Link Test] Started for " + devEui +
                " mode=" + p.mode +
                " timeout=" + p.timeoutSec + "s" +
                (p.mode == Mode.SET ? " key=" + p.settingKey + " value=" + p.value : ""));

        // First downlink fires immediately
        sendNext(devEui, s);

        return getStatus(devEui);
    }

    /** Manual stop via controller. */
    public Map<String, Object> stop(String devEui) {
        return stopInternal(devEui, "manual");
    }

    private synchronized Map<String, Object> stopInternal(String devEui, String reason) {
        Session s = sessions.remove(devEui);
        Map<String, Object> resp = new LinkedHashMap<>();
        if (s == null) {
            resp.put("running", false);
            resp.put("devEui", devEui);
            // Surface any cached recent stop so UI can still show TIMEOUT chip.
            Map<String, Object> last = recentStops.get(devEui);
            if (last != null) {
                resp.putAll(last);
                resp.put("running", false);
            }
            return resp;
        }
        synchronized (s) {
            if (s.pendingTimeoutFuture != null) {
                s.pendingTimeoutFuture.cancel(false);
                s.pendingTimeoutFuture = null;
            }
            if (s.pendingIntervalFuture != null) {
                s.pendingIntervalFuture.cancel(false);
                s.pendingIntervalFuture = null;
            }
        }

        System.out.println(" [Link Test] Stopped for " + devEui +
                " reason="   + reason +
                " sent="     + s.downlinksSent.get() +
                " received=" + s.uplinksReceived.get());

        resp.put("running",       false);
        resp.put("devEui",        devEui);
        resp.put("stoppedReason", reason);
        resp.put("timeoutSec",    s.timeoutSec);
        resp.put("finalStats",    buildStats(s));
        resp.put("events",        snapshotEvents(s));
        recentStops.put(devEui, resp);
        return resp;
    }

    /**
     * Hook invoked by DevicePayloadDecoder on every uplink.
     * Resolves the pending TX (if any), logs an RX event, and chains next TX.
     */
    public void recordUplink(String devEui, long receivedAtMillis, Integer rssi) {
        Session s = sessions.get(devEui);
        if (s == null) return;

        boolean shouldChain = false;
        synchronized (s) {
            s.uplinksReceived.incrementAndGet();
            s.lastUplinkAtMillis = receivedAtMillis;
            if (rssi != null) s.lastRssi = rssi;

            String typeLabel = (s.mode == Mode.READ) ? "STATUS" : s.settingKey;

            if (s.pendingSentAtMillis != null) {
                long rttMs = receivedAtMillis - s.pendingSentAtMillis;
                if (rttMs < 0) rttMs = 0;
                s.rttCount++;
                s.rttSumMs += rttMs;
                if (rttMs < s.rttMinMs) s.rttMinMs = rttMs;
                if (rttMs > s.rttMaxMs) s.rttMaxMs = rttMs;

                appendEvent(s, new LogEvent(
                        receivedAtMillis, "RX", typeLabel, rttMs, rssi, "OK"));

                s.pendingSentAtMillis = null;
                if (s.pendingTimeoutFuture != null) {
                    s.pendingTimeoutFuture.cancel(false);
                    s.pendingTimeoutFuture = null;
                }
                shouldChain = true;
            } else {
                // Unsolicited uplink — count + log, but don't chain a new TX.
                appendEvent(s, new LogEvent(
                        receivedAtMillis, "RX", typeLabel, null, rssi, "OK"));
            }
        }
        if (shouldChain) {
            if (s.intervalSec <= 0) {
                // intervalSec == 0 → preserve original immediate-chain behaviour
                sendNext(devEui, s);
            } else {
                // Pace next TX: pause intervalSec seconds before sending again.
                // Future is tracked in s.pendingIntervalFuture so stop() can
                // cancel a pending wait and avoid an accidental late TX.
                synchronized (s) {
                    if (sessions.get(devEui) != s) return; // already stopped
                    s.pendingIntervalFuture = scheduler.schedule(() -> {
                        synchronized (s) {
                            s.pendingIntervalFuture = null;
                        }
                        sendNext(devEui, s);
                    }, s.intervalSec, TimeUnit.SECONDS);
                }
            }
        }
    }

    /** Current snapshot, including events[] up to MAX_LOG_EVENTS. */
    public Map<String, Object> getStatus(String devEui) {
        Session s = sessions.get(devEui);
        Map<String, Object> resp = new LinkedHashMap<>();
        if (s == null) {
            // No running session — surface the recent stop snapshot if any,
            // so the UI's first post-timeout poll still shows the TIMEOUT chip.
            Map<String, Object> last = recentStops.get(devEui);
            if (last != null) {
                resp.putAll(last);
                resp.put("running", false);
                return resp;
            }
            resp.put("running", false);
            resp.put("devEui", devEui);
            return resp;
        }
        long now = System.currentTimeMillis();
        resp.put("running",         true);
        resp.put("devEui",          devEui);
        resp.put("mode",            s.mode.name());
        resp.put("readTarget",      s.readTarget);
        resp.put("settingKey",      s.settingKey);
        resp.put("value",           s.value);
        resp.put("timeoutSec",      s.timeoutSec);
        resp.put("intervalSec",     s.intervalSec);
        resp.put("startedAtMillis", s.startedAtMillis);
        resp.put("elapsedSec",      (now - s.startedAtMillis) / 1000L);
        resp.put("stats",           buildStats(s));
        resp.put("events",          snapshotEvents(s));
        return resp;
    }

    // ==========================================================================
    // Internals
    // ==========================================================================

    private void validate(Params p) {
        if (p.mode == null) {
            throw new IllegalArgumentException("mode required (READ or SET)");
        }
        if (p.timeoutSec < MIN_TIMEOUT_SEC || p.timeoutSec > MAX_TIMEOUT_SEC) {
            throw new IllegalArgumentException(
                    "timeoutSec must be " + MIN_TIMEOUT_SEC + "~" + MAX_TIMEOUT_SEC);
        }
        if (p.intervalSec < MIN_INTERVAL_SEC || p.intervalSec > MAX_INTERVAL_SEC) {
            throw new IllegalArgumentException(
                    "intervalSec must be " + MIN_INTERVAL_SEC + "~" + MAX_INTERVAL_SEC);
        }
        if (p.mode == Mode.READ) {
            if (p.readTarget == null || !"STATUS".equalsIgnoreCase(p.readTarget)) {
                throw new IllegalArgumentException(
                        "READ mode: readTarget must be \"STATUS\"");
            }
        } else { // SET
            if (p.settingKey == null || p.settingKey.isBlank()) {
                throw new IllegalArgumentException("SET mode: settingKey required");
            }
            if (p.value == null) {
                throw new IllegalArgumentException("SET mode: value required");
            }
            if (SettingDefinition.fromKey(p.settingKey).isEmpty()) {
                throw new IllegalArgumentException(
                        "SET mode: unknown settingKey \"" + p.settingKey + "\"");
            }
        }
    }

    /**
     * Fire one downlink and arm the timeout watchdog. Called from start() and
     * then chained from recordUplink() after each successful match.
     */
    private void sendNext(String devEui, Session s) {
        // Race: stop() may have just removed the session.
        if (sessions.get(devEui) != s) return;

        long sentAt = System.currentTimeMillis();
        String typeLabel = (s.mode == Mode.READ) ? "STATUS" : s.settingKey;

        try {
            if (s.mode == Mode.READ) {
                // STATUS = 40010103. Bypasses manual-sync cooldown.
                deviceService.enqueueDownlinkRaw(devEui, 10, "40010103", 60L);
            } else {
                Optional<SettingDefinition> defOpt = SettingDefinition.fromKey(s.settingKey);
                if (defOpt.isEmpty()) {
                    System.err.println(" [Link Test] Unknown settingKey mid-flight: "
                            + s.settingKey + " — stopping " + devEui);
                    stopInternal(devEui, "manual");
                    return;
                }
                deviceService.updateNumericSettingRaw(devEui, defOpt.get(), s.value);
            }
        } catch (Exception e) {
            // gRPC / enqueue failed. Log ERROR and stop — no response to chain.
            System.err.println(" [Link Test] sendNext failed on " + devEui + ": " + e.getMessage());
            synchronized (s) {
                appendEvent(s, new LogEvent(sentAt, "—", typeLabel, null, null, "ERROR"));
            }
            stopInternal(devEui, "manual");
            return;
        }

        synchronized (s) {
            // Re-check inside lock — stop() / handleTimeout() may have run between
            // the enqueue and now; if so don't arm a new timeout future.
            if (sessions.get(devEui) != s) return;

            s.downlinksSent.incrementAndGet();
            s.pendingSentAtMillis = sentAt;
            appendEvent(s, new LogEvent(sentAt, "TX", typeLabel, null, null, "SENT"));

            s.pendingTimeoutFuture = scheduler.schedule(
                    () -> handleTimeout(devEui, s),
                    s.timeoutSec, TimeUnit.SECONDS);
        }
    }

    private void handleTimeout(String devEui, Session s) {
        synchronized (s) {
            if (sessions.get(devEui) != s) return;
            if (s.pendingSentAtMillis == null) return; // resolved between fire & lock

            String typeLabel = (s.mode == Mode.READ) ? "STATUS" : s.settingKey;
            appendEvent(s, new LogEvent(
                    System.currentTimeMillis(), "—", typeLabel,
                    (long) (s.timeoutSec * 1000), null, "TIMEOUT"));
            s.pendingSentAtMillis = null;
            s.pendingTimeoutFuture = null;
        }
        System.out.println(" [Link Test] Timeout on " + devEui +
                " after " + s.timeoutSec + "s — stopping");
        stopInternal(devEui, "timeout");
    }

    /** Append to ring buffer, evicting oldest when full. Caller must hold `s` monitor. */
    private void appendEvent(Session s, LogEvent ev) {
        if (s.events.size() >= MAX_LOG_EVENTS) {
            s.events.pollFirst();
        }
        s.events.addLast(ev);
    }

    private List<Map<String, Object>> snapshotEvents(Session s) {
        synchronized (s) {
            List<Map<String, Object>> out = new ArrayList<>(s.events.size());
            for (LogEvent ev : s.events) {
                out.add(ev.toMap());
            }
            return out;
        }
    }

    private Map<String, Object> buildStats(Session s) {
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("downlinksSent",   s.downlinksSent.get());
        stats.put("uplinksReceived", s.uplinksReceived.get());
        synchronized (s) {
            if (s.rttCount > 0) {
                stats.put("rttAvgMs", s.rttSumMs / s.rttCount);
                stats.put("rttMinMs", s.rttMinMs);
                stats.put("rttMaxMs", s.rttMaxMs);
            } else {
                stats.put("rttAvgMs", null);
                stats.put("rttMinMs", null);
                stats.put("rttMaxMs", null);
            }
            stats.put("lastRssi",           s.lastRssi);
            stats.put("lastUplinkAtMillis", s.lastUplinkAtMillis);
        }
        return stats;
    }
}