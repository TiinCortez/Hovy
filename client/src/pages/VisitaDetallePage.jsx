import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MessageCircle,
  User,
  Phone,
  MapPin,
  Ruler,
  Wrench,
  CalendarDays,
  Clock,
  StickyNote,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import VisitaService from '../services/api/visita.service';

const FRANJA_TEXTO = {
  Mañana: 'por la mañana',
  Tarde: 'por la tarde',
  Indistinto: 'en cualquier horario',
};

const mensajeWhatsapp = (nombre) =>
  `Hola ${nombre}, como esta? Gracias por comunicarse con hovy. ¿Continuamos con la asignacion de la visita para poder realizar un presupuesto?`;

const formatFecha = (valor) => {
  if (!valor) return null;
  return new Date(valor).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' });
};

export default function VisitaDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [visita, setVisita] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contactando, setContactando] = useState(false);

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
      alert(err.response?.data?.error || 'No se pudo marcar la solicitud como contactada.');
    } finally {
      setContactando(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <div className="spinner-border" style={{ color: '#1B3006' }} role="status"></div>
      </div>
    );
  }

  if (error || !visita) {
    return (
      <div className="p-5 text-center">
        <AlertTriangle size={48} className="text-warning mb-3 mx-auto" />
        <h3 className="fw-bold text-dark">Solicitud no encontrada</h3>
        <p className="text-secondary">{error || 'Es posible que el enlace sea incorrecto.'}</p>
        <Button onClick={() => navigate('/dashboard')} variant="outline-primary" className="mt-3 bg-white text-dark border-secondary">
          Volver al inicio
        </Button>
      </div>
    );
  }

  const franja = FRANJA_TEXTO[visita.franja_preferida] ?? FRANJA_TEXTO.Indistinto;
  const yaContactada = visita.estado !== 'Pendiente';

  return (
    <div className="d-flex flex-column gap-4 pb-5">
      <div>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn btn-link text-dark text-decoration-none p-0 d-flex align-items-center gap-2 fw-semibold"
        >
          <ArrowLeft size={18} /> Volver al inicio
        </button>
      </div>

      <Card className="p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4 pb-4 border-bottom">
          <div className="d-flex align-items-center gap-3">
            <div
              className="rounded-4 d-flex align-items-center justify-content-center fw-bold text-success flex-shrink-0"
              style={{ width: 56, height: 56, backgroundColor: '#E8F5E9', fontSize: '1.25rem', border: '1px solid #C8E6C9' }}
            >
              {visita.nombre?.[0]?.toUpperCase()}{visita.apellido?.[0]?.toUpperCase()}
            </div>
            <div>
              <h2 className="fw-bold text-dark m-0 fs-4">{visita.nombre} {visita.apellido}</h2>
              <p className="text-secondary small m-0">Solicitud de visita #{visita.id_solicitud}</p>
            </div>
          </div>

          <span
            className={`badge rounded-pill px-3 py-2 fw-semibold d-flex align-items-center gap-1 ${
              yaContactada ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-warning-subtle text-warning border border-warning-subtle'
            }`}
          >
            {yaContactada ? <CheckCircle2 size={14} /> : <Clock size={14} />}
            {visita.estado}
          </span>
        </div>

        <div className="row g-3 mb-4">
          <div className="col-12 col-md-6">
            <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
              <Phone size={18} className="text-secondary mb-1" />
              <div className="text-secondary text-uppercase fw-bold mb-1" style={{ fontSize: '0.65rem' }}>Teléfono</div>
              <div className="fw-medium text-dark small">+{visita.telefono}</div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
              <User size={18} className="text-secondary mb-1" />
              <div className="text-secondary text-uppercase fw-bold mb-1" style={{ fontSize: '0.65rem' }}>Disponibilidad</div>
              <div className="fw-medium text-dark small text-capitalize">{franja}</div>
            </div>
          </div>
          <div className="col-12">
            <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
              <MapPin size={18} className="text-secondary mb-1" />
              <div className="text-secondary text-uppercase fw-bold mb-1" style={{ fontSize: '0.65rem' }}>Dirección</div>
              <div className="fw-medium text-dark small">
                {visita.direccion}
                {visita.barrio && `, ${visita.barrio}`}
                {visita.provincia && `, ${visita.provincia}`}
              </div>
            </div>
          </div>
          {visita.superficie_aproximada && (
            <div className="col-12 col-md-6">
              <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                <Ruler size={18} className="text-secondary mb-1" />
                <div className="text-secondary text-uppercase fw-bold mb-1" style={{ fontSize: '0.65rem' }}>Superficie aproximada</div>
                <div className="fw-medium text-dark small">{visita.superficie_aproximada} m²</div>
              </div>
            </div>
          )}
          {visita.servicio && (
            <div className="col-12 col-md-6">
              <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                <Wrench size={18} className="text-secondary mb-1" />
                <div className="text-secondary text-uppercase fw-bold mb-1" style={{ fontSize: '0.65rem' }}>Servicio solicitado</div>
                <div className="fw-medium text-dark small">{visita.servicio}</div>
              </div>
            </div>
          )}
          {visita.fecha_preferida && (
            <div className="col-12 col-md-6">
              <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                <CalendarDays size={18} className="text-secondary mb-1" />
                <div className="text-secondary text-uppercase fw-bold mb-1" style={{ fontSize: '0.65rem' }}>Fecha preferida</div>
                <div className="fw-medium text-dark small">{visita.fecha_preferida}</div>
              </div>
            </div>
          )}
          {visita.nota_horario && (
            <div className="col-12">
              <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                <StickyNote size={18} className="text-secondary mb-1" />
                <div className="text-secondary text-uppercase fw-bold mb-1" style={{ fontSize: '0.65rem' }}>Nota sobre el horario</div>
                <div className="fw-medium text-dark small">{visita.nota_horario}</div>
              </div>
            </div>
          )}
          <div className="col-12">
            <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
              <Clock size={18} className="text-secondary mb-1" />
              <div className="text-secondary text-uppercase fw-bold mb-1" style={{ fontSize: '0.65rem' }}>Solicitada el</div>
              <div className="fw-medium text-dark small">{formatFecha(visita.created_at)}</div>
            </div>
          </div>
        </div>

        <Button
          variant="primary"
          className="w-100 w-md-auto justify-content-center"
          style={{ backgroundColor: '#1B3006', borderColor: '#1B3006' }}
          onClick={handleContactar}
          disabled={contactando || yaContactada}
        >
          <MessageCircle size={18} />
          {yaContactada ? 'Ya contactada' : contactando ? 'Abriendo WhatsApp...' : 'Contactar'}
        </Button>
        {!yaContactada && (
          <p className="text-secondary text-center mt-2 mb-0" style={{ fontSize: '0.75rem' }}>
            Al presionar Contactar, la solicitud pasará a "Contactada" automáticamente.
          </p>
        )}
      </Card>
    </div>
  );
}
