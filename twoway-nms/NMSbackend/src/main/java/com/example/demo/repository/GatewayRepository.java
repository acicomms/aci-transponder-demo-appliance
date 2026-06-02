package com.example.demo.repository;

import com.example.demo.model.GatewayEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface GatewayRepository extends JpaRepository<GatewayEntity, String> {
    List<GatewayEntity> findByNameContainingIgnoreCaseOrGatewayIdContainingIgnoreCase(String name, String id);
}