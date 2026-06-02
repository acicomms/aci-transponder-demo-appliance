package com.example.demo.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "device_config_logs")
public class DeviceConfigLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "dev_eui", length = 50)
    private String devEui;

    @Column(name = "log_type", length = 20)
    private String logType; // "INFO_01" 或 "SETTINGS_02"

    @Column(name = "config_data", columnDefinition = "JSON")
    private String configDataJson;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() { this.createdAt = LocalDateTime.now(); }


    public void setDevEui(String devEui) { this.devEui = devEui; }
    public void setLogType(String logType) { this.logType = logType; }
    public void setConfigDataJson(String configDataJson) { this.configDataJson = configDataJson; }
}