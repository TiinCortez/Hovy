#!/usr/bin/env bash
# =============================================================================
# SCRIPT DE HARDENING DE SEGURIDAD PARA AZURE VM (Ubuntu 24.04 LTS)
# =============================================================================
set -euo pipefail

echo "=== 1. Actualizando paquetes del sistema ==="
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y ufw fail2ban unattended-upgrades curl openssl

echo "=== 2. Configurando actualizaciones de seguridad automáticas ==="
sudo DEBIAN_FRONTEND=noninteractive dpkg-reconfigure -f noninteractive unattended-upgrades

echo "=== 3. Configurando Fail2Ban contra ataques de fuerza bruta SSH ==="
cat << 'EOF' | sudo tee /etc/fail2ban/jail.local
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
EOF

sudo systemctl restart fail2ban
sudo systemctl enable fail2ban

echo "=== 4. Configurando Firewall UFW (Permitiendo Web solo desde Cloudflare) ==="
# Política por defecto: denegar entrantes, permitir salientes
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Permitir SSH (administración)
sudo ufw allow 22/tcp comment 'SSH Access'

# Descargar y permitir rangos oficiales IPv4 e IPv6 de Cloudflare en puertos 80 y 443
for cf_ip in $(curl -fsSL https://www.cloudflare.com/ips-v4); do
  sudo ufw allow proto tcp from "$cf_ip" to any port 80,443 comment 'Cloudflare IPv4'
done

for cf_ip6 in $(curl -fsSL https://www.cloudflare.com/ips-v6); do
  sudo ufw allow proto tcp from "$cf_ip6" to any port 80,443 comment 'Cloudflare IPv6' || true
done

# Activar firewall
sudo ufw --force enable
sudo ufw status verbose

echo "=== 5. Hardening completado con éxito ==="
