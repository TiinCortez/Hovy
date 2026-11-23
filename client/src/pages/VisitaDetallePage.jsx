import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import { useAvisos } from '../components/ui/avisosContext';
import VisitaService from '../services/api/visita.service';
import ConfirmarVisitaForm from '../components/visitas/ConfirmarVisitaForm.jsx';
import FlujoConfirmada from '../components/visitas/FlujoConfirmada.jsx';
import CancelarVisitaModal from '../components/visitas/CancelarVisitaModal.jsx';
import RechazarVisitaModal from '../components/visitas/RechazarVisitaModal.jsx';
import ResumenVisitaPanel from '../components/visitas/ResumenVisitaPanel.jsx';
import VisitaDetalleCard from '../components/visitas/VisitaDetalleCard.jsx';
import VisitaDetalleSkeleton from '../components/skeletons/VisitaDetalleSkeleton';
import { mensajeWhatsapp } from '../components/visitas/visitaUtils';

export default function VisitaDetallePage() {
  const { avisar } = useAvisos();
  const { id } = useParams();

  const [visita, setVisita] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contactando, setContactando] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showCancel, setShowCancel] = useState(false);
  const [showReject, setShowReject] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchVisita = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await VisitaService.getById(id);
        if (isMounted) setVisita(response.data);
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.error || 'No se pudo cargar la solicitud de visita.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchVisita();
    return () => { isMounted = false; };
  }, [id]);

  // Called by the workflow components after each mutation: reload without the full-page spinner
  const refreshVisita = useCallback(async (message) => {
    try {
      const response = await VisitaService.getById(id);
      setVisita(response.data);
      setFeedback(message ? { type: 'success', text: message } : null);
    } catch (err) {
      setFeedback({ type: 'danger', text: err.response?.data?.error || 'No se pudo actualizar la solicitud.' });
    }
  }, [id]);

  const handleContactar = async () => {
    if (!visita) return;
    setContactando(true);
    try {
      const url = `https://wa.me/${visita.telefono}?text=${encodeURIComponent(mensajeWhatsapp(visita.nombre))}`;
      window.open(url, '_blank', 'noopener,noreferrer');

      const response = await VisitaService.contactar(visita.id_solicitud);
      setVisita(response.data);
    } catch (err) {
      console.error('No se pudo marcar la solicitud como contactada:', err);
      avisar(err.response?.data?.error || 'No se pudo marcar la solicitud como contactada.');
    } finally {
      setContactando(false);
    }
  };

  if (loading) {
    return <VisitaDetalleSkeleton />;
  }

  if (error || !visita) {
    return (
      <div className="p-5 text-center">
        <AlertTriangle size={48} className="text-warning mb-3 mx-auto" />
        <h3 className="fw-bold text-dark">Solicitud no encontrada</h3>
        <p className="text-secondary">{error || 'Es posible que el enlace sea incorrecto.'}</p>
        <Link to="/dashboard" className="btn btn-outline-primary mt-3 bg-white text-dark border-secondary">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column gap-4 pb-5">
      <div>
        <Link
          to="/dashboard"
          className="btn btn-link text-dark text-decoration-none p-0 d-flex align-items-center gap-2 fw-semibold"
        >
          <ArrowLeft size={18} aria-hidden="true" /> Volver al inicio
        </Link>
      </div>

      <VisitaDetalleCard
        visita={visita}
        onContactar={handleContactar}
        contactando={contactando}
      />

      {feedback && (
        <div className={`alert alert-${feedback.type} rounded-3 m-0 small fw-medium`} role={feedback.type === 'danger' ? 'alert' : 'status'}>
          {feedback.text}
        </div>
      )}

      {visita.estado === 'Contactada' && <ConfirmarVisitaForm visita={visita} onDone={refreshVisita} />}
      {visita.tipo_solicitud === 'cliente' && ['Pendiente', 'Contactada'].includes(visita.estado) && (
        <div>
          <Button variant="light" className="text-danger d-flex align-items-center gap-2" onClick={() => setShowCancel(true)}>
            <XCircle size={18} /> Cancelar visita
          </Button>
        </div>
      )}
      {showCancel && (
        <CancelarVisitaModal
          idSolicitud={visita.id_solicitud}
          onClose={() => setShowCancel(false)}
          onCancelled={() => {
            setShowCancel(false);
            refreshVisita('Visita cancelada.');
          }}
        />
      )}
      {visita.tipo_solicitud !== 'cliente' && visita.id_cliente == null && ['Pendiente', 'Contactada'].includes(visita.estado) && (
        <div>
          <Button variant="light" className="text-danger d-flex align-items-center gap-2" onClick={() => setShowReject(true)}>
            <XCircle size={18} /> Rechazar solicitud
          </Button>
        </div>
      )}
      {showReject && (
        <RechazarVisitaModal
          idSolicitud={visita.id_solicitud}
          onClose={() => setShowReject(false)}
          onRejected={(respuesta) => {
            setShowReject(false);
            refreshVisita(respuesta?.aviso_enviado
              ? 'Solicitud rechazada. Le avisamos por WhatsApp.'
              : 'Solicitud rechazada. No le pudimos avisar por WhatsApp (puede que no haya escrito en las últimas 24 h).');
          }}
        />
      )}
      {visita.estado === 'Rechazada' && (
        <p className="text-secondary small m-0">
          Esta solicitud fue rechazada{visita.motivo_rechazo ? `. Motivo: ${visita.motivo_rechazo}` : ''}. No admite más cambios.
        </p>
      )}
      {visita.estado === 'Confirmada' && <FlujoConfirmada visita={visita} onRefresh={refreshVisita} />}
      {visita.estado === 'Realizada' && <ResumenVisitaPanel visita={visita} />}
      {visita.estado === 'Cancelada' && (
        <p className="text-secondary small m-0">Esta visita fue cancelada. No admite más cambios.</p>
      )}
    </div>
  );
}
