package com.example.demo.model;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Single source of truth for device live health status.
 * Main status is driven by amplifier data freshness (lastAmpDataAt), not
 * transponder LoRaWAN last-seen, so a dead amplifier no longer shows online
 * just because the transponder keeps reporting cached data.
 */
public enum DeviceHealthStatus {
    ONLINE,   // amp data fresh, unitStatus normal
    STALE,    // retained for backward compatibility; no longer emitted
    OFFLINE,  // amp data stale or never received
    ALARM;    // amp data fresh and unitStatus != 1

    // Fallback thresholds (minutes) when a device has no per-device value yet.
    private static final int DEFAULT_AMP_OFFLINE_MIN = 6;
    private static final int DEFAULT_TRANSPONDER_OFFLINE_MIN = 10;

    /**
     * Main health status based on amplifier data freshness.
     * lastAmpDataAt is expected to be UTC (matches how it is written on decode).
     * ampOfflineMin null falls back to the default.
     */
    public static DeviceHealthStatus compute(LocalDateTime lastAmpDataAt, Integer unitStatus, Integer ampOfflineMin) {
        if (lastAmpDataAt == null) return OFFLINE;

        long thresholdSec = (ampOfflineMin != null ? ampOfflineMin : DEFAULT_AMP_OFFLINE_MIN) * 60L;
        LocalDateTime nowUtc = LocalDateTime.now(ZoneId.of("UTC"));
        long elapsedSec = Duration.between(lastAmpDataAt, nowUtc).getSeconds();

        if (elapsedSec > thresholdSec) return OFFLINE;

        boolean alarm = unitStatus != null && unitStatus != 1;
        return alarm ? ALARM : ONLINE;
    }

    /**
     * Secondary indicator: transponder LoRaWAN reachability (online/offline only).
     * lastSeenAt is expected to be UTC. transponderOfflineMin null falls back to the default.
     */
    public static DeviceHealthStatus computeTransponder(LocalDateTime lastSeenAt, Integer transponderOfflineMin) {
        if (lastSeenAt == null) return OFFLINE;

        long thresholdSec = (transponderOfflineMin != null ? transponderOfflineMin : DEFAULT_TRANSPONDER_OFFLINE_MIN) * 60L;
        LocalDateTime nowUtc = LocalDateTime.now(ZoneId.of("UTC"));
        long elapsedSec = Duration.between(lastSeenAt, nowUtc).getSeconds();

        return elapsedSec > thresholdSec ? OFFLINE : ONLINE;
    }

    /**
     * Lowercase enum name, e.g. "online" / "offline" / "alarm".
     * Used as the JSON value for the frontend.
     */
    public String toJsonValue() {
        return name().toLowerCase();
    }
}