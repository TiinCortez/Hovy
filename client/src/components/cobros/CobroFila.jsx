import {
  AlertCircle, Clock, MapPin, Wrench, MoreVertical, CheckCircle2, Hourglass,
  FileText, MessageCircle, RotateCcw,
} from 'lucide-react';
import Button from '../ui/Button';
import { obtenerEnlaceWhatsApp } from '../../services/whatsapp';
import { formatearHorarioTurno, formatearMontoARS } from '../turnos/agendaTurnos';
import {
  codigoOrden, formatearDiaCorto, montoFinal, cobroAtrasado, diasEntre, DIAS_ALERTA_COBRO,
} from './cobrosUtils';

// Una fila de la liquidación: grilla en desktop y tarjeta apilada en mobile (cobros.scss)
export default function CobroFila({
  turno, hoy, guardando, menuAbierto, onToggleMenu, onCambiarCobrado, onVerDetalle,
}) {
  const { cobrado, cliente = {}, inmueble = {}, fechaAsignada } = turno;
  const monto = montoFinal(turno);
  const atrasado = cobroAtrasado(turno, hoy);
  const diasSinCobrar = diasEntre(fechaAsignada, hoy);
  const ubicacion = [inmueble.direccion, inmueble.barrio].filter(Boolean).join(', ') || 'Sin dirección';

  const enlaceWhatsApp = obtenerEnlaceWhatsApp(cliente.telefono);
  const mensaje = `Hola ${cliente.nombre || ''}, te escribimos de Hovy para recordarte que está pendiente el pago del servicio realizado el ${formatearDiaCorto(fechaAsignada)} por ${formatearMontoARS(monto)}. ¡Muchas gracias!`;
  const urlWhatsApp = enlaceWhatsApp ? `${enlaceWhatsApp}?text=${encodeURIComponent(mensaje)}` : null;

  return (
    <div className={`cobros-fila ${cobrado ? '' : 'is-pendiente'}`}>
      <div className="cobros-celda-turno min-w-0">
        <div className="d-flex align-items-center gap-2">
          <span className="fw-bold" style={{ color: '#173313' }}>{codigoOrden(turno)}</span>
          {atrasado && (
            <span
              className="cobros-alerta d-inline-flex"
              title={`Lleva ${diasSinCobrar} días sin cobrar (más de ${DIAS_ALERTA_COBRO})`}
              aria-label={`Lleva ${diasSinCobrar} días sin cobrar`}
              role="img"
            >
              <AlertCircle size={16} />
            </span>
          )}
        </div>
        <div className="small text-secondary d-flex align-items-center gap-1 mt-1">
          <Clock size={14} className="flex-shrink-0" />
          <span>{formatearDiaCorto(fechaAsignada)} • {formatearHorarioTurno(turno)}</span>
        </div>
      </div>

      <div className="cobros-celda-cliente min-w-0">
        <div className="fw-semibold text-dark text-truncate">
          {`${cliente.nombre || ''} ${cliente.apellido || ''}`.trim() || 'Sin cliente'}
        </div>
        <div className="small text-secondary d-flex align-items-center gap-1 min-w-0">
          <MapPin size={14} className="flex-shrink-0" />
          <span className="text-truncate" title={ubicacion}>{ubicacion}</span>
        </div>
      </div>

      <div className="cobros-celda-servicio min-w-0">
        <div className="small fw-semibold text-dark d-flex align-items-center gap-1 min-w-0">
          <Wrench size={14} className="text-secondary flex-shrink-0 d-lg-none" />
          <span className="text-truncate" title={turno.servicio?.descripcion}>
            {turno.servicio?.descripcion}
          </span>
        </div>
      </div>

      <div className="cobros-celda-monto">
        <span className="d-block d-lg-none text-secondary fw-semibold" style={{ fontSize: '0.65rem' }}>Presupuesto final</span>
        <span className={`cobros-monto ${cobrado ? 'is-cobrado' : 'is-pendiente'}`}>{formatearMontoARS(monto)}</span>
      </div>

      <div className="cobros-celda-estado d-flex align-items-center justify-content-end justify-content-lg-center gap-2">
        <div className="d-flex flex-column align-items-center">
          <button
            type="button"
            className={`cobros-estado ${cobrado ? 'is-cobrado' : 'is-pendiente'}`}
            onClick={() => onCambiarCobrado(turno, !cobrado)}
            disabled={guardando}
            aria-label={cobrado ? 'Cobrado. Click para volver a pendiente' : 'Pendiente. Click para marcar como cobrado'}
            title={cobrado ? 'Volver a pendiente' : 'Marcar como cobrado'}
          >
            {cobrado ? <CheckCircle2 size={16} /> : <Hourglass size={16} />}
            <span>{cobrado ? 'Cobrado' : 'Pendiente'}</span>
          </button>
          {!cobrado && (
            <button
              type="button"
              className="cobros-link-cobrar mt-1"
              onClick={() => onCambiarCobrado(turno, true)}
              disabled={guardando}
            >
              + Marcar cobrado
            </button>
          )}
        </div>

        <div className="position-relative" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="light"
            icon
            aria-label="Opciones del turno"
            aria-expanded={menuAbierto}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu();
            }}
          >
            <MoreVertical size={16} />
          </Button>

          {menuAbierto && (
            <div
              className="position-absolute end-0 mt-1 bg-white rounded-3 shadow border py-1"
              style={{ minWidth: '220px', zIndex: 1050 }}
            >
              <button
                type="button"
                className="w-100 btn btn-sm text-start px-3 py-2 d-flex align-items-center gap-2 text-dark border-0 rounded-0"
                onClick={() => onVerDetalle(turno)}
              >
                <FileText size={14} className="text-secondary" />
                <span>Ver detalle del turno</span>
              </button>

              {!cobrado && (
                urlWhatsApp ? (
                  <a
                    href={urlWhatsApp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-100 btn btn-sm text-start px-3 py-2 d-flex align-items-center gap-2 text-dark border-0 rounded-0"
                    onClick={onToggleMenu}
                  >
                    <MessageCircle size={14} className="text-success" />
                    <span>Enviar aviso por WhatsApp</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    className="w-100 btn btn-sm text-start px-3 py-2 d-flex align-items-center gap-2 text-secondary border-0 rounded-0"
                    disabled
                    title="El cliente no tiene un teléfono válido para WhatsApp"
                  >
                    <MessageCircle size={14} />
                    <span>Enviar aviso por WhatsApp</span>
                  </button>
                )
              )}

              <button
                type="button"
                className={`w-100 btn btn-sm text-start px-3 py-2 d-flex align-items-center gap-2 border-0 rounded-0 ${cobrado ? 'cobros-texto-terracota' : 'text-success'}`}
                onClick={() => onCambiarCobrado(turno, !cobrado)}
                disabled={guardando}
              >
                {cobrado ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
                <span>{cobrado ? 'Marcar como pendiente' : 'Marcar como cobrado'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}