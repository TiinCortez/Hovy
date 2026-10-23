import { useEffect, useState } from 'react';
import PagoService from '../../services/api/pago.service';
import { getApiError } from '../visitas/visitaUtils';
import RegistroPagoModal from './RegistroPagoModal';
import { medioDeForma, totalPagado } from './formaDePago';

const FORMAS_MANUALES = ['efectivo', 'transferencia'];

// "Marcar cobrado" from the Cobros view: instead of only flipping the flag, it registers
// the payment (so the account ledger matches). It loads the real balance of the turno first.
//   onRegistrado({ cobrado, pendiente }) - the payment was saved
//   onSinSaldo()  - the turno owes nothing in the ledger: the caller just marks the flag
//   onFallo(msg)  - the balance could not be loaded
export default function MarcarCobradoModal({ turno, onRegistrado, onSinSaldo, onFallo, onClose }) {
  const [saldo, setSaldo] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const idTurno = turno.idTurno;

  useEffect(() => {
    let cancelled = false;
    PagoService.getSaldo(idTurno)
      .then((res) => {
        if (cancelled) return;
        if (!(Number(res.data?.pendiente) > 0)) onSinSaldo();
        else setSaldo(res.data);
      })
      .catch((err) => {
        if (!cancelled) onFallo(getApiError(err, 'No se pudo consultar el saldo del turno.'));
      });
    return () => { cancelled = true; };
    // The callbacks come from the parent and only use setters: the balance loads once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idTurno]);

  const confirmar = async (eleccion) => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await PagoService.registrar(idTurno, {
        medio: medioDeForma(eleccion.forma),
        monto: Number(String(eleccion.monto).replace(',', '.')),
        referencia: eleccion.referencia.trim() || undefined,
      });
      onRegistrado(res.data);
    } catch (err) {
      setError(getApiError(err, 'No se pudo registrar el pago.'));
      setIsSaving(false);
    }
  };

  if (!saldo) return null;

  return (
    <RegistroPagoModal
      modo="registrar"
      formas={FORMAS_MANUALES}
      formaInicial="efectivo"
      subtitulo={`Turno #${idTurno}`}
      total={saldo.total ?? null}
      pendiente={saldo.pendiente}
      pagado={totalPagado(saldo.pagos)}
      isSaving={isSaving}
      error={error}
      onConfirm={confirmar}
      onClose={onClose}
    />
  );
}
