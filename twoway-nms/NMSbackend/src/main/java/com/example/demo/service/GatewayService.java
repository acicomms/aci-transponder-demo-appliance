package com.example.demo.service;

import com.example.demo.dto.GatewayMetricsResponseDTO;
import com.example.demo.model.DeviceEntity;
import com.example.demo.repository.DeviceRepository;
import com.example.demo.repository.GatewayRepository;
import com.google.protobuf.Timestamp;
import io.chirpstack.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;
import com.example.demo.model.DeviceHealthStatus;
import com.example.demo.model.GatewayEntity;

@Service
public class GatewayService {

    @Autowired
    private GatewayServiceGrpc.GatewayServiceBlockingStub gatewayStub;

    @Autowired
    private GatewayRepository gatewayRepository;

    @Autowired
    private DeviceRepository deviceRepository;

    @Value("${chirpstack.tenant-id}")
    private String tenantId;

    private final DateTimeFormatter isoFormatter = DateTimeFormatter.ISO_INSTANT;

        /////////////////////////////////////////////
        //gateway topology
        /////////////////////////////////////////////

    public List<Map<String, Object>> listGatewaysWithMapFormat() {
        List<GatewayListItem> list = gatewayStub.list(ListGatewaysRequest.newBuilder()
                .setTenantId(tenantId).setLimit(100).build()).getResultList();

        return list.stream().map(gw -> {
            Map<String, Object> map = new HashMap<>();
            map.put("gatewayEui", gw.getGatewayId());
            map.put("name", gw.getName());
            map.put("description", gw.getDescription());
            // ChirpStack GetGateway lastSeenAt
            if (gw.hasLastSeenAt()) {
                map.put("lastSeenAt", isoFormatter.format(
                        Instant.ofEpochSecond(gw.getLastSeenAt().getSeconds(), gw.getLastSeenAt().getNanos())));
            } else {
                map.put("lastSeenAt", null);
            }
            // regionId 從 GatewayListItem.properties map 取出 (key: region_config_id)
            // ChirpStack v4 web UI 顯示同來源欄位; null => 前端顯示 '-'
            map.put("regionId", gw.getPropertiesMap().get("region_config_id"));
            map.put("onlineStatus", gw.hasLastSeenAt() &&
                    Instant.ofEpochSecond(gw.getLastSeenAt().getSeconds()).isAfter(Instant.now().minusSeconds(300)));
            return map;
        }).collect(Collectors.toList());
    }



    /////////////////////////////////////////////
    //把 「有設定過座標」 的 Gateway 和 Device 撈出來
    //並計算 Device 目前的連線與警報狀態（ 1=正常, 2=警報 ）
    /////////////////////////////////////////////
    public Map<String, Object> getGlobalMapData() {
        Map<String, Object> result = new HashMap<>();

        // 取得 ChirpStack 最即時的 Gateway 狀態
        List<Map<String, Object>> liveGateways = listGatewaysWithMapFormat();
        Map<String, Boolean> gwOnlineMap = new HashMap<>();
        for(Map<String, Object> lgw : liveGateways) {
            gwOnlineMap.put((String)lgw.get("gatewayEui"), (Boolean)lgw.get("onlineStatus"));
        }

        // 處理 Gateway 
        List<GatewayEntity> allGws = gatewayRepository.findAll();
        List<Map<String, Object>> gwList = allGws.stream()
                // .filter(gw -> gw.getLatitude() != null && gw.getLongitude() != null)
                .map(gw -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", gw.getGatewayId());
                    map.put("name", gw.getName() != null ? gw.getName() : gw.getGatewayId());
                    map.put("lat", gw.getLatitude());
                    map.put("lng", gw.getLongitude());
                    
                    // 從 ChirpStack 的即時資料來判斷是否上線
                    boolean isOnline = gwOnlineMap.getOrDefault(gw.getGatewayId(), false);
                    // gateway 沒有 alarm/stale 概念, 只 online/offline; 命名跟 device 對齊
                    map.put("healthStatus", isOnline ? "online" : "offline");

                    return map;
                }).collect(Collectors.toList());

