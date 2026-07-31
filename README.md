# ACI Transponder Demo Appliance

ACI Transponder onsite demo appliance deployment repository.

---

# Overview

This repository stores the info for:

- ACI Transponder onsite demo appliance
- ChirpStack deployment
- MQTT services
- PostgreSQL database
- ACI NMS environment
- Demo/testing environment setup

The appliance will be used at：

- Customer onsite demo
- ACI lab validation
- Transponder telemetry data path verification
- ChirpStack / MQTT / NMS integration
- Field trial environments

---

# Appliance Installation

Recommended deployment path:

```text
/opt/aci-transponder-demo
```

---

## Step 1 — Install Ubuntu Server

Download:

https://ubuntu.com/download/server

Check https://ubuntu.com/download/server#how-to-install-tab-lts to create a bootable USB flash drive, and use that to install Ubuntu

Install:

```text
Ubuntu Server 24.04 LTS
```

---

## Step 2 — Install Docker Engine

<details>
<summary>Expand Docker installation steps</summary>

<br>

### Update Ubuntu

```bash
sudo apt update
sudo apt upgrade -y
```

Reboot:

```bash
sudo reboot
```

---

### Install prerequisite packages

```bash
sudo apt update

sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    python3 \
    python3-yaml \
    python3-requests
```

---

### Add Docker GPG key

```bash
sudo mkdir -p /etc/apt/keyrings

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
```

---

### Add Docker repository

```bash
echo \
  "deb [arch=$(dpkg --print-architecture) \
  signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  noble stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

---

### Install Docker Engine + Compose plugin

```bash
sudo apt update

sudo apt install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin
```

---

### Verify Docker installation

```bash
sudo docker --version
sudo docker compose version
```

---

### Add current user to docker group

```bash
sudo usermod -aG docker $USER
sudo reboot
```

---

### Verify Docker without sudo

```bash
sudo docker ps
```

</details>

---

## Step 3 — Install Tailscale (optional)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Authorize from your laptop browser when prompted.

Verify:

```bash
tailscale status
```

---

## Step 4 — Clone Repository

```bash
sudo mkdir -p /opt/aci-transponder-demo
sudo chown $USER:$USER /opt/aci-transponder-demo

cd /opt/aci-transponder-demo

sudo git clone https://github.com/acicomms/aci-transponder-demo-appliance.git .
```

You will be asked to enter username and password for pull the files from this private repo.
Please be sure to get the token from the maintainer to be used as the password.

---

## Step 5 — Configure Environment Variables

Copy template:

```bash
cp .env.example .env
```

Edit configuration:

```bash
nano .env
```

---

## Step 6 — Start Services

```bash
sudo docker compose pull
sudo docker compose up -d
```

---

## Step 7 — Run bootstrap to create API Keys, Device Profiles, Gateway, Applications and 4 transponders 
Edit this preconfig file if needed https://github.com/acicomms/aci-transponder-demo-appliance/blob/main/bootstrap/config.local.yaml 

```bash
./bootstrap/bootstrap.sh
```

Open from laptop browser:

```text
http://<appliance-ip>:8080
http://<appliance-ip>:9080
```

---

## Step 8 — Verify Services

Check listening ports:

```bash
ss -ltunp
```

Expected:

```text
TCP 8080
TCP 9080
TCP 1883
UDP 1700
```

Open from laptop browser:

```text
http://<appliance-ip>:8080
http://<appliance-ip>:9080
```

---

## Step 9 — Verify Auto Recovery After Reboot

```bash
sudo reboot
```

After reboot:

```bash
sudo docker compose ps
```

---

# Hardware Requirements

## Recommended Mini PC

- Dell OptiPlex 7060 Micro
- Intel Core i5-8500T
- 16GB RAM
- 256GB SSD or above

## Other Supported Platforms

- HP ProDesk Mini
- Dell OptiPlex Micro
- Lenovo ThinkCentre Tiny
- Intel NUC

---

# Operating System

Recommended:

```text
Ubuntu Server 24.04 LTS
```

Not recommended:

```text
Windows + WSL2 production appliance deployment
```

---

# Repository Structure

```text
aci-transponder-demo-appliance/
├── README.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── install.sh
├── bootstrap/
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

---

# Services Included

| Service | Purpose |
|---|---|
| ChirpStack | LoRaWAN Network Server |
| PostgreSQL | Database |
| Redis | Cache / Queue |
| Mosquitto MQTT | MQTT Broker |
| ChirpStack Gateway Bridge | Gateway Integration |
| ACI NMS | Network Management |
| Tailscale | Remote Support |

---

# Common Commands

## Check Appliance Status

```bash
./scripts/status.sh
```

---

## Start Services

```bash
docker compose up -d
```

---

## Stop Services

```bash
docker compose down
```

---

## View Running Containers

```bash
docker compose ps
```

---

## View Logs

```bash
docker compose logs -f
```

---

## Update System and Containers

```bash
./scripts/update.sh
```

---

## Backup Configuration

```bash
./scripts/backup.sh
```

---

# Security Notes

DO NOT commit:

- `.env`
- Real passwords
- Customer credentials
- Tailscale auth keys
- API keys
- Docker image tar files
- PostgreSQL backups
- Customer production data
- Production private configurations

Use:

```text
.env.example
```

as the configuration template.

Each appliance should create its own local:

```text
.env
```

Example:

```bash
cp .env.example .env
nano .env
```

---

# Remote Access

Recommended architecture:

```text
ACI Engineer Laptop
        ↓
    Tailscale
        ↓
 Demo Appliance
        ↓
SSH / Docker / Logs / Config
```

Avoid exposing SSH directly to the public Internet.

Recommended remote support method:

```text
Tailscale + SSH
```

---

# Versioning

Recommended release tags:

```text
v0.1-lab-test
v0.2-chirpstack-added
v0.3-nms-added
v1.0-customer-demo-ready
v1.1-field-update
```

Update release notes for each version:

```text
docs/release-notes.md
```

---

# Maintainer

```text
Jeff Lu
ACI Communications
```
