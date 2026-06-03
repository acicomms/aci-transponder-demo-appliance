package com.example.demo.repository;

import com.example.demo.model.PartSettingMap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PartSettingMapRepository extends JpaRepository<PartSettingMap, Long> {
    List<PartSettingMap> findByPartKey(String partKey);
}