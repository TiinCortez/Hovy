# Runbook 02 — Fallo de Webhooks de Mercado Pago

> **Severidad:** P2 (Alto)  
> **Objetivo MTTR:** < 15 minutos  
> **Responsable:** DevOps & SRE Lead (Aramayo, Leg. 410995)

---

## 1. Detección y Síntomas
- El cliente abonó un presupuesto mediante QR o Link de Pago, pero el cobro figura en estado `Pendiente` en el panel de Hovy.
- Logs con mensajes `HMAC signature verification failed` o código HTTP 400/401 en `/api/mercadopago/webhooks/pagos`.
- Peticiones rechazadas por Cloudflare o Basic Auth en el entorno de desarrollo.

---

## 2. Diagnóstico Rápido

### A. Verificar si el webhook está llegando al servidor
En la VM, filtrar los logs del webhook usando el `requestId`:
```bash
docker logs --tail=200 hovy-api | grep -E "webhook|mercadopago"
```

### B. Verificar Nginx y Basic Auth
Si el error ocurre en `dev.hovyapp.com.ar`:
- Verificar que el bloque `/api/` en `infra/nginx/hovy.conf` tenga `auth_basic off;`. Mercado Pago no envía cabeceras de autorización HTTP Basic.

### C. Verificar secreto HMAC del webhook
Verificar que la variable `MERCADOPAGO_WEBHOOK_SECRET` en `server/.env` coincida exactamente con la clave secreta provista en el panel de Mercado Pago Developers.

---

## 3. Resolución y Reconciliación Manual
Si un webhook se perdió o no impactó en la base de datos:
1. El webhook de Mercado Pago reintenta con backoff exponencial durante 48 horas.
2. Si se requiere imputación inmediata:
   - Consultar el ID del pago en Mercado Pago Developers.
   - Desde el panel de administración de Hovy, ejecutar la consulta de sincronización manual de estado para actualizar la tabla `cobros_mercadopago` a `Aprobado`.
