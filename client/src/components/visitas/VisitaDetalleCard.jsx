import {
  Phone,
  MapPin,
  Ruler,
  Wrench,
  CalendarDays,
  Clock,
  StickyNote,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';
import {
  BADGE_TIPO,
  getEstadoLabel,
  formatFecha,
  FRANJA_TEXTO,
  mensajeWhatsapp,
} from './visitaUtils';
import { VERDE } from '../../styles/colores';

export default function VisitaDetalleCard({
  visita,
  onContactar,
  contactando = false,
  className = '',
}) {
  if (!visita) return null;

  const franja = FRANJA_TEXTO[visita.franja_preferida] ?? FRANJA_TEXTO.Indistinto;
  const yaContactada = visita.estado !== 'Pendiente';
  const estadoLabel = getEstadoLabel(visita.estado);

  return (
    <Card className={className}>
      {/* Encabezado */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 pb-4 border-bottom">
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded-4 d-flex align-items-center justify-content-center fw-bold text-success flex-shrink-0"
            style={{
              width: 52,
              height: 52,
              backgroundColor: 'var(--hovy-verde-100)',
              fontSize: 'var(--hovy-texto-lg)',
              border: '1px solid var(--hovy-verde-200)',
            }}
          >
            {visita.nombre?.[0]?.toUpperCase()}
            {visita.apellido?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h2 className="fw-bold text-dark m-0 fs-4">
                {visita.nombre} {visita.apellido}
              </h2>
              <Badge tipo={BADGE_TIPO[estadoLabel] || 'pendiente'} conPunto={false}>
                {yaContactada ? <CheckCircle2 size={13} aria-hidden="true" /> : <Clock size={13} aria-hidden="true" />}
                {estadoLabel}
              </Badge>
              {visita.estado === 'Realizada' && (
                <span className="badge rounded-pill px-2.5 py-1 fw-semibold bg-success text-white" style={{ fontSize: '11px' }}>
                  Turno asignado
                </span>
              )}
            </div>
            <p className="text-secondary small m-0 mt-1">
              Solicitud de visita #{visita.id_solicitud}
              {visita.created_at && ` • Solicitada el ${formatFecha(visita.created_at)}`}
            </p>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          {!yaContactada ? (
            <Button
              variant="primary"
              className="d-inline-flex align-items-center gap-2 px-3 py-2"
              style={{ backgroundColor: VERDE, borderColor: VERDE }}
              onClick={onContactar}
              disabled={contactando}
            >
              <MessageCircle size={16} />
              {contactando ? 'Abriendo WhatsApp…' : 'Contactar'}
            </Button>
          ) : (
            <a
              href={`https://wa.me/${visita.telefono}?text=${encodeURIComponent(mensajeWhatsapp(visita.nombre))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-2 px-3 py-2 rounded-3 fw-medium"
            >
              <MessageCircle size={16} /> Chat WhatsApp
            </a>
          )}
        </div>
      </div>

      {/* Cuerpo en 2 columnas */}
      <div className="row g-3 g-lg-4">
        {/* Columna Principal: Detalles del Servicio y Ubicación */}
        <div className="col-12 col-lg-7 d-flex flex-column gap-3">
          <h6 className="text-secondary text-uppercase fw-bold m-0" style={{ fontSize: 'var(--hovy-texto-xs)', letterSpacing: '0.05em' }}>
            Detalles del servicio
          </h6>

          <div className="row g-3">
            {visita.servicio && (
              <div className={`col-12 ${visita.superficie_aproximada ? 'col-sm-6' : ''}`}>
                <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle d-flex align-items-start gap-2.5">
                  <div
                    className="p-2 rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--hovy-verde-100)', color: 'var(--hovy-verde-700)', border: '1px solid var(--hovy-verde-200)' }}
                  >
                    <Wrench size={18} />
                  </div>
                  <div>
                    <span className="text-secondary text-uppercase fw-bold d-block" style={{ fontSize: 'var(--hovy-texto-xs)' }}>
                      Servicio solicitado
                    </span>
                    <span className="fw-bold text-dark small">{visita.servicio}</span>
                  </div>
                </div>
              </div>
            )}

            {visita.superficie_aproximada && (
              <div className={`col-12 ${visita.servicio ? 'col-sm-6' : ''}`}>
                <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle d-flex align-items-start gap-2.5">
                  <div className="p-2 rounded-3 bg-white text-secondary border border-light-subtle flex-shrink-0">
                    <Ruler size={18} />
                  </div>
                  <div>
                    <span className="text-secondary text-uppercase fw-bold d-block" style={{ fontSize: 'var(--hovy-texto-xs)' }}>
                      Superficie aproximada
                    </span>
                    <span className="fw-bold text-dark small">{visita.superficie_aproximada} m²</span>
                  </div>
                </div>
              </div>
            )}

            <div className="col-12">
              <div className="p-3 bg-light rounded-4 border border-light-subtle d-flex align-items-start gap-2.5">
                <div className="p-2 rounded-3 bg-white text-primary border border-light-subtle flex-shrink-0">
                  <MapPin size={18} />
                </div>
                <div className="flex-grow-1">
                  <span className="text-secondary text-uppercase fw-bold d-block" style={{ fontSize: 'var(--hovy-texto-xs)' }}>
                    Ubicación de la visita
                  </span>
                  <span className="fw-semibold text-dark small d-block">
                    {visita.direccion}
                    {visita.barrio && `, ${visita.barrio}`}
                  </span>
                  {visita.provincia && (
                    <span className="text-secondary small d-block">{visita.provincia}</span>
                  )}
                </div>
              </div>
            </div>

            {visita.nota_horario && (
              <div className="col-12">
                <div className="p-3 bg-light rounded-4 border border-light-subtle d-flex align-items-start gap-2.5">
                  <div className="p-2 rounded-3 bg-white text-secondary border border-light-subtle flex-shrink-0">
                    <StickyNote size={18} />
                  </div>
                  <div>
                    <span className="text-secondary text-uppercase fw-bold d-block" style={{ fontSize: 'var(--hovy-texto-xs)' }}>
                      Nota sobre el horario
                    </span>
                    <span className="fw-medium text-dark small">{visita.nota_horario}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Columna Lateral: Preferencias del Cliente y Contacto */}
        <div className="col-12 col-lg-5">
          <div className="p-3 bg-light rounded-4 border border-light-subtle h-100 d-flex flex-column justify-content-between">
            <div>
              <h6 className="text-secondary text-uppercase fw-bold mb-3" style={{ fontSize: 'var(--hovy-texto-xs)', letterSpacing: '0.05em' }}>
                Preferencias del cliente
              </h6>

              <div className="d-flex flex-column gap-3">
                {visita.fecha_preferida && (
                  <div className="d-flex align-items-center gap-3 pb-2.5 border-bottom border-light-subtle">
                    <CalendarDays size={18} className="text-secondary flex-shrink-0" />
                    <div>
                      <span className="text-secondary text-uppercase fw-bold d-block" style={{ fontSize: '10px' }}>
                        Fecha preferida
                      </span>
                      <span className="fw-bold text-dark small">{visita.fecha_preferida}</span>
                    </div>
                  </div>
                )}

                <div className="d-flex align-items-center gap-3 pb-2.5 border-bottom border-light-subtle">
                  <Clock size={18} className="text-secondary flex-shrink-0" />
                  <div>
                    <span className="text-secondary text-uppercase fw-bold d-block" style={{ fontSize: '10px' }}>
                      Disponibilidad
                    </span>
                    <span className="fw-bold text-dark small text-capitalize">{franja}</span>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-3">
                  <Phone size={18} className="text-secondary flex-shrink-0" />
                  <div>
                    <span className="text-secondary text-uppercase fw-bold d-block" style={{ fontSize: '10px' }}>
                      Teléfono
                    </span>
                    <span className="fw-bold text-dark small">+{visita.telefono}</span>
                  </div>
                </div>
              </div>
            </div>

            {!yaContactada && (
              <div className="pt-2 border-top border-light-subtle mt-3">
                <p className="text-secondary text-center m-0" style={{ fontSize: 'var(--hovy-texto-xs)' }}>
                  Al presionar Contactar, pasará a "Contactada" automáticamente.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
