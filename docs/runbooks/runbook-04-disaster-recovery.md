# Runbook 04 — Recuperación ante Desastres (Disaster Recovery)

> **Severidad:** P1 (Catastrófico)  
> **Objetivo RTO:** < 30 minutos  
> **Objetivo RPO:** < 24 horas (respaldo diario a las 04:00 UTC)  
> **Responsable:** DevOps & SRE Lead (Aramayo, Leg. 410995)

---

## 1. Escenario de Desastre
- Pérdida accidental o corrupción de datos en la instancia de Supabase.
- Eliminación involuntaria de la VM de Azure o falla de hardware en el datacenter de Microsoft.

---

## 2. Plan de Restauración de la Base de Datos

### Paso 1: Obtener el último respaldo automatizado
1. Ir al repositorio en GitHub > pestaña **Actions** > workflow **Supabase Automated Daily Backup** (`backup.yml`).
2. Descargar el artifact `supabase-backup-prod-YYYY-MM-DD` generado a las 04:00 UTC.
3. Descomprimir el archivo `.tar.gz` o `.sql.gz`.

### Paso 2: Restaurar en Supabase o PostgreSQL nuevo
```bash
# Restaurar esquema y datos con psql
PGPASSWORD="<SUPABASE_DB_PASSWORD>" psql \
  -h db.<PROYECTO_ID>.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -f backup_prod_dump.sql
```

### Paso 3: Validar integridad del esquema
Verificar que las tablas base, RLS policies y triggers estén intactos:
```bash
node scripts/verify-migrations.mjs
```

---

## 3. Plan de Recreación de la Máquina Virtual (Azure)

Si la VM fue destruida:
1. Crear una nueva VM en Azure Portal:
   - **Imagen:** Ubuntu 24.04 LTS x64.
   - **Tamaño:** Standard B1s (1 vCPU, 1 GiB RAM).
   - **IP Pública:** Estática (reasignar el registro DNS `A` en Cloudflare hacia la nueva IP).
2. Conectarse por SSH a la nueva VM.
3. Clonar el repositorio y ejecutar el aprovisionamiento automatizado (IaC):
   ```bash
   git clone https://github.com/TiinCortez/Hovy.git /opt/hovy
   cd /opt/hovy
   sudo bash infra/scripts/bootstrap-vm.sh
   ```
4. Configurar el archivo `server/.env` con las variables de producción.
5. Iniciar los contenedores:
   ```bash
   docker compose pull && docker compose up -d
   ```
6. Verificar operatividad:
   ```bash
   curl -s http://localhost:4000/api/health?deep=true | jq .
   ```
