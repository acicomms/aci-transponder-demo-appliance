package com.example.demo.controller;

import com.example.demo.model.AuthProvider;
import com.example.demo.model.User;
import com.example.demo.repository.LoginLogRepository;
import com.example.demo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import org.springframework.security.core.Authentication; 
import org.springframework.security.core.context.SecurityContextHolder; 
import java.util.Collections; 
import java.util.List; 


import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LoginLogRepository loginLogRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // 取得使用者列表
    @GetMapping
    public ResponseEntity<?> getUsers(Authentication authentication) {
        String currentEmail = authentication.getName();
        Optional<User> currentUserOpt = userRepository.findByEmail(currentEmail);
        
        if (currentUserOpt.isEmpty()) {
            return ResponseEntity.status(401).body("User not found");
        }
        User currentUser = currentUserOpt.get();

        if ("ADMIN".equalsIgnoreCase(currentUser.getRole())) {
            return ResponseEntity.ok(userRepository.findAll());
        } else {
            return ResponseEntity.ok(Collections.singletonList(currentUser));
        }
    }

    // 新增使用者 (Create)
    @PostMapping
    public ResponseEntity<?> createUser(@RequestBody Map<String, String> payload) {
        String name = payload.get("name");
        String email = payload.get("email");
        String role = payload.get("role"); 
        String password = payload.get("password");

        if (name == null || email == null) {
            return ResponseEntity.badRequest().body("Name and Email are required");
        }

        if (password == null || password.isEmpty()) {
            return ResponseEntity.badRequest().body("Password is required for local users");
        }

        if (userRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.badRequest().body("Email already exists");
        }

        try {
            User newUser = new User();
            newUser.setName(name);
            newUser.setEmail(email);
            newUser.setProvider(AuthProvider.LOCAL); 
            
            // newUser.setProviderId("local_" + email); 
            newUser.setRole(role != null ? role : "USER");
            newUser.setPassword(passwordEncoder.encode(password));
            newUser.setCreateTime(LocalDateTime.now());
            newUser.setLastLoginTime(null);
            
            // 手動新增的使用者 預設狀態看需求 這裡設為 true
            newUser.setActive(true);

            User savedUser = userRepository.save(newUser);
            return ResponseEntity.ok(savedUser);

        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error creating user: " + e.getMessage());
        }
    }

    // 編輯使用者 (Update)
    @PutMapping("/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        Optional<User> userOpt = userRepository.findById(id);

        if (userOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        User user = userOpt.get();

        if (payload.containsKey("name")) {
            user.setName((String) payload.get("name"));
        }
        if (payload.containsKey("role")) {
            user.setRole((String) payload.get("role"));
        }
        if (payload.containsKey("email")) {
            user.setEmail((String) payload.get("email"));
        }
        
   
        if (payload.containsKey("active")) {

            Object activeVal = payload.get("active");
            if (activeVal instanceof Boolean) {
                user.setActive((Boolean) activeVal);
                
                // 如果管理員啟用了帳號 清除之前的鎖定狀態 讓他可以立刻登入
                if ((Boolean) activeVal) {
                    user.setLoginAttempts(0);
                    user.setLockTime(null);
                }
            }
        }

        // 處理密碼更新
        if (payload.containsKey("password")) {
            String newPass = (String) payload.get("password");
            if (newPass != null && !newPass.trim().isEmpty()) {
                user.setPassword(passwordEncoder.encode(newPass));
            }
        }

        userRepository.save(user);
        return ResponseEntity.ok(user);
    }

    // 刪除使用者 (Delete)
    @DeleteMapping("/{id}")
    @Transactional 
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        if (!userRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        try {
            loginLogRepository.deleteByUserId(id);
            userRepository.deleteById(id);
            return ResponseEntity.ok("User deleted successfully");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Delete failed: " + e.getMessage());
        }
    }
}