package com.example.demo.dto;

import lombok.Data;

@Data
public class DeviceConfigDto {

    private String name; 
    private String description;
    private String deviceProfileId; 
    private String joinEui;
    private Boolean isDisabled; 
    
    // Disable frame-counter validation (開關)
    // 在 Protobuf 中這個欄位叫 skip_fcnt_check
    private Boolean skipFcntCheck; 
}