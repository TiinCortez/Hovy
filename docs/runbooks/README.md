# Runbooks Operativos de DevOps & SRE — Hovy

Este directorio contiene los manuales de procedimientos operativos estándar (SOP) y guías de respuesta ante incidentes para el sistema **Hovy** (*Valle La Armonía y Jardinería*, San Salvador de Jujuy, UTN FRC).

---

## 📚 Índice de Runbooks

| Runbook | Escenario | Nivel de Severidad | Tiempo Objetivo (MTTR) |
|---|---|---|---|
| [**Runbook 01: Caída de API o Contenedor**](./runbook-01-caida-api.md) | La API no responde en `/api/health`, reinicios de contenedor o error 502 Bad Gateway. | **P1 (Crítico)** | < 5 minutos |
| [**Runbook 02: Fallo de Webhooks Mercado Pago**](./runbook-02-webhook-mercadopago.md) | Pagos no imputados, fallos de firma HMAC (`x-signature`) o reintentos de webhook. | **P2 (Alto)** | < 15 minutos |
| [**Runbook 03: Schema Drift y Triggers SQL**](./runbook-03-schema-drift-triggers.md) | Errores `P0001` de PostgreSQL al realizar/cancelar turnos o desincronización entre Staging y Prod. | **P2 (Alto)** | < 10 minutos |
| [**Runbook 04: Recuperación ante Desastres (DR)**](./runbook-04-disaster-recovery.md) | Destrucción de la VM Azure o pérdida de base de datos Supabase; restauración desde backups diarios. | **P1 (Crítico)** | < 30 minutos |

---

## 🛠️ Herramientas Operativas Rápidas

```bash
# Estado general del contenedor y consumo
docker stats --no-stream

# Ver logs estructurados en vivo con trazabilidad de Request ID
docker compose logs -f --tail=100 api

# Chequeo profundo de salud con ping a la base de datos
curl -s https://hovyapp.com.ar/api/health?deep=true | jq .

# Ejecutar monitoreo de recursos en la VM
bash infra/scripts/monitor-resources.sh
```
