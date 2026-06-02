package com.example.demo.repository;

import com.example.demo.model.DeviceStatusLog;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DeviceStatusLogRepository extends JpaRepository<DeviceStatusLog, Long> {

    List<DeviceStatusLog> findByDevEuiOrderByCreatedAtDesc(String devEui);


    List<DeviceStatusLog> findByDevEuiAndCreatedAtBetweenOrderByCreatedAtDesc(
        String devEui, LocalDateTime start, LocalDateTime end);



    Optional<DeviceStatusLog> findFirstByDevEuiOrderByCreatedAtDesc(String devEui);


     List<DeviceStatusLog> findByCreatedAtBetweenOrderByCreatedAtDesc(
        LocalDateTime start, LocalDateTime end);
    
}