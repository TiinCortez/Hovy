import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import PagoService from '../../services/api/pago.service';
import CobroService from '../../services/api/cobro.service';
import { getApiError } from '../visitas/visitaUtils';
import Modal from '../ui/Modal';
import { CAPAS } from '../../styles/capas';
import RegistroPagoModal from './RegistroPagoModal';
import CobroQrPanel from './CobroQrPanel';
import { medioDeForma, totalPagado } from './formaDePago';

const FORMAS_COBRO = ['efectivo', 'transferencia', 'qr'];

// "Marcar cobrado" from the Cobros view: instead of only flipping the flag, it registers
// the payment (so the account ledger matches). It loads the real balance of the turno first.
// Cash and transfer are registered right away; QR creates the Mercado Pago link and shows
// the QR to scan (the same panel used in the turno detail).
//   onRegistrado({ cobrado, pendiente }) - the payment was saved
//   onSinSaldo()  - the turno owes nothing in the ledger: the caller just marks the flag
//   onFallo(msg)  - the balance could not be loaded
//   onQrCerrado() - the QR dialog was closed (the client may have paid part of the debt)
export default function MarcarCobradoModal({ turno, onRegistrado, onSinSaldo, onFallo, onQrCerrado, onClose }) {
  const [saldo, setSaldo] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [verQr, setVerQr] = useState(false);

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

  const aNumero = (texto) => Number(String(texto).replace(',', '.'));

  const confirmar = async (eleccion) => {
    setIsSaving(true);
    setError(null);
    try {
      if (eleccion.forma === 'qr') {
        await CobroService.crearParaTurno(idTurno, aNumero(eleccion.monto));
        setVerQr(true);
        setIsSaving(false);
        return;
      }
      const res = await PagoService.registrar(idTurno, {
        medio: medioDeForma(eleccion.forma),
        monto: aNumero(eleccion.monto),
        referencia: eleccion.referencia.trim() || undefined,
      });
      onRegistrado(res.data);
    } catch (err) {
      setError(getApiError(err, eleccion.forma === 'qr' ? 'No se pudo generar el cobro.' : 'No se pudo registrar el pago.'));
      setIsSaving(false);
    }
  };

  if (verQr) {
    return (
      <PanelQr
        turno={turno}
        onCobrado={() => onRegistrado({ cobrado: true })}
        onClose={onQrCerrado ?? onClose}
      />
    );
  }

  if (!saldo) return null;

  return (
    <RegistroPagoModal
      modo="registrar"
      formas={FORMAS_COBRO}
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

// Dialog that hosts the QR panel: it shows the QR, waits for the payment and tells the
// parent when the turno ends up fully paid.
function PanelQr({ turno, onCobrado, onClose }) {
  return createPortal(
    <Modal
      titulo="Cobro con QR"
      subtitulo={<p className="text-secondary small mb-0 mt-1">Turno #{turno.idTurno}</p>}
      onCerrar={onClose}
      zIndex={CAPAS.modalEncima}
    >
      <div className="modal-body px-4 pb-4 pt-0">
        <CobroQrPanel turno={turno} onCobrado={onCobrado} />
      </div>
    </Modal>,
    document.body
  );
}
