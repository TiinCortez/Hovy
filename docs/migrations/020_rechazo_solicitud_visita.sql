-- 020: a new contact's visit request can be rejected from the panel
-- (POST /api/visitas/:id/rechazar). The row is not deleted: it moves to
-- 'Rechazada' and keeps why, when and who, so it stays in the history.
--
-- No BEGIN/COMMIT: db-migrate runs each file through the exec_migration RPC,
-- which already wraps it in a transaction and rejects transaction commands.

ALTER TABLE public.solicitudes_visita DROP CONSTRAINT IF EXISTS solicitudes_visita_estado_check;
ALTER TABLE public.solicitudes_visita ADD CONSTRAINT solicitudes_visita_estado_check CHECK (
  estado IN ('Pendiente', 'Contactada', 'Confirmada', 'Realizada', 'Cancelada', 'Rechazada')
);

ALTER TABLE public.solicitudes_visita
  -- Optional reason written by the admin; it is also sent to the person by WhatsApp.
  ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT CHECK (char_length(motivo_rechazo) <= 500),
  ADD COLUMN IF NOT EXISTS fecha_rechazo  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rechazada_por  BIGINT REFERENCES public.usuarios (id) ON DELETE SET NULL;
