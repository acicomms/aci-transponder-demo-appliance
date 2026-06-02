
package com.example.demo.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;
import lombok.RequiredArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "gateways")
@Getter
@Setter
@ToString
@RequiredArgsConstructor
public class GatewayEntity {
    @Id
    @Column(name = "gateway_id")
    private String gatewayId;

    private String name;
    private String description;
    private Double latitude;
    private Double longitude;
    private String regionId;
    private String regionCommonName;
    private LocalDateTime lastSeenAt;
    private Boolean onlineStatus;
}