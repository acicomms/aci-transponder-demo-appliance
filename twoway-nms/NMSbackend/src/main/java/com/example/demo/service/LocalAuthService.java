package com.example.demo.service;

import com.example.demo.model.AuthProvider;
import com.example.demo.model.LoginLog;
import com.example.demo.model.LoginStatus;
import com.example.demo.model.User;
import com.example.demo.repository.LoginLogRepository;
import com.example.demo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class LocalAuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LoginLogRepository loginLogRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // 註冊
    public User register(String name, String email, String rawPassword, String role) {
        if (userRepository.findByEmail(email).isPresent()) {
            throw new RuntimeException("Email already exists");
        }

        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(rawPassword));
        user.setRole(role != null ? role : "USER");
        user.setCreateTime(LocalDateTime.now());
        
        user.setProvider(AuthProvider.LOCAL);

        user.setActive(true);

        return userRepository.save(user);
    }

    // 登入
    public User login(String email, String rawPassword, String ipAddress) {
        Optional<User> userOpt = userRepository.findByEmail(email);

        if (userOpt.isEmpty()) {
            logFailure(null, email, ipAddress, "User not found");
            throw new RuntimeException("User not found");
        }

        User user = userOpt.get();

        //  登入檢查邏輯
        // 舊邏輯: if (user.getProvider() != AuthProvider.LOCAL) -> 錯誤  會擋住混合登入的使用者
        // 新邏輯: 檢查是否有密碼。如果有密碼，無論他上次是用 Google 還是 FB  都允許他嘗試用密碼登入
        if (user.getPassword() == null || user.getPassword().isEmpty()) {
            logFailure(user.getId(), user.getName(), ipAddress, "No local password set");
            throw new RuntimeException("此帳號是透過第三方 (Google/LINE/FB) 建立的，請使用該方式登入");
        }

        // 檢查帳號狀態
        checkAccountStatus(user);

        // 驗證
        if (!passwordEncoder.matches(rawPassword, user.getPassword())) {
            handleLoginFailure(user);
            logFailure(user.getId(), user.getName(), ipAddress, "Wrong password");
            int attemptsLeft = 5 - user.getLoginAttempts();
            throw new RuntimeException("密碼錯誤。剩餘嘗試次數：" + attemptsLeft);
        }

        user.setProvider(AuthProvider.LOCAL);

        // 重置失敗計數
        if (user.getLoginAttempts() > 0 || user.getLockTime() != null) {
            user.setLoginAttempts(0);
            user.setLockTime(null);
        }

        user.setLastLoginTime(LocalDateTime.now());
        userRepository.save(user);

        loginLogRepository.save(new LoginLog(
                user.getId(), user.getName(), ipAddress, LoginStatus.SUCCESS, "Local Login Success"));

        return user;
    }

    private void checkAccountStatus(User user) {
        if (!user.isActive()) {
            if (user.getLockTime() != null) {
                LocalDateTime unlockTime = user.getLockTime().plusMinutes(30);
                if (LocalDateTime.now().isAfter(unlockTime)) {
                    user.setActive(true);
                    user.setLockTime(null);
                    user.setLoginAttempts(0);
                    userRepository.save(user);
                } else {
                    throw new RuntimeException("帳號因多次登入失敗已被鎖定，請於 " + unlockTime + " 後再試");
                }
            } else {
                throw new RuntimeException("您的帳號尚未啟用或已被停用，請聯繫管理員");
            }
        }
    }

    private void handleLoginFailure(User user) {
        int newAttempts = user.getLoginAttempts() + 1;
        user.setLoginAttempts(newAttempts);

        if (newAttempts >= 5) {
            user.setActive(false);
            user.setLockTime(LocalDateTime.now());
        }
        userRepository.save(user);
    }

    private void logFailure(Long userId, String username, String ip, String msg) {
        loginLogRepository.save(new LoginLog(userId, username, ip, LoginStatus.FAILURE, msg));
    }
}