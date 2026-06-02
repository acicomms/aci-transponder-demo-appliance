package com.example.demo.service;

import com.example.demo.dto.DeviceConfigDto;
import com.example.demo.model.DeviceEntity;
import com.example.demo.model.DeviceStatusLog;
import com.example.demo.repository.DeviceRepository;
import com.example.demo.repository.DeviceStatusLogRepository;
import com.google.protobuf.ByteString;
import io.chirpstack.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import com.example.demo.dto.DeviceDetailResponseDto;
import com.example.demo.model.DeviceHealthStatus;
import com.example.demo.service.CobsCodec;
import java.util.concurrent.ConcurrentHashMap;

import com.google.protobuf.Timestamp;
import org.springframework.beans.factory.annotation.Value;
import io.chirpstack.api.FlushDeviceQueueRequest;
import io.chirpstack.api.GetDeviceQueueItemsRequest;
import io.chirpstack.api.GetDeviceQueueItemsResponse;
import com.example.demo.dto.LinkMetricsResponseDTO;
import java.util.stream.Collectors;

@Service
public class DeviceService {

    @Autowired
    private DeviceServiceGrpc.DeviceServiceBlockingStub deviceStub;

    @Autowired
    private DeviceProfileServiceGrpc.DeviceProfileServiceBlockingStub deviceProfileStub;

    @Value("${chirpstack.tenant-id}")
    private String tenantId;

    @Autowired
    private DeviceStatusLogRepository statusLogRepository;

    @Autowired
    private DeviceRepository deviceRepository;

    private final DateTimeFormatter isoFormatter = DateTimeFormatter.ISO_INSTANT;

    // 紀錄 DevEUI -> 上次請求同步的 Timestamp
    private final ConcurrentHashMap<String, Long> syncCooldownMap = new ConcurrentHashMap<>();
    private static final long COOLDOWN_MS = 1 * 60 * 1000; // 1 分鐘冷卻時間

    // Manual sync cooldown (per-target). Covers one full downlink+response cycle (~8-10s).
    private static final long MANUAL_SYNC_COOLDOWN_MS = 10 * 1000;

    // 讀取 application.yml 中的過渡期開關 預設為 false 比較安全
    @Value("${iot.workaround.enable-flush-queue:false}")
    private boolean enableFlushQueueWorkaround;

