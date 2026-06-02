package com.example.demo.service;

import com.example.demo.model.DeviceConfigLog;
import com.example.demo.model.DeviceEntity;
import com.example.demo.model.DeviceSpectrumLog;
import com.example.demo.model.DeviceStatusLog;
import com.example.demo.repository.DeviceConfigLogRepository;
import com.example.demo.repository.DeviceRepository;
import com.example.demo.repository.DeviceSpectrumLogRepository;
import com.example.demo.repository.DeviceStatusLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.demo.model.RawPayloadLog;
import com.example.demo.repository.RawPayloadLogRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

@Service
public class DevicePayloadDecoder {
    /************************ 儲存rawdata******************************* */
    @Autowired(required = false)
    private RawPayloadLogRepository rawPayloadLogRepository;
    /************************ 儲存parse data**************************** */
    @Autowired(required = false)
    private DeviceSpectrumLogRepository spectrumLogRepository;

    @Autowired(required = false)
    private DeviceConfigLogRepository configLogRepository;

    private final ObjectMapper objectMapper = new ObjectMapper(); 
    /******************************************************* */

    @Autowired(required = false)
    private DeviceRepository deviceRepository;

    @Autowired(required = false)
    private DeviceStatusLogRepository statusLogRepository;

    @Autowired(required = false)
    private MonitoringService monitoringService;

    @Autowired(required = false)
    private TelegramAlertIntegrationService telegramAlertService;

    @Autowired(required = false)
    private AlarmEventService alarmEventService;

    // RF Test Session — optional; only present when feature is wired. Hook
    // below in decodeAndSave forwards every uplink so RTT/match stats work.
    @Autowired(required = false)
    private RfTestSessionService rfTestSessionService;

