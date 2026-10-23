// Pure helpers of the "how does the client pay" choice, shared by the finish-turno
// dialog and the payment panel of a finished turno.

export const FORMAS = {
  anotar: { id: 'anotar', etiqueta: 'Anotar', detalle: 'Queda como deuda en la cuenta corriente' },
  efectivo: { id: 'efectivo', etiqueta: 'Efectivo', detalle: 'Pagó en mano', medio: 'Efectivo' },
  transferencia: { id: 'transferencia', etiqueta: 'Transferencia', detalle: 'Pagó por el banco', medio: 'Transferencia' },
  qr: { id: 'qr', etiqueta: 'QR', detalle: 'Paga con Mercado Pago' },
};

const MAX_REFERENCIA = 100;

// Cash and transfer are registered right away and need an amount.
export const requiereMonto = (forma) => forma === 'efectivo' || forma === 'transferencia';

// Medium name the API expects ('Efectivo' | 'Transferencia'), or null.
export const medioDeForma = (forma) => FORMAS[forma]?.medio ?? null;

const aNumero = (texto) => Number(String(texto).replace(',', '.'));

// What the typed amount means against what the client owes, to give live feedback:
//  - vacio / invalido: nothing usable typed yet
//  - libre: the debt is unknown, so there is nothing to compare with
//  - salda: pays everything; parcial: part of it (`restante` stays); excede: too much
// Compared in cents so decimals never give a wrong answer.
export const analizarMonto = (monto, pendiente) => {
  const numero = aNumero(monto);
  if (String(monto ?? '').trim() === '' || !Number.isFinite(numero) || numero <= 0) return { tipo: 'vacio' };
  if (pendiente === null || pendiente === undefined) return { tipo: 'libre' };

  const centavos = Math.round(numero * 100);
  const debe = Math.round(Number(pendiente) * 100);
  if (centavos > debe) return { tipo: 'excede', exceso: (centavos - debe) / 100 };
  if (centavos === debe) return { tipo: 'salda' };
  return { tipo: 'parcial', restante: (debe - centavos) / 100 };
};

// Sum of the approved payments already registered for the turno.
export const totalPagado = (pagos) =>
  (Array.isArray(pagos) ? pagos : [])
    .filter((pago) => pago.estado === 'Aprobado')
    .reduce((acumulado, pago) => acumulado + Math.round(Number(pago.monto) * 100), 0) / 100;

// Shortcuts to fill the amount: all of it, or half. Only offered when they differ.
export const montosRapidos = (pendiente) => {
  const debe = Number(pendiente);
  if (!Number.isFinite(debe) || debe <= 0) return [];
  const mitad = Math.round((debe / 2) * 100) / 100;
  const atajos = [{ etiqueta: 'Todo', valor: debe }];
  if (mitad > 0 && mitad !== debe) atajos.push({ etiqueta: 'La mitad', valor: mitad });
  return atajos;
};

export const seleccionInicial = (forma, montoSugerido) => ({
  forma,
  monto: Number.isFinite(Number(montoSugerido)) && Number(montoSugerido) > 0 ? String(montoSugerido) : '',
  referencia: '',
});

// Checks a selection before sending it. `pendiente` is what the client owes (null when
// unknown); the server checks it again. Returns the message to show, or null.
export const validarSeleccion = ({ forma, monto, referencia }, pendiente = null) => {
  if (!FORMAS[forma]) return 'Elegí cómo se cobra.';
  if (!requiereMonto(forma)) return null;

  const numero = Number(String(monto).replace(',', '.'));
  if (String(monto).trim() === '' || !Number.isFinite(numero) || numero <= 0) {
    return 'Ingresá un monto mayor a 0.';
  }
  if (Math.abs(numero * 100 - Math.round(numero * 100)) > 1e-6) {
    return 'El monto puede tener hasta 2 decimales.';
  }
  if (pendiente !== null && pendiente !== undefined && numero > Number(pendiente)) {
    return 'El monto no puede superar lo que el cliente debe.';
  }
  if (String(referencia ?? '').trim().length > MAX_REFERENCIA) {
    return `La referencia puede tener hasta ${MAX_REFERENCIA} caracteres.`;
  }
  return null;
};

// Texto del botón de confirmar según la forma elegida.
export const textoConfirmar = (forma, enFinalizacion = false) => {
  const prefijo = enFinalizacion ? 'Finalizar y ' : '';
  switch (forma) {
    case 'anotar': return enFinalizacion ? 'Finalizar y anotar' : 'Anotar';
    case 'efectivo': return `${prefijo}${enFinalizacion ? 'registrar el efectivo' : 'Registrar pago en efectivo'}`;
    case 'transferencia': return `${prefijo}${enFinalizacion ? 'registrar la transferencia' : 'Registrar transferencia'}`;
    case 'qr': return `${prefijo}${enFinalizacion ? 'generar el QR' : 'Generar QR'}`;
    default: return 'Confirmar';
  }
};
