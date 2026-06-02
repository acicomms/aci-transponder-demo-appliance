package com.example.demo.repository;

import com.example.demo.model.AlarmEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AlarmEventRepository extends JpaRepository<AlarmEvent, Long> {

    /**
     * 找指定設備 + 分類目前 ACTIVE 中的事件
     * (正常情況下任何時刻每組 (devEui, category) 最多只會有 1 筆 ACTIVE)
     */
    Optional<AlarmEvent> findFirstByDevEuiAndCategoryAndStatusOrderByStartTimeDesc(
            String devEui, String category, String status);

    /**
     * 走 idx_alarm_events_start_time 索引, 取得時間範圍內所有事件
     * 其他維度 (devEui, category, status) 在 service 層 in-memory filter
     */
    List<AlarmEvent> findByStartTimeBetweenOrderByStartTimeDesc(
            LocalDateTime start, LocalDateTime end);

    /**
     * 鈴鐺未讀計數用 (countOnly + since)
     */
    long countByStartTimeGreaterThanEqual(LocalDateTime since);

    /**
     * 取得指定 status 的事件 (跨設備跨類別).
     * 給 queryAlarmEvents union 用 — 確保持續中的 ACTIVE alarm
     * 即使 startTime 在查詢範圍之前, 仍會納入結果.
     */
    List<AlarmEvent> findByStatusOrderByStartTimeDesc(String status);
}