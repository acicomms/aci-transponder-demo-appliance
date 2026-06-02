package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ChartDataDTO {
    private String name;       
    private Long received;      
    private Long transmitted;   
    private Integer dr;        
    private Long freq;         
}