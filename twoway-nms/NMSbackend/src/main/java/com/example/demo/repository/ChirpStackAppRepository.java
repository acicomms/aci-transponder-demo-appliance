package com.example.demo.repository;

import com.example.demo.model.ChirpStackApp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ChirpStackAppRepository extends JpaRepository<ChirpStackApp, String> {
    
}