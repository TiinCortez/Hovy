import { CalendarDays, ClipboardList, MapPin, Receipt } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { CAPAS } from '../../styles/capas';
import {
  ESTADO_META,
  PRIORIDAD_META,
  formatearFechaLarga,
  formatearFechaPago,
  formatearFranja,
  formatearMonto,
  obtenerResumenCobro,
} from './historialTurnosUtils';
import './historialTurnos.scss';

export default function HistorialTurnoDetalleModal({ turno, nombreCliente, onCerrar }) {
  if (!turno) return null;

  const estadoInfo = ESTADO_META[turno.estado] ?? { label: turno.estado || 'Sin estado', mod: 'coordinado' };
  const prioridadInfo = PRIORIDAD_META[turno.prioridad] ?? { label: turno.prioridad || 'Sin prioridad', mod: 'p3' };
  const resumenCobro = obtenerResumenCobro(turno);
  const inmueble = turno.inmueble || {};
  const presupuesto = turno.presupuesto || null;
  const pagos = Array.isArray(turno.cobro?.pagos) ? turno.cobro.pagos : [];
  const mostrarBloqueCobro = resumenCobro !== null || pagos.length > 0;

  const direccionCompleta = [
    inmueble.direccion || 'Sin dirección',
    inmueble.manzana ? `Mz ${inmueble.manzana}` : null,
    inmueble.lote ? `Lote ${inmueble.lote}` : null,
  ].filter(Boolean).join(' · ');

  const ubicacion = [inmueble.barrio, inmueble.provincia].filter(Boolean).join(', ') || 'Sin especificar';
  const supMantenible = Number(inmueble.superficie_mantenible);
  const supTotal = Number(inmueble.superficie_total);
  const superficieTexto = Number.isFinite(supMantenible) && supMantenible > 0
    ? `${supMantenible} m² mantenibles`
    : Number.isFinite(supTotal) && supTotal > 0
      ? `${supTotal} m² totales`
      : 'Sin medir';

  const tieneTraslado = presupuesto
    && ((presupuesto.monto_traslado !== null && Number(presupuesto.monto_traslado) > 0)
      || (presupuesto.traslado_km !== null && Number(presupuesto.traslado_km) > 0));

  const mostrarSubtotal = presupuesto
    && Number(presupuesto.monto_subtotal) > 0
    && Number(presupuesto.monto_subtotal) !== Number(presupuesto.monto_total);

  return (
    <Modal
      antetitulo={<span className="hovy-rotulo">Historial · Solo lectura</span>}
      titulo={`Turno #${turno.id_turno}`}
      subtitulo={(
        <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
          <span className={`historial-estado-pill historial-estado-pill--${estadoInfo.mod}`}>
            {estadoInfo.label}
          </span>
          <span className={`historial-prioridad-pill historial-prioridad-pill--${prioridadInfo.mod}`}>
            {prioridadInfo.label}
          </span>
          {resumenCobro && (
            <span className={`historial-cobro-pill historial-cobro-pill--${resumenCobro.tipo}`}>
              {resumenCobro.label}
            </span>
          )}
        </div>
      )}
      onCerrar={onCerrar}
      etiquetaCerrar="Cerrar detalle del turno"
      tamano="lg"
      desplazable
      cerrarAlTocarFondo
      zIndex={CAPAS.modalEncima}
      claseContenido="overflow-hidden bg-white"
      claseCabecera="border-bottom pb-3 pt-4 px-3 px-md-4"
    >
      <div className="modal-body p-3 p-md-4 d-flex flex-column gap-3">
        {turno.estado === 'CANCELADO' && (
          <div className="historial-detalle-cancelacion">
            <strong className="d-block mb-1">Motivo de cancelación</strong>
            <span>{turno.motivo_cancelacion || 'Sin motivo registrado'}</span>
          </div>
        )}

        <div className="historial-detalle-grid">
          <section className="historial-detalle-bloque">
            <h3><CalendarDays size={15} aria-hidden="true" /> Programación</h3>
            <div className="historial-detalle-fila">
              <span>Fecha</span>
              <strong>{formatearFechaLarga(turno.fecha_programada)}</strong>
            </div>
            <div className="historial-detalle-fila">
              <span>Franja horaria</span>
              <strong>{formatearFranja(turno.inicio_desde, turno.hasta)}</strong>
            </div>
            <div className="historial-detalle-fila">
              <span>Cliente</span>
              <strong>{nombreCliente || 'Cliente'}</strong>
            </div>
          </section>

          <section className="historial-detalle-bloque">
            <h3><MapPin size={15} aria-hidden="true" /> Inmueble</h3>
            <div className="historial-detalle-fila">
              <span>Dirección</span>
              <strong>{direccionCompleta}</strong>
            </div>
            <div className="historial-detalle-fila">
              <span>Ubicación</span>
              <strong>{ubicacion}</strong>
            </div>
            <div className="historial-detalle-fila">
              <span>Tipo / Superficie</span>
              <strong>{[inmueble.tipo_inmueble || 'General', superficieTexto].join(' · ')}</strong>
            </div>
          </section>

          <section className="historial-detalle-bloque">
            <h3><ClipboardList size={15} aria-hidden="true" /> Servicios y Presupuesto</h3>
            <div className="historial-detalle-fila">
              <span>Servicios</span>
              <strong>
                {Array.isArray(turno.servicios) && turno.servicios.length > 0
                  ? turno.servicios.join(', ')
                  : 'Sin servicio asociado'}
              </strong>
            </div>
            {presupuesto ? (
              <>
                <div className="historial-detalle-fila">
                  <span>Presupuesto</span>
                  <strong>
                    #{presupuesto.id_presupuesto}{presupuesto.estado ? ` · ${presupuesto.estado}` : ''}
                  </strong>
                </div>
                <div className="historial-detalle-fila">
                  <span>Monto estimado</span>
                  <strong>{formatearMonto(presupuesto.monto_estimado)}</strong>
                </div>
                {tieneTraslado && (
                  <div className="historial-detalle-fila">
                    <span>Traslado</span>
                    <strong>
                      {formatearMonto(presupuesto.monto_traslado ?? 0)}
                      {presupuesto.traslado_km ? ` (${presupuesto.traslado_km} km)` : ''}
                    </strong>
                  </div>
                )}
                {mostrarSubtotal && (
                  <div className="historial-detalle-fila">
                    <span>Subtotal</span>
                    <strong>{formatearMonto(presupuesto.monto_subtotal)}</strong>
                  </div>
                )}
                <div className="historial-detalle-fila">
                  <span>Total final</span>
                  <strong>{formatearMonto(presupuesto.monto_total)}</strong>
                </div>
              </>
            ) : (
              <div className="historial-detalle-fila">
                <span>Presupuesto</span>
                <strong>Sin presupuesto asociado</strong>
              </div>
            )}
          </section>

          {mostrarBloqueCobro && (
            <section className="historial-detalle-bloque">
              <h3><Receipt size={15} aria-hidden="true" /> Cobro y Pagos</h3>
              <div className="historial-detalle-fila">
                <span>Estado</span>
                <strong>{resumenCobro?.label || (turno.cobrado ? 'Cobrado' : 'Pendiente')}</strong>
              </div>
              <div className="historial-detalle-fila">
                <span>Total pagado</span>
                <strong>{formatearMonto(turno.cobro?.total_pagado ?? 0)}</strong>
              </div>
              {resumenCobro && resumenCobro.pendiente > 0 && (
                <div className="historial-detalle-fila">
                  <span>Saldo pendiente</span>
                  <strong>{formatearMonto(resumenCobro.pendiente)}</strong>
                </div>
              )}
              {pagos.length > 0 ? (
                <ul className="historial-detalle-pagos">
                  {pagos.map((pago) => (
                    <li key={pago.id_pago}>
                      <span>
                        <strong>{pago.medio_pago || 'Pago'}</strong> · {formatearFechaPago(pago.fecha_pago)}
                      </span>
                      <strong>{formatearMonto(pago.monto)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="historial-detalle-fila">
                  <span>Pagos</span>
                  <strong>Sin pagos registrados</strong>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <div className="modal-footer border-top pt-3 pb-3 px-3 px-md-4">
        <Button
          variant="light"
          className="rounded-pill px-4 fw-semibold text-secondary border"
          onClick={onCerrar}
        >
          Cerrar
        </Button>
      </div>
    </Modal>
  );
}
