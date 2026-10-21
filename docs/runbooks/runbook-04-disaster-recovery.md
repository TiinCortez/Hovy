# Runbook 04 — Recuperación ante Desastres (Disaster Recovery)

> **Severidad:** P1 (Catastrófico)  
> **Objetivo RTO:** < 30 minutos  
> **Objetivo RPO:** < 24 horas (backup diario de Supabase + backup de VM a las 04:00 UTC)  
> **Responsable:** DevOps & SRE Lead (Aramayo, Leg. 410995)

---

## 1. Escenario de Desastre
- Pérdida accidental o corrupción de datos en la instancia de Supabase.
- Eliminación involuntaria de la VM de Azure o falla de hardware en el datacenter de Microsoft.

---

## 2. Plan de Restauración de la Base de Datos

### Paso 1: Obtener el último respaldo
`backup.yml` corre todos los días a las 04:00 UTC y opera en dos capas:
1. **Respaldo en la VM (`/home/azureuser/backups/<fecha>/`):** guarda `n8n_data.tar.gz`, `prod.env`, `dev.env` y `hovy.nginx.conf` (rotación de 7 días).
2. **Respaldo Off-VM cifrado con AES-256 (GitHub Actions Artifacts):** si el secret `SUPABASE_DB_URL` está configurado en GitHub Secrets, ejecuta `pg_dump --no-owner --no-acl`, lo cifra con `openssl enc -aes-256-cbc -pbkdf2` usando `VM_SSH_KEY` y lo sube como artifact `hovy-offsite-backup-<run_number>` (retención 7 días). Adicionalmente, Supabase mantiene sus backups propios en **Supabase Dashboard > Database > Backups** y el esquema completo está versionado en `docs/migrations/001` a `008`.

Para descifrar el dump descargado desde GitHub Actions Artifacts:
```bash
cat ~/.ssh/id_rsa | openssl enc -d -aes-256-cbc -pbkdf2 -pass stdin \
  -in supabase_dump.sql.gz.enc | gunzip > backup_prod_dump.sql
```

### Paso 2: Restaurar en Supabase o PostgreSQL nuevo (si se dispone de un dump `.sql`)
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
3. Clonar el repositorio para Producción y Staging y ejecutar el aprovisionamiento automatizado (IaC):
   ```bash
   git clone -b main https://github.com/TiinCortez/Hovy.git /home/azureuser/Hovy-prod
   git clone -b develop https://github.com/TiinCortez/Hovy.git /home/azureuser/Hovy-dev
   cd /home/azureuser/Hovy-prod
   sudo bash infra/scripts/bootstrap-vm.sh
   ```
4. Configurar los archivos `/home/azureuser/Hovy-prod/server/.env` y `/home/azureuser/Hovy-dev/server/.env` (y cargar el certificado Cloudflare Origin en `/etc/ssl/certs/cloudflare_origin.pem` y `/etc/ssl/private/cloudflare_origin.key`).
5. Iniciar los contenedores:
   ```bash
   cd /home/azureuser/Hovy-prod && docker compose up -d --build
   cd /home/azureuser/Hovy-dev && HOST_PORT=4001 CONTAINER_NAME=hovy-api-dev docker compose up -d --build
   ```
6. Verificar operatividad:
   ```bash
   curl -s http://localhost:4000/api/health?deep=true | jq .
   ```
