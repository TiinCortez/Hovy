#!/usr/bin/env bash
# =============================================================================
# monitor-resources.sh
# Script de observabilidad y monitoreo de recursos para la VM Azure de Hovy
#
# Monitorea:
# 1. Uso de memoria RAM y Swap (crítico en VM de 1 GiB con Sharp/libvips)
# 2. Uso del contenedor Docker 'hovy-api' respecto al mem_limit (768m)
# 3. Espacio en disco de la partición raíz (/)
#
# Alerta en consola y syslog si los umbrales superan el 85 %.
# =============================================================================

set -euo pipefail

UMBRAL_RAM=85
UMBRAL_SWAP=85
UMBRAL_DISCO=85

FECHA=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
echo "======================================================================"
echo "📊 Reporte de Recursos Hovy VM - $FECHA"
echo "======================================================================"

# 1. Monitoreo de RAM
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
USADA_RAM=$(free -m | awk '/^Mem:/{print $3}')
PORC_RAM=$(( USADA_RAM * 100 / TOTAL_RAM ))

echo "🧠 RAM: ${USADA_RAM}MB / ${TOTAL_RAM}MB (${PORC_RAM}%)"
if [ "$PORC_RAM" -ge "$UMBRAL_RAM" ]; then
  echo "⚠️  [ALERTA] Uso de RAM por encima del ${UMBRAL_RAM}%!"
  logger -p user.warning "Hovy Monitor: Alerta de RAM ${PORC_RAM}%"
fi

# 2. Monitoreo de Swap
TOTAL_SWAP=$(free -m | awk '/^Swap:/{print $2}')
if [ "$TOTAL_SWAP" -gt 0 ]; then
  USADA_SWAP=$(free -m | awk '/^Swap:/{print $3}')
  PORC_SWAP=$(( USADA_SWAP * 100 / TOTAL_SWAP ))
  echo "💾 SWAP: ${USADA_SWAP}MB / ${TOTAL_SWAP}MB (${PORC_SWAP}%)"
  if [ "$PORC_SWAP" -ge "$UMBRAL_SWAP" ]; then
    echo "⚠️  [ALERTA] Uso de SWAP por encima del ${UMBRAL_SWAP}%!"
    logger -p user.warning "Hovy Monitor: Alerta de SWAP ${PORC_SWAP}%"
  fi
else
  echo "⚠️  [ADVERTENCIA] No hay espacio de Swap configurado en el sistema."
fi

# 3. Monitoreo de Disco (/)
USO_DISCO=$(df -h / | awk 'NR==2 {print $5}' | tr -d '%')
DISCO_DISP=$(df -h / | awk 'NR==2 {print $4}')
echo "💿 DISCO (/): ${USO_DISCO}% usado (${DISCO_DISP} disponible)"
if [ "$USO_DISCO" -ge "$UMBRAL_DISCO" ]; then
  echo "⚠️  [ALERTA] Espacio en disco crítico: ${USO_DISCO}%!"
  logger -p user.warning "Hovy Monitor: Alerta de Disco ${USO_DISCO}%"
fi

# 4. Monitoreo del contenedor Docker
if command -v docker >/dev/null 2>&1; then
  echo "🐳 Estado de contenedores Docker:"
  docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}" || true
fi

echo "======================================================================"
echo "✅ Monitoreo completado con éxito."
