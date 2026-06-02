package com.example.demo.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "login_logs")
@Data
@NoArgsConstructor
public class LoginLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;


    @ManyToOne
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    private String username;      // 登入當下的名稱 (若 User 被刪除，這裡還留有紀錄)
    
    private String ipAddress;
    
    @Enumerated(EnumType.STRING)
    private LoginStatus status;

    private String message;
    
    private LocalDateTime loginTime;


    public LoginLog(Long userId, String username, String ipAddress, LoginStatus status, String message) {
        this.userId = userId;
        this.username = username;
        this.ipAddress = ipAddress;
        this.status = status;
        this.message = message;
        this.loginTime = LocalDateTime.now();
    }
}