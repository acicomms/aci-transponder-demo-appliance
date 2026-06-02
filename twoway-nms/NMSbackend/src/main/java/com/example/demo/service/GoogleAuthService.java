package com.example.demo.service;

import com.example.demo.model.AuthProvider;
import com.example.demo.model.LoginLog;
import com.example.demo.model.LoginStatus;
import com.example.demo.model.User;
import com.example.demo.repository.LoginLogRepository;
import com.example.demo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

@Service
public class GoogleAuthService {

    @Value("${google.client-id}")
    private String clientId;

    @Value("${google.client-secret}")
    private String clientSecret;

    @Value("${google.token-uri}")
    private String tokenUri;

    @Value("${google.user-info-uri}")
    private String userInfoUri;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LoginLogRepository loginLogRepository; 

    public User googleLogin(String code, String redirectUri, String ipAddress) {
        try {
            //用 Code 換 Token
            String accessToken = getAccessToken(code, redirectUri);

            //用 Token 換 User Info
            Map<String, Object> googleUserInfo = getUserInfo(accessToken);

            //處理使用者資料
            String googleSub = (String) googleUserInfo.get("sub"); // Google 的唯一 ID
            String email = (String) googleUserInfo.get("email");
            String name = (String) googleUserInfo.get("name");
            String picture = (String) googleUserInfo.get("picture");

            // 邏輯：
            // A. 先查 providerId (Google sub) -> 舊使用者登入
            // B. 若無，查 email -> 可能是之前用 LINE 登入但有點過 Email，或是手動註冊過 -> 進行關聯
            // C. 若無，建立新帳號

            User user;
            // 優先用 Google ID 找 
            Optional<User> existingUser = userRepository.findByGoogleId(googleSub);
            // Optional<User> existingUser = userRepository.findByProviderId(googleSub);

            if (existingUser.isPresent()) {
                user = existingUser.get();

                user.setName(name);
                user.setPictureUrl(picture);
                user.setLastLoginTime(LocalDateTime.now());
                user.setProvider(AuthProvider.GOOGLE); // 更新最後登入方式
            } else {
                // Google ID 找不到 嘗試用 Email 找 (帳號關聯)
                Optional<User> userByEmail = userRepository.findByEmail(email);
                
                if (userByEmail.isPresent()) {
                    user = userByEmail.get();
                    // 綁定 Google ID  但不影響原本的 FacebookId/LineId
                    user.setGoogleId(googleSub);
                    
                    user.setProvider(AuthProvider.GOOGLE);
                    user.setPictureUrl(picture);
                    user.setLastLoginTime(LocalDateTime.now());
                } else {
                    // 全新使用者
                    user = new User(email, name, picture, AuthProvider.GOOGLE);
                    user.setGoogleId(googleSub); // 設定 Google ID
                }
            }

            User savedUser = userRepository.save(user);



            // 檢查帳號狀態
            if (!savedUser.isActive()) {
                // 這裡不需處理 30分鐘解鎖 因為 OAuth 通常不適用密碼錯誤鎖定
                // 這裡的 Inactive 通常是新人等待審核或被管理員停權
                loginLogRepository.save(new LoginLog(savedUser.getId(), savedUser.getName(), ipAddress, LoginStatus.FAILURE, "Account Inactive"));
                throw new RuntimeException("您的帳號尚未啟用或已被停用，請聯繫管理員");
            }



            //  紀錄成功 Log
            loginLogRepository.save(new LoginLog(
                    savedUser.getId(),
                    savedUser.getName(),
                    ipAddress,
                    LoginStatus.SUCCESS,
                    "Google Login Success"
            ));

            return savedUser;

        } catch (Exception e) {
            // 紀錄失敗 Log
            e.printStackTrace();
            loginLogRepository.save(new LoginLog(
                    null,
                    "Google_Unknown",
                    ipAddress,
                    LoginStatus.FAILURE,
                    "Google Login Error: " + e.getMessage()
            ));
            throw e;
        }
    }

    private String getAccessToken(String code, String redirectUri) {
        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("code", code);
        params.add("client_id", clientId);
        params.add("client_secret", clientSecret);
        params.add("redirect_uri", redirectUri);
        params.add("grant_type", "authorization_code");

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(params, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(tokenUri, request, Map.class);
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return (String) response.getBody().get("access_token");
            }
        } catch (Exception e) {
            throw new RuntimeException("Google 換取 Token 失敗: " + e.getMessage());
        }
        throw new RuntimeException("無法取得 Google Access Token");
    }

    private Map<String, Object> getUserInfo(String accessToken) {
        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);

        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(userInfoUri, HttpMethod.GET, entity, Map.class);
            if (response.getStatusCode() == HttpStatus.OK) {
                return response.getBody();
            }
        } catch (Exception e) {
            throw new RuntimeException("取得 Google User Info 失敗: " + e.getMessage());
        }
        throw new RuntimeException("無法取得 Google User Info");
    }
}