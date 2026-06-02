package com.example.demo.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.demo.model.DeviceSpectrumLog;

public interface DeviceSpectrumLogRepository extends JpaRepository<DeviceSpectrumLog, Long> {
}
