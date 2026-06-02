package com.example.demo.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class SystemStartupSync {

    @Autowired
    private GatewayService gatewayService;

    /**
     * 當應用程式啟動完成後  自動執行一次全同步
     */
    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        System.out.println("\n ========== 系統啟動成功，初始資料同步 ==========");
        gatewayService.syncAllGatewaysFromChirpStack();
        
        // (未來可以在這裡加入同步 Device 的邏輯)
        
        System.out.println(" ========== 初始資料同步程序結束 ==========\n");
    }
}