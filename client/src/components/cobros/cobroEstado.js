// Pure helpers of the "cobrar con QR" panel: which cobro is the live one, whether to
// keep asking the backend about it, and what to tell the user.

// How often the panel asks while a payment is awaited, and when it gives up (the
// user can always press "Verificar ahora").
export const INTERVALO_CONSULTA_MS = 5000;
export const MAX_CONSULTA_MS = 20 * 60 * 1000;

// The cobro the panel should show: the newest one that is still waiting for its
// payment or already approved. `lista` comes newest first.
export const cobroVigente = (lista) =>
  (Array.isArray(lista) ? lista : []).find((cobro) => cobro.estado === 'Pendiente' || cobro.estado === 'Aprobado') ?? null;

// Keep asking while the payment has not arrived, or it arrived but is not yet
// recorded in the client's account.
export const hayQueSeguirConsultando = (cobro) =>
  Boolean(cobro)
  && (cobro.estado === 'Pendiente' || (cobro.estado === 'Aprobado' && Boolean(cobro.id_turno) && !cobro.impactado));

// Message and kind of notice for a cobro: 'espera' (waiting), 'ok', 'aviso', 'error'.
export const describirCobro = (cobro, formatMonto) => {
  const monto = formatMonto(cobro.monto);
  switch (cobro.estado) {
    case 'Pendiente':
      return { tipo: 'espera', mensaje: `Esperando el pago de ${monto}...` };
    case 'Aprobado':
      if (cobro.impactado) return { tipo: 'ok', mensaje: 'Pago recibido y registrado en la cuenta corriente del cliente.' };
      return cobro.id_turno
        ? { tipo: 'espera', mensaje: 'Pago recibido. Registrándolo en la cuenta corriente...' }
        : { tipo: 'ok', mensaje: 'Pago recibido.' };
    case 'Rechazado':
      return { tipo: 'error', mensaje: 'Mercado Pago rechazó el pago. Podés generar un nuevo QR.' };
    case 'Cancelado':
      return { tipo: 'aviso', mensaje: 'El cobro fue cancelado. Podés generar un nuevo QR.' };
    case 'Expirado':
      return { tipo: 'aviso', mensaje: 'El link de pago venció. Generá un nuevo QR.' };
    default:
      return { tipo: 'aviso', mensaje: `Estado del cobro: ${cobro.estado}.` };
  }
};

// A new QR can be generated when the cobro is over without being paid.
export const sePuedeRegenerar = (cobro) =>
  Boolean(cobro) && ['Cancelado', 'Expirado', 'Rechazado'].includes(cobro.estado);
