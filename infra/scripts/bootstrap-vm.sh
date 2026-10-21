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
  usermod -aG docker azureuser 2>/dev/null || true
  echo "✅ Docker instalado exitosamente."
else
  usermod -aG docker azureuser 2>/dev/null || true
  echo "ℹ️  Docker ya está instalado."
fi

# 4. Configuración de Nginx
echo "🌐 Configurando Nginx para Hovy..."
mkdir -p /etc/ssl/certs /etc/ssl/private /var/www/certbot

# Si aún no se cargó el certificado Origin CA de Cloudflare, generar uno provisorio autofirmado
# para que nginx -t valide y levante sin errores en una VM recién aprovisionada.
if [ ! -f /etc/ssl/certs/cloudflare_origin.pem ] || [ ! -f /etc/ssl/private/cloudflare_origin.key ]; then
  echo "⚠️  No se detectó Cloudflare Origin Certificate. Generando certificado TLS provisorio..."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/cloudflare_origin.key \
    -out /etc/ssl/certs/cloudflare_origin.pem \
    -subj "/CN=hovyapp.com.ar"
  chmod 600 /etc/ssl/private/cloudflare_origin.key
fi

# Asegurar existencia de archivo .htpasswd para Staging Basic Auth
if [ ! -f /etc/nginx/.htpasswd ]; then
  touch /etc/nginx/.htpasswd
  chmod 640 /etc/nginx/.htpasswd
fi

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

# 5. Ejecutar Hardening de Red, UFW y Fail2Ban
if [ -f "$SCRIPT_DIR/harden-vm.sh" ]; then
  echo "🛡️  Ejecutando hardening de firewall (UFW + Fail2Ban)..."
  bash "$SCRIPT_DIR/harden-vm.sh"
fi

# 6. Programar monitoreo periódico de recursos cada 15 minutos
if [ -f "$SCRIPT_DIR/monitor-resources.sh" ]; then
  chmod +x "$SCRIPT_DIR/monitor-resources.sh"
  echo "*/15 * * * * root $SCRIPT_DIR/monitor-resources.sh >> /var/log/hovy-monitor.log 2>&1" > /etc/cron.d/hovy-monitor
  chmod 644 /etc/cron.d/hovy-monitor
  echo "✅ Cron de monitoreo de recursos configurado (/etc/cron.d/hovy-monitor)."
fi

echo "======================================================================"
echo "🎉 ¡Aprovisionamiento completado con éxito!"
echo "La VM está blindada, con 2GB de Swap, Docker, Nginx, UFW y Fail2Ban activos."
echo "======================================================================"
