package com.example.demo.controller;

import com.example.demo.dto.*;
import com.example.demo.model.ChirpStackApp;
import com.example.demo.model.DeviceStatusLog;
import com.example.demo.service.AlarmEventService;
import com.example.demo.service.ApplicationService;
import com.example.demo.service.DeviceService;
import com.example.demo.service.CobsCodec;
import com.example.demo.service.GatewayService;
import com.example.demo.service.RfTestSessionService;
import com.example.demo.service.SettingDefinition;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/iot")
public class IotController {

    @Autowired
    private ApplicationService applicationService;

    @Autowired
    private GatewayService gatewayService;

    @Autowired
    private DeviceService deviceService;

    @Autowired
    private AlarmEventService alarmEventService;

    @Autowired
    private RfTestSessionService rfTestSessionService;


    // ==========================================
    // 全域地圖拓撲資料 (Map Topology)
    // 在GatewayService.java 實作
    // ==========================================
    @GetMapping("/dashboard/map-data")
    public ResponseEntity<?> getGlobalMapTopology() {
        try {
            Map<String, Object> mapData = gatewayService.getGlobalMapData();
            return ResponseEntity.ok(mapData);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", "無法取得地圖資料: " + e.getMessage()));
        }
    }


    // ==========================================
    // 查詢 alarm 事件 (事件導向, 多維過濾 + 分頁 + countOnly)
    // ==========================================
    @GetMapping("/alarms/events")
    public ResponseEntity<?> getAlarmEvents(
            @RequestParam(required = false) List<String> devEui,
            @RequestParam(required = false) List<String> category,
            @RequestParam(required = false) List<String> status,
            @RequestParam(required = false) String start,
            @RequestParam(required = false) String end,
            @RequestParam(required = false, defaultValue = "startTime") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDir,
            @RequestParam(required = false, defaultValue = "1") Integer page,
            @RequestParam(required = false, defaultValue = "50") Integer pageSize,
            @RequestParam(required = false, defaultValue = "false") Boolean countOnly,
            @RequestParam(required = false) String since
    ) {
        try {
            Map<String, Object> result = alarmEventService.queryAlarmEvents(
                    devEui,
                    category,
                    status,
                    parseIsoOrNull(start),
                    parseIsoOrNull(end),
                    sortBy,
                    sortDir,
                    page,
                    pageSize,
                    countOnly,
                    parseIsoOrNull(since)
            );
            return ResponseEntity.ok(result);
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Invalid ISO date format: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Failed to query alarm events: " + e.getMessage()));
        }
    }

    /** 容忍 ISO_LOCAL_DATE_TIME ("2026-05-05T00:00:00") 跟 OffsetDateTime ("...Z" / "...+00:00") */
    private LocalDateTime parseIsoOrNull(String iso) {
        if (iso == null || iso.isBlank()) return null;
        try {
            return LocalDateTime.parse(iso, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (DateTimeParseException ignored) {
            // 帶 tz 的 ISO (e.g. "2026-05-11T07:00:00.000Z") 要先依 instant 換算到 JVM 預設時區,
            // 再取 LocalDateTime; 直接 .toLocalDateTime() 會靜默丟掉 Z, 造成查詢窗口位移 tz offset.
            return OffsetDateTime.parse(iso)
                    .atZoneSameInstant(ZoneId.systemDefault())
                    .toLocalDateTime();
        }
    }

    // ==========================================
    // Applications 
    // ==========================================
    @GetMapping("/applications")
    public ResponseEntity<List<ChirpStackApp>> getApplications() {

        List<ChirpStackApp> apps = applicationService.getAllFromLocal();
        // 如果資料庫是空的就自動同步
        if (apps.isEmpty()) {
            apps = applicationService.syncFromChirpStack();
        }
        return ResponseEntity.ok(apps);

    }


    @PostMapping("/applications/sync")
    public ResponseEntity<List<ChirpStackApp>> syncApplications() {
        return ResponseEntity.ok(applicationService.syncFromChirpStack());
    }

    // ==========================================
    // Application (POST /iot/applications)
    // ==========================================
    @PostMapping("/applications")
    public ResponseEntity<?> createApplication(@RequestBody Map<String, String> payload) {
        try {
            String name = payload.get("name");
            String description = payload.getOrDefault("description", "");
            if (name == null || name.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "message", "name is required"));
            }
            Map<String, String> result = applicationService.createApplication(name.trim(), description);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Create Application FAIL: " + e.getMessage()));
        }
    }

