package com.example.demo.dto;

import com.example.demo.model.AlarmEvent;
import lombok.Data;

import java.time.Duration;
import java.time.LocalDateTime;

/**
 * 對外 DTO. 隱藏預留欄位 (ack_*, details).
 * durationSeconds: ACTIVE 時算到 now, CLEARED 時算 endTime - startTime.
 */
@Data
public class AlarmEventDto {

    private Long id;
    private String devEui;
    private String category;
    private String severity;
    private String status;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Double triggerValue;
    private Double resolveValue;
    private Long durationSeconds;

    public static AlarmEventDto from(AlarmEvent e) {
        AlarmEventDto dto = new AlarmEventDto();
        dto.setId(e.getId());
        dto.setDevEui(e.getDevEui());
        dto.setCategory(e.getCategory());
        dto.setSeverity(e.getSeverity());
        dto.setStatus(e.getStatus());
        dto.setStartTime(e.getStartTime());
        dto.setEndTime(e.getEndTime());
        dto.setTriggerValue(e.getTriggerValue());
        dto.setResolveValue(e.getResolveValue());

        if (e.getStartTime() != null) {
            LocalDateTime endRef = e.getEndTime() != null ? e.getEndTime() : LocalDateTime.now();
            dto.setDurationSeconds(Duration.between(e.getStartTime(), endRef).getSeconds());
        }
        return dto;
    }
}