package com.example.demo.service;

import java.util.Optional;


public enum SettingDefinition {

    // ----- (1) Alarms -----
    TEMP_HIGH            ("temp-high",            (byte) 0x90, (byte) 0x00, 2, 10,  -500, 1500, EncodingType.INT16_LE,  "Temperature High Alarm"),
    TEMP_LOW             ("temp-low",             (byte) 0x90, (byte) 0x02, 2, 10,  -500, 1500, EncodingType.INT16_LE,  "Temperature Low Alarm"),
    VOLT_HIGH            ("volt-high",            (byte) 0x90, (byte) 0x04, 2, 10,     0,  300, EncodingType.UINT16_LE, "24V High Alarm"),
    VOLT_LOW             ("volt-low",             (byte) 0x90, (byte) 0x06, 2, 10,     0,  300, EncodingType.UINT16_LE, "24V Low Alarm"),
    RIPPLE_HIGH          ("ripple-high",          (byte) 0x90, (byte) 0x08, 2,  1,     0, 1000, EncodingType.UINT16_LE, "Ripple High Alarm"),
    RF_OUT_HIGH          ("rf-out-high",          (byte) 0x90, (byte) 0x0C, 2, 10,     0,  800, EncodingType.UINT16_LE, "RF Output Total Power High Alarm"),
    RF_OUT_LOW           ("rf-out-low",           (byte) 0x90, (byte) 0x0E, 2, 10,     0,  800, EncodingType.UINT16_LE, "RF Output Total Power Low Alarm"),

    // ----- (2) RF mode -----
//    DFU_TYPE             ("dfu-type",             (byte) 0x90, (byte) 0x16, 1,  1,     1,    6, EncodingType.UINT8,     "DFU type",                       new int[]{1, 3, 5, 6}),
    ALSC                 ("alsc",                 (byte) 0x90, (byte) 0x18, 1,  1,     0,    1, EncodingType.UINT8,     "ALSC (FWD AGC Mode)"),
    SETTING_MODE         ("setting-mode",         (byte) 0x90, (byte) 0x17, 1,  1,     0,    3, EncodingType.UINT8,     "Setting Mode",                   new int[]{0, 1, 3}),

    // ----- (3) RF loading & pilot -----
    FWD_LOADING_LOW_FREQ ("fwd-loading-low-freq", (byte) 0x90, (byte) 0x1A, 2,  1,   258, 1794, EncodingType.UINT16_LE, "FWD Loading Low Freq"),
    FWD_LOADING_HIGH_FREQ("fwd-loading-high-freq",(byte) 0x90, (byte) 0x1C, 2,  1,   258, 1794, EncodingType.UINT16_LE, "FWD Loading High Freq"),
    FWD_LOADING_PWR_LOW  ("fwd-loading-pwr-low",  (byte) 0x90, (byte) 0x1E, 2, 10,   200,  540, EncodingType.UINT16_LE, "FWD Loading Pwr @ Low Freq"),
    FWD_LOADING_PWR_HIGH ("fwd-loading-pwr-high", (byte) 0x90, (byte) 0x20, 2, 10,   200,  540, EncodingType.UINT16_LE, "FWD Loading Pwr @ High Freq"),
    FWD_PILOT_LOW_FREQ   ("fwd-pilot-low-freq",   (byte) 0x90, (byte) 0x22, 2,  1,   261, 1791, EncodingType.UINT16_LE, "FWD Pilot Low Freq"),
    FWD_PILOT_HIGH_FREQ  ("fwd-pilot-high-freq",  (byte) 0x90, (byte) 0x24, 2,  1,   261, 1791, EncodingType.UINT16_LE, "FWD Pilot High Freq"),

    // ----- (4) REV Ingress + FWD E-CEQ + RF output log minutes -----
    REV_INGRESS_1        ("rev-ingress-1",        (byte) 0x90, (byte) 0x10, 1,  1,     0,    4, EncodingType.UINT8,     "REV Ingress Setting #1"),
    REV_INGRESS_2        ("rev-ingress-2",        (byte) 0x90, (byte) 0x11, 1,  1,     0,    4, EncodingType.UINT8,     "REV Ingress Setting #2"),
    REV_INGRESS_3        ("rev-ingress-3",        (byte) 0x90, (byte) 0x12, 1,  1,     0,    4, EncodingType.UINT8,     "REV Ingress Setting #3"),
    FWD_ECEQ_INDEX       ("fwd-eceq-index",       (byte) 0x90, (byte) 0x13, 1,  1,     0,   24, EncodingType.UINT8,     "FWD E-CEQ Index"),
    RF_OUTPUT_LOG_MIN    ("rf-output-log-min",    (byte) 0x90, (byte) 0x14, 1,  1,     0,  240, EncodingType.UINT8,     "RF Output Log in Minutes",       new int[]{0, 30, 60, 120, 180, 240}),

