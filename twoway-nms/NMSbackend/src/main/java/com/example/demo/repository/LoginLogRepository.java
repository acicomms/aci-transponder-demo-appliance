package com.example.demo.repository;

import com.example.demo.model.LoginLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LoginLogRepository extends JpaRepository<LoginLog, Long> {
    List<LoginLog> findByUserIdOrderByLoginTimeDesc(Long userId);
    void deleteByUserId(Long userId);
}