#!/usr/bin/env bash
# =============================================================================
# bootstrap-vm.sh
# Script de aprovisionamiento declarativo automatizado (IaC) para la VM Azure de Hovy
#
# Entorno objetivo: Ubuntu 24.04 LTS (B1s - 1 vCPU, 1 GiB RAM)
#
# Configura:
# 1. 2 GiB de Swap para amortiguar compilaciones y procesamiento de imágenes (Sharp).
# 2. Docker Engine y Docker Compose plugin oficiales.
# 3. Nginx con proxy inverso y soporte para Cloudflare Origin Certificate.
# 4. Fail2ban para protección contra ataques de fuerza bruta en SSH.
# 5. Ejecución del script de hardening de firewall (harden-vm.sh).
# =============================================================================

set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "❌ Error: Este script debe ejecutarse como root o con sudo."
  exit 1
fi

echo "🚀 Iniciando aprovisionamiento automatizado de la VM Hovy..."

# 1. Actualización de paquetes base
export DEBIAN_FRONTEND=noninteractive
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git ufw fail2ban nginx ca-certificates gnupg lsb-release

# 2. Configuración de 2 GiB de Swap (vital para VM de 1 GiB RAM)
if [ ! -f /swapfile ]; then
  echo "💾 Creando archivo de Swap de 2 GiB..."
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl vm.swappiness=10
  echo 'vm.swappiness=10' >> /etc/sysctl.d/99-hovy-swap.conf
  echo "✅ Swap de 2 GiB configurado con éxito."
else
  echo "ℹ️  Swapfile ya existente. Omitiendo creación."
fi

# 3. Instalación de Docker oficial
if ! command -v docker >/dev/null 2>&1; then
  echo "🐳 Instalando Docker Engine y Docker Compose..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  systemctl enable docker
  systemctl start docker
  echo "✅ Docker instalado exitosamente."
else
  echo "ℹ️  Docker ya está instalado."
fi

# 4. Configuración de Nginx
echo "🌐 Configurando Nginx para Hovy..."
mkdir -p /etc/ssl/certs /etc/ssl/private /var/www/certbot

# Copiar configuración versionada si se ejecuta desde el repositorio
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ -f "$REPO_DIR/infra/nginx/hovy.conf" ]; then
  cp "$REPO_DIR/infra/nginx/hovy.conf" /etc/nginx/sites-available/hovy.conf
  rm -f /etc/nginx/sites-enabled/default
  ln -sf /etc/nginx/sites-available/hovy.conf /etc/nginx/sites-enabled/
  nginx -t && systemctl reload nginx
  echo "✅ Configuración de Nginx aplicada y validada."
fi

# 5. Ejecutar Hardening de Red y Firewall
if [ -f "$SCRIPT_DIR/harden-vm.sh" ]; then
  echo "🛡️  Ejecutando hardening de firewall y UFW..."
  bash "$SCRIPT_DIR/harden-vm.sh"
fi

# 6. Configurar Fail2ban para SSH
cat << 'EOF' > /etc/fail2ban/jail.local
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
findtime = 600
EOF

systemctl enable fail2ban
systemctl restart fail2ban
echo "✅ Fail2ban activado."

echo "======================================================================"
echo "🎉 ¡Aprovisionamiento completado con éxito!"
echo "La VM está blindada, con 2GB de Swap, Docker, Nginx y UFW activo."
echo "======================================================================"
