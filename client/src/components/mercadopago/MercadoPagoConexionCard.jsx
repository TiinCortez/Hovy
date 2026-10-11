import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import MercadoPagoService from '../../services/api/mercadopago.service';
import DesvincularMercadoPagoModal from './DesvincularMercadoPagoModal';
import { alertaDesdeParams } from './mercadopagoMotivos';

const formatFecha = (iso) =>
  iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

export default function MercadoPagoConexionCard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [conexion, setConexion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState(null);
  const [alerta, setAlerta] = useState(() => alertaDesdeParams(searchParams));
  const [showModal, setShowModal] = useState(false);

  // Reload (retry / after unlink). isLoading starts true, so the first load
  // below only sets state from async callbacks.
  const cargar = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await MercadoPagoService.getConexion();
      setConexion(res.data);
    } catch (err) {
      setLoadError(err.response?.data?.error || 'No se pudo consultar el estado de Mercado Pago.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    MercadoPagoService.getConexion()
      .then((res) => { if (!cancelled) setConexion(res.data); })
      .catch((err) => {
        if (!cancelled) setLoadError(err.response?.data?.error || 'No se pudo consultar el estado de Mercado Pago.');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Remove the return params so a refresh does not repeat the alert.
  useEffect(() => {
    if (searchParams.has('mercadopago') || searchParams.has('motivo')) {
      const next = new URLSearchParams(searchParams);
      next.delete('mercadopago');
      next.delete('motivo');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleVincular = async () => {
    setIsLinking(true);
    setLinkError(null);
    setAlerta(null);
    try {
      const res = await MercadoPagoService.iniciarVinculacion();
      const url = res?.data?.url;
      if (typeof url !== 'string' || !url.startsWith('https://')) {
        throw new Error('invalid-url');
      }
      window.location.assign(url);
    } catch (err) {
      setLinkError(err.response?.data?.error || 'No se pudo iniciar la vinculación con Mercado Pago.');
      setIsLinking(false);
    }
  };

  const reautorizar = conexion?.estado === 'Reautorizar';
  const conectada = conexion?.conectada === true;
  const vinculada = conectada || reautorizar;

  return (
    <Card title="Mercado Pago">
      <div className="d-flex flex-column gap-3">
        {alerta && (
          <div className={`alert alert-${alerta.type} alert-dismissible d-flex align-items-center gap-2 rounded-3 mb-0`} role="alert">
            {alerta.type === 'success' ? <CheckCircle2 size={18} className="flex-shrink-0" /> : <AlertCircle size={18} className="flex-shrink-0" />}
            <span className="small fw-medium">{alerta.message}</span>
            <button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setAlerta(null)} />
          </div>
        )}

        {linkError && (
          <div className="alert alert-danger d-flex align-items-center gap-2 rounded-3 mb-0" role="alert">
            <AlertCircle size={18} className="flex-shrink-0" />
            <span className="small fw-medium">{linkError}</span>
          </div>
        )}

        {isLoading && <p className="text-secondary mb-0">Cargando estado de la conexión...</p>}

        {!isLoading && loadError && (
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <span className="text-danger small fw-medium">{loadError}</span>
            <Button variant="light" size="sm" className="rounded-pill" onClick={cargar}>Reintentar</Button>
          </div>
        )}

        {!isLoading && !loadError && conexion && (
          <>
            {conectada && (
              <div>
                <span className="badge text-bg-success rounded-pill mb-2">Conectada</span>
                <p className="mb-1">Cuenta de Mercado Pago vinculada (ID {conexion.mp_user_id}).</p>
                <p className="small text-secondary mb-0">Autorización vigente hasta {formatFecha(conexion.expira_en)}. Se renueva automáticamente.</p>
              </div>
            )}
            {reautorizar && (
              <div>
                <span className="badge text-bg-warning rounded-pill mb-2">Reautorizar</span>
                <p className="mb-0">La vinculación con Mercado Pago venció o fue revocada. Volvé a vincular tu cuenta para seguir cobrando.</p>
              </div>
            )}
            {!vinculada && (
              <p className="mb-0 text-secondary">Todavía no vinculaste tu cuenta de Mercado Pago. Vinculala para cobrar a tus clientes con QR.</p>
            )}

            <div className="d-flex gap-2 flex-wrap">
              <Button onClick={handleVincular} disabled={isLinking}>
                {isLinking ? 'Redirigiendo...' : (reautorizar ? 'Volver a vincular' : 'Vincular Mercado Pago')}
              </Button>
              {vinculada && (
                <Button variant="outline-danger" onClick={() => setShowModal(true)} disabled={isLinking}>
                  Desvincular
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <DesvincularMercadoPagoModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onUnlinked={cargar}
      />
    </Card>
  );
}
