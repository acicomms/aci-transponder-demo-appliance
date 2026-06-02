package com.example.demo.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "device_status_logs")
@Data
public class DeviceStatusLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String devEui;

    // ==========================================
    // 03 即時狀態 (Status Data) - 重要數據
    // ==========================================
    private Integer unitStatus;      // 狀態 (1=Normal, 2=Alarm)
    private Double temperature;      // 溫度
    private Double voltage;          // 電壓 
    private Integer ripple;          // ripple
    private Double rfOutputPower;    // TCP 總輸出功率 (dBmV)
    
    // ==========================================
    // 03 即時狀態 - 運作模式與功率
    // ==========================================
    private Integer workingMode;     // Working Mode
    private Integer dfuType;         // DFU Type
    private Double pilotLowPwr;      // 低頻導頻功率 
    private Double pilotHighPwr;     // 高頻導頻功率
    private Double outputSlope;      // Output Slope
    private Double userPilotLowPwr;  // User setting Pilot Low Pwr
    private Double userPilotHighPwr; // User setting Pilot High Pwr
    private Integer lowPilotFreq;    // Low Pilot Freq 
    private Integer highPilotFreq;   // High Pilot Freq 
    private Integer ceqIndexStatus;  // CEQ Index

    // ==========================================
    // 03 即時狀態 - 細節警報 (1: Alarm/Unlock, 0: Normal/Lock)
    // ==========================================
    private Integer rfLowFreqUnlockStatus;
    private Integer rfHighFreqUnlockStatus;
    private Integer tempAlarmStatus;
    private Integer voltAlarmStatus;
    private Integer rippleAlarmStatus;
    private Integer tcpAlarmStatus;

    // ==========================================
    // 網路資訊與原始封包
    // ==========================================
    private String gatewayId;        
    private Integer fCnt;            
    private Long frequency;          
    private Integer spreadingFactor; 
    private Integer rssi;            
    private Double snr;              
    private Double gwLatitude;       
    private Double gwLongitude;      

    @Column(columnDefinition = "TEXT")
    private String rawData;          
    
    @Column(columnDefinition = "TEXT")
    private String chirpstackPayload;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}