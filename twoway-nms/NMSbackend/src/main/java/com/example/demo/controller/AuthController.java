package com.example.demo.controller;

import com.example.demo.dto.AuthResponse;
import com.example.demo.model.User;
import com.example.demo.repository.LoginLogRepository;
import com.example.demo.repository.UserRepository;
import com.example.demo.security.JwtUtils;
import com.example.demo.service.GoogleAuthService;
import com.example.demo.service.LineAuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
import com.example.demo.service.FacebookAuthService;
import com.example.demo.service.LocalAuthService;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private LineAuthService lineAuthService;

    @Autowired
    private GoogleAuthService googleAuthService;

    @Autowired
    private LoginLogRepository loginLogRepository;

    @Autowired
    private FacebookAuthService facebookAuthService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private LocalAuthService localAuthService;

    // 開放給外部使用的註冊
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> payload) {
        try {
            String name = payload.get("name");
            String email = payload.get("email");
            String password = payload.get("password");

            User user = localAuthService.register(name, email, password, "USER");

            return ResponseEntity.ok(user);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Registration failed: " + e.getMessage());
        }
    }

    // 本地登入
    @PostMapping("/login")
    public ResponseEntity<?> localLogin(@RequestBody Map<String, String> payload, HttpServletRequest request) {
        try {

            User user = localAuthService.login(payload.get("email"), payload.get("password"), getIpAddress(request));

            String token = jwtUtils.generateToken(user.getEmail());

            return ResponseEntity.ok(new AuthResponse(token, user));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(e.getMessage());
        }
    }

    // 取得所有登入紀錄
    @GetMapping("/history")
    public ResponseEntity<?> getAllLoginLogs() {
        // 倒序排列
        return ResponseEntity.ok(loginLogRepository.findAll(Sort.by(Sort.Direction.DESC, "loginTime")));
    }

    @GetMapping("/logs/{userId}")
    public ResponseEntity<?> getLoginLogs(@PathVariable Long userId) {
        return ResponseEntity.ok(loginLogRepository.findByUserIdOrderByLoginTimeDesc(userId));
    }

    // 取得 IP
    private String getIpAddress(HttpServletRequest request) {
        String ipAddress = request.getHeader("X-Forwarded-For");
        if (ipAddress == null || ipAddress.isEmpty()) {
            ipAddress = request.getRemoteAddr();
        }
        return ipAddress;
    }





    
    // Line Login
    @PostMapping("/line")
    public ResponseEntity<?> lineLogin(@RequestBody Map<String, String> payload, HttpServletRequest request) {
        String code = payload.get("code");

        // 取得 IP
        String ipAddress = request.getHeader("X-Forwarded-For");
        if (ipAddress == null || ipAddress.isEmpty()) {
            ipAddress = request.getRemoteAddr();
        }

        if (code == null) {
            return ResponseEntity.badRequest().body("Code is required");
        }

        try {
            // 傳入 IP
            User user = lineAuthService.lineLogin(code, ipAddress);

            if (!user.isActive()) {
                return ResponseEntity.status(403).body("您的帳號尚未啟用，請等待管理員審核");
            }


            String token = jwtUtils.generateToken(user.getEmail());
            return ResponseEntity.ok(new AuthResponse(token, user));
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Login failed: " + e.getMessage());
        }
    }

    // Google Login
    @PostMapping("/google")
    public ResponseEntity<?> googleLogin(@RequestBody Map<String, String> payload, HttpServletRequest request) {
        String code = payload.get("code");
        String redirectUri = payload.get("redirectUri"); // Google 驗證需要 redirectUri
        String ipAddress = getIpAddress(request);

        if (code == null)
            return ResponseEntity.badRequest().body("Code is required");
        if (redirectUri == null)
            return ResponseEntity.badRequest().body("Redirect URI is required");

        try {
            User user = googleAuthService.googleLogin(code, redirectUri, ipAddress);


            if (!user.isActive()) {
                return ResponseEntity.status(403).body("您的帳號尚未啟用，請等待管理員審核");
            }

            
            String token = jwtUtils.generateToken(user.getEmail());

            return ResponseEntity.ok(new AuthResponse(token, user));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Google Login failed: " + e.getMessage());
        }
    }

    // Facebook Login
    @PostMapping("/facebook")
    public ResponseEntity<?> facebookLogin(@RequestBody Map<String, String> payload, HttpServletRequest request) {
        String code = payload.get("code");
        // 前端傳來的 redirectUri，必須跟前端發起登入時設定的完全一樣
        String redirectUri = payload.get("redirectUri");

        String ipAddress = getIpAddress(request);

        if (code == null)
            return ResponseEntity.badRequest().body("Code is required");
        // Facebook 對 redirectUri 檢查極嚴格 建議從前端傳過來以確保一致
        if (redirectUri == null)
            return ResponseEntity.badRequest().body("Redirect URI is required");

        try {
            User user = facebookAuthService.facebookLogin(code, redirectUri, ipAddress);
        

            if (!user.isActive()) {
                return ResponseEntity.status(403).body("您的帳號尚未啟用，請等待管理員審核");
            }
            
            String token = jwtUtils.generateToken(user.getEmail());
            return ResponseEntity.ok(new AuthResponse(token, user));
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Facebook Login failed: " + e.getMessage());
        }
    }

}