import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, QrCode, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';
import Aviso from '../ui/Aviso';
import CobroService from '../../services/api/cobro.service';
import { formatearMontoARS } from '../turnos/agendaTurnos';
import { getApiError } from '../visitas/visitaUtils';
import {
  INTERVALO_CONSULTA_MS,
  MAX_CONSULTA_MS,
  cobroVigente,
  describirCobro,
  hayQueSeguirConsultando,
  sePuedeRegenerar,
} from './cobroEstado';

const VERDE = '#1B3006';

// Spinner shaped like an icon, to sit inside <Aviso>.
const IconoEspera = () => <span className="hovy-spinner" aria-hidden="true" />;

const ICONOS = { espera: IconoEspera, ok: CheckCircle2, aviso: AlertCircle, error: AlertCircle };

// Charge a finished turno with a Mercado Pago QR and show, on screen, when the
// payment arrives and when it is recorded in the client's account. While the QR is
// shown the panel asks the backend every few seconds (the backend checks Mercado
// Pago itself, so it works even if the automatic notification does not arrive).
// `onCobrado` is called once when the payment is recorded.
export default function CobroQrPanel({ turno, onCobrado }) {
  const idTurno = turno.idTurno;
  const [cobro, setCobro] = useState(null);
  const [qr, setQr] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState(null);
  const avisado = useRef(false);

  const yaCobrado = turno.cobrado === true;

  // Updates the cobro and tells the parent the first time the payment is recorded.
  const actualizarCobro = (nuevo) => {
    setCobro(nuevo);
    if (nuevo?.impactado && !avisado.current) {
      avisado.current = true;
      if (onCobrado) onCobrado();
    }
  };

  // First load: is there already a live cobro for this turno?
  useEffect(() => {
    if (yaCobrado) return undefined;
    let cancelled = false;
    CobroService.listarPorTurno(idTurno)
      .then((res) => { if (!cancelled) setCobro(cobroVigente(res.data)); })
      .catch((err) => { if (!cancelled) setError(getApiError(err, 'No se pudo consultar el cobro del turno.')); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [idTurno, yaCobrado]);

  // QR image of the pending cobro. The auth header is needed, so it is fetched as a
  // blob; the object URL is released when the cobro changes or the panel closes.
  const cobroId = cobro?.id;
  const cobroPendiente = cobro?.estado === 'Pendiente';
  useEffect(() => {
    if (!cobroId || !cobroPendiente) return undefined;
    let cancelled = false;
    let url = null;
    CobroService.getQr(cobroId)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setQr({ id: cobroId, url });
      })
      .catch(() => { if (!cancelled) setError('No se pudo mostrar el QR. Probá con el link de pago.'); });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [cobroId, cobroPendiente]);

  // Polling while the payment is awaited (or approved but not yet recorded).
  const seguir = hayQueSeguirConsultando(cobro) && !pausado;
  useEffect(() => {
    if (!seguir) return undefined;
    const inicio = Date.now();
    const consultar = async () => {
      if (Date.now() - inicio > MAX_CONSULTA_MS) {
        setPausado(true);
        return;
      }
      try {
        const res = await CobroService.verificar(cobroId);
        actualizarCobro(res.data);
      } catch {
        // A failed poll is not an error for the user: the next one tries again.
      }
    };
    const intervalo = setInterval(consultar, INTERVALO_CONSULTA_MS);
    return () => clearInterval(intervalo);
    // actualizarCobro only uses setters and a ref: it does not need to restart the polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seguir, cobroId]);

  const ejecutar = async (accion, mensajeError) => {
    setIsWorking(true);
    setError(null);
    try {
      await accion();
    } catch (err) {
      setError(getApiError(err, mensajeError));
    } finally {
      setIsWorking(false);
    }
  };

  const handleCobrar = () =>
    ejecutar(async () => {
      const res = await CobroService.crearParaTurno(idTurno);
      avisado.current = false;
      setPausado(false);
      setQr(null);
      actualizarCobro(res.data);
    }, 'No se pudo generar el cobro.');

  const handleVerificar = () =>
    ejecutar(async () => {
      const res = await CobroService.verificar(cobro.id);
      setPausado(false);
      actualizarCobro(res.data);
    }, 'No se pudo verificar el pago.');

  const handleCancelar = () =>
    ejecutar(async () => {
      const res = await CobroService.cancelar(cobro.id);
      actualizarCobro(res.data);
    }, 'No se pudo cancelar el cobro.');

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(cobro.init_point);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError('No se pudo copiar el link.');
    }
  };

  if (yaCobrado) {
    return (
      <div className="cobro-qr mt-4">
        <Aviso tipo="ok" icono={CheckCircle2}>
          Este turno está cobrado{cobro?.monto ? `: ${formatearMontoARS(cobro.monto)}` : ''}.
        </Aviso>
      </div>
    );
  }

  if (isLoading) {
    return <div className="cobro-qr mt-4 text-secondary small">Consultando el cobro...</div>;
  }

  const estado = cobro ? describirCobro(cobro, formatearMontoARS) : null;
  const qrVisible = qr && qr.id === cobroId ? qr.url : null;

  return (
    <div className="cobro-qr mt-4">
      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
        <h6 className="text-secondary fw-bold small text-uppercase d-flex align-items-center gap-2 m-0" style={{ letterSpacing: '0.05em' }}>
          <QrCode size={16} /> Cobro con Mercado Pago
        </h6>
        {cobro && <strong className="text-dark">{formatearMontoARS(cobro.monto)}</strong>}
      </div>

      {error && <div className="mb-3"><Aviso tipo="error" icono={AlertCircle}>{error}</Aviso></div>}

      {!cobro || sePuedeRegenerar(cobro) ? (
        <>
          {estado && <div className="mb-3"><Aviso tipo={estado.tipo} icono={ICONOS[estado.tipo]}>{estado.mensaje}</Aviso></div>}
          <p className="text-secondary small mb-3">
            Se cobra lo que el cliente todavía debe de este trabajo. Mientras no pague, la deuda sigue en su cuenta corriente.
          </p>
          <Button
            variant="primary"
            onClick={handleCobrar}
            disabled={isWorking}
            style={{ backgroundColor: VERDE, borderColor: VERDE }}
          >
            <QrCode size={16} className="me-2" />
            {isWorking ? 'Generando...' : (cobro ? 'Generar nuevo QR' : 'Cobrar con QR')}
          </Button>
        </>
      ) : (
        <>
          <div className="mb-3"><Aviso tipo={estado.tipo} icono={ICONOS[estado.tipo]}>{estado.mensaje}</Aviso></div>

          {cobroPendiente && (
            <div className="d-flex flex-column flex-sm-row gap-3 align-items-sm-start">
              {qrVisible ? (
                <img className="cobro-qr-imagen" src={qrVisible} alt="QR para pagar con Mercado Pago" />
              ) : (
                <div className="cobro-qr-vacio">Generando el QR...</div>
              )}
              <div className="d-flex flex-column gap-2">
                <p className="text-secondary small m-0">
                  Pedile al cliente que escanee el QR con Mercado Pago, o enviale el link. Cuando pague, esta pantalla se actualiza sola.
                </p>
                <div className="d-flex flex-wrap gap-2">
                  <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill d-flex align-items-center gap-2 fw-semibold px-3" onClick={handleCopiar}>
                    <Copy size={14} /> {copiado ? 'Link copiado' : 'Copiar link de pago'}
                  </button>
                  <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill d-flex align-items-center gap-2 fw-semibold px-3" onClick={handleVerificar} disabled={isWorking}>
                    <RefreshCw size={14} /> Verificar ahora
                  </button>
                  <button type="button" className="btn btn-sm btn-light rounded-pill fw-semibold px-3 text-danger" onClick={handleCancelar} disabled={isWorking}>
                    Cancelar cobro
                  </button>
                </div>
                {pausado && (
                  <span className="text-secondary small">
                    Dejé de consultar automáticamente. Usá &quot;Verificar ahora&quot; cuando el cliente haya pagado.
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
