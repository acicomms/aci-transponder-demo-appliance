package com.example.demo.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String googleId;

    @Column(unique = true)
    private String lineId;

    @Column(unique = true)
    private String facebookId;

    // 記錄最近一次是用什麼方式登入的
    @Enumerated(EnumType.STRING)
    @JsonProperty("authProvider")
    private AuthProvider provider; // Last Login Provider

    private String name;

    @Column(unique = true)
    private String email;

    @Column(columnDefinition = "TEXT")
    private String pictureUrl;

    private String role;

    // 密碼欄位 只有 provider=LOCAL 時會有值，其他為 NULL
    @JsonIgnore
    private String password;

    private LocalDateTime createTime;
    private LocalDateTime lastLoginTime;

    // 帳號狀態與鎖定機制欄位
    @Column(nullable = false)
    private boolean active = true; // 預設為 true (給手動註冊用)OAuth 需覆寫

    private int loginAttempts = 0; // 登入失敗次數

    private LocalDateTime lockTime; // 被鎖定的時間點

    public User(String email, String name, String pictureUrl, AuthProvider provider) {
        this.email = email;
        this.name = name;
        this.pictureUrl = pictureUrl;
        this.provider = provider;
        this.role = "USER";
        this.createTime = LocalDateTime.now();
        this.lastLoginTime = LocalDateTime.now();
        this.active = false; // OAuth 預設停用 , true的話使用OAuth會直接登入
        this.loginAttempts = 0;
    }
}