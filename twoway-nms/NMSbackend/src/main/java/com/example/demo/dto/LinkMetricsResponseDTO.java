package com.example.demo.dto;

import lombok.Data;
import java.util.List;

/**
 * ChirpStack v4 GetDeviceLinkMetricsResponse
 * 內層 MetricSet/MetricDataset 跟 GatewayMetricsResponseDTO 同 shape, 但 data 用 Double
 * RSSI/SNR 在 proto 是 float
 */
@Data
public class LinkMetricsResponseDTO {
    private MetricSet rxPackets;
    private MetricSet gwRssi;
    private MetricSet gwSnr;
    private MetricSet rxPacketsPerFreq;
    private MetricSet rxPacketsPerDr;
    private MetricSet errors;

    @Data
    public static class MetricSet {
        private String name;
        private List<String> timestamps;
        private List<MetricDataset> datasets;
        private String kind;
    }

    @Data
    public static class MetricDataset {
        private String label;
        private List<Double> data;
    }
}