    public DeviceDetailResponseDto getDeviceAggregatedDetail(String devEui) {
        DeviceDetailResponseDto response = new DeviceDetailResponseDto();
        response.setDevEui(devEui);

        // 用來精準判斷缺什麼資料
        boolean missingBasicInfo = false;
        boolean missingSettings = false;

        Optional<DeviceEntity> deviceOpt = deviceRepository.findById(devEui);
        if (deviceOpt.isPresent()) {
            DeviceEntity device = deviceOpt.get();
            response.setName(device.getName() != null ? device.getName() : "未命名");
            response.setLastSeenAt(device.getLastSeenAt());

            // healthStatus: 統一用 enum 計算 (5min/10min 門檻)
            response.setHealthStatus(
                    DeviceHealthStatus.compute(device.getLastSeenAt(), device.getUnitStatus()).toJsonValue()
            );

            // 檢查是否缺少基本資訊
            if (device.getPartName() != null) {
                response.getBasicInfo().setPartName(device.getPartName());
                response.getBasicInfo().setPartNumber(device.getPartNumber());
                response.getBasicInfo().setSerialNumber(device.getSerialNumber());
                response.getBasicInfo().setFwVersion(device.getFwVersion());
            } else {
                missingBasicInfo = true;
            }

            // 檢查是否缺少設定參數
            if (device.getTempHighAlarm() != null) {
                response.getSettings().getAlarms().setTempHigh(device.getTempHighAlarm());
                response.getSettings().getAlarms().setTempLow(device.getTempLowAlarm());
                response.getSettings().getAlarms().setVoltHigh(device.getVoltHighAlarm());
                response.getSettings().getAlarms().setVoltLow(device.getVoltLowAlarm());
                response.getSettings().getAlarms().setRippleHigh(device.getRippleHighAlarm());
                response.getSettings().getAlarms().setRfOutputHigh(device.getRfOutputHighAlarm());
                response.getSettings().getAlarms().setRfOutputLow(device.getRfOutputLowAlarm());
                response.getSettings().getSystem().setLogIntervalMin(device.getLogIntervalMin());
                // DFU type + ALSC + Setting Mode initial-fill (entity 已由 SETTINGS_02 解析填入)
                response.getSettings().getSystem().setDfuType(device.getDfuTypeSetting());
                response.getSettings().getSystem().setAlsc(device.getFwdAgcMode());
                response.getSettings().getSystem().setSettingMode(device.getSettingMode());
                // RF loading & pilot freq/pwr initial-fill (entity 已由 SETTINGS_02 解析填入)
                response.getSettings().getLoadingPilot().setFwdLoadingLowFreq(device.getFwdLoadingLowFreq());
                response.getSettings().getLoadingPilot().setFwdLoadingHighFreq(device.getFwdLoadingHighFreq());
                response.getSettings().getLoadingPilot().setFwdLoadingPwrLow(device.getFwdLoadingPwrLow());
                response.getSettings().getLoadingPilot().setFwdLoadingPwrHigh(device.getFwdLoadingPwrHigh());
                response.getSettings().getLoadingPilot().setFwdPilotLowFreq(device.getFwdPilotLowFreq());
                response.getSettings().getLoadingPilot().setFwdPilotHighFreq(device.getFwdPilotHighFreq());
                // Alarm Status Mask initial-fill (entity 已由 SETTINGS_02 解析 byte 40~50 填入)
                response.getSettings().getAlarmMasks().setTemperature(device.getMaskTemp());
                response.getSettings().getAlarmMasks().setVolt24v(device.getMask24v());
                response.getSettings().getAlarmMasks().setVolt24vRipple(device.getMaskRipple());
                response.getSettings().getAlarmMasks().setRfOutTotal(device.getMaskRfOutPwr());
                response.getSettings().getAlarmMasks().setPilotLowFreq(device.getMaskRfOutPilotLow());
                response.getSettings().getAlarmMasks().setPilotHighFreq(device.getMaskRfOutPilotHigh());
                response.getSettings().getAlarmMasks().setTampSwitch(device.getMaskTampSwitch());
            } else {
                missingSettings = true;
            }
        } else {
            // 資料庫沒有這台設備全部都缺
            missingBasicInfo = true;
            missingSettings = true;
        }

        // 撈取 device_status_logs 表的最新一筆狀態
        statusLogRepository.findFirstByDevEuiOrderByCreatedAtDesc(devEui).ifPresent(log -> {
            DeviceDetailResponseDto.LatestStatus latest = response.getLatestStatus();
            latest.setUpdatedAt(log.getCreatedAt());
            latest.setUnitStatus(log.getUnitStatus() != null && log.getUnitStatus() == 1 ? "Normal" : "Alarm");

            latest.getMeasurements().setTemperature(log.getTemperature());
            latest.getMeasurements().setVoltage(log.getVoltage());
            latest.getMeasurements().setRipple(log.getRipple());
            latest.getMeasurements().setRfOutputPower(log.getRfOutputPower());
            latest.getMeasurements().setPilotLowPwr(log.getPilotLowPwr());
            latest.getMeasurements().setPilotHighPwr(log.getPilotHighPwr());
            // 運作狀態 raw Integer (label 由前端 mapping).
            // null (舊 row 沒填) 時保留 DTO 預設 -999, 前端顯示 em dash.
            if (log.getWorkingMode() != null) {
                latest.setWorkingMode(log.getWorkingMode());
            }
            if (log.getDfuType() != null) {
                latest.setDfuType(log.getDfuType());
            }
        });

        // 傳送下一個指令
        if (missingBasicInfo || missingSettings) {
            response.setSyncStatus("SYNCING");
            // 傳入缺少的狀態 讓方法決定要發送哪個指令
            triggerBackgroundSync(devEui, missingBasicInfo, missingSettings);
        }

        return response;
    }

    /**
     * 前端手動觸發的強制 01 / 02 / 03 同步指令
     * 帶 per-target cooldown 檢查 (10s), hit 拋 SyncCooldownException
     * 共用 syncCooldownMap
     */
    public void forceSyncCommand(String devEui, String target) {
        String upper = target == null ? "" : target.toUpperCase();
        String hex;
        switch (upper) {
            case "INFO":     hex = "40010101"; break;
            case "SETTINGS": hex = "40010102"; break;
            case "STATUS":   hex = "40010103"; break;
            default: throw new IllegalArgumentException("未知的同步目標: " + target);
        }

        String key = devEui + "_" + upper;
        long now = System.currentTimeMillis();
        long lastSent = syncCooldownMap.getOrDefault(key, 0L);
        long elapsed = now - lastSent;
        if (elapsed < MANUAL_SYNC_COOLDOWN_MS) {
            long remainingSec = (MANUAL_SYNC_COOLDOWN_MS - elapsed + 999) / 1000;
            throw new SyncCooldownException(upper, remainingSec);
        }

        syncCooldownMap.put(key, now);
        System.out.println(" [手動同步] 請求設備 " + devEui + " " + upper + " (" + hex + ")");
        enqueueDownlink(devEui, 10, hex, 60); // 1 分鐘過期
    }

    /**
     * Per-target manual sync cooldown hit時拋出, controller 翻成 HTTP 429
     */
    public static class SyncCooldownException extends RuntimeException {
        private final String target;
        private final long retryAfterSeconds;

        public SyncCooldownException(String target, long retryAfterSeconds) {
            super("Sync cooldown active for " + target + ", retry after " + retryAfterSeconds + "s");
            this.target = target;
            this.retryAfterSeconds = retryAfterSeconds;
        }

        public String getTarget() { return target; }
        public long getRetryAfterSeconds() { return retryAfterSeconds; }
    }


