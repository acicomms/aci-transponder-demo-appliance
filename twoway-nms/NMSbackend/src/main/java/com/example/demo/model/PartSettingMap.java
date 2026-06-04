package com.example.demo.model;

import jakarta.persistence.*;

@Entity
@Table(
        name = "part_setting_map",
        uniqueConstraints = @UniqueConstraint(columnNames = {"part_key", "setting_key"})
)
public class PartSettingMap {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Normalized part identifier: lowercase, alphanumeric only (e.g. "amtmb").
    @Column(name = "part_key", nullable = false, length = 64)
    private String partKey;

    // Human-readable part name for reference (e.g. "AMT-MB").
    @Column(name = "part_name", length = 64)
    private String partName;

    @Column(name = "setting_key", nullable = false, length = 64)
    private String settingKey;

    // Physical port label shown in the UI (e.g. "Port 3 & 4").
    @Column(name = "port_label", length = 64)
    private String portLabel;

    public PartSettingMap() {}

    public PartSettingMap(String partKey, String partName, String settingKey, String portLabel) {
        this.partKey = partKey;
        this.partName = partName;
        this.settingKey = settingKey;
        this.portLabel = portLabel;
    }

    // Normalize a part name to a lookup key: lowercase, strip non-alphanumeric.
    // Absorbs spec hyphen form (AFM-LE) vs device space form (AFM LE).
    public static String normalizeKey(String raw) {
        if (raw == null) return "";
        return raw.toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getPartKey() { return partKey; }
    public void setPartKey(String partKey) { this.partKey = partKey; }

    public String getPartName() { return partName; }
    public void setPartName(String partName) { this.partName = partName; }

    public String getSettingKey() { return settingKey; }
    public void setSettingKey(String settingKey) { this.settingKey = settingKey; }

    public String getPortLabel() { return portLabel; }
    public void setPortLabel(String portLabel) { this.portLabel = portLabel; }
}