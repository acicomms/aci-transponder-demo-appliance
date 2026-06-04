package com.example.demo.config;

import com.example.demo.model.PartSettingMap;
import com.example.demo.repository.PartSettingMapRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class PartSettingMapInitializer implements CommandLineRunner {

    @Autowired
    private PartSettingMapRepository repository;

    @Override
    public void run(String... args) {
        if (repository.count() > 0) return;

        System.out.println("part_setting_map 為空，正在填入機種 port 對照種子資料...");

        List<PartSettingMap> seed = new ArrayList<>();

        // ----- AMT-MB (Port 1~4, 14 entries) -----
        addRow(seed, "AMT-MB", "fwd-input-pad-p1",    "Port 1");
        addRow(seed, "AMT-MB", "fwd-input-eq-p1",     "Port 1");
        addRow(seed, "AMT-MB", "rev-input-pad-grp1",  "Port 2");
        addRow(seed, "AMT-MB", "rev-output-eq-p1",    "Port 1");
        addRow(seed, "AMT-MB", "rev-output-pad-p1",   "Port 1");
        addRow(seed, "AMT-MB", "fwd-output-pad-grp1", "Port 2");
        addRow(seed, "AMT-MB", "fwd-output-eq-grp1",  "Port 2");
        addRow(seed, "AMT-MB", "fwd-output-pad-grp2", "Port 3 & 4");
        addRow(seed, "AMT-MB", "fwd-output-eq-grp2",  "Port 3 & 4");
        addRow(seed, "AMT-MB", "rev-input-pad-grp2",  "Port 3");
        addRow(seed, "AMT-MB", "rev-input-pad-grp3",  "Port 4");
        addRow(seed, "AMT-MB", "rev-ingress-1",       "Port 2");
        addRow(seed, "AMT-MB", "rev-ingress-2",       "Port 3");
        addRow(seed, "AMT-MB", "rev-ingress-3",       "Port 4");

        // ----- AMT-BLE (Port 1~2, 6 entries) -----
        addRow(seed, "AMT-BLE", "fwd-input-pad-p1",   "Port 1");
        addRow(seed, "AMT-BLE", "fwd-input-eq-p1",    "Port 1");
        addRow(seed, "AMT-BLE", "rev-input-pad-grp1", "Port 2");
        addRow(seed, "AMT-BLE", "rev-output-eq-p1",   "Port 1");
        addRow(seed, "AMT-BLE", "rev-output-pad-p1",  "Port 1");
        addRow(seed, "AMT-BLE", "rev-ingress-1",      "Port 2");

        // ----- AFM-LE (same port layout as AMT-BLE, 6 entries) -----
        addRow(seed, "AFM-LE", "fwd-input-pad-p1",    "Port 1");
        addRow(seed, "AFM-LE", "fwd-input-eq-p1",     "Port 1");
        addRow(seed, "AFM-LE", "rev-input-pad-grp1",  "Port 2");
        addRow(seed, "AFM-LE", "rev-output-eq-p1",    "Port 1");
        addRow(seed, "AFM-LE", "rev-output-pad-p1",   "Port 1");
        addRow(seed, "AFM-LE", "rev-ingress-1",       "Port 2");

        repository.saveAll(seed);
        System.out.println("part_setting_map 種子資料已填入 " + seed.size() + " 筆");
    }

    private void addRow(List<PartSettingMap> list, String partName, String settingKey, String portLabel) {
        list.add(new PartSettingMap(PartSettingMap.normalizeKey(partName), partName, settingKey, portLabel));
    }
}