    /**
     * 背景同步01和02指令 
     */
    private void triggerBackgroundSync(String devEui, boolean missingBasicInfo, boolean missingSettings) {
        long now = System.currentTimeMillis();

        try {
            
            if (missingBasicInfo) {
                long lastSyncInfo = syncCooldownMap.getOrDefault(devEui + "_INFO", 0L);
                if (now - lastSyncInfo >= 30 * 1000) {
                    syncCooldownMap.put(devEui + "_INFO", now);
                    System.out.println(" [背景同步] 發現設備 " + devEui + " 缺基本資訊，下發 40010101...");
                    enqueueDownlink(devEui, 10, "40010101", 120); // 過期指令
                }
            }

            if (missingSettings) {
                long lastSyncSettings = syncCooldownMap.getOrDefault(devEui + "_SETTINGS", 0L);
                if (now - lastSyncSettings >= 30 * 1000) {
                    syncCooldownMap.put(devEui + "_SETTINGS", now);
                    System.out.println(" [背景同步] 發現設備 " + devEui + " 缺設定參數，下發 40010102...");
                    enqueueDownlink(devEui, 10, "40010102", 120); // 過期指令
                }
            }
        } catch (Exception e) {
            System.err.println(" 背景下發請求指令失敗: " + e.getMessage());
        }
    }

    /**
     * 啟動即時監控 (單發觸發 Middleware 輪詢)
     * 發送 40010103 指令給設備
     */
    public void startRealTimeMonitor(String devEui) {
        try {
           
            String messageId = enqueueDownlink(devEui, 10, "40010103", 60); // 1分鐘過期

        } catch (Exception e) {
            System.err.println(" 啟動即時監控失敗: " + e.getMessage());
            throw new RuntimeException("無法下發監控指令", e);
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }

    public List<Map<String, Object>> listDeviceProfilesForTenant() {
        ListDeviceProfilesRequest req = ListDeviceProfilesRequest.newBuilder()
                .setTenantId(tenantId)
                .setLimit(100)
                .build();
        ListDeviceProfilesResponse resp = deviceProfileStub.list(req);

        List<Map<String, Object>> result = new ArrayList<>();
        for (DeviceProfileListItem item : resp.getResultList()) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", item.getId());
            map.put("name", item.getName());
            map.put("region", item.getRegion().name());          // enum -> string e.g. "US915"
            map.put("macVersion", item.getMacVersion().name());  // enum -> string e.g. "LORAWAN_1_0_3"
            map.put("supportsOtaa", item.getSupportsOtaa());
            map.put("supportsClassC", item.getSupportsClassC());
            result.add(map);
        }
        return result;
    }

    // ==========================================
    // Create Device + DeviceKeys (2段 gRPC, CreateKeys fail then rollback)
    // ==========================================
    public Map<String, Object> createDeviceWithKeys(
            String devEui,
            String name,
            String description,
            String applicationId,
            String deviceProfileId,
            String appKey,
            boolean isDisabled,
            boolean skipFcntCheck) {

        // Create Device
        Device newDevice = Device.newBuilder()
                .setDevEui(devEui)
                .setName(name)
                .setDescription(description != null ? description : "")
                .setApplicationId(applicationId)
                .setDeviceProfileId(deviceProfileId)
                .setIsDisabled(isDisabled)
                .setSkipFcntCheck(skipFcntCheck)
                .build();

        CreateDeviceRequest createReq = CreateDeviceRequest.newBuilder()
                .setDevice(newDevice)
                .build();

        try {
            deviceStub.create(createReq);
        } catch (Exception e) {
            throw new RuntimeException("Create device failed: " + e.getMessage(), e);
        }
        System.out.println(" [Device Create] devEui=" + devEui + ", name=" + name);

        // Create Device Keys
        DeviceKeys keys = DeviceKeys.newBuilder()
                .setDevEui(devEui)
                .setNwkKey(appKey)
                .build();

        CreateDeviceKeysRequest keysReq = CreateDeviceKeysRequest.newBuilder()
                .setDeviceKeys(keys)
                .build();

        try {
            deviceStub.createKeys(keysReq);
        } catch (Exception e) {
            // Rollback: delete 剛建好的 device, 避免半截狀態
            try {
                deviceStub.delete(DeleteDeviceRequest.newBuilder().setDevEui(devEui).build());
                System.err.println(" [Device Create] CreateKeys failed, rolled back device " + devEui);
            } catch (Exception rollbackEx) {
                System.err.println(" [Device Create] Rollback delete also failed: " + rollbackEx.getMessage());
            }
            throw new RuntimeException("CreateKeys failed (device rolled back): " + e.getMessage(), e);
        }
        System.out.println(" [Device CreateKeys] devEui=" + devEui + " (AppKey -> nwk_key, 1.0.x)");

        Map<String, Object> result = new HashMap<>();
        result.put("devEui", devEui);
        result.put("name", name);
        result.put("applicationId", applicationId);
        result.put("deviceProfileId", deviceProfileId);
        return result;
    }