    // ==========================================
    // Application (PUT /iot/applications/{id})
    // 只允許 name + description 2欄位, 其他保留 ChirpStack 值
    // ==========================================
    @PutMapping("/applications/{id}")
    public ResponseEntity<?> updateApplication(
            @PathVariable String id,
            @RequestBody Map<String, String> payload) {
        try {
            String name = payload.get("name");
            String description = payload.getOrDefault("description", "");
            if (name == null || name.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "message", "name is required"));
            }
            applicationService.updateApplication(id, name.trim(), description);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "id", id,
                    "name", name.trim(),
                    "description", description));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Update Application FAIL: " + e.getMessage()));
        }
    }

    // ==========================================
    // Application (DELETE /iot/applications/{id})
    // ChirpStack v4 預設 cascade delete devices, 由前端先警告底下 N 台
    // ==========================================
    @DeleteMapping("/applications/{id}")
    public ResponseEntity<?> deleteApplication(@PathVariable String id) {
        try {
            applicationService.deleteApplication(id);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Application deleted"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Delete Application FAIL: " + e.getMessage()));
        }
    }

    // ==========================================
    // Device Profiles
    // ==========================================
    @GetMapping("/device-profiles")
    public ResponseEntity<?> getDeviceProfiles() {
        try {
            List<Map<String, Object>> profiles = deviceService.listDeviceProfilesForTenant();
            return ResponseEntity.ok(profiles);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "List device profiles failed: " + e.getMessage()));
        }
    }

    // ==========================================
    // Create Device
    // ==========================================
    @PostMapping("/devices")
    public ResponseEntity<?> createDevice(@RequestBody Map<String, Object> payload) {
        try {
            String devEui = (String) payload.get("devEui");
            String name = (String) payload.get("name");
            String description = (String) payload.getOrDefault("description", "");
            String applicationId = (String) payload.get("applicationId");
            String deviceProfileId = (String) payload.get("deviceProfileId");
            String appKey = (String) payload.get("appKey");
            Boolean isDisabled = (Boolean) payload.getOrDefault("isDisabled", false);
            Boolean skipFcntCheck = (Boolean) payload.getOrDefault("skipFcntCheck", false);

            if (devEui == null || devEui.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "devEui is required"));
            }
            if (name == null || name.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "name is required"));
            }
            if (applicationId == null || applicationId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "applicationId is required"));
            }
            if (deviceProfileId == null || deviceProfileId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "deviceProfileId is required"));
            }
            if (appKey == null || appKey.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "appKey is required"));
            }

            String normDevEui = devEui.replaceAll("[\\s-]", "").toLowerCase();
            String normAppKey = appKey.replaceAll("[\\s-]", "").toLowerCase();

            if (!normDevEui.matches("^[0-9a-f]{16}$")) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "devEui must be 16 hex chars"));
            }
            if (!normAppKey.matches("^[0-9a-f]{32}$")) {
                return ResponseEntity.badRequest().body(Map.of("success", false, "message", "appKey must be 32 hex chars"));
            }

            Map<String, Object> result = deviceService.createDeviceWithKeys(
                    normDevEui,
                    name.trim(),
                    description,
                    applicationId,
                    deviceProfileId,
                    normAppKey,
                    isDisabled,
                    skipFcntCheck);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Create Device FAIL: " + e.getMessage()));
        }
    }

    // ==========================================
    // Delete Device
    // ==========================================
    @DeleteMapping("/devices/{devEui}")
    public ResponseEntity<?> deleteDevice(@PathVariable String devEui) {
        try {
            deviceService.deleteDevice(devEui);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Device deleted"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Delete Device FAIL: " + e.getMessage()));
        }
    }

    // ==========================================
    // Get Device OTAA Keys
    // ==========================================
    @GetMapping("/devices/{devEui}/keys")
    public ResponseEntity<?> getDeviceKeys(@PathVariable String devEui) {
        try {
            Map<String, Object> keys = deviceService.getDeviceKeys(devEui);
            return ResponseEntity.ok(keys);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Get Device Keys FAIL: " + e.getMessage()));
        }
    }

    // ==========================================
    // Device Link Metrics
    // ==========================================
    @GetMapping("/devices/{devEui}/link-metrics")
    public ResponseEntity<LinkMetricsResponseDTO> getDeviceLinkMetrics(
            @PathVariable String devEui,
            @RequestParam String start,
            @RequestParam String end,
            @RequestParam String aggregation) {
        return ResponseEntity.ok(deviceService.getDeviceLinkMetrics(devEui, start, end, aggregation));
    }

    // ==========================================
    // Gateways 
    // ==========================================
    @GetMapping("/gateways")
    public ResponseEntity<List<Map<String, Object>>> getAllGateways() {
        return ResponseEntity.ok(gatewayService.listGatewaysWithMapFormat());
    }

    @GetMapping("/gateways/{gatewayId}/metrics")
    public ResponseEntity<GatewayMetricsResponseDTO> getGatewayMetrics(
            @PathVariable String gatewayId,
            @RequestParam String start,
            @RequestParam String end,
            @RequestParam String aggregation) {
        return ResponseEntity.ok(gatewayService.getGatewayMetrics(gatewayId, start, end, aggregation));
    }

    @GetMapping("/gateways/{gatewayId}/devices")
    public ResponseEntity<List<Map<String, Object>>> getDevicesUnderGateway(@PathVariable String gatewayId) {
        return ResponseEntity.ok(gatewayService.getDevicesUnderGateway(gatewayId));
    }

    // ==========================================
    // 更新 Gateway 座標
    // 前端發送 JSON: { "latitude": 24.81, "longitude": 121.03 }
    // ==========================================
    @PutMapping("/gateways/{gatewayId}/location")
    public ResponseEntity<?> updateGatewayLocation(
            @PathVariable String gatewayId,
            @RequestBody Map<String, Double> payload) {
        try {
            Double latitude = payload.get("latitude");
            Double longitude = payload.get("longitude");

            if (latitude == null || longitude == null) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "message", "錯誤：缺少 latitude 或 longitude 參數"
                ));
            }

            // 更新 ChirpStack
            gatewayService.updateGatewayLocation(gatewayId, latitude, longitude);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Gateway [" + gatewayId + "] 座標更新成功",
                    "latitude", latitude,
                    "longitude", longitude
            ));

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "更新 Gateway 座標失敗: " + e.getMessage()
            ));
        }
    }



    // ==========================================
    // 手動觸發同步設備資料 (01 或 02 指令)
    // ==========================================
    @PostMapping("/devices/{devEui}/sync0102")
    public ResponseEntity<?> syncDeviceData(
            @PathVariable String devEui,
            @RequestBody Map<String, String> payload) {
        try {
            String target = payload.get("target"); // "INFO" / "SETTINGS" / "STATUS"
            deviceService.forceSyncCommand(devEui, target);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "同步指令已成功加入列隊，等待設備回傳"));
        } catch (DeviceService.SyncCooldownException e) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of(
                    "success", false,
                    "message", "Refresh cooldown active",
                    "target", e.getTarget(),
                    "retryAfterSeconds", e.getRetryAfterSeconds()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "下發同步指令失敗: " + e.getMessage()));
        }
    }

    /** ==========================================
     * 01+02
     * 取得單一設備的全部詳細資訊 
     ==========================================*/
    @GetMapping("/devices/{devEui}/detail")
    public ResponseEntity<DeviceDetailResponseDto> getDeviceAggregatedDetail(@PathVariable String devEui) {
        DeviceDetailResponseDto detail = deviceService.getDeviceAggregatedDetail(devEui);

        return ResponseEntity.ok(detail);
    }

    @GetMapping("/devices")
    public ResponseEntity<List<Map<String, Object>>> getDevices(@RequestParam String applicationId) {
        return ResponseEntity.ok(deviceService.getDevicesByApplication(applicationId));
    }

    @PutMapping("/devices/{devEui}")
    public ResponseEntity<?> updateDevice(@PathVariable String devEui, @RequestBody DeviceConfigDto dto) {
        deviceService.updateDevice(devEui, dto);
        return ResponseEntity.ok(Map.of("message", "Device updated successfully"));
    }

    @GetMapping("/devices/{devEui}/history")
    public ResponseEntity<List<DeviceStatusLog>> getDeviceHistory(
            @PathVariable String devEui,
            @RequestParam(required = false) String start,
            @RequestParam(required = false) String end) {
        return ResponseEntity.ok(deviceService.getDeviceHistory(devEui, start, end));
    }

    // ==========================================
    // 下發03即時數據指令
    // ==========================================
    @PostMapping("/devices/{devEui}/start-monitor")
    public ResponseEntity<?> startDeviceMonitor(@PathVariable String devEui) {
        try {
            deviceService.startRealTimeMonitor(devEui);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "監控指令已成功下發至設備 " + devEui));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "下發指令失敗: " + e.getMessage()));
        }
    }

    /**==========================================
     * 設定device實體座標
     * JSON: { "latitude": 24.8123, "longitude": 121.0123 }
     ==========================================*/
     @PostMapping("/devices/{devEui}/location")
     public ResponseEntity<?> setDeviceLocation(
             @PathVariable String devEui,
             @RequestBody Map<String, Double> payload) {
         try {
             Double lat = payload.get("latitude");
             Double lon = payload.get("longitude");
 
             if (lat == null || lon == null) {
                 return ResponseEntity.badRequest().body(Map.of("message", "缺少經緯度參數"));
             }
 
             deviceService.updateDeviceLocation(devEui, lat, lon);
 
             return ResponseEntity.ok(Map.of(
                     "success", true,
                     "message", "座標設定指令已送入佇列，等待設備更新..."
             ));
         } catch (Exception e) {
             return ResponseEntity.internalServerError().body(Map.of("message", e.getMessage()));
         }
     }

    // ==========================================
    // 設定設備實體地址"文字" 
    // 指令: 0xB0 0x10 0x00 0x90 0x33 + 96 bytes UTF-16
    // JSON: { "address": "66TH Avenue South Kent, WA 98032 U.S.A. " }
    // ==========================================
    @PostMapping("/devices/{devEui}/address")
    public ResponseEntity<?> setDeviceAddress(
            @PathVariable String devEui,
            @RequestBody Map<String, String> payload) {
        try {
            String address = payload.get("address");

            if (address == null) {
                return ResponseEntity.badRequest().body(Map.of("message", "缺少 address 參數"));
            }

            deviceService.updateDeviceAddress(devEui, address);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "地址設定指令已送入佇列，等待設備更新..."
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", e.getMessage()));
        }
    }

    // ==========================================
    // 設定設備運轉時間 (Working Time) — R102 0x80 0xA8
    // 指令: 0xB0 0x10 0x00 0x80 0xA8 + 6 bytes (year LE, month, day, hour, minute)
    // JSON: { "year": 2026, "month": 5, "day": 24, "hour": 10, "minute": 30 }
    // note: 此 SET 不存 EEPROM, 為 log 用. 放 Diagnostics 區, 不在 SettingsTab 主流程.
    // ==========================================
    @PostMapping("/devices/{devEui}/working-time")
    public ResponseEntity<?> setDeviceWorkingTime(
            @PathVariable String devEui,
            @RequestBody Map<String, Object> payload) {
        try {
            Integer year   = toInt(payload.get("year"));
            Integer month  = toInt(payload.get("month"));
            Integer day    = toInt(payload.get("day"));
            Integer hour   = toInt(payload.get("hour"));
            Integer minute = toInt(payload.get("minute"));

            if (year == null || month == null || day == null || hour == null || minute == null) {
                return ResponseEntity.badRequest().body(Map.of("success", false,
                        "message", "Missing field(s): year/month/day/hour/minute required"));
            }
            if (year < 2000 || year > 2099 || month < 1 || month > 12
                    || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
                return ResponseEntity.badRequest().body(Map.of("success", false,
                        "message", "Working time field(s) out of range"));
            }

            deviceService.updateDeviceWorkingTime(devEui, year, month, day, hour, minute);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Working time 指令已送入佇列，等待設備更新..."
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", e.getMessage()));
        }
    }

    private static Integer toInt(Object o) {
        if (o == null) return null;
        if (o instanceof Number) return ((Number) o).intValue();
        try { return Integer.parseInt(o.toString().trim()); } catch (Exception e) { return null; }
    }

    // ==========================================
    // GET /api/iot/devices/{devEui}/settings
    // ==========================================
    @GetMapping("/devices/{devEui}/settings")
    public ResponseEntity<?> listApplicableSettings(@PathVariable String devEui) {
        try {
            String partName = deviceService.getDevicePartName(devEui);  // null/blank if not yet synced

            java.util.List<Map<String, Object>> result = new java.util.ArrayList<>();
            for (SettingDefinition def : SettingDefinition.values()) {
                if (!def.appliesTo(partName)) continue;
                Map<String, Object> row = new java.util.LinkedHashMap<>();
                row.put("settingKey",   def.getSettingKey());
                row.put("displayName",  def.getDisplayName());
                row.put("frame",        String.format("0x%02X", def.getFrame() & 0xFF));
                row.put("hexIndex",     String.format("0x%02X", def.getHexIndex() & 0xFF));
                row.put("byteLen",      def.getByteLen());
                row.put("scale",        def.getScale());
                row.put("minRaw",       def.getMinRaw());
                row.put("maxRaw",       def.getMaxRaw());
                row.put("encoding",     def.getEncoding().name());
                row.put("allowedValues", def.getAllowedValues());          // null if range-based
                row.put("applicablePartTypes", def.getApplicablePartTypes()); // null = all
                result.add(row);
            }
            return ResponseEntity.ok(Map.of(
                    "partName", partName == null ? "" : partName,
                    "count",    result.size(),
                    "settings", result
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Failed to list settings: " + e.getMessage()));
        }
    }

    // ==========================================
    // Generic numeric SET endpoint
    // POST /api/iot/devices/{devEui}/settings/{settingKey}
    // Body: { "value": <number> }
    // ==========================================
    @PostMapping("/devices/{devEui}/settings/{settingKey}")
    public ResponseEntity<?> setDeviceSetting(
            @PathVariable String devEui,
            @PathVariable String settingKey,
            @RequestBody Map<String, Object> payload) {

        Optional<SettingDefinition> defOpt = SettingDefinition.fromKey(settingKey);
        if (defOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Unknown setting key: " + settingKey));
        }
        SettingDefinition def = defOpt.get();

        Object rawValue = payload.get("value");
        if (rawValue == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Missing 'value' in request body"));
        }
        double value;
        try {
            value = ((Number) rawValue).doubleValue();
        } catch (ClassCastException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "'value' must be a number"));
        }

        // Range check (front of the line — service will re-check defensively)
        int raw = (int) Math.round(value * def.getScale());
        if (raw < def.getMinRaw() || raw > def.getMaxRaw()) {
            double minVal = def.getMinRaw() / (double) def.getScale();
            double maxVal = def.getMaxRaw() / (double) def.getScale();
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", String.format("Value %.3f out of range for %s [%.3f ~ %.3f]",
                            value, def.getDisplayName(), minVal, maxVal)));
        }

        // allowedValues check — used for enumerated raw values (e.g. DFU type {1,3,5,6}).
        // Null means range alone is authoritative (5 alarms, ALSC).
        int[] allowed = def.getAllowedValues();
        if (allowed != null) {
            boolean ok = false;
            for (int v : allowed) {
                if (v == raw) { ok = true; break; }
            }
            if (!ok) {
                StringBuilder list = new StringBuilder();
                for (int i = 0; i < allowed.length; i++) {
                    if (i > 0) list.append(", ");
                    list.append(allowed[i]);
                }
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "message", String.format("Value %d not in allowed list for %s [%s]",
                                raw, def.getDisplayName(), list.toString())));
            }
        }

        try {
            deviceService.updateNumericSetting(devEui, def, value);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "settingKey", settingKey,
                    "message", "Setting submitted"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Failed to send setting: " + e.getMessage()));
        }
    }

    // ==========================================
    // Link Test (Diagnostics) — sequential request-response.
    // ==========================================

    @PostMapping("/devices/{devEui}/diagnostics/rf-test/start")
    public ResponseEntity<?> startRfTest(
            @PathVariable String devEui,
            @RequestBody Map<String, Object> body) {
        try {
            RfTestSessionService.Params p = new RfTestSessionService.Params();
            String modeStr = String.valueOf(body.getOrDefault("mode", "")).trim().toUpperCase();
            if ("READ".equals(modeStr)) {
                p.mode = RfTestSessionService.Mode.READ;
            } else if ("SET".equals(modeStr)) {
                p.mode = RfTestSessionService.Mode.SET;
            } else {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "message", "mode required (READ or SET)"));
            }
            Object readTargetObj = body.get("readTarget");
            p.readTarget = readTargetObj == null ? null : String.valueOf(readTargetObj);

            Object settingKeyObj = body.get("settingKey");
            p.settingKey = settingKeyObj == null ? null : String.valueOf(settingKeyObj);

            Object valueObj = body.get("value");
            p.value = (valueObj instanceof Number) ? ((Number) valueObj).doubleValue() : null;

            Object timeoutObj = body.get("timeoutSec");
            p.timeoutSec = (timeoutObj instanceof Number) ? ((Number) timeoutObj).intValue() : 0;

            Object intervalObj = body.get("intervalSec");
            p.intervalSec = (intervalObj instanceof Number) ? ((Number) intervalObj).intValue() : 0;

            Map<String, Object> status = rfTestSessionService.start(devEui, p);
            return ResponseEntity.ok(status);

        } catch (IllegalStateException e) {
            // Session already running on this device
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "success", false,
                    "message", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Failed to start RF test: " + e.getMessage()));
        }
    }

    @PostMapping("/devices/{devEui}/diagnostics/rf-test/stop")
    public ResponseEntity<?> stopRfTest(@PathVariable String devEui) {
        try {
            return ResponseEntity.ok(rfTestSessionService.stop(devEui));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Failed to stop RF test: " + e.getMessage()));
        }
    }

    @GetMapping("/devices/{devEui}/diagnostics/rf-test/status")
    public ResponseEntity<?> getRfTestStatus(@PathVariable String devEui) {
        try {
            return ResponseEntity.ok(rfTestSessionService.getStatus(devEui));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "Failed to read RF test status: " + e.getMessage()));
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }

    // ==========================================
    // 頻譜掃描 (Spectrum Scan) 指令 04~09
    // ==========================================
    @PostMapping("/{devEui}/spectrum/scan")
    public ResponseEntity<?> scanSpectrum(
            @PathVariable String devEui,
            @RequestBody Map<String, Integer> payload) {

        Integer type = payload.get("type"); // 0: Input, 1: Output
        Integer part = payload.get("part"); // 1: Part I, 2: Part II, 3: Part III

        if (type == null || part == null || part < 1 || part > 3 || (type != 0 && type != 1)) {
            return ResponseEntity.badRequest().body("錯誤：參數不正確 (type: 0/1, part: 1/2/3)");
        }

        // ==========================================
        // (4~9 指令)
        // Input Part 1~3 => 4, 5, 6
        // Output Part 1~3 => 7, 8, 9
        // ==========================================
        int commandId = 4 + (type * 3) + (part - 1);

        // 直接組合出 40010104 ~ 40010109 的 HEX 字串 
        String hexPayload = String.format("4001010%d", commandId);

        System.out.printf(" 準備下發 [頻譜掃描 Type:%d Part:%d] 給設備 %s, 指令代號: %d, Hex: %s%n",
                type, part, devEui, commandId, hexPayload);

        try {
            // 改用 enqueueSpectrumDownlink 並且把 TTL 設為 60 秒
            String messageId = deviceService.enqueueSpectrumDownlink(devEui, 10, hexPayload, 60);
            
            return ResponseEntity.ok(Map.of(
                    "message", "頻譜掃描指令已加入佇列",
                    "hexPayload", hexPayload,
                    "messageId", messageId));
        } catch (Exception e) {
            System.err.println("下發頻譜指令失敗: " + e.getMessage());
            return ResponseEntity.internalServerError().body("下發指令失敗: " + e.getMessage());
        }
    }

    // ==========================================
    // 強制清空設備指令 Queue 
    // ==========================================
    @DeleteMapping("/devices/{devEui}/queue")
    public ResponseEntity<?> clearDeviceQueue(@PathVariable String devEui) {
        try {
            // 直接呼叫 Service 層執行清空
            deviceService.flushQueue(devEui);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "已強制清空設備 " + devEui + " 的指令列隊"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of(
                    "success", false,
                    "message", "清空列隊失敗: " + e.getMessage()));
        }
    }

}