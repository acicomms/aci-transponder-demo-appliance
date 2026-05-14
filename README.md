# ACI Transponder Demo Appliance

這個 repository 是用來維護 **ACI Transponder onsite demo appliance** 的安裝設定。

我們在去客戶現場展示 ACI Transponder solution 之前，要確認**ACI Transponder onsite demo appliance**可以提供完整的 ChirpStack、MQTT、資料庫服務，以及 ACI NMS 環境。

---

## 目標用途

這個 appliance 主要用於：

- 客戶現場 Transponder demo
- ACI lab 測試
- Harmonic / cOS / Sonar integration 前期驗證
- Transponder telemetry data path 驗證
- ChirpStack / NMS / MQTT 本地端環境部署
- Field trial 或短期客戶端測試環境

這個 repository 只存放部署相關的設定檔、script、Docker Compose file，以及文件說明。

**請勿將實際 Docker image tar file、Clonezilla image、客戶密碼、API key、Tailscale key 或正式環境 credential 放進 GitHub。**

---

## 目標硬體

初期目標硬體：

- Dell OptiPlex 7060 Micro
- Intel Core i5-8500T
- 16GB RAM
- 256GB SSD 或以上
- Ubuntu Server 24.04 LTS

未來也可支援其他類似規格的 mini PC，例如：

- HP ProDesk Mini
- Dell OptiPlex Micro
- Lenovo ThinkCentre Tiny
- Intel NUC 類型設備

---

## 作業系統

建議使用：

```text
Ubuntu Server 24.04 LTS
```

不建議在客戶現場 demo appliance 上使用 Windows + WSL2 作為主要部署方式。

原因是 onsite appliance 需要：

- 開機後自動啟動服務
- power outage 後可自動恢復
- Docker service 穩定運作
- 遠端 SSH 維護簡單
- 網路設定清楚
- 減少 Windows Update / WSL networking 額外複雜度

---

## 主要服務

這個 appliance 預計包含以下服務：

- ChirpStack
- PostgreSQL
- Redis
- MQTT broker
- ChirpStack Gateway Bridge
- ACI NMS - (TBD)
- Tailscale remote SSH support

---

## 目前測試狀態

目前此 repository 已可以在 WSL2 / Docker Desktop 測試 ChirpStack Docker baseline。

本地端測試網址：

```text
http://localhost:8080
```

若頁面可以開啟 ChirpStack Web UI，代表基本 ChirpStack stack 已正常啟動。

---

## Repository 結構

目前主要結構如下：

```text
aci-transponder-demo-appliance/
├── README.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── install.sh
├── configuration/
│   ├── chirpstack/
│   ├── chirpstack-gateway-bridge/
│   ├── mosquitto/
│   └── postgresql/
├── docs/
├── examples/
└── scripts/
    ├── status.sh
    ├── update.sh
    └── backup.sh
```

### `docker-compose.yml`

定義要啟動哪些 container services，例如：

- ChirpStack
- PostgreSQL
- Redis
- Mosquitto MQTT
- ChirpStack Gateway Bridge

### `configuration/`

這個資料夾來自 ChirpStack Docker baseline，用來存放各服務的設定檔。

其中包含：

- ChirpStack server config
- region config，例如 US915
- ChirpStack Gateway Bridge config
- Mosquitto MQTT config
- PostgreSQL initialization scripts

請注意，目前使用的是 ChirpStack Docker package 原本的 `configuration/` folder name，因為 `docker-compose.yml` 預設會讀取這個路徑。

---

## 重要安全注意事項

請勿 commit 以下內容：

- `.env`
- 真實密碼
- 客戶 credential
- Tailscale auth key
- API key
- Docker image tar file
- Clonezilla image
- PostgreSQL backup data
- 客戶現場實際資料
- 任何正式環境 private configuration

請使用：

```text
.env.example
```

作為 template。

在每一台 appliance 上，另外建立本地使用的：

```text
.env
```

範例：

```bash
cp .env.example .env
nano .env
```

---

## 本地 WSL2 測試方式

在 Windows 11 + WSL2 + Docker Desktop 環境下，可以使用以下方式測試：

```bash
cd ~/projects/aci-transponder-demo-appliance
docker compose up -d
```

檢查 container 狀態：

```bash
docker compose ps
```

查看 logs：

```bash
docker compose logs -f
```

開啟 ChirpStack Web UI：

```text
http://localhost:8080
```

停止服務：

```bash
docker compose down
```

若要清除 container 與 volume 後重新測試：

```bash
docker compose down -v
docker compose up -d
```

---

## Appliance 部署位置

正式安裝到 mini PC appliance 時，建議放在：

```text
/opt/aci-transponder-demo
```

流程如下：

```text
1. 安裝 Ubuntu Server 24.04 LTS
2. 安裝 Docker Engine / Docker Compose plugin
3. 安裝 Tailscale
4. Clone 這個 repository
5. 複製 .env.example 為 .env
6. 更新 .env 裡面的密碼與 appliance 設定
7. 啟動 Docker Compose services
8. 測試 ChirpStack / MQTT / NMS
9. 確認 reboot 後服務可自動恢復
10. 建立 golden image
```

---

## 常用指令

檢查 appliance 狀態：

```bash
./scripts/status.sh
```

啟動服務：

```bash
docker compose up -d
```

停止服務：

```bash
docker compose down
```

查看服務狀態：

```bash
docker compose ps
```

查看 logs：

```bash
docker compose logs -f
```

更新系統與 container：

```bash
./scripts/update.sh
```

備份設定：

```bash
./scripts/backup.sh
```

---

## 遠端連線

建議使用：

```text
Tailscale + SSH
```

正常情況下，不建議直接把 SSH port 開放到 public Internet。

遠端維護建議流程：

```text
ACI engineer laptop
    ↓
Tailscale
    ↓
Demo appliance
    ↓
SSH / Docker / logs / config
```

---

## 版本管理

建議使用以下版本命名方式：

```text
v0.1-lab-test
v0.2-chirpstack-added
v0.3-nms-added
v1.0-customer-demo-ready
v1.1-field-update
```

每次更新請同步更新：

```text
docs/release-notes.md
```

---

## 聯絡窗口

ACI owner:

```text
Jeff Lu
```

這個 repository 目前作為 ACI Transponder demo appliance 的config與文件管理。