    // ==========================================
    // Get Device OTAA Keys
    // ==========================================
    public Map<String, Object> getDeviceKeys(String devEui) {
        GetDeviceKeysRequest req = GetDeviceKeysRequest.newBuilder()
                .setDevEui(devEui)
                .build();
        GetDeviceKeysResponse resp = deviceStub.getKeys(req);

        Map<String, Object> result = new HashMap<>();
        result.put("devEui", devEui);
        // 1.0.x: AppKey 對應 nwk_key; app_key / gen_app_key 不暴露 (給前端少一層混淆)
        result.put("appKey", resp.getDeviceKeys().getNwkKey());

        if (resp.hasCreatedAt()) {
            result.put("createdAt", isoFormatter.format(
                    Instant.ofEpochSecond(resp.getCreatedAt().getSeconds(), resp.getCreatedAt().getNanos())));
        } else {
            result.put("createdAt", null);
        }
        if (resp.hasUpdatedAt()) {
            result.put("updatedAt", isoFormatter.format(
                    Instant.ofEpochSecond(resp.getUpdatedAt().getSeconds(), resp.getUpdatedAt().getNanos())));
        } else {
            result.put("updatedAt", null);
        }
        return result;
    }

    // ==========================================
    // Delete Device
    // ==========================================
    public void deleteDevice(String devEui) {
        // ChirpStack
        DeleteDeviceRequest req = DeleteDeviceRequest.newBuilder()
                .setDevEui(devEui)
                .build();
        deviceStub.delete(req);
        System.out.println(" [Device Delete] devEui=" + devEui + " (ChirpStack ok)");

        // NMS DeviceEntity
        try {
            if (deviceRepository.existsById(devEui)) {
                deviceRepository.deleteById(devEui);
                System.out.println(" [Device Delete] devEui=" + devEui + " (NMS DeviceEntity ok)");
            } else {
                System.out.println(" [Device Delete] devEui=" + devEui + " (NMS DeviceEntity 本來就不存在, 略過)");
            }
        } catch (Exception e) {
            // ChirpStack 已刪成功, NMS 端刪失敗不視為 fatal
            System.err.println(" [Device Delete] NMS DeviceEntity 刪除失敗: " + e.getMessage());
        }
    }

    public List<Map<String, Object>> getDevicesByApplication(String applicationId) {
        ListDevicesRequest request = ListDevicesRequest.newBuilder()
                .setApplicationId(applicationId).setLimit(1000).build();
        ListDevicesResponse response = deviceStub.list(request);

        List<Map<String, Object>> result = new ArrayList<>();
        for (DeviceListItem item : response.getResultList()) {
            Map<String, Object> map = new HashMap<>();

            String devEui = item.getDevEui();
            map.put("devEui", devEui);
            map.put("applicationId", applicationId);
            map.put("name", item.getName());
            map.put("description", item.getDescription());

            LocalDateTime lastSeenLdt = null;
            if (item.hasLastSeenAt()) {
                map.put("lastSeen", isoFormatter.format(
                        Instant.ofEpochSecond(item.getLastSeenAt().getSeconds(), item.getLastSeenAt().getNanos())));
                lastSeenLdt = LocalDateTime.ofInstant(
                        Instant.ofEpochSecond(item.getLastSeenAt().getSeconds(), item.getLastSeenAt().getNanos()),
                        ZoneId.systemDefault());
            } else {
                map.put("lastSeen", null);
            }

            // ==========================================
            // 同步到 MySQL  順便讀回 unitStatus 給 healthStatus 用
            // ==========================================
            DeviceEntity deviceEntity = null;
            try {
                deviceEntity = deviceRepository.findById(devEui).orElse(new DeviceEntity());
                deviceEntity.setDevEui(devEui);
                deviceEntity.setName(item.getName());
                if (lastSeenLdt != null) {
                    deviceEntity.setLastSeenAt(lastSeenLdt);
                }
                deviceRepository.save(deviceEntity);
            } catch (Exception e) {
                System.err.println("同步設備 " + devEui + " 到本地資料庫失敗: " + e.getMessage());
            }

            // healthStatus: 跟 map-data / DeviceDetailResponseDto 一致的計算路徑
            LocalDateTime ls = (deviceEntity != null) ? deviceEntity.getLastSeenAt() : lastSeenLdt;
            Integer us = (deviceEntity != null) ? deviceEntity.getUnitStatus() : null;
            map.put("healthStatus",
                    DeviceHealthStatus.compute(ls, us).toJsonValue());

            result.add(map);
        }
        return result;
    }

    public void updateDevice(String devEui, DeviceConfigDto dto) {
        Device current = deviceStub.get(GetDeviceRequest.newBuilder().setDevEui(devEui).build()).getDevice();
        Device.Builder builder = current.toBuilder();

        if (dto.getName() != null)
            builder.setName(dto.getName());
        if (dto.getDescription() != null)
            builder.setDescription(dto.getDescription());
        if (dto.getDeviceProfileId() != null)
            builder.setDeviceProfileId(dto.getDeviceProfileId());
        if (dto.getIsDisabled() != null)
            builder.setIsDisabled(dto.getIsDisabled());
        if (dto.getSkipFcntCheck() != null)
            builder.setSkipFcntCheck(dto.getSkipFcntCheck());

        deviceStub.update(UpdateDeviceRequest.newBuilder().setDevice(builder.build()).build());
    }

