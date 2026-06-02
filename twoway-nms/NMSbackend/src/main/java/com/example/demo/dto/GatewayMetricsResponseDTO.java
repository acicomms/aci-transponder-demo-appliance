package com.example.demo.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class GatewayMetricsResponseDTO {
    private MetricSet rxPackets;
    private MetricSet txPackets;
    private MetricSet txPacketsPerFreq;
    private MetricSet rxPacketsPerFreq;
    private MetricSet txPacketsPerDr;
    private MetricSet rxPacketsPerDr;
    private MetricSet txPacketsPerStatus;

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
        private List<Integer> data;
    }
}