    // ----- (5) Status Mask (7 entries, R103) -----
    MASK_PILOT_LOW_FREQ  ("mask-pilot-low-freq",  (byte) 0x90, (byte) 0x28, 1,  1,     0,    1, EncodingType.UINT8,     "Status Mask RF Output Pilot Low Frequency"),
    MASK_PILOT_HIGH_FREQ ("mask-pilot-high-freq", (byte) 0x90, (byte) 0x29, 1,  1,     0,    1, EncodingType.UINT8,     "Status Mask RF Output Pilot High Frequency"),
    MASK_TEMPERATURE     ("mask-temperature",     (byte) 0x90, (byte) 0x2A, 1,  1,     0,    1, EncodingType.UINT8,     "Status Mask Temperature"),
    MASK_VOLT_24V        ("mask-volt-24v",        (byte) 0x90, (byte) 0x2B, 1,  1,     0,    1, EncodingType.UINT8,     "Status Mask 24V"),
    MASK_TAMP_SWITCH     ("mask-tamp-switch",     (byte) 0x90, (byte) 0x30, 1,  1,     0,    1, EncodingType.UINT8,     "Status Mask Tamp Switch"),
    MASK_VOLT_24V_RIPPLE ("mask-volt-24v-ripple", (byte) 0x90, (byte) 0x31, 1,  1,     0,    1, EncodingType.UINT8,     "Status Mask 24V Ripple"),
    MASK_RF_OUT_TOTAL    ("mask-rf-out-total",    (byte) 0x90, (byte) 0x32, 1,  1,     0,    1, EncodingType.UINT8,     "Status Mask RF Output Total Power"),

    // ----- (6) System log minutes -----
    SYS_LOG_MIN          ("sys-log-min",          (byte) 0x90, (byte) 0x93, 1,  1,     0,  240, EncodingType.UINT8,     "System Log in Minutes",          new int[]{0, 1, 2, 3, 5, 10, 15, 30, 60, 120, 180, 240}),

    // ----- (7) Bench Mode FWD Input (Port 1) -----
    FWD_INPUT_PAD_P1     ("fwd-input-pad-p1",     (byte) 0x90, (byte) 0x94, 2, 10,     0,  200, EncodingType.UINT16_LE, "Port 1 FWD Input PAD"),
    FWD_INPUT_EQ_P1      ("fwd-input-eq-p1",      (byte) 0x90, (byte) 0x96, 2, 10,     0,  120, EncodingType.UINT16_LE, "Port 1 FWD Input EQ"),

    // ----- (8) Bench Mode FWD Output (per port group) -----
    // 0xA2 / 0xAA = PAD #1 / PAD #2 (port assignment depends on partType)
    // 0xAC / 0xAE = EQ  #1 / EQ  #2 (same logic)
    FWD_OUTPUT_PAD_GRP1  ("fwd-output-pad-grp1",  (byte) 0x90, (byte) 0xA2, 2, 10,     0,  200, EncodingType.UINT16_LE, "FWD Output PAD (group 1)",       null, new String[]{"SDAT", "SDAM", "AMT MB", "AFM TR", "AFM BR"}),
    FWD_OUTPUT_PAD_GRP2  ("fwd-output-pad-grp2",  (byte) 0x90, (byte) 0xAA, 2, 10,     0,  200, EncodingType.UINT16_LE, "FWD Output PAD (group 2)",       null, new String[]{"SDAT", "AFM TR"}),
    FWD_OUTPUT_EQ_GRP1   ("fwd-output-eq-grp1",   (byte) 0x90, (byte) 0xAC, 2, 10,     0,  120, EncodingType.UINT16_LE, "FWD Output EQ (group 1)",        null, new String[]{"SDAT", "AFM TR", "AFM BR"}),
    FWD_OUTPUT_EQ_GRP2   ("fwd-output-eq-grp2",   (byte) 0x90, (byte) 0xAE, 2, 10,     0,  120, EncodingType.UINT16_LE, "FWD Output EQ (group 2)",        null, new String[]{"SDAT", "AFM TR"}),