    // ==========================================
    // Device Link Metrics
    // ==========================================
    public LinkMetricsResponseDTO getDeviceLinkMetrics(String devEui, String startStr,
                                                       String endStr, String aggStr) {
        Instant startInstant = Instant.parse(startStr);
        Instant endInstant = Instant.parse(endStr);

        Timestamp startTs = Timestamp.newBuilder().setSeconds(startInstant.getEpochSecond())
                .setNanos(startInstant.getNano()).build();
        Timestamp endTs = Timestamp.newBuilder().setSeconds(endInstant.getEpochSecond())
                .setNanos(endInstant.getNano()).build();
        Aggregation aggEnum = Aggregation.valueOf(aggStr.toUpperCase());

        GetDeviceLinkMetricsRequest request = GetDeviceLinkMetricsRequest.newBuilder()
                .setDevEui(devEui)
                .setStart(startTs)
                .setEnd(endTs)
                .setAggregation(aggEnum)
                .build();

        GetDeviceLinkMetricsResponse response = deviceStub.getLinkMetrics(request);

        LinkMetricsResponseDTO dto = new LinkMetricsResponseDTO();
        dto.setRxPackets(mapToLinkMetricSet(response.getRxPackets(), "Received"));
        dto.setGwRssi(mapToLinkMetricSet(response.getGwRssi(), "RSSI"));
        dto.setGwSnr(mapToLinkMetricSet(response.getGwSnr(), "SNR"));
        dto.setRxPacketsPerFreq(mapToLinkMetricSet(response.getRxPacketsPerFreq(), "Received / frequency"));
        dto.setRxPacketsPerDr(mapToLinkMetricSet(response.getRxPacketsPerDr(), "Received / DR"));
        dto.setErrors(mapToLinkMetricSet(response.getErrors(), "Errors"));
        return dto;
    }

    private LinkMetricsResponseDTO.MetricSet mapToLinkMetricSet(Metric metric, String displayName) {
        LinkMetricsResponseDTO.MetricSet set = new LinkMetricsResponseDTO.MetricSet();
        set.setName(displayName);
        set.setKind("ABSOLUTE");
        if (metric == null || metric.getTimestampsCount() == 0) {
            set.setTimestamps(new ArrayList<>());
            set.setDatasets(new ArrayList<>());
            return set;
        }
        set.setTimestamps(metric.getTimestampsList().stream()
                .map(ts -> isoFormatter.format(Instant.ofEpochSecond(ts.getSeconds(), ts.getNanos())))
                .collect(Collectors.toList()));
        // RSSI/SNR 是 float (proto), 用 doubleValue 不丟精度
        set.setDatasets(metric.getDatasetsList().stream().map(ds -> {
            LinkMetricsResponseDTO.MetricDataset datasetDTO = new LinkMetricsResponseDTO.MetricDataset();
            datasetDTO.setLabel(ds.getLabel());
            datasetDTO.setData(ds.getDataList().stream()
                    .map(Float::doubleValue)
                    .collect(Collectors.toList()));
            return datasetDTO;
        }).collect(Collectors.toList()));
        return set;
    }

    /**
     * 清空 Queue 過渡期
     * 避免誤殺正在排隊的頻譜掃描等 需要長時間執行的指令
     */
    private void safeFlushQueue(String devEui) {
    
        if (!enableFlushQueueWorkaround) {
            return;
        }

        try {
            GetDeviceQueueItemsResponse queueResp = deviceStub.getQueue(
                    GetDeviceQueueItemsRequest.newBuilder().setDevEui(devEui).build());

            boolean hasImportantTask = false;

            // 檢查是否有不能被中斷的指令 (例如頻譜 40010104 ~ 40010109)
            for (DeviceQueueItem item : queueResp.getResultList()) {
                String hexCmd = bytesToHex(item.getData().toByteArray()).toUpperCase();

                if (hexCmd.startsWith("40010104") || hexCmd.startsWith("40010105") ||
                        hexCmd.startsWith("40010106") || hexCmd.startsWith("40010107") ||
                        hexCmd.startsWith("40010108") || hexCmd.startsWith("40010109")) {
                    hasImportantTask = true;
                    break;
                }
            }

            // 只有在沒有重要任務時  才執行 Flush
            if (!hasImportantTask) {
                deviceStub.flushQueue(FlushDeviceQueueRequest.newBuilder().setDevEui(devEui).build());
                // System.out.println(" [過渡期機制] 已安全清空設備 " + devEui + " 的積壓 Queue");
            } else {
                System.out.println(" [過渡期保護] 設備 " + devEui + " Queue 內包含頻譜掃描指令 跳過 Flush 動作");
            }

        } catch (Exception e) {
            System.err.println("檢查/清空 Queue 時發生錯誤: " + e.getMessage());
        }
    }

