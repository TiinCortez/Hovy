import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, QrCode, RefreshCw } from 'lucide-react';
import Button from '../ui/Button';
import Aviso from '../ui/Aviso';
import CobroService from '../../services/api/cobro.service';
import PagoService from '../../services/api/pago.service';
import RegistroPagoModal from './RegistroPagoModal';
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
import { medioDeForma, totalPagado } from './formaDePago';

const VERDE = '#1B3006';

// Spinner shaped like an icon, to sit inside <Aviso>.
const IconoEspera = () => <span className="hovy-spinner" aria-hidden="true" />;

const ICONOS = { espera: IconoEspera, ok: CheckCircle2, aviso: AlertCircle, error: AlertCircle };

const FORMAS_PANEL = ['qr', 'efectivo', 'transferencia'];
const FORMAS_MANUALES = ['efectivo', 'transferencia'];

const aNumero = (texto) => Number(String(texto).replace(',', '.'));

const formatearFecha = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : null;

// How a finished turno is charged: a Mercado Pago QR, cash or a bank transfer. It
// shows what the client still owes and the payments already registered. With a QR on
// screen it asks the backend every few seconds (the backend checks Mercado Pago
// itself, so it works even if the automatic notification does not arrive).
//   onCobrado  - called once when the turno ends up fully paid.
//   preferencia - the choice made in the finish-turno dialog ({ forma, monto,
//                 referencia }); it is carried out once, as soon as the debt exists.
export default function CobroQrPanel({ turno, onCobrado, preferencia = null }) {
  const idTurno = turno.idTurno;
  const [cobro, setCobro] = useState(null);
  const [qr, setQr] = useState(null);
  const [saldo, setSaldo] = useState(null);
  const [versionSaldo, setVersionSaldo] = useState(0);
  // Which payment dialog is open: null | 'cobrar' (QR, cash or transfer) | 'manual' (cash or transfer)
  const [modal, setModal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState(null);
  const [mensajeOk, setMensajeOk] = useState(null);
  const avisado = useRef(false);
  const preferenciaEjecutada = useRef(false);

  const yaCobrado = turno.cobrado === true;
  const pendiente = saldo?.pendiente ?? null;

  // Tells the parent the first time the turno is fully paid.
  const avisarCobrado = () => {
    if (avisado.current) return;
    avisado.current = true;
    if (onCobrado) onCobrado();
  };

  // Updates the cobro (Mercado Pago link) and, once its payment is recorded, the balance.
  const actualizarCobro = (nuevo) => {
    setCobro(nuevo);
    if (nuevo?.impactado) {
      setVersionSaldo((v) => v + 1);
      avisarCobrado();
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

  // Balance and payments of the turno (reloaded after every payment).
  useEffect(() => {
    let cancelled = false;
    PagoService.getSaldo(idTurno)
      .then((res) => { if (!cancelled) setSaldo(res.data); })
      .catch(() => { /* the balance is a convenience: the panel still works without it */ });
    return () => { cancelled = true; };
  }, [idTurno, versionSaldo]);

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

  // Runs an action and reports whether it worked (the dialog closes only on success).
  const ejecutar = async (accion, mensajeError) => {
    setIsWorking(true);
    setError(null);
    setMensajeOk(null);
    try {
      await accion();
      return true;
    } catch (err) {
      setError(getApiError(err, mensajeError));
      return false;
    } finally {
      setIsWorking(false);
    }
  };

  const crearQr = () =>
    ejecutar(async () => {
      const res = await CobroService.crearParaTurno(idTurno);
      avisado.current = false;
      setPausado(false);
      setQr(null);
      actualizarCobro(res.data);
    }, 'No se pudo generar el cobro.');

  // Cash or transfer. The server cancels the turno's pending Mercado Pago links (their
  // amount no longer matches what is owed) and only marks the turno paid when nothing
  // is left to pay.
  const registrarManual = (eleccion) =>
    ejecutar(async () => {
      const medio = medioDeForma(eleccion.forma);
      const monto = aNumero(eleccion.monto);
      const res = await PagoService.registrar(idTurno, {
        medio,
        monto,
        referencia: eleccion.referencia.trim() || undefined,
      });
      setMensajeOk(`Se registró el pago de ${formatearMontoARS(monto)} (${medio}).`);
      setCobro(null);
      setQr(null);
      setVersionSaldo((v) => v + 1);
      if (res.data?.cobrado) avisarCobrado();
    }, 'No se pudo registrar el pago.');

  // The choice made when finishing the turno is carried out once the panel knows the
  // debt exists (the turno is Realizado and the balance has loaded).
  useEffect(() => {
    if (!preferencia || yaCobrado || isLoading || !saldo) return undefined;
    // Deferred, and marked as done only when it actually runs: if React remounts the
    // effect (development), the first timer is cleared and the second one still fires.
    const temporizador = setTimeout(() => {
      if (preferenciaEjecutada.current) return;
      preferenciaEjecutada.current = true;
      if (preferencia.forma === 'qr') crearQr();
      else registrarManual(preferencia);
    }, 0);
    return () => clearTimeout(temporizador);
    // Runs once per preferencia; the handlers only use setters, refs and stable props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferencia, yaCobrado, isLoading, saldo]);

  const handleConfirmar = async (eleccion) => {
    const ok = eleccion.forma === 'qr' ? await crearQr() : await registrarManual(eleccion);
    if (ok) setModal(null);
  };

  const abrirModal = (cual) => {
    setError(null);
    setMensajeOk(null);
    setModal(cual);
  };

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

  const listaPagos = saldo?.pagos?.length > 0 && (
    <div className="mt-3">
      <span className="combustible-label">Pagos registrados</span>
      <ul className="list-unstyled m-0 small">
        {saldo.pagos.map((pago) => (
          <li key={pago.id_pago} className="d-flex justify-content-between gap-2">
            <span className="text-secondary">
              {pago.medio}{formatearFecha(pago.fecha) ? ` · ${formatearFecha(pago.fecha)}` : ''}
            </span>
            <strong className="text-dark">{formatearMontoARS(pago.monto)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );

  if (yaCobrado) {
    return (
      <div className="cobro-qr mt-4">
        <Aviso tipo="ok" icono={CheckCircle2}>
          Este turno está cobrado{saldo?.total ? `: ${formatearMontoARS(saldo.total)}` : ''}.
        </Aviso>
        {listaPagos}
      </div>
    );
  }

  if (isLoading) {
    return <div className="cobro-qr mt-4 text-secondary small">Consultando el cobro...</div>;
  }

  const estado = cobro ? describirCobro(cobro, formatearMontoARS) : null;
  const qrVisible = qr && qr.id === cobroId ? qr.url : null;
  const sinSaldo = pendiente !== null && pendiente <= 0;
  const elegirNuevo = !cobro || sePuedeRegenerar(cobro);

  return (
    <div className="cobro-qr mt-4">
      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
        <h6 className="text-secondary fw-bold small text-uppercase d-flex align-items-center gap-2 m-0" style={{ letterSpacing: '0.05em' }}>
          <QrCode size={16} /> Cobro del turno
        </h6>
        {pendiente !== null && (
          <span className="text-end">
            <span className="text-secondary small d-block">Pendiente de cobro</span>
            <strong className="text-dark">{formatearMontoARS(pendiente)}</strong>
          </span>
        )}
      </div>

      {mensajeOk && <div className="mb-3"><Aviso tipo="ok" icono={CheckCircle2}>{mensajeOk}</Aviso></div>}
      {error && !modal && <div className="mb-3"><Aviso tipo="error" icono={AlertCircle}>{error}</Aviso></div>}

      {sinSaldo && !cobro ? (
        <Aviso tipo="ok" icono={CheckCircle2}>Este turno no tiene saldo pendiente de cobro.</Aviso>
      ) : elegirNuevo ? (
        <>
          {estado && <div className="mb-3"><Aviso tipo={estado.tipo} icono={ICONOS[estado.tipo]}>{estado.mensaje}</Aviso></div>}
          <p className="text-secondary small mb-2">
            Mientras el cliente no pague, la deuda sigue en su cuenta corriente.
          </p>
          <Button
            variant="primary"
            onClick={() => abrirModal('cobrar')}
            disabled={isWorking}
            style={{ backgroundColor: VERDE, borderColor: VERDE }}
          >
            Cobrar
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
                <button type="button" className="btn btn-link btn-sm p-0 text-start text-decoration-none fw-semibold" style={{ color: VERDE }} onClick={() => abrirModal('manual')}>
                  El cliente pagó de otra forma (efectivo o transferencia)
                </button>
              </div>
            </div>
          )}

        </>
      )}

      {listaPagos}

      {modal && (
        <RegistroPagoModal
          modo="registrar"
          formas={modal === 'manual' ? FORMAS_MANUALES : FORMAS_PANEL}
          formaInicial={modal === 'manual' ? 'efectivo' : 'qr'}
          subtitulo={`Turno #${idTurno}`}
          total={saldo?.total ?? null}
          pendiente={pendiente}
          pagado={totalPagado(saldo?.pagos)}
          aviso={modal === 'manual' ? 'Al registrar el pago, el QR pendiente se cancela para que nadie lo pague de más.' : null}
          isSaving={isWorking}
          error={error}
          onConfirm={handleConfirmar}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
