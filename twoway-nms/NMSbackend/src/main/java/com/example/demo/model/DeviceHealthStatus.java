package com.example.demo.model;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Single source of truth for device live health status.
 * Used by REST responses and any future health-aware logic.
 */
public enum DeviceHealthStatus {
    ONLINE,   // last seen < 5 min, unitStatus normal
    STALE,    // last seen 5~10 min, unitStatus normal
    OFFLINE,  // last seen >= 10 min (unitStatus is stale, ignored)
    ALARM;    // last seen < 10 min and unitStatus != 1

    private static final long ONLINE_SECONDS = 5 * 60;
    private static final long OFFLINE_SECONDS = 10 * 60;

    /**
     * Compute health status. lastSeenAt is expected to be UTC
     * (matches how ChirpStack stores it).
     */
    public static DeviceHealthStatus compute(LocalDateTime lastSeenAt, Integer unitStatus) {
        if (lastSeenAt == null) return OFFLINE;

        LocalDateTime nowUtc = LocalDateTime.now(ZoneId.of("UTC"));
        long elapsedSec = Duration.between(lastSeenAt, nowUtc).getSeconds();

        if (elapsedSec >= OFFLINE_SECONDS) return OFFLINE;

        boolean alarm = unitStatus != null && unitStatus != 1;
        if (alarm) return ALARM;

        return elapsedSec < ONLINE_SECONDS ? ONLINE : STALE;
    }

    /**
     * Lowercase enum name, e.g. "online" / "stale" / "offline" / "alarm".
     * Used as the JSON value for the frontend.
     */
    public String toJsonValue() {
        return name().toLowerCase();
    }
}