    /**
     * 下發方法升級版 (Expires At 與動態 TTL)
     */
    public String enqueueDownlink(String devEui, int fPort, String hexPayload, long ttlSeconds) {

        // 執行過渡期的智慧清空
        safeFlushQueue(devEui);

        // 執行計算 Expires At (當前時間 + TTL)
        Instant expireInstant = Instant.now().plusSeconds(ttlSeconds);
        Timestamp expiresAt = Timestamp.newBuilder()
                .setSeconds(expireInstant.getEpochSecond())
                .setNanos(expireInstant.getNano())
                .build();

        DeviceQueueItem item = DeviceQueueItem.newBuilder()
                .setDevEui(devEui)
                .setFPort(fPort)
                .setConfirmed(false)
                .setData(ByteString.copyFrom(hexStringToByteArray(hexPayload)))
                .setExpiresAt(expiresAt) // 寫入過期時間
                .build();

        return deviceStub.enqueue(EnqueueDeviceQueueItemRequest.newBuilder().setQueueItem(item).build()).getId();
    }

    /**
     * Raw enqueue — same as enqueueDownlink but bypasses safeFlushQueue.
     */
    public String enqueueDownlinkRaw(String devEui, int fPort, String hexPayload, long ttlSeconds) {

        // safeFlushQueue intentionally skipped — see method javadoc.

        Instant expireInstant = Instant.now().plusSeconds(ttlSeconds);
        Timestamp expiresAt = Timestamp.newBuilder()
                .setSeconds(expireInstant.getEpochSecond())
                .setNanos(expireInstant.getNano())
                .build();

        DeviceQueueItem item = DeviceQueueItem.newBuilder()
                .setDevEui(devEui)
                .setFPort(fPort)
                .setConfirmed(false)
                .setData(ByteString.copyFrom(hexStringToByteArray(hexPayload)))
                .setExpiresAt(expiresAt)
                .build();

        return deviceStub.enqueue(EnqueueDeviceQueueItemRequest.newBuilder().setQueueItem(item).build()).getId();
    }

