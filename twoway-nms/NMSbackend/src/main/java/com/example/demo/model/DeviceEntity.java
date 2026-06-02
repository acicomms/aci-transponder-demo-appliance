package com.example.demo.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "devices")
@Data
public class DeviceEntity {
    @Id
    private String devEui;
    private String name;

    // ==========================================
    // 01 基本資訊 (Model Type)
    // ==========================================
    private String partName;     // 設備名稱
    private String partNumber;   // 型號
    private String serialNumber; // 序號
    private String hwVersion;    // 硬體版本
    private String fwVersion;    // 韌體版本
    private String mfgDate;      // 製造日期 
    private Integer partIndex;   // Part Index 
    
    // 地理位置
    private String latitude;
    private String longitude;
    
    // ==========================================
    // 02 設定參數 (Setting Data) - 警報門檻
    // ==========================================
    private Double tempHighAlarm;    // 溫度高警報
    private Double tempLowAlarm;     // 溫度低警報
    private Double voltHighAlarm;    // 電壓高警報
    private Double voltLowAlarm;     // 電壓低警報
    private Integer rippleHighAlarm; // ripple高警報
    private Double rfOutputHighAlarm; // RF 輸出高警報 
    private Double rfOutputLowAlarm;  // RF 輸出低警報

    // ==========================================
    // 02 設定參數 (Setting Data) - 
    // ==========================================
    private Integer rtnIngress1;      // RTN Ingress (Port 2/4)
    private Integer rtnIngress2;      // RTN Ingress (Port 3)
    private Integer rtnIngress3;      // RTN Ingress (Port 4/6)
    private Integer fwdEceqIndex;     // FWD E-CEQ Index
    private Integer rfOutputLogMin;   // RF output Log 分鐘
    private Integer dfuTypeSetting;   // DFU Type
    private Integer settingMode;      // Setting Mode
    private Integer fwdAgcMode;       // FWD AGC Mode
    
    // ==========================================
    // 02 設定參數 (Setting Data) - 頻率與功率設定
    // ==========================================
    private Integer fwdLoadingLowFreq;  // MHz
    private Integer fwdLoadingHighFreq; // MHz
    private Double fwdLoadingPwrLow;    // dBmV
    private Double fwdLoadingPwrHigh;   // dBmV
    private Integer fwdPilotLowFreq;    // MHz
    private Integer fwdPilotHighFreq;   // MHz

    // ==========================================
    // 02 設定參數 (Setting Data) - Status Mask
    // ==========================================
    private Integer maskRfOutPilotLow;
    private Integer maskRfOutPilotHigh;
    private Integer maskTemp;
    private Integer mask24v;
    private Integer maskTampSwitch;     // R102 0x30 (Cray handover 時誤填為 DFU Type, 已改正)
    private Integer maskRipple;
    private Integer maskRfOutPwr;


    private Double port1FwdInputPad;
    private Double port1FwdInputEq;
    private Double portNRevInputPad1;
    private Double port1RevOutputEq;
    private Double portNFwdOutputPad1;
    private Double port1RevOutputPad;
    private Double portNRevInputPad2;
    private Double portNRevInputPad3;
    private Double portNFwdOutputPad2;
    private Double portNFwdOutputEq1;
    private Double portNFwdOutputEq2;

    @Column(length = 255)
    private String locationAddress;  // 地址字串
    private Integer logIntervalMin;  // 系統紀錄頻率

    // ==========================================
    // 系統運作與網路屬性
    // ==========================================
    private Integer unitStatus;      // 1=Normal, 其他為 Alarm
    private Boolean isAlarmAcked;    // 預設為 true
    private String lastGatewayId; 
    private LocalDateTime lastSeenAt;
    private String deviceProfileName; 
    private String deviceClassEnabled; 
}