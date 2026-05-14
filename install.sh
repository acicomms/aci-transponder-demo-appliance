#!/bin/bash
set -e

echo "=== ACI Transponder Demo Appliance Installer ==="

echo "Updating Ubuntu..."
sudo apt update
sudo apt upgrade -y

echo "Installing basic tools..."
sudo apt install -y \
  curl \
  git \
  vim \
  htop \
  net-tools \
  unzip \
  ca-certificates \
  gnupg \
  lsb-release

echo "Installing Docker prerequisites..."
sudo install -m 0755 -d /etc/apt/keyrings

if [ ! -f /etc/apt/keyrings/docker.asc ]; then
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
fi

if [ ! -f /etc/apt/sources.list.d/docker.list ]; then
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
fi

echo "Installing Docker Engine and Compose plugin..."
sudo apt update
sudo apt install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

echo "Adding current user to docker group..."
sudo usermod -aG docker "$USER"

echo "Installing Tailscale..."
curl -fsSL https://tailscale.com/install.sh | sh

echo "Creating application folder..."
sudo mkdir -p /opt/aci-transponder-demo
sudo chown -R "$USER:$USER" /opt/aci-transponder-demo

echo
echo "Installer complete."
echo
echo "Next steps:"
echo "1. Reboot or log out/log back in so Docker permission applies."
echo "2. Run: sudo tailscale up --ssh --hostname=aci-txp-demo-001"
echo "3. Copy .env.example to .env and update passwords."
echo "4. Run: docker compose up -d"
