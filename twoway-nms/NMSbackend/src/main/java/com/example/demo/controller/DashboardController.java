package com.example.demo.controller;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.model.DeviceStatusLog;
import com.example.demo.repository.DeviceStatusLogRepository;

@RestController
@RequestMapping("/api/iot/dashboard")
public class DashboardController {

    @Autowired
    private DeviceStatusLogRepository logRepository;


    @GetMapping("/alarms")
    public ResponseEntity<?> getAlarmDashboardData(@RequestParam(defaultValue = "1") int days) {
        try {

            LocalDateTime now = LocalDateTime.now();
            LocalDateTime startDate = now.minusDays(days);

            List<DeviceStatusLog> logs = logRepository.findByCreatedAtBetweenOrderByCreatedAtDesc(startDate, now);

            // 計算 Normal=1 與 Warning=2 的數量
            long normalCount = logs.stream().filter(log -> log.getUnitStatus() != null && log.getUnitStatus() == 1).count();
            long warningCount = logs.stream().filter(log -> log.getUnitStatus() != null && log.getUnitStatus() == 2).count();


            Map<String, Object> summary = new HashMap<>();
            summary.put("normal", normalCount);
            summary.put("warning", warningCount);

            Map<String, Object> result = new HashMap<>();
            result.put("summary", summary);
            result.put("logs", logs); // 前端下方的Alarm Logs列表所需資料

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "無法取得 Dashboard 資料: " + e.getMessage()));
        }
    }
}


