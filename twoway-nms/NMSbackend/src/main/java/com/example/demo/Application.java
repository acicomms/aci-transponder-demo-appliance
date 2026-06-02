package com.example.demo;

import jakarta.annotation.PostConstruct;
import java.util.TimeZone;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;


@SpringBootApplication
@EnableScheduling // 啟動背景定時任務功能
public class Application {

	public static void main(String[] args) {
		SpringApplication.run(Application.class, args);
	}

	
    @PostConstruct
    public void init() {
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Taipei"));
    }

}