    // ----- (9) Bench Mode REV (per port group) -----
    REV_INPUT_PAD_GRP1   ("rev-input-pad-grp1",   (byte) 0x90, (byte) 0x9C, 2, 10,     0,  200, EncodingType.UINT16_LE, "REV Input PAD (group 1)",        null, new String[]{"SDAT", "SDAM", "SDLE", "AMT MB", "AMT BLE", "AFM LE", "AFM TR"}),
    REV_INPUT_PAD_GRP2   ("rev-input-pad-grp2",   (byte) 0x90, (byte) 0xA6, 2, 10,     0,  200, EncodingType.UINT16_LE, "REV Input PAD (group 2)",        null, new String[]{"SDAT", "SDAM", "AMT MB", "AFM TR", "AFM BR"}),
    REV_INPUT_PAD_GRP3   ("rev-input-pad-grp3",   (byte) 0x90, (byte) 0xA8, 2, 10,     0,  200, EncodingType.UINT16_LE, "REV Input PAD (group 3)",        null, new String[]{"SDAT", "SDAM", "AMT MB", "AFM TR", "AFM BR"}),
    REV_OUTPUT_EQ_P1     ("rev-output-eq-p1",     (byte) 0x90, (byte) 0x9E, 2, 10,     0,  200, EncodingType.UINT16_LE, "Port 1 REV Output EQ"),
    REV_OUTPUT_PAD_P1    ("rev-output-pad-p1",    (byte) 0x90, (byte) 0xA4, 2, 10,     0,  200, EncodingType.UINT16_LE, "Port 1 REV Output PAD");

    public enum EncodingType {
        INT16_LE,   // signed 2-byte little-endian   (temp alarms)
        UINT16_LE,  // unsigned 2-byte little-endian (voltage, ripple, freq, pwr, PAD, EQ)
        UINT8       // unsigned 1-byte               (DFU type, ALSC, masks, ingress, eceq, log min)
    }

    private final String settingKey;
    private final byte frame;
    private final byte hexIndex;
    private final int byteLen;
    private final int scale;
    private final int minRaw;
    private final int maxRaw;
    private final EncodingType encoding;
    private final String displayName;
    private final int[] allowedValues;            // null when minRaw/maxRaw range alone is authoritative
    private final String[] applicablePartTypes;   // null = applies to all part types

    // 9-arg form: range-only, all part types.
    SettingDefinition(String settingKey, byte frame, byte hexIndex,
                      int byteLen, int scale, int minRaw, int maxRaw,
                      EncodingType encoding, String displayName) {
        this(settingKey, frame, hexIndex, byteLen, scale, minRaw, maxRaw,
                encoding, displayName, null, null);
    }

    // 10-arg form: range + allowedValues, all part types.
    SettingDefinition(String settingKey, byte frame, byte hexIndex,
                      int byteLen, int scale, int minRaw, int maxRaw,
                      EncodingType encoding, String displayName,
                      int[] allowedValues) {
        this(settingKey, frame, hexIndex, byteLen, scale, minRaw, maxRaw,
                encoding, displayName, allowedValues, null);
    }

    // 11-arg form
    SettingDefinition(String settingKey, byte frame, byte hexIndex,
                      int byteLen, int scale, int minRaw, int maxRaw,
                      EncodingType encoding, String displayName,
                      int[] allowedValues, String[] applicablePartTypes) {
        this.settingKey = settingKey;
        this.frame = frame;
        this.hexIndex = hexIndex;
        this.byteLen = byteLen;
        this.scale = scale;
        this.minRaw = minRaw;
        this.maxRaw = maxRaw;
        this.encoding = encoding;
        this.displayName = displayName;
        this.allowedValues = allowedValues;
        this.applicablePartTypes = applicablePartTypes;
    }

    public String getSettingKey()             { return settingKey; }
    public byte   getFrame()                  { return frame; }
    public byte   getHexIndex()               { return hexIndex; }
    public int    getByteLen()                { return byteLen; }
    public int    getScale()                  { return scale; }
    public int    getMinRaw()                 { return minRaw; }
    public int    getMaxRaw()                 { return maxRaw; }
    public EncodingType getEncoding()         { return encoding; }
    public String getDisplayName()            { return displayName; }
    public int[]  getAllowedValues()          { return allowedValues; }
    public String[] getApplicablePartTypes()  { return applicablePartTypes; }

    /**
     * True if this SET applies to a device with the given partName
     */
    public boolean appliesTo(String partName) {
        if (applicablePartTypes == null) return true;
        if (partName == null || partName.isBlank()) return true;
        String key = partName.trim();
        for (String pt : applicablePartTypes) {
            if (pt.equalsIgnoreCase(key)) return true;
        }
        return false;
    }

    /** Lookup by URL slug. Returns Optional.empty() if not found. Case-sensitive. */
    public static Optional<SettingDefinition> fromKey(String key) {
        if (key == null) return Optional.empty();
        for (SettingDefinition s : values()) {
            if (s.settingKey.equals(key)) return Optional.of(s);
        }
        return Optional.empty();
    }
}