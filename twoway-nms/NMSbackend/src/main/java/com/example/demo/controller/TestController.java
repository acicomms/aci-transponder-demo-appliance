package com.example.demo.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.web.bind.annotation.*;

import com.example.demo.model.DeviceStatusLog;
import com.example.demo.service.DeviceService;
import com.example.demo.repository.DeviceStatusLogRepository;
import com.example.demo.service.MonitoringService;

import java.util.HashMap;
import java.util.Map;
import java.util.Random;


/**單次發送 */
@RestController
@RequestMapping("/api/test")
public class TestController {

    @Autowired
    private DeviceStatusLogRepository statusLogRepository; 

    @Autowired
    private MonitoringService monitoringService;

    // 控制模擬器是否正在運行的開關
    private boolean isSimulating = false;
    private final Random random = new Random();




    /**
     * 模擬 ChirpStack 推送數據給前端
     */
    @PostMapping("/push/{devEui}")
    public String triggerPush(@PathVariable String devEui) {

        DeviceStatusLog mockLog = new DeviceStatusLog();



        // 建立 Mock 數據
        double temp = 36.53333;
        double volt = 24.21111;

        // 儲存至 MySQL
        DeviceStatusLog log = new DeviceStatusLog();
        log.setDevEui(devEui);
        log.setTemperature(temp);
        log.setVoltage(volt);
        log.setRawData("Mock testing data");
        statusLogRepository.save(log); // 執行儲存



        // 準備 WebSocket 推播內容
        Map<String, Object> mockData = new HashMap<>();
        mockData.put("devEui", devEui);
        mockData.put("temperature", 36.5);
        mockData.put("voltage", 24.2);
        mockData.put("timestamp", System.currentTimeMillis());
        mockData.put("status", "Testing-Success");


        // 呼叫推播服務
        monitoringService.sendDeviceUpdate(devEui, mockData);

        return "已向主題 /topic/device/" + devEui + " 發送測試數據";
    }





    /**排程多次發送 */
    /**
     * 開關模擬器 API
     * POST /api/test/simulate/toggle?start=true (啟動)
     * POST /api/test/simulate/toggle?start=false (停止)
     */
    @PostMapping("/simulate/toggle")
    public Map<String, Object> toggleSimulation(@RequestParam(defaultValue = "true") boolean start) {
        this.isSimulating = start;
        return Map.of(
            "message", start ? "模擬器已啟動 (每 3 秒發送一次)" : " 模擬器已停止", 
            "isSimulating", isSimulating
        );
    }

    /**
     * 背景定時任務：每 3 秒 (3000ms) 自動執行一次
     */
    @Scheduled(fixedRate = 3000)
    public void simulateHeartbeat() {
        // 如果沒開啟模擬，就直接跳出不執行
        if (!isSimulating) return;

        // 模擬兩台設備不斷發送資料
        String[] testEuis = {"70b3d57ed005a1b2", "1122334455667788"}; 

        for (String devEui : testEuis) {
            // 產生合理範圍的隨機亂數
            
            // 溫度: 模擬 40.0 ~ 65.0 度   超過 55度 當作警報
            double temp = 40.0 + (random.nextDouble() * 25.0);
            boolean isTempAlarm = temp > 55.0; 

            // 電壓: 模擬 23.5 ~ 25.0 V
            double volt = 23.5 + (random.nextDouble() * 1.5);

            // Ripple: 模擬 10 ~ 40 mV
            int ripple = 10 + random.nextInt(30);

            // RF 輸出: 模擬 50.0 ~ 70.0 dBmV
            double rfOutput = 50.0 + (random.nextDouble() * 20.0);

            // 四捨五入到小數點第一位
            temp = Math.round(temp * 10.0) / 10.0;
            volt = Math.round(volt * 10.0) / 10.0;
            rfOutput = Math.round(rfOutput * 10.0) / 10.0;

            // 儲存至 MySQL
            DeviceStatusLog log = new DeviceStatusLog();
            log.setDevEui(devEui);
            log.setTemperature(temp);
            log.setVoltage(volt);
            log.setRawData("Simulated"); // 標記為模擬數據
            statusLogRepository.save(log);

            // 準備 WebSocket 推播內容
            Map<String, Object> pushData = new HashMap<>();
            pushData.put("devEui", devEui);
            pushData.put("temperature", temp);
            pushData.put("voltage", volt);
            pushData.put("ripple", ripple);
            pushData.put("rfOutputPower", rfOutput);
            pushData.put("isTempAlarm", isTempAlarm);
            pushData.put("timestamp", System.currentTimeMillis());
            pushData.put("status", isTempAlarm ? "Alarm" : "Normal");

            // 呼叫推播服務
            monitoringService.sendDeviceUpdate(devEui, pushData);

            System.out.println(" [模擬器] 發送數據 -> 設備: " + devEui + " | 溫度: " + temp + "℃ | 狀態: " );
        }
    }
}
