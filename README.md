# ACI Transponder Demo Appliance

這個 repository 是用來維護 **ACI Transponder onsite demo appliance** 的安裝設定。

這台 appliance 的目標是提供一個可攜式、可重複部署的本地 demo 環境，讓我們在客戶現場展示 ACI Transponder solution 時，可以提供完整的 ChirpStack、MQTT、資料庫服務，以及 ACI NMS 環境。

---

## 目標用途

這個 appliance 主要用於：

- 客戶現場 Transponder demo
- ACI lab 測試
- Harmonic / cOS / Sonar integration 前期驗證
- Transponder telemetry data path 驗證
- ChirpStack / NMS / MQTT 本地端環境部署
- Field trial 或短期客戶端測試環境

這個 repository 只存相關的設定檔、script、Docker Compose file，以及文件說明。

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
Ubuntu Server 24.04 LTS
