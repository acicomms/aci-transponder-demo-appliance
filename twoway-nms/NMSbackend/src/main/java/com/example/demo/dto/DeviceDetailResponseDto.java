package com.example.demo.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class DeviceDetailResponseDto {
    private String devEui = "unknow";
    private String name = "unknow";
    private LocalDateTime lastSeenAt;
    private String syncStatus = "SYNCED"; // 同步狀態
    private String healthStatus = "offline"; // online / stale / offline / alarm

    private BasicInfo basicInfo = new BasicInfo();
    private Settings settings = new Settings();
    private LatestStatus latestStatus = new LatestStatus();

    @Data
    public static class BasicInfo {
        
        private String partName = "data sync...";
        private String partNumber = "data sync...";
        private String serialNumber = "data sync...";
        private String fwVersion = "data sync...";
    }

    @Data
    public static class Settings {
        private Alarms alarms = new Alarms();
        private SystemConfig system = new SystemConfig();
        private LoadingPilot loadingPilot = new LoadingPilot();
        private AlarmMasks alarmMasks = new AlarmMasks();

        @Data
        public static class Alarms {
            //  -999.0 / -999 代表尚未取得資料
            private Double tempHigh = -999.0;
            private Double tempLow = -999.0;
            private Double voltHigh = -999.0;
            private Double voltLow = -999.0;
            private Integer rippleHigh = -999;       // mV (1mV unit, integer per R102)
            private Double rfOutputHigh = -999.0;
            private Double rfOutputLow  = -999.0;
        }

        // RF loading & pilot freq/pwr (R102 0x1A ~ 0x24). -999 / -999.0 = 尚未取得資料.
        @Data
        public static class LoadingPilot {
            private Integer fwdLoadingLowFreq  = -999;     // MHz   (range 258 ~ 1794)
            private Integer fwdLoadingHighFreq = -999;     // MHz   (range 258 ~ 1794)
            private Double  fwdLoadingPwrLow   = -999.0;   // dBmV  (range 20.0 ~ 54.0)
            private Double  fwdLoadingPwrHigh  = -999.0;   // dBmV  (range 20.0 ~ 54.0)
            private Integer fwdPilotLowFreq    = -999;     // MHz   (range 261 ~ 1791)
            private Integer fwdPilotHighFreq   = -999;     // MHz   (range 261 ~ 1791)
        }

        @Data
        public static class SystemConfig {
            private Integer logIntervalMin = -999;
            // DFU type (R102 0x16) + ALSC / FWD AGC Mode (R102 0x18) + Setting Mode (R102 0x17). -999 = 尚未取得資料.
            private Integer dfuType     = -999;
            private Integer alsc        = -999;
            private Integer settingMode = -999;     // 0 = Bandwidth Pilot, 1 = User Pilot, 3 = Bench
        }

        // Alarm Status Mask (R102 0x28~0x32). 0 = Mask OFF, 1 = Mask ON. -999 = 尚未取得資料.
        @Data
        public static class AlarmMasks {
            private Integer temperature    = -999;
            private Integer volt24v        = -999;
            private Integer volt24vRipple  = -999;
            private Integer rfOutTotal     = -999;
            private Integer pilotLowFreq   = -999;
            private Integer pilotHighFreq  = -999;
            private Integer tampSwitch     = -999;
        }
    }

    @Data
    public static class LatestStatus {
        private LocalDateTime updatedAt;
        private String unitStatus = "waiting...";
        private Measurements measurements = new Measurements();
        private ActiveAlarms activeAlarms = new ActiveAlarms();
        private Integer workingMode = -999;
        private Integer dfuType     = -999;

        @Data
        public static class Measurements {
            private Double temperature = -999.0;
            private Double voltage = -999.0;
            private Integer ripple = -999;
            private Double rfOutputPower = -999.0;
            private Double pilotLowPwr = -999.0;
            private Double pilotHighPwr = -999.0;
        }

        @Data
        public static class ActiveAlarms {
            private Boolean isTempAlarm = false;
            private Boolean isVoltageAlarm = false;
            private Boolean isRippleAlarm = false;
            private Boolean isRfPowerAlarm = false;
        }
    }
}