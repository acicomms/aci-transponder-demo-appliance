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
    private String transponderStatus = "offline"; // transponder LoRaWAN reachability: online / offline
    private LocalDateTime lastAmpDataAt;          // last amp status frame decode time (UTC)
    private Integer ampOfflineMin = 6;            // per-device amp-freshness offline threshold (minutes)
    private Integer transponderOfflineMin = 10;   // per-device transponder offline threshold (minutes)
    private String latitude;   // Device-reported coordinates (Model frame byte 69~107)
    private String longitude;  // Device-reported coordinates (Model frame byte 69~107)

    private BasicInfo basicInfo = new BasicInfo();
    private Settings settings = new Settings();
    private LatestStatus latestStatus = new LatestStatus();

    @Data
    public static class BasicInfo {

        private String partName = "data sync...";
        private String partNumber = "data sync...";
        private String serialNumber = "data sync...";
        private String hwVersion = "data sync...";   // Hardware Version (Model frame byte 56~59)
        private String fwVersion = "data sync...";
        private String mfgDate = "data sync...";      // Manufactured date (Model frame byte 64~67)
    }

    @Data
    public static class Settings {
        private Alarms alarms = new Alarms();
        private SystemConfig system = new SystemConfig();
        private LoadingPilot loadingPilot = new LoadingPilot();
        private AlarmMasks alarmMasks = new AlarmMasks();
        private BenchMode benchMode = new BenchMode();

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

        // Bench Mode PAD/EQ readback (R102 0x94~0xAE, status byte 148~174). -999.0 = not yet synced.
        @Data
        public static class BenchMode {
            private Double port1FwdInputPad   = -999.0;   // byte 148  Port 1 FWD Input PAD
            private Double port1FwdInputEq    = -999.0;   // byte 150  Port 1 FWD Input EQ
            private Double portNFwdOutputPad1 = -999.0;   // byte 162  FWD Output PAD group 1
            private Double portNFwdOutputPad2 = -999.0;   // byte 170  FWD Output PAD group 2
            private Double portNFwdOutputEq1  = -999.0;   // byte 172  FWD Output EQ group 1
            private Double portNFwdOutputEq2  = -999.0;   // byte 174  FWD Output EQ group 2
            private Double portNRevInputPad1  = -999.0;   // byte 156  REV Input PAD group 1
            private Double portNRevInputPad2  = -999.0;   // byte 166  REV Input PAD group 2
            private Double portNRevInputPad3  = -999.0;   // byte 168  REV Input PAD group 3
            private Double port1RevOutputEq   = -999.0;   // byte 158  Port 1 REV Output EQ
            private Double port1RevOutputPad  = -999.0;   // byte 164  Port 1 REV Output PAD
        }

        @Data
        public static class SystemConfig {
            private Integer logIntervalMin = -999;
            // DFU type (R102 0x16) + ALSC / FWD AGC Mode (R102 0x18) + Setting Mode (R102 0x17). -999 = 尚未取得資料.
            private Integer dfuType     = -999;
            private Integer alsc        = -999;
            private Integer settingMode = -999;     // 0 = Bandwidth Pilot, 1 = User Pilot, 3 = Bench
            private String  locationAddress = "";    // Device-reported address (settings frame byte 51~146, UTF-16)
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