    private byte[] hexStringToByteArray(String s) {
        int len = s.length();
        byte[] data = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            data[i / 2] = (byte) ((Character.digit(s.charAt(i), 16) << 4) + Character.digit(s.charAt(i + 1), 16));
        }
        return data;
    }

    public List<DeviceStatusLog> getDeviceHistory(String devEui, String startStr, String endStr) {
        DateTimeFormatter formatter = DateTimeFormatter.ISO_DATE_TIME;
        LocalDateTime start = (startStr != null) ? LocalDateTime.parse(startStr, formatter)
                : LocalDateTime.now().minusDays(1);
        LocalDateTime end = (endStr != null) ? LocalDateTime.parse(endStr, formatter) : LocalDateTime.now();
        return statusLogRepository.findByDevEuiAndCreatedAtBetweenOrderByCreatedAtDesc(devEui, start, end);
    }

    /*******************************************************
     * Wrap raw command with COBS + Transponder envelope
     *******************************************************/
    private byte[] wrapEnvelope(byte[] rawCmd) {
        byte[] cobsEncoded = CobsCodec.encode(rawCmd);
        byte[] header = new byte[] { 0x40, 0x01, 0x01, 0x0A, 0x02 };

        byte[] finalPayload = new byte[header.length + cobsEncoded.length + 1];
        System.arraycopy(header, 0, finalPayload, 0, header.length);
        System.arraycopy(cobsEncoded, 0, finalPayload, header.length, cobsEncoded.length);
        finalPayload[finalPayload.length - 1] = 0x00;

        return finalPayload;
    }

    /*******************************************************
     * Generic numeric setting writer
     *******************************************************/
    public void updateNumericSetting(String devEui, SettingDefinition def, double value) {
        int raw = (int) Math.round(value * def.getScale());

        if (raw < def.getMinRaw() || raw > def.getMaxRaw()) {
            double minVal = def.getMinRaw() / (double) def.getScale();
            double maxVal = def.getMaxRaw() / (double) def.getScale();
            throw new IllegalArgumentException(String.format(
                    "Value %.3f out of range for %s [%.3f ~ %.3f]",
                    value, def.getDisplayName(), minVal, maxVal));
        }

        byte[] payload;
        switch (def.getEncoding()) {
            case INT16_LE:
            case UINT16_LE: {
                short raw16 = (short) raw;
                byte lo = (byte) (raw16 & 0xFF);
                byte hi = (byte) ((raw16 >> 8) & 0xFF);
                payload = new byte[] { lo, hi };
                break;
            }
            case UINT8: {
                payload = new byte[] { (byte) (raw & 0xFF) };
                break;
            }
            default:
                throw new IllegalStateException(
                        "Unsupported encoding for " + def.name() + ": " + def.getEncoding());
        }

        byte[] baseCmd = new byte[5 + payload.length];
        baseCmd[0] = (byte) 0xB0;
        baseCmd[1] = 0x10;
        baseCmd[2] = 0x00;
        baseCmd[3] = def.getFrame();
        baseCmd[4] = def.getHexIndex();
        System.arraycopy(payload, 0, baseCmd, 5, payload.length);

        byte[] finalPayload = wrapEnvelope(baseCmd);
        String hexString = bytesToHex(finalPayload);

        System.out.printf(" [SET %s] frame=0x%02X idx=0x%02X value=%.3f raw=%d | Payload: %s%n",
                def.getDisplayName(), def.getFrame(), def.getHexIndex(), value, raw, hexString);

        enqueueDownlink(devEui, 10, hexString, 60);
    }

    /*******************************************************
     * Raw variant of updateNumericSetting.
     *******************************************************/
    public void updateNumericSettingRaw(String devEui, SettingDefinition def, double value) {
        int raw = (int) Math.round(value * def.getScale());

        if (raw < def.getMinRaw() || raw > def.getMaxRaw()) {
            double minVal = def.getMinRaw() / (double) def.getScale();
            double maxVal = def.getMaxRaw() / (double) def.getScale();
            throw new IllegalArgumentException(String.format(
                    "Value %.3f out of range for %s [%.3f ~ %.3f]",
                    value, def.getDisplayName(), minVal, maxVal));
        }

        byte[] payload;
        switch (def.getEncoding()) {
            case INT16_LE:
            case UINT16_LE: {
                short raw16 = (short) raw;
                byte lo = (byte) (raw16 & 0xFF);
                byte hi = (byte) ((raw16 >> 8) & 0xFF);
                payload = new byte[] { lo, hi };
                break;
            }
            case UINT8: {
                payload = new byte[] { (byte) (raw & 0xFF) };
                break;
            }
            default:
                throw new IllegalStateException(
                        "Unsupported encoding for " + def.name() + ": " + def.getEncoding());
        }

        byte[] baseCmd = new byte[5 + payload.length];
        baseCmd[0] = (byte) 0xB0;
        baseCmd[1] = 0x10;
        baseCmd[2] = 0x00;
        baseCmd[3] = def.getFrame();
        baseCmd[4] = def.getHexIndex();
        System.arraycopy(payload, 0, baseCmd, 5, payload.length);

        byte[] finalPayload = wrapEnvelope(baseCmd);
        String hexString = bytesToHex(finalPayload);

        System.out.printf(" [SET-RAW %s] frame=0x%02X idx=0x%02X value=%.3f raw=%d | Payload: %s%n",
                def.getDisplayName(), def.getFrame(), def.getHexIndex(), value, raw, hexString);

        enqueueDownlinkRaw(devEui, 10, hexString, 60);
    }

    /*******************************************************
     * 下行指令 下發device設備座標設定指令 (0xB0 0x10 0x00 0x80 0x45)
     ******************************************************/
    public void updateDeviceLocation(String devEui, Double lat, Double lon) {
        try {
            // 格式化字串並補齊至39Bytes 補空白 0x20
            String coordStr = String.format("%.10f, %.10f", lat, lon);
            // 確保長度精確為 39 bytes
            StringBuilder sb = new StringBuilder(coordStr);
            while (sb.length() < 39) {
                sb.append(" ");
            }
            String finalStr = sb.substring(0, 39);
            byte[] asciiBytes = finalStr.getBytes(java.nio.charset.StandardCharsets.US_ASCII);

            // 組合原始指令: B0 10 00 80 45 + 39 bytes
            byte[] baseCmd = new byte[5 + 39];
            baseCmd[0] = (byte) 0xB0;
            baseCmd[1] = 0x10;
            baseCmd[2] = 0x00;
            baseCmd[3] = (byte) 0x80;
            baseCmd[4] = 0x45;
            System.arraycopy(asciiBytes, 0, baseCmd, 5, 39);

            byte[] finalPayload = wrapEnvelope(baseCmd);

            String hexString = bytesToHex(finalPayload);
            System.out.println(" 準備下發設備座標: " + finalStr + " | Hex: " + hexString);

            enqueueDownlink(devEui, 10, hexString, 120);

            // Fire-and-forget: 不再自動讀回
            System.out.println(" 座標 SET 已下發 (fire-and-forget)");

        } catch (Exception e) {
            System.err.println("下發設備座標失敗: " + e.getMessage());
            throw new RuntimeException("設備座標下發失敗", e);
        }
    }

    /*******************************************************
     * 下發設備地址設定指令 (0xB0 0x10 0x00 0x90 0x33)
     * 格式: UTF-16LE 編碼 補足 96 bytes
     *******************************************************/
    public void updateDeviceAddress(String devEui, String address) {
        try {
            // 轉換為 UTF-16LE 0x32 0x00 ('2')確認為 LittleEndian
            byte[] utf16Bytes = address.getBytes(java.nio.charset.StandardCharsets.UTF_16LE);

            // 準備 96 bytes 容器並預填空白   UTF-16LE 的空白是 0x20 0x00
            byte[] paddedData = new byte[96];
            for (int i = 0; i < 96; i += 2) {
                paddedData[i] = 0x20;
                paddedData[i + 1] = 0x00;
            }

            int lengthToCopy = Math.min(utf16Bytes.length, 96);
            System.arraycopy(utf16Bytes, 0, paddedData, 0, lengthToCopy);

            // 組合原始指令: B0 10 00 90 33 + 96 bytes
            byte[] baseCmd = new byte[5 + 96];
            baseCmd[0] = (byte) 0xB0;
            baseCmd[1] = 0x10;
            baseCmd[2] = 0x00;
            baseCmd[3] = (byte) 0x90;
            baseCmd[4] = 0x33;
            System.arraycopy(paddedData, 0, baseCmd, 5, 96);

            byte[] finalPayload = wrapEnvelope(baseCmd);

            String hexString = bytesToHex(finalPayload);
            System.out.println(" 準備下發設備地址: " + address + " | Hex 長度: " + hexString.length() / 2);

            enqueueDownlink(devEui, 10, hexString, 80);

            // Fire-and-forget: 不再自動讀回
            System.out.println(" 地址 SET 已下發 (fire-and-forget)");

        } catch (Exception e) {
            System.err.println("下發設備地址失敗: " + e.getMessage());
            throw new RuntimeException("設備地址下發失敗", e);
        }
    }

    /*******************************************************
     * Working Time SET — R102 0x80 0xA8 (6 bytes)
     *******************************************************/
    public void updateDeviceWorkingTime(String devEui, int year, int month, int day,
                                        int hour, int minute) {
        try {
            byte[] payload = new byte[6];
            payload[0] = (byte) (year & 0xFF);
            payload[1] = (byte) ((year >> 8) & 0xFF);
            payload[2] = (byte) (month & 0xFF);
            payload[3] = (byte) (day & 0xFF);
            payload[4] = (byte) (hour & 0xFF);
            payload[5] = (byte) (minute & 0xFF);

            byte[] baseCmd = new byte[5 + 6];
            baseCmd[0] = (byte) 0xB0;
            baseCmd[1] = 0x10;
            baseCmd[2] = 0x00;
            baseCmd[3] = (byte) 0x80;
            baseCmd[4] = (byte) 0xA8;
            System.arraycopy(payload, 0, baseCmd, 5, 6);

            byte[] finalPayload = wrapEnvelope(baseCmd);
            String hexString = bytesToHex(finalPayload);

            System.out.printf(" [SET Working Time] %04d/%02d/%02d %02d:%02d | Payload: %s%n",
                    year, month, day, hour, minute, hexString);

            enqueueDownlink(devEui, 10, hexString, 60);

            System.out.println(" Working Time SET 已下發 (fire-and-forget)");
        } catch (Exception e) {
            System.err.println("下發 Working Time 失敗: " + e.getMessage());
            throw new RuntimeException("Working Time 下發失敗", e);
        }
    }

    /*******************************************************
     * Get device's partName (trimmed) for SettingDefinition.appliesTo() filtering
     *******************************************************/
    public String getDevicePartName(String devEui) {
        if (deviceRepository == null) return null;
        return deviceRepository.findById(devEui)
                .map(d -> d.getPartName())
                .map(s -> s == null ? null : s.trim())
                .filter(s -> s != null && !s.isEmpty())
                .orElse(null);
    }

    /********************************************************
     * 手動強制清空 Queue
     *******************************************************/
    public void flushQueue(String devEui) {
        try {
            deviceStub.flushQueue(FlushDeviceQueueRequest.newBuilder().setDevEui(devEui).build());
            System.out.println(" [手動介入] 已強制清空設備 " + devEui + " 的所有列隊指令");
        } catch (Exception e) {
            System.err.println("強制清空 Queue 發生錯誤: " + e.getMessage());
            throw new RuntimeException("ChirpStack API 呼叫失敗", e);
        }
    }

    /********************************************************
     * 頻譜掃描專用的下發方法  強制清空 Queue
     * 這裡只要收到新請求 就代表舊的已經超時或完成了 可以直接清空舊 Queue
    *******************************************************/
    public String enqueueSpectrumDownlink(String devEui, int fPort, String hexPayload, long ttlSeconds) {

        // 無視 safeFlushQueue 直接強制清空
        try {
            deviceStub.flushQueue(FlushDeviceQueueRequest.newBuilder().setDevEui(devEui).build());
            System.out.println(" [頻譜掃描通道] 已強制清空設備 " + devEui + " 的 Queue");
        } catch (Exception e) {
            System.err.println("清空 Queue 發生錯誤: " + e.getMessage());
        }

        // 設定過期時間 TTL
        Instant expireInstant = Instant.now().plusSeconds(ttlSeconds);
        Timestamp expiresAt = Timestamp.newBuilder()
                .setSeconds(expireInstant.getEpochSecond())
                .setNanos(expireInstant.getNano())
                .build();

        //組合並下發指令
        DeviceQueueItem item = DeviceQueueItem.newBuilder()
                .setDevEui(devEui)
                .setFPort(fPort)
                .setConfirmed(false)
                .setData(ByteString.copyFrom(hexStringToByteArray(hexPayload)))
                .setExpiresAt(expiresAt)
                .build();

        return deviceStub.enqueue(EnqueueDeviceQueueItemRequest.newBuilder().setQueueItem(item).build()).getId();
    }

}