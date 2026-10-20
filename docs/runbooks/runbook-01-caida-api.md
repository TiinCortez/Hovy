# Runbook 01 — Caída de API o Contenedor (502 / Offline)

> **Severidad:** P1 (Crítico)  
> **Objetivo MTTR:** < 5 minutos  
> **Responsable:** DevOps & SRE Lead (Aramayo, Leg. 410995)

---

## 1. Detección y Síntomas
- Nginx devuelve `502 Bad Gateway` en `hovyapp.com.ar` o `dev.hovyapp.com.ar`.
- El endpoint `/api/health` arroja timeout o código de estado HTTP 503.
- Alertas de BetterStack o GitHub Actions smoke tests fallando tras un deploy.

---

## 2. Diagnóstico Rápido (Triage en 60 segundos)

Conectarse a la VM por SSH y ejecutar:

```bash
# 1. Verificar si el contenedor está corriendo
docker ps -a | grep hovy-api

# 2. Si el estado es "Exited (137)", el kernel mató el proceso por Out-of-Memory (OOM Killer)
docker inspect hovy-api --format='{{.State.OOMKilled}}'

# 3. Ver los últimos 50 logs estructurados del contenedor
docker logs --tail=50 hovy-api
```

---

## 3. Acciones de Mitigación

### Caso A: El contenedor crasheó por OOM (Out Of Memory)
Si `sharp` o una compilación saturó los 768 MB asignados:
```bash
# Verificar Swap activo
free -m

# Si no hay swap, activarlo inmediatamente:
sudo swapon /swapfile || sudo bash infra/scripts/bootstrap-vm.sh

# Levantar el contenedor
docker compose up -d
```

### Caso B: Error de código en el último deploy (CrashLoop)
Si el contenedor se reinicia indefinidamente tras un deploy reciente:
1. Ir a GitHub Actions > **Rollback Deployment** (`rollback.yml`).
2. Seleccionar el entorno (`staging` o `production`) y disparar el workflow con un clic.
3. El workflow ejecuta `git checkout <referencia>` (por defecto `HEAD~1`, o el SHA/tag que indiques), reconstruye el contenedor con `docker compose up -d --build --force-recreate` y verifica `/api/health` hasta 12 veces.

---

## 4. Verificación Post-Incidente
```bash
# Validar salud profunda con ping a BD
curl -s http://localhost:4000/api/health?deep=true | jq .

# Verificar que Nginx enrute correctamente
curl -I https://hovyapp.com.ar/api/health
```
