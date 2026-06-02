package com.example.demo.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.chirpstack.api.ApplicationServiceGrpc;
import io.chirpstack.api.DeviceProfileServiceGrpc;
import io.chirpstack.api.DeviceServiceGrpc;
import io.chirpstack.api.GatewayServiceGrpc;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.Metadata;
import io.grpc.stub.MetadataUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ChirpStackConfig {

    @Value("${chirpstack.host}")
    private String host;

    @Value("${chirpstack.port}")
    private int port;

    @Value("${chirpstack.api-token}")
    private String apiToken;

    @Bean
    public ManagedChannel managedChannel() {
        return ManagedChannelBuilder.forAddress(host, port)
                .usePlaintext() // 若 ChirpStack 未開啟 TLS 則使用純文本
                .build();
    }

    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        return mapper;
    }

    private Metadata getAuthHeader() {
        Metadata header = new Metadata();
        Metadata.Key<String> key = Metadata.Key.of("authorization", Metadata.ASCII_STRING_MARSHALLER);
        header.put(key, "Bearer " + apiToken);
        return header;
    }

    @Bean
    public GatewayServiceGrpc.GatewayServiceBlockingStub gatewayStub(ManagedChannel channel) {
        return GatewayServiceGrpc.newBlockingStub(channel)
                .withInterceptors(MetadataUtils.newAttachHeadersInterceptor(getAuthHeader()));
    }

    @Bean
    public DeviceServiceGrpc.DeviceServiceBlockingStub deviceStub(ManagedChannel channel) {
        return DeviceServiceGrpc.newBlockingStub(channel)
                .withInterceptors(MetadataUtils.newAttachHeadersInterceptor(getAuthHeader()));
    }

    @Bean
    public ApplicationServiceGrpc.ApplicationServiceBlockingStub applicationStub(ManagedChannel channel) {
        return ApplicationServiceGrpc.newBlockingStub(channel)
                .withInterceptors(MetadataUtils.newAttachHeadersInterceptor(getAuthHeader()));
    }

    @Bean
    public DeviceProfileServiceGrpc.DeviceProfileServiceBlockingStub deviceProfileStub(ManagedChannel channel) {
        return DeviceProfileServiceGrpc.newBlockingStub(channel)
                .withInterceptors(MetadataUtils.newAttachHeadersInterceptor(getAuthHeader()));
    }
}