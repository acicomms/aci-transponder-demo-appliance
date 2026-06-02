package com.example.demo.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "alarm_events",
        indexes = {
                @Index(name = "idx_alarm_events_dev_cat_status", columnList = "dev_eui, category, status"),
                @Index(name = "idx_alarm_events_start_time",     columnList = "start_time")
        }
)
@Data
public class AlarmEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "dev_eui", nullable = false, length = 50)
    private String devEui;

    // TEMPERATURE / VOLTAGE / RIPPLE / TCP
    @Column(nullable = false, length = 20)
    private String category;

    // 預留欄位, 第二段一律寫 "MAJOR"
    @Column(length = 20)
    private String severity;

    // ACTIVE / CLEARED
    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    // null = ACTIVE (still ongoing)
    @Column(name = "end_time")
    private LocalDateTime endTime;

    // 觸發當下的測量值
    @Column(name = "trigger_value")
    private Double triggerValue;

    // 解除當下的測量值
    @Column(name = "resolve_value")
    private Double resolveValue;

    // ==========================================
    // 預留欄位 (第二段不讀不寫, 第三段以後才用)
    // ==========================================
    @Column(name = "ack_status", length = 20)
    private String ackStatus;

    @Column(name = "ack_user", length = 100)
    private String ackUser;

    @Column(name = "ack_time")
    private LocalDateTime ackTime;

    @Column(name = "ack_note", columnDefinition = "TEXT")
    private String ackNote;

    @Column(columnDefinition = "JSON")
    private String details;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}