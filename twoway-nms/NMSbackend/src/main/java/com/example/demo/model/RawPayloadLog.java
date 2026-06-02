package com.example.demo.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "raw_payload_logs")
public class RawPayloadLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "dev_eui", length = 50)
    private String devEui;

    @Column(name = "f_cnt")
    private Integer fCnt;

    @Column(name = "raw_hex", columnDefinition = "TEXT")
    private String rawHex;

    @Column(name = "raw_json", columnDefinition = "TEXT")
    private String rawJson;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

  
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getDevEui() { return devEui; }
    public void setDevEui(String devEui) { this.devEui = devEui; }
    public Integer getFCnt() { return fCnt; }
    public void setFCnt(Integer fCnt) { this.fCnt = fCnt; }
    public String getRawHex() { return rawHex; }
    public void setRawHex(String rawHex) { this.rawHex = rawHex; }
    public String getRawJson() { return rawJson; }
    public void setRawJson(String rawJson) { this.rawJson = rawJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}