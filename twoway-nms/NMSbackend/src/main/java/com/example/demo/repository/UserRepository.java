package com.example.demo.repository;

import com.example.demo.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

import java.util.List;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByGoogleId(String googleId);
    Optional<User> findByFacebookId(String facebookId);
    Optional<User> findByLineId(String lineId);

    Optional<User> findByEmail(String email);

    
}