    /**
     * 0x08 0x02 0x12 標頭 並進行 COBS 解碼
     */
    public void decodeAndSave(String devEui, String deviceName, String deviceProfileName, String deviceClassEnabled,
            String gatewayId, Integer fCnt, Long frequency, Integer spreadingFactor,
                              Integer rssi, Double snr, Double gwLat, Double gwLon,
                              byte[] payloadBytes, String rawJsonPayload) {
        try {

            if (rfTestSessionService != null) {
                rfTestSessionService.recordUplink(devEui, System.currentTimeMillis(), rssi);
            }

            // ==========================================
            // 直接印出設備回傳的原始 Hex 碼
            // ==========================================
            String rawHex = bytesToHex(payloadBytes);
            System.out.println(" [DEBUG] 收到設備 " + devEui + " 的原始 Payload (Hex): " +
                    rawHex);

            // 尋找 Transponder 回傳封包的固定標記: 0x08, 0x02, 0x12
            int cobsStart = -1;
            int cobsLen = 0;
            for (int i = 0; i < payloadBytes.length - 2; i++) {
                if (payloadBytes[i] == 0x08 && payloadBytes[i + 1] == 0x02 && payloadBytes[i + 2] == 0x12) {
                    i += 3; // 跳過標記
                    // 讀取 Varint 格式的長度
                    int len = 0;
                    int shift = 0;
                    while (i < payloadBytes.length) {
                        byte b = payloadBytes[i++];
                        len |= (b & 0x7F) << shift;
                        if ((b & 0x80) == 0)
                            break;
                        shift += 7;
                    }
                    cobsStart = i;
                    cobsLen = len;
                    break;
                }
            }

            // ==========================================
            // 無條件儲存所有原始 Payload
            // ==========================================
            if (rawPayloadLogRepository != null) {
                RawPayloadLog rawLog = new RawPayloadLog();
                rawLog.setDevEui(devEui);
                rawLog.setFCnt(fCnt);
                rawLog.setRawHex(rawHex);
                rawLog.setRawJson(rawJsonPayload);

                rawPayloadLogRepository.save(rawLog);
                System.out.println(" 已將原始封包存入 raw_payload_logs (Fcnt: " + fCnt + ")");
            }

            if (cobsStart == -1) {
                System.out.println(">>> 找不到封包的特定標記 (0x08 0x02 0x12) 放棄解析");
                return;
            }

            byte[] enc = new byte[cobsLen];
            System.arraycopy(payloadBytes, cobsStart, enc, 0, Math.min(cobsLen, payloadBytes.length - cobsStart));

            byte[] dec = cobsDecode(enc);

            int cmdIdEcho = -1;
            if (payloadBytes.length >= 6) {
                int b5 = payloadBytes[5] & 0xFF;
                int hi = (b5 >> 4) & 0x0F;
                int lo = b5 & 0x0F;
                if (hi == lo && hi >= 1 && hi <= 9) {
                    cmdIdEcho = hi;
                }
            }

            // 頻譜回應 (4001010 4~9): 不再依 dec.length 判定, 直接走 spectrum handler
            if (cmdIdEcho >= 4 && cmdIdEcho <= 9) {
                System.out.println(">>>  偵測到 Spectrum Data (頻譜資料) 封包, cmd: 4001010" + cmdIdEcho + ", 長度: " + dec.length);
                handleSpectrumData(devEui, dec, cmdIdEcho);
                return;
            }

            // 原本的 176 Bytes 長度檢查
            if (dec.length < 176) {
                System.out.println(">>> 解碼後的資料長度 (" + dec.length + ") 小於 176 bytes不符合規格");
                return;
            }

            if (dec.length == 0) {
                System.out.println(">>> 解碼後的資料為空，無法解析");
                return;
            }

            // 更新 devices 主檔
            if (deviceRepository != null) {
                DeviceEntity device = deviceRepository.findById(devEui).orElse(new DeviceEntity());
                device.setDevEui(devEui);
                device.setLastSeenAt(java.time.LocalDateTime.now());

                if (deviceName != null && !deviceName.isEmpty()) {
                    device.setName(deviceName);
                }
                if (gatewayId != null && !gatewayId.isEmpty()) {
                    device.setLastGatewayId(gatewayId);
                }
                if (deviceProfileName != null) {
                    device.setDeviceProfileName(deviceProfileName);
                }
                if (deviceClassEnabled != null) {
                    device.setDeviceClassEnabled(deviceClassEnabled);
                }
                deviceRepository.save(device);
            }

            /*
             * B1 01 6F
             * B1：代表這是一個指令回覆 (Command Response)
             * 01 或 02：代表它是回覆哪一個指令（01 = 基本資訊，02 = 設定參數）
             * 第三個 Byte 6F：是長度或校驗碼
             */
            int headerByte = dec[0] & 0xFF;
            byte[] actualData = dec;
            int packetType = -1;

            // 判斷是否為帶有 B1 表頭的新版硬體格式
            if (headerByte == 0xB1 && dec.length > 3) {
                int cmdType = dec[1] & 0xFF;

                // 切掉前面的3 Bytes表頭 還原真實的 176 Bytes資料
                actualData = java.util.Arrays.copyOfRange(dec, 3, dec.length);

                if (cmdType == 0x01) {
                    packetType = 1; // 40010101 
                } else if (cmdType == 0x02) {
                    packetType = 2; // 40010102 
                }
            }
            // 判斷是否為舊版無表頭格式或Status Data
            /*
             * 第一個 Byte 直接是機器的狀態碼（例如 0x01 正常，或 0x02 警報）
             * 如果 headerByte 不是 B1，程式會進入 else 判斷：
             */
            else {
                if (headerByte == 0x53 || headerByte == 0x41) {
                    // 'S' (SDAT) 或 'A' (AFM) 開頭
                    packetType = 1;
                } else if (headerByte == 1 || headerByte == 2) {
                    // 1=Normal, 2=Alarm
                    packetType = 3;
                } else {
                    // 預設當作設定參數
                    packetType = 2;
                }
            }

            // 根據乾淨的 actualData 進行正確路由
            if (packetType == 1) {
                System.out.println(">>> 偵測到 Model Type (基本資訊) 封包");

                handleModelTypeData(devEui, actualData);
            } else if (packetType == 3) {
                System.out.println(">>>  偵測到 Status Data (即時狀態) 封包");

                handleStatusData(devEui, actualData, gatewayId, fCnt, frequency, spreadingFactor, rssi, snr, gwLat,
                        gwLon, rawJsonPayload);
            } else {
                System.out.println(">>>  偵測到 Setting Data (設定參數) 封包");
                handleSettingData(devEui, actualData);
            }

        } catch (Exception e) {
            System.err.println("Decoder 發生錯誤: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * 解析 0xB0 0x03 0x00 0x00
     */
    private void handleModelTypeData(String devEui, byte[] data) {
        String partName = extractAsciiString(data, 0, 20);
        String partNumber = extractAsciiString(data, 20, 20);
        String serialNumber = extractAsciiString(data, 40, 16);
        String hwVersion = extractAsciiString(data, 56, 4);
        String fwVersion = extractAsciiString(data, 60, 4);

        // 解析製造日期 MFG Date: Byte 64~67
        int year = parseLittleEndianShort(data, 64);
        int month = data[66] & 0xFF;
        int day = data[67] & 0xFF;
        String mfgDate = String.format("%04d-%02d-%02d", year, month, day);

        int partIndex = data[68] & 0xFF;

        // 解析經緯度 Byte 69~107
        String latLonRaw = extractAsciiString(data, 69, 39);

        if (deviceRepository != null) {
            DeviceEntity device = deviceRepository.findById(devEui).orElse(new DeviceEntity());
            device.setDevEui(devEui);
            device.setPartName(partName);
            device.setPartNumber(partNumber);
            device.setSerialNumber(serialNumber);
            device.setHwVersion(hwVersion);
            device.setFwVersion(fwVersion);
            device.setMfgDate(mfgDate);
            device.setPartIndex(partIndex);

            if (latLonRaw != null && latLonRaw.contains(",")) {
                try {
                    String[] parts = latLonRaw.split(",");
                    device.setLatitude(parts[0].trim());
                    device.setLongitude(parts[1].trim());
                } catch (Exception e) {
                    System.err.println("解析設備座標失敗: " + latLonRaw);
                }
            }
            // System.out.println(" 已新增/更新設備基本資訊至 devices 表");
            device.setLastSeenAt(java.time.LocalDateTime.now());
            deviceRepository.save(device);

            // ==========================================
            // 透過 WebSocket 廣播給前端
            // ==========================================
            if (monitoringService != null) {
                Map<String, Object> pushData = new HashMap<>();
                pushData.put("devEui", devEui);
                pushData.put("updateType", "BASIC_INFO_UPDATED");

                // 廣播出去
                monitoringService.sendDeviceUpdate(devEui, pushData);
                // System.out.println(" 已發送 BASIC_INFO_UPDATED 推播");
            }
        }
    }

    /**
     * 解析 0xB0 0x03 0x00 0x90
     */

    private void handleSettingData(String devEui, byte[] data) {
        if (deviceRepository != null) {
            DeviceEntity device = deviceRepository.findById(devEui).orElse(new DeviceEntity());
            device.setDevEui(devEui);

            double tempHighAlarm = parseLittleEndianShort(data, 0) / 10.0;
            double tempLowAlarm = parseLittleEndianShort(data, 2) / 10.0;
            double voltHighAlarm = parseLittleEndianShort(data, 4) / 10.0;
            double voltLowAlarm = parseLittleEndianShort(data, 6) / 10.0;
            double rfOutHighAlarm = parseLittleEndianShort(data, 10) / 10.0;
            int sysLogInterval = data[147] & 0xFF;

            // 警報門檻
            device.setTempHighAlarm(parseLittleEndianShort(data, 0) / 10.0);
            device.setTempLowAlarm(parseLittleEndianShort(data, 2) / 10.0);
            device.setVoltHighAlarm(parseLittleEndianShort(data, 4) / 10.0);
            device.setVoltLowAlarm(parseLittleEndianShort(data, 6) / 10.0);
            device.setRippleHighAlarm((int) parseLittleEndianShort(data, 8)); // mV
            device.setRfOutputHighAlarm(parseLittleEndianShort(data, 10) / 10.0);
            device.setRfOutputLowAlarm(parseLittleEndianShort(data, 12) / 10.0);

            // 進階系統設定
            device.setRtnIngress1(data[16] & 0xFF);
            device.setRtnIngress2(data[17] & 0xFF);
            device.setRtnIngress3(data[18] & 0xFF);
            device.setFwdEceqIndex(data[19] & 0xFF);
            device.setRfOutputLogMin(data[20] & 0xFF);
            device.setDfuTypeSetting(data[22] & 0xFF);
            device.setSettingMode(data[23] & 0xFF);
            device.setFwdAgcMode(data[24] & 0xFF);

            // 頻率與功率設定
            device.setFwdLoadingLowFreq((int) parseLittleEndianShort(data, 26));
            device.setFwdLoadingHighFreq((int) parseLittleEndianShort(data, 28));
            device.setFwdLoadingPwrLow(parseLittleEndianShort(data, 30) / 10.0);
            device.setFwdLoadingPwrHigh(parseLittleEndianShort(data, 32) / 10.0);
            device.setFwdPilotLowFreq((int) parseLittleEndianShort(data, 34));
            device.setFwdPilotHighFreq((int) parseLittleEndianShort(data, 36));

            // Status Mask
            device.setMaskRfOutPilotLow(data[40] & 0xFF);
            device.setMaskRfOutPilotHigh(data[41] & 0xFF);
            device.setMaskTemp(data[42] & 0xFF);
            device.setMask24v(data[43] & 0xFF);
            device.setMaskTampSwitch(data[48] & 0xFF);  // R102 0x30 = Tamp Switch (非 DFU Type)
            device.setMaskRipple(data[49] & 0xFF);
            device.setMaskRfOutPwr(data[50] & 0xFF);

            // UTF-16 地址與系統 Log
            device.setLocationAddress(readUtf16LeString(data, 51, 96));
            device.setLogIntervalMin(data[147] & 0xFF);

            // PAD 與 EQ (注意單位都是 0.1dB)
            device.setPort1FwdInputPad(parseLittleEndianShort(data, 148) / 10.0);
            device.setPort1FwdInputEq(parseLittleEndianShort(data, 150) / 10.0);
            device.setPortNRevInputPad1(parseLittleEndianShort(data, 156) / 10.0);
            device.setPort1RevOutputEq(parseLittleEndianShort(data, 158) / 10.0);
            device.setPortNFwdOutputPad1(parseLittleEndianShort(data, 162) / 10.0);
            device.setPort1RevOutputPad(parseLittleEndianShort(data, 164) / 10.0);
            device.setPortNRevInputPad2(parseLittleEndianShort(data, 166) / 10.0);
            device.setPortNRevInputPad3(parseLittleEndianShort(data, 168) / 10.0);
            device.setPortNFwdOutputPad2(parseLittleEndianShort(data, 170) / 10.0);
            device.setPortNFwdOutputEq1(parseLittleEndianShort(data, 172) / 10.0);
            device.setPortNFwdOutputEq2(parseLittleEndianShort(data, 174) / 10.0);

            device.setLastSeenAt(java.time.LocalDateTime.now());
            deviceRepository.save(device);

            // 儲存設定變更歷史
            if (configLogRepository != null) {
                try {
                    Map<String, Object> configData = new HashMap<>();
                    configData.put("tempHighAlarm", tempHighAlarm);
                    configData.put("tempLowAlarm", tempLowAlarm);
                    configData.put("voltHighAlarm", voltHighAlarm);
                    configData.put("voltLowAlarm", voltLowAlarm);
                    configData.put("rfOutHighAlarm", rfOutHighAlarm);
                    configData.put("sysLogInterval", sysLogInterval);

                    DeviceConfigLog log = new DeviceConfigLog();
                    log.setDevEui(devEui);
                    log.setLogType("SETTINGS_02");
                    log.setConfigDataJson(objectMapper.writeValueAsString(configData));
                    configLogRepository.save(log);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            } // 在這裡提早關閉 configLogRepository 的判斷

            // ==========================================
            // 透過 WebSocket 廣播給前端
            // ==========================================
            if (monitoringService != null) {
                Map<String, Object> pushData = new HashMap<>();
                pushData.put("devEui", devEui);
                pushData.put("updateType", "SETTINGS_UPDATED");

                // 廣播出去
                monitoringService.sendDeviceUpdate(devEui, pushData);
            }
        } // 關閉 deviceRepository 的判斷

    }

    /**
     * 解析 0xB0 0x03 0x00 0xA0 
     */
    private void handleStatusData(String devEui, byte[] data, String gatewayId, Integer fCnt, Long frequency,
            Integer spreadingFactor, Integer rssi, Double snr, Double gwLat, Double gwLon,
            String rawJsonPayload) {

        int unitStatus = data[0] & 0xFF;
        double temperature = parseLittleEndianShort(data, 1) / 10.0;
        double voltage = parseLittleEndianShort(data, 3) / 10.0;
        int ripple = parseLittleEndianShort(data, 5);
        double rfOutputPower = parseLittleEndianShort(data, 17) / 10.0;
        double pilotLowPwr = parseLittleEndianShort(data, 89) / 10.0;
        double pilotHighPwr = parseLittleEndianShort(data, 91) / 10.0;

        if (statusLogRepository != null) {
            DeviceStatusLog log = new DeviceStatusLog();
            log.setDevEui(devEui);

            // 基本數據
            log.setUnitStatus(unitStatus);
            log.setTemperature(temperature);
            log.setVoltage(voltage);
            log.setRipple(ripple);
            log.setRfOutputPower(rfOutputPower);

            // 運作模式與功率
            log.setWorkingMode(data[67] & 0xFF);
            log.setDfuType(data[68] & 0xFF);
            log.setPilotLowPwr(parseLittleEndianShort(data, 89) / 10.0);
            log.setPilotHighPwr(parseLittleEndianShort(data, 91) / 10.0);
            log.setOutputSlope(parseLittleEndianShort(data, 93) / 10.0);
            log.setUserPilotLowPwr(parseLittleEndianShort(data, 95) / 10.0);
            log.setUserPilotHighPwr(parseLittleEndianShort(data, 97) / 10.0);
            log.setLowPilotFreq((int) parseLittleEndianShort(data, 99));
            log.setHighPilotFreq((int) parseLittleEndianShort(data, 101));
            log.setCeqIndexStatus(data[134] & 0xFF);

            // 細節警報
            log.setRfLowFreqUnlockStatus(data[123] & 0xFF);
            log.setRfHighFreqUnlockStatus(data[124] & 0xFF);
            log.setTempAlarmStatus(data[125] & 0xFF);
            log.setVoltAlarmStatus(data[126] & 0xFF);
            log.setRippleAlarmStatus(data[132] & 0xFF);
            log.setTcpAlarmStatus(data[133] & 0xFF);

            // 網路資訊與 Payload
            log.setGatewayId(gatewayId);
            log.setFCnt(fCnt);
            log.setFrequency(frequency);
            log.setSpreadingFactor(spreadingFactor);
            log.setRssi(rssi);
            log.setSnr(snr);
            log.setGwLatitude(gwLat);
            log.setGwLongitude(gwLon);
            log.setChirpstackPayload(rawJsonPayload);
            log.setRawData(bytesToHex(data));

            statusLogRepository.save(log);
            // System.out.println(" 已成功將豐富的設備狀態寫入 device_status_logs 表");
        }

        // ==========================================
        // Alarm 事件跳變偵測 (寫入 alarm_events 表)
        // 跟 statusLog 寫入並列, 跟舊 unitStatus alarm 機制並列, 互不影響
        // ==========================================
        if (alarmEventService != null) {
            try {
                alarmEventService.recordTransition(devEui, "TEMPERATURE",
                        data[125] & 0xFF, temperature);
                alarmEventService.recordTransition(devEui, "VOLTAGE",
                        data[126] & 0xFF, voltage);
                alarmEventService.recordTransition(devEui, "RIPPLE",
                        data[132] & 0xFF, (double) ripple);
                alarmEventService.recordTransition(devEui, "TCP",
                        data[133] & 0xFF, rfOutputPower);
                // UNIT_STATUS: data[0] (1=Normal, 2=Alarm).
                // firmware 目前只填 data[0], 細分 byte 全 0; 用 UNIT_STATUS 作為
                // overall alarm 訊號寫入 alarm_events. 將來 firmware 補上細分 byte
                // 後, 上面 4 行細分 recordTransition 會自動運作.
                alarmEventService.recordTransition(devEui, "UNIT_STATUS",
                        unitStatus == 2 ? 1 : 0, (double) unitStatus);
            } catch (Exception e) {
                System.err.println(" 寫入 alarm_events 失敗 (不影響主流程): " + e.getMessage());
            }
        }

        // ==========================================
        // 更新設備主檔 (devices 表)
        // ==========================================
        if (deviceRepository != null) {
            // 先把舊資料拿出來看
            DeviceEntity device = deviceRepository.findById(devEui).orElse(new DeviceEntity());

            // 假設原先資料庫裡紀錄的 unitStatus 1=Normal, 其他為 Alarm (null 視為 Normal)
            boolean wasAlarm = (device.getUnitStatus() != null && device.getUnitStatus() != 1);
            boolean isNowAlarm = (unitStatus != 1);

            // 更新資料庫的最新狀態
            device.setDevEui(devEui);
            device.setUnitStatus(unitStatus);
            device.setLastSeenAt(java.time.LocalDateTime.now());

            // ==========================================
            // 同時發送websocket 和 telegram
            // ==========================================
            if (wasAlarm != isNowAlarm) {
                if (isNowAlarm) {
                    // 觸發 Telegram 遠端廣播
                    if (telegramAlertService != null) {
                        String devName = device.getName() != null ? device.getName() : devEui;
                        // 將解碼出來的真實數據放進去
                        String alarmMsg = String.format("硬體狀態異常 (代碼: %d) | 溫度: %.1f°C | 電壓: %.1fV",
                                unitStatus, temperature, voltage);
                        telegramAlertService.sendSimpleAlarmToTelegram(devEui, devName, alarmMsg);
                    }

                } else {
                    // 如果希望警報解除也發 Telegram 可以寫在這裡 並把Type改為INFO

                }

                // 發送推播給前端 Header
                if (monitoringService != null) {
                    String timestamp = java.time.Instant.now().toString();
                    String devName = device.getName() != null ? device.getName() : devEui;

                    monitoringService.sendGlobalAlarmUpdate(devEui, isNowAlarm, devName, timestamp);

                    if (isNowAlarm) {
                        System.out.println("觸發全域警報: 設備 " + devEui + " 發生異常！");
                    } else {
                        System.out.println("警報解除: 設備 " + devEui + " 恢復正常！");
                    }
                }
            }

            deviceRepository.save(device);
        }

        // 將單一設備 的 即時數據推播給前端
        if (monitoringService != null) {
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("devEui", devEui);
            pushData.put("updateType", "TELEMETRY_UPDATED");
            pushData.put("timestamp", java.time.Instant.now().toString());
            pushData.put("unitStatus", unitStatus == 1 ? "Normal" : "Alarm");

            // 組合 measurements 讓前端 RealTimeDashboard 解析
            Map<String, Object> measurements = new HashMap<>();
            measurements.put("temperature", temperature);
            measurements.put("voltage", voltage);
            measurements.put("ripple", ripple);
            measurements.put("rfOutputPower", rfOutputPower);
            measurements.put("pilotLowPwr", pilotLowPwr);
            measurements.put("pilotHighPwr", pilotHighPwr);

            pushData.put("measurements", measurements);

            monitoringService.sendDeviceUpdate(devEui, pushData);
            System.out.println(" 已發送 TELEMETRY_UPDATED 即時狀態推播給設備: " + devEui);
        }

    }

    // ==========================================
    // 輔助工具
    // ==========================================
      /**
     * 將 byte 陣列轉為容易閱讀的 Hex 字串
     */
    private String bytesToHex(byte[] bytes) {
        if (bytes == null || bytes.length == 0)
            return "空封包";
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString().trim();
    }


    // UTF-16的輔助方法
    private String readUtf16LeString(byte[] arr, int offset, int length) {
        int actualLength = 0;
        for (int i = 0; i < length; i += 2) {
            if (offset + i + 1 >= arr.length)
                break;
            if (arr[offset + i] == 0 && arr[offset + i + 1] == 0)
                break;
            actualLength += 2;
        }
        return new String(arr, offset, actualLength, StandardCharsets.UTF_16LE).trim();
    }

    /**
     * COBS 解碼
     */
    private byte[] cobsDecode(byte[] encoded) {
        ByteArrayOutputStream decoded = new ByteArrayOutputStream();
        int idx = 0;
        while (idx < encoded.length) {
            int code = encoded[idx++] & 0xFF;
            if (code == 0)
                break;
            for (int j = 1; j < code; j++) {
                if (idx < encoded.length) {
                    decoded.write(encoded[idx++]);
                }
            }
            if (idx < encoded.length && code != 0xFF) {
                decoded.write(0x00);
            }
        }
        return decoded.toByteArray();
    }

    /**
     * LittleEndian
     */
    private short parseLittleEndianShort(byte[] data, int index) {
        if (index + 1 >= data.length)
            return 0;
        return (short) ((data[index] & 0xFF) | ((data[index + 1] & 0xFF) << 8));
    }

    /**
     * AsciiString
     */
    private String extractAsciiString(byte[] data, int startIndex, int length) {
        if (startIndex + length > data.length)
            return "N/A";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) {
            if (data[startIndex + i] == 0)
                break;
            sb.append((char) data[startIndex + i]);
        }
        return sb.toString().trim();
    }

    /**
     * 解析頻譜回傳資料 (cmd 4~9).
     * cmdId 用於 log 顯示來源指令; data.length input ~180 / output ~188.
     */
    private void handleSpectrumData(String devEui, byte[] data, int cmdId) {
        if (monitoringService == null)
            return;

        // 將 Byte Array 轉為 Double 陣列
        //每 2 Bytes一個數值  Little-Endian並除以 10
        int points = data.length / 2;
        java.util.List<Double> powerValues = new java.util.ArrayList<>();

        for (int i = 0; i < points; i++) {
            double power = parseLittleEndianShort(data, i * 2) / 10.0;
            powerValues.add(power);
        }

        Map<String, Object> pushData = new HashMap<>();
        pushData.put("devEui", devEui);
        pushData.put("updateType", "SPECTRUM_RAW");
        pushData.put("powerValues", powerValues); // 前端會收到這個 Array

        monitoringService.sendDeviceUpdate(devEui, pushData);

        System.out.println(" [RF 頻譜數值 - 4001010" + cmdId + " 的回傳]: " + powerValues.toString());


        // 解析後的RF頻譜陣列歷史存檔
        if (spectrumLogRepository != null) {
            try {
                DeviceSpectrumLog log = new DeviceSpectrumLog();
                log.setDevEui(devEui);
                // 將 List<Double> 轉換為 JSON 字串
                log.setPowerValuesJson(objectMapper.writeValueAsString(powerValues));
                spectrumLogRepository.save(log);
                System.out.println("已將解析後的頻譜資料存入 device_spectrum_logs");
            } catch (Exception e) {
                System.err.println("儲存頻譜歷史紀錄失敗: " + e.getMessage());
            }
        }

    }

}