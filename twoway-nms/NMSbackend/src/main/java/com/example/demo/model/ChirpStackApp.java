package com.example.demo.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "iot_applications")
public class ChirpStackApp {

    @Id
    private String id; // 對應 ChirpStack 的 UUID

    private String name;
    private String description;

    private LocalDateTime lastSyncTime;
}