        // 處理 Device 
        List<DeviceEntity> allDevs = deviceRepository.findAll();
        List<Map<String, Object>> devList = allDevs.stream()
                // .filter(dev -> dev.getLatitude() != null && dev.getLongitude() != null)
                .map(dev -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("devEui", dev.getDevEui());
                    map.put("name", dev.getName() != null ? dev.getName() : dev.getDevEui());
                    map.put("lat", dev.getLatitude());
                    map.put("lng", dev.getLongitude());
                    map.put("gatewayId", dev.getLastGatewayId());

                    String healthStatus = DeviceHealthStatus.compute(dev.getLastAmpDataAt(), dev.getUnitStatus(), dev.getAmpOfflineMin()).toJsonValue();
                    map.put("healthStatus", healthStatus);
                    return map;
                }).collect(Collectors.toList());

        result.put("gateways", gwList);
        result.put("devices", devList);
        return result;
    }




    /**
     * 從 ChirpStack同步所有 Gateway 資訊到本地 MySQL
     */
    public void syncAllGatewaysFromChirpStack() {
        System.out.println(" [Startup] 開始從 ChirpStack 同步 Gateway 原始資料...");
        try {
     
            ListGatewaysRequest listReq = ListGatewaysRequest.newBuilder()
                    .setTenantId(tenantId)
                    .setLimit(100)
                    .build();
            List<GatewayListItem> items = gatewayStub.list(listReq).getResultList();

            for (GatewayListItem item : items) {
                // 針對每一台 Gateway 取得詳細資訊
                GetGatewayRequest getReq = GetGatewayRequest.newBuilder()
                        .setGatewayId(item.getGatewayId())
                        .build();
                Gateway gwDetail = gatewayStub.get(getReq).getGateway();

                GatewayEntity entity = gatewayRepository.findById(item.getGatewayId())
                        .orElse(new GatewayEntity());

                entity.setGatewayId(item.getGatewayId());
                entity.setName(gwDetail.getName());
                entity.setDescription(gwDetail.getDescription());
                
                // 同步座標
                if (gwDetail.getLocation() != null) {
                    entity.setLatitude(gwDetail.getLocation().getLatitude());
                    entity.setLongitude(gwDetail.getLocation().getLongitude());
                }

                gatewayRepository.save(entity);
                System.out.println("   已同步 Gateway: " + item.getGatewayId() + " (" + gwDetail.getName() + ")");
            }
            System.out.println(" [Startup] Gateway 同步完成，共計 " + items.size() + " 台。");
        } catch (Exception e) {
            System.err.println("[Startup] 同步 Gateway 失敗: " + e.getMessage());
        }
    }



    public List<Map<String, Object>> getDevicesUnderGateway(String gatewayId) {
        List<DeviceEntity> devices = deviceRepository.findByLastGatewayId(gatewayId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (DeviceEntity dev : devices) {
            Map<String, Object> map = new HashMap<>();
            map.put("devEui",       dev.getDevEui());
            map.put("name",         dev.getName());
            map.put("lastSeenAt",   dev.getLastSeenAt());
            map.put("unitStatus",   dev.getUnitStatus());
            map.put("parentDevEui", null); // 樹狀預留欄位 目前都是 null
            map.put("healthStatus",
                    DeviceHealthStatus.compute(dev.getLastAmpDataAt(), dev.getUnitStatus(), dev.getAmpOfflineMin()).toJsonValue());
            result.add(map);
        }
        return result;
    }

    public GatewayMetricsResponseDTO getGatewayMetrics(String gatewayId, String startStr, String endStr,
            String aggStr) {
        Instant startInstant = Instant.parse(startStr);
        Instant endInstant = Instant.parse(endStr);

        Timestamp startTs = Timestamp.newBuilder().setSeconds(startInstant.getEpochSecond())
                .setNanos(startInstant.getNano()).build();
        Timestamp endTs = Timestamp.newBuilder().setSeconds(endInstant.getEpochSecond()).setNanos(endInstant.getNano())
                .build();
        Aggregation aggEnum = Aggregation.valueOf(aggStr.toUpperCase());

        GetGatewayMetricsRequest request = GetGatewayMetricsRequest.newBuilder()
                .setGatewayId(gatewayId)
                .setStart(startTs)
                .setEnd(endTs)
                .setAggregation(aggEnum)
                .build();

        GetGatewayMetricsResponse response = gatewayStub.getMetrics(request);
        return convertToDTO(response);
    }

    private GatewayMetricsResponseDTO convertToDTO(GetGatewayMetricsResponse response) {
        GatewayMetricsResponseDTO dto = new GatewayMetricsResponseDTO();
        dto.setRxPackets(mapToMetricSet(response.getRxPackets(), "Received"));
        dto.setTxPackets(mapToMetricSet(response.getTxPackets(), "Transmitted"));
        // displayName 對齊 ChirpStack proto comment + grpcurl 實測回傳的 .name 欄位
        dto.setRxPacketsPerFreq(mapToMetricSet(response.getRxPacketsPerFreq(), "Received / frequency"));
        dto.setTxPacketsPerFreq(mapToMetricSet(response.getTxPacketsPerFreq(), "Transmitted / frequency"));
        dto.setRxPacketsPerDr(mapToMetricSet(response.getRxPacketsPerDr(), "Received / DR"));
        dto.setTxPacketsPerDr(mapToMetricSet(response.getTxPacketsPerDr(), "Transmitted / DR"));
        dto.setTxPacketsPerStatus(mapToMetricSet(response.getTxPacketsPerStatus(), "TX packets / status"));
        return dto;
    }

    private GatewayMetricsResponseDTO.MetricSet mapToMetricSet(Metric metric, String displayName) {
        GatewayMetricsResponseDTO.MetricSet set = new GatewayMetricsResponseDTO.MetricSet();
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
        set.setDatasets(metric.getDatasetsList().stream().map(ds -> {
            GatewayMetricsResponseDTO.MetricDataset datasetDTO = new GatewayMetricsResponseDTO.MetricDataset();
            datasetDTO.setLabel(ds.getLabel());
            datasetDTO.setData(ds.getDataList().stream().map(Float::intValue).collect(Collectors.toList()));
            return datasetDTO;
        }).collect(Collectors.toList()));
        return set;
    }

    // ==========================================
    // 更新 Gateway 座標
    // ==========================================
    public void updateGatewayLocation(String gatewayId, Double latitude, Double longitude) {
        try {
            // 1. 先取得目前的 Gateway 資訊 (保留原有的 Name, Description, TenantId 等)
            GetGatewayRequest getReq = GetGatewayRequest.newBuilder().setGatewayId(gatewayId).build();
            Gateway currentGateway = gatewayStub.get(getReq).getGateway();

            Gateway updatedGateway = currentGateway.toBuilder()
                    .setLocation(
                            currentGateway.getLocation().toBuilder()
                                    .setLatitude(latitude)
                                    .setLongitude(longitude)
                                    .setSourceValue(2)
                                    .build())
                    .build();

            // 透過 gRPC 下發更新指令回 ChirpStack
            UpdateGatewayRequest updateReq = UpdateGatewayRequest.newBuilder()
                    .setGateway(updatedGateway)
                    .build();

            gatewayStub.update(updateReq);
            System.out.println(" 已成功透過 gRPC 更新 Gateway " + gatewayId + " 座標為: " + latitude + ", " + longitude);



            // 因為gw硬體目前的座標直接被寫死在設定檔,即使透過grpc也無法更改
            // 所以多儲存一份在mysql 
            // 強制將正確座標寫入 MySQL
            // 尋找現有的 Entity，若不存在則建立新的
            GatewayEntity gwEntity = gatewayRepository.findById(gatewayId)
                    .orElseGet(() -> {
                        GatewayEntity newGw = new GatewayEntity();
                        newGw.setGatewayId(gatewayId);
                        return newGw;
                    });

            gwEntity.setLatitude(latitude);
            gwEntity.setLongitude(longitude);
            // 同步更新名稱
            if (currentGateway.getName() != null) {
                gwEntity.setName(currentGateway.getName());
            }


            gatewayRepository.save(gwEntity);
            System.out.println(" 正確座標已強制寫入本地 MySQL 資料庫: [" + latitude + ", " + longitude + "]");

        } catch (Exception e) {
            System.err.println(" 更新 Gateway 座標時發生錯誤: " + e.getMessage());
            throw new RuntimeException("ChirpStack Gateway 更新失敗", e);
        }
    }

}