package com.example.demo.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import java.util.Map;
import java.util.HashMap;

@Service
public class MonitoringService {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * 推播裝置狀態給前端
     */
    public void sendDeviceUpdate(String devEui, Map<String, Object> data) {
        // 前端訂閱此路徑：/topic/device/{devEui}
        String destination = "/topic/device/" + devEui;
        messagingTemplate.convertAndSend(destination, (Object) data);

    }

    // 全域警報狀態推播
    public void sendGlobalAlarmUpdate(String devEui, boolean isAlarm, String deviceName, String timestamp) {
        Map<String, Object> alarmData = new HashMap<>();
        alarmData.put("devEui", devEui);
        alarmData.put("isAlarm", isAlarm); // true: 產生警報, false: 警報解除
        alarmData.put("deviceName", deviceName);
        alarmData.put("timestamp", timestamp);

        
        messagingTemplate.convertAndSend("/topic/alarms", (Object) alarmData);
    }

}