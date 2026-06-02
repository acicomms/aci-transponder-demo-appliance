package com.example.demo.service;

import com.example.demo.model.AuthProvider;
import com.example.demo.model.LoginLog;
import com.example.demo.model.LoginStatus;
import com.example.demo.model.User;
import com.example.demo.repository.LoginLogRepository;
import com.example.demo.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class FacebookAuthService {

    @Value("${facebook.app-id}")
    private String appId;

    @Value("${facebook.app-secret}")
    private String appSecret;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LoginLogRepository loginLogRepository;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public User facebookLogin(String code, String redirectUri, String ipAddress) {
        try {
            // 換取 Access Token
            String tokenUrl = String.format(
                "https://graph.facebook.com/v19.0/oauth/access_token?client_id=%s&client_secret=%s&redirect_uri=%s&code=%s",
                appId, appSecret, redirectUri, code
            );

            ResponseEntity<String> tokenResponse = restTemplate.getForEntity(tokenUrl, String.class);
            JsonNode tokenRoot = objectMapper.readTree(tokenResponse.getBody());
            String accessToken = tokenRoot.path("access_token").asText();

            // 換取 User Profile
            String userInfoUrl = "https://graph.facebook.com/me?fields=id,name,email,picture&access_token=" + accessToken;
            ResponseEntity<String> userResponse = restTemplate.getForEntity(userInfoUrl, String.class);

            JsonNode userRoot = objectMapper.readTree(userResponse.getBody());
            
            String fbId = userRoot.path("id").asText();
            String name = userRoot.path("name").asText();
            String email = userRoot.has("email") ? userRoot.path("email").asText() : null;
            
            String pictureUrl = null;
            if (userRoot.has("picture") && userRoot.get("picture").has("data")) {
                pictureUrl = userRoot.get("picture").get("data").path("url").asText();
            }

            //儲存或更新使用者
            User user;

            Optional<User> existingUser = userRepository.findByFacebookId(fbId);
            // Optional<User> existingUser = userRepository.findByProviderId(fbId);

            if (existingUser.isPresent()) {
                user = existingUser.get();
                user.setName(name);
                user.setPictureUrl(pictureUrl);
                user.setLastLoginTime(LocalDateTime.now());
                user.setProvider(AuthProvider.FACEBOOK);
            } else {
                if (email != null) {
                    Optional<User> userByEmail = userRepository.findByEmail(email);
                    if (userByEmail.isPresent()) {
                        user = userByEmail.get();
                        // 綁定 FB ID
                        user.setFacebookId(fbId);
                        // user.setProviderId(fbId); 

                        user.setProvider(AuthProvider.FACEBOOK);
                        user.setPictureUrl(pictureUrl);
                        user.setLastLoginTime(LocalDateTime.now());
                    } else {
                        // 全新
                        user = new User(email, name, pictureUrl, AuthProvider.FACEBOOK);
                        user.setFacebookId(fbId);
                    }
                } else {
                    // 沒 Email 也沒 FB ID -> 全新 (這種情況無法自動關聯視為新帳號)
                    user = new User(null, name, pictureUrl, AuthProvider.FACEBOOK);
                    user.setFacebookId(fbId);
                }
            }

            User savedUser = userRepository.save(user);

            // [檢查帳號狀態]
            if (!savedUser.isActive()) {
                loginLogRepository.save(new LoginLog(savedUser.getId(), savedUser.getName(), ipAddress,
                        LoginStatus.FAILURE, "Account Inactive"));
                throw new RuntimeException("您的帳號尚未啟用或已被停用，請聯繫管理員");
            }

            // 紀錄 Log
            loginLogRepository.save(new LoginLog(
                savedUser.getId(), savedUser.getName(), ipAddress, LoginStatus.SUCCESS, "Facebook Login Success"
            ));

            return savedUser;

        } catch (RuntimeException e) {
            // 優先捕捉 RuntimeException (包含 "尚未啟用")  直接拋出
            throw e;
        } catch (Exception e) {
            // 捕捉其餘 Checked Exceptions
            e.printStackTrace();
            loginLogRepository.save(new LoginLog(
                null, "Facebook_Unknown", ipAddress, LoginStatus.FAILURE, "FB Login Error: " + e.getMessage()
            ));
            throw new RuntimeException("Facebook Login Failed: " + e.getMessage(), e);
        }
    }
}