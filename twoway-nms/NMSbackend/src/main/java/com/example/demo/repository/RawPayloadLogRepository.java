package com.example.demo.repository;

import com.example.demo.model.RawPayloadLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RawPayloadLogRepository extends JpaRepository<RawPayloadLog, Long> {
}