package com.example.demo.security;

import com.example.demo.model.User;
import com.example.demo.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

import java.util.Collections;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User Not Found with email: " + email));

        // 將資料庫的 active 狀態傳遞給 Spring Security
        // boolean enabled = user.isActive();
        // boolean accountNonExpired = true;
        // boolean credentialsNonExpired = true;
        // boolean accountNonLocked = true; 
        
        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPassword() == null ? "" : user.getPassword(),
                user.isActive(), // enabled
                true, // accountNonExpired
                true, // credentialsNonExpired
                true, // accountNonLocked
                Collections.emptyList());
    }
}