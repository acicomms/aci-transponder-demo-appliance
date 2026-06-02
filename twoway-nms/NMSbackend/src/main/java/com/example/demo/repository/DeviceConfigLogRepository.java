package com.example.demo.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.demo.model.DeviceConfigLog;

public interface DeviceConfigLogRepository extends JpaRepository<DeviceConfigLog, Long> {
    
}
