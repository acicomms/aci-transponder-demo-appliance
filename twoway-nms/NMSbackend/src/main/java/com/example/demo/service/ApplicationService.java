package com.example.demo.service;

import com.example.demo.model.ChirpStackApp;
import com.example.demo.repository.ChirpStackAppRepository;
import io.chirpstack.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ApplicationService {

    @Autowired
    private ApplicationServiceGrpc.ApplicationServiceBlockingStub appStub;

    @Autowired
    private ChirpStackAppRepository appRepository;

    @Value("${chirpstack.tenant-id}")
    private String tenantId;

    public List<ChirpStackApp> syncFromChirpStack() {
        ListApplicationsRequest req = ListApplicationsRequest.newBuilder()
                .setTenantId(tenantId).setLimit(100).build();
        ListApplicationsResponse resp = appStub.list(req);

        List<ChirpStackApp> entities = resp.getResultList().stream().map(item -> {
            ChirpStackApp app = new ChirpStackApp();
            app.setId(item.getId());
            app.setName(item.getName());
            app.setDescription(item.getDescription());
            app.setLastSyncTime(LocalDateTime.now());
            return app;
        }).collect(Collectors.toList());

        List<ChirpStackApp> saved = appRepository.saveAll(entities);

        // Reconcile: ChirpStack 是 application 的唯一真實來源
        java.util.Set<String> keepIds = saved.stream()
                .map(ChirpStackApp::getId)
                .collect(Collectors.toSet());
        List<ChirpStackApp> stale = appRepository.findAll().stream()
                .filter(a -> !keepIds.contains(a.getId()))
                .collect(Collectors.toList());
        if (!stale.isEmpty()) {
            appRepository.deleteAll(stale);
            System.out.println(" [Application Sync] prune 幽靈列 " + stale.size()
                    + " 筆: " + stale.stream()
                    .map(ChirpStackApp::getId)
                    .collect(Collectors.toList()));
        }

        return saved;
    }

    public List<ChirpStackApp> getAllFromLocal() {
        return appRepository.findAll();
    }

    // ==========================================
    // Create Application (透過 ChirpStack gRPC)
    // return {id, name, description} 給 controller
    // ==========================================
    public Map<String, String> createApplication(String name, String description) {
        Application newApp = Application.newBuilder()
                .setName(name)
                .setDescription(description != null ? description : "")
                .setTenantId(tenantId)
                .build();

        CreateApplicationRequest req = CreateApplicationRequest.newBuilder()
                .setApplication(newApp)
                .build();

        CreateApplicationResponse resp = appStub.create(req);
        String newId = resp.getId();

        System.out.println(" [Application Create] id=" + newId + ", name=" + name);

        Map<String, String> result = new HashMap<>();
        result.put("id", newId);
        result.put("name", name);
        result.put("description", description != null ? description : "");
        return result;
    }

    // ==========================================
    // Update Application (get-then-modify, 只動 name/description)
    // 跟 GatewayService.updateGatewayLocation 同作法, keep其他欄位
    // ==========================================
    public void updateApplication(String id, String name, String description) {
        GetApplicationRequest getReq = GetApplicationRequest.newBuilder()
                .setId(id)
                .build();
        Application current = appStub.get(getReq).getApplication();

        Application updated = current.toBuilder()
                .setName(name)
                .setDescription(description != null ? description : "")
                .build();

        UpdateApplicationRequest req = UpdateApplicationRequest.newBuilder()
                .setApplication(updated)
                .build();

        appStub.update(req);
        System.out.println(" [Application Update] id=" + id + ", name=" + name);
    }

    // ==========================================
    // Delete Application (ChirpStack v4 cascade delete devices)
    // ==========================================
    public void deleteApplication(String id) {
        DeleteApplicationRequest req = DeleteApplicationRequest.newBuilder()
                .setId(id)
                .build();

        appStub.delete(req);
        System.out.println(" [Application Delete] id=" + id);
    }
}