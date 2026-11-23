import { Building2, ChevronRight, MessageCircle } from 'lucide-react';
import { obtenerEnlaceWhatsApp } from '../../services/whatsapp';
import {
  esClienteInactivo,
  formatearFechaCortaTurno,
  formatearHoraTurno,
  formatearTelefono,
  normalizarTipoCliente,
  obtenerInicialesCliente,
  obtenerNombreCliente,
} from './clientesUtils';

export default function ClienteCard({
  cliente,
  cantidadInmuebles,
  proximoTurno,
  seleccionado,
  onSeleccionar,
}) {
  const nombre = obtenerNombreCliente(cliente);
  const iniciales = obtenerInicialesCliente(cliente);
  const tipo = normalizarTipoCliente(cliente.tipo_cliente);
  const inactivo = esClienteInactivo(cliente);
  const enlaceWhatsApp = obtenerEnlaceWhatsApp(cliente.telefono);
  const fechaTurno = formatearFechaCortaTurno(proximoTurno?.fechaAsignada);
  const horaTurno = formatearHoraTurno(proximoTurno);

  const varianteAvatar = inactivo ? 'inactivo' : tipo.toLowerCase();
  const textoInmuebles = cantidadInmuebles === 0
    ? 'Sin inmuebles'
    : cantidadInmuebles === 1
      ? '1 inmueble'
      : `${cantidadInmuebles} inmuebles`;

  return (
    <li>
      <article className={`clientes-card${seleccionado ? ' is-selected' : ''}`}>
        {/* Capa 1: Identidad limpia */}
        <div className="clientes-card-cabecera">
          <div className="clientes-card-identidad">
            <div className={`clientes-avatar clientes-avatar--${varianteAvatar}`} aria-hidden="true">
              {iniciales}
            </div>
            <div className="clientes-card-titulo-wrap">
              <h2 className="clientes-card-nombre">
                <button
                  type="button"
                  className="clientes-card-trigger"
                  aria-expanded={seleccionado}
                  onClick={(e) => onSeleccionar(cliente, e.currentTarget)}
                >
                  {nombre}
                </button>
              </h2>
              <div className="clientes-card-meta-tipo">
                {inactivo ? (
                  <span className="clientes-tipo-pill clientes-tipo-pill--inactivo">Inactivo</span>
                ) : tipo === 'Casual' ? (
                  <span className="clientes-tipo-sutil">Casual</span>
                ) : (
                  <span className={`clientes-tipo-pill clientes-tipo-pill--${tipo.toLowerCase()}`}>
                    {tipo}
                  </span>
                )}
              </div>
            </div>
          </div>
          <span className="clientes-card-chevron" aria-hidden="true">
            <ChevronRight size={18} />
          </span>
        </div>

        {/* Capa 2: Señal operativa (el turno solo aparece si existe) */}
        <div className="clientes-card-operativa">
          <span className="clientes-dato-inmuebles">
            <Building2 size={14} aria-hidden="true" />
            <span>{textoInmuebles}</span>
          </span>
          {fechaTurno && (
            <>
              <span className="clientes-sep" aria-hidden="true">·</span>
              <span className="clientes-chip-turno">
                <span className="clientes-punto-turno" aria-hidden="true" />
                <span>{horaTurno ? `${fechaTurno}, ${horaTurno}` : fechaTurno}</span>
              </span>
            </>
          )}
        </div>

        {/* Capa 3: Pie limpio con teléfono formateado y acceso directo a WhatsApp */}
        <div className="clientes-card-pie">
          <span className="clientes-telefono">{formatearTelefono(cliente.telefono)}</span>
          {enlaceWhatsApp && (
            <a
              href={enlaceWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="clientes-wa-btn"
              aria-label={`Escribir por WhatsApp a ${nombre}`}
              title={`Escribir por WhatsApp a ${nombre}`}
            >
              <MessageCircle size={16} aria-hidden="true" />
            </a>
          )}
        </div>
      </article>
    </li>
  );
}
