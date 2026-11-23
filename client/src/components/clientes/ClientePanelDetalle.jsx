import { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowUpRight, Calendar, Check, Copy, Edit2, Mail, MapPin,
  MessageCircle, Phone, RotateCcw, Trash2, X,
} from 'lucide-react';
import Button from '../ui/Button';
import useCerrarConEscape from '../ui/useCerrarConEscape';
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

export default function ClientePanelDetalle({
  cliente,
  inmuebles,
  proximoTurno,
  cambiandoEstado,
  bloqueadoPorModal,
  onCerrar,
  onAbrirFicha,
  onEditar,
  onCambiarEstado,
}) {
  const tituloId = useId();
  const botonCerrarRef = useRef(null);
  const timerCopiadoRef = useRef(null);
  const [telefonoCopiado, setTelefonoCopiado] = useState(null);
  const [esMovil, setEsMovil] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 991.98px)').matches
  ));

  useCerrarConEscape(Boolean(cliente) && !bloqueadoPorModal, onCerrar);

  useEffect(() => () => {
    if (timerCopiadoRef.current) window.clearTimeout(timerCopiadoRef.current);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 991.98px)');
    const actualizar = () => setEsMovil(mq.matches);
    mq.addEventListener('change', actualizar);
    return () => mq.removeEventListener('change', actualizar);
  }, []);

  // En móvil (hoja superpuesta) movemos el foco al panel para teclado y lectores de pantalla.
  useEffect(() => {
    if (cliente && esMovil) {
      botonCerrarRef.current?.focus();
    }
  }, [cliente, esMovil]);

  if (!cliente) return null;

  const nombre = obtenerNombreCliente(cliente);
  const iniciales = obtenerInicialesCliente(cliente);
  const tipo = normalizarTipoCliente(cliente.tipo_cliente);
  const inactivo = esClienteInactivo(cliente);
  const varianteAvatar = inactivo ? 'inactivo' : tipo.toLowerCase();
  const telefonoLegible = formatearTelefono(cliente.telefono);
  const enlaceWhatsApp = obtenerEnlaceWhatsApp(cliente.telefono);
  const fechaTurno = formatearFechaCortaTurno(proximoTurno?.fechaAsignada);
  const horaTurno = formatearHoraTurno(proximoTurno);
  const razonSocialVisible = cliente.razon_social && cliente.razon_social.trim() !== nombre
    ? cliente.razon_social.trim()
    : null;
  const copiado = telefonoCopiado !== null && telefonoCopiado === cliente.telefono;

  const handleCopiarTelefono = async () => {
    if (!cliente.telefono || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(telefonoLegible);
      setTelefonoCopiado(cliente.telefono);
      if (timerCopiadoRef.current) window.clearTimeout(timerCopiadoRef.current);
      timerCopiadoRef.current = window.setTimeout(() => setTelefonoCopiado(null), 1800);
    } catch {
      // Sin permiso de portapapeles: no interrumpimos al usuario.
    }
  };

  return (
    <>
      <div className="clientes-panel-backdrop" onClick={onCerrar} aria-hidden="true" />

      <aside
        className="clientes-panel"
        role={esMovil ? 'dialog' : 'complementary'}
        aria-modal={esMovil ? 'true' : undefined}
        aria-labelledby={tituloId}
      >
        <div className="clientes-panel-cabecera">
          <div className="clientes-card-identidad">
            <div className={`clientes-avatar clientes-avatar--lg clientes-avatar--${varianteAvatar}`} aria-hidden="true">
              {iniciales}
            </div>
            <div className="clientes-card-titulo-wrap">
              <h2 id={tituloId} className="clientes-panel-nombre">{nombre}</h2>
              {razonSocialVisible && (
                <div className="clientes-tipo-sutil text-truncate">{razonSocialVisible}</div>
              )}
              <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
                <span className={`clientes-tipo-pill clientes-tipo-pill--${tipo.toLowerCase()}`}>
                  {tipo}
                </span>
                <span className={`clientes-panel-estado ${inactivo ? 'is-inactivo' : 'is-activo'}`}>
                  {inactivo ? 'Inactivo' : 'Activo'}
                </span>
              </div>
            </div>
          </div>

          <button
            ref={botonCerrarRef}
            type="button"
            className="clientes-panel-cerrar"
            aria-label="Cerrar panel del cliente"
            onClick={onCerrar}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="clientes-panel-cuerpo">
          {/* Acciones rápidas de contacto */}
          {(enlaceWhatsApp || cliente.telefono) && (
            <div className="clientes-panel-acciones-rapidas">
              {enlaceWhatsApp && (
                <a
                  href={enlaceWhatsApp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="clientes-panel-wa"
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  <span>WhatsApp</span>
                </a>
              )}
              {cliente.telefono && (
                <button
                  type="button"
                  className="clientes-panel-copiar"
                  onClick={handleCopiarTelefono}
                  aria-label={`Copiar teléfono de ${nombre}`}
                >
                  {copiado ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                  <span>{copiado ? 'Copiado' : 'Copiar'}</span>
                </button>
              )}
            </div>
          )}

          {/* Contacto */}
          <section className="clientes-panel-seccion">
            <h3 className="clientes-panel-rotulo">Contacto</h3>
            <div>
              <div className="clientes-panel-fila-dato">
                <span className="clientes-panel-etiqueta">
                  <Phone size={14} aria-hidden="true" /> Teléfono
                </span>
                <span className="clientes-panel-valor">{telefonoLegible}</span>
              </div>
              <div className="clientes-panel-fila-dato">
                <span className="clientes-panel-etiqueta">
                  <Mail size={14} aria-hidden="true" /> Email
                </span>
                {cliente.email ? (
                  <a
                    href={`mailto:${cliente.email}`}
                    className="clientes-panel-valor text-decoration-none"
                    title={cliente.email}
                  >
                    {cliente.email}
                  </a>
                ) : (
                  <span className="clientes-panel-valor is-vacio">No registrado</span>
                )}
              </div>
            </div>
          </section>

          {/* Próximo servicio: solo se renderiza si realmente tiene uno agendado */}
          {proximoTurno && fechaTurno && (
            <section className="clientes-panel-seccion">
              <h3 className="clientes-panel-rotulo">Próximo servicio</h3>
              <div className="clientes-panel-servicio">
                <div className="clientes-panel-servicio-fecha">
                  <Calendar size={14} aria-hidden="true" />
                  <span>{horaTurno ? `${fechaTurno} · ${horaTurno}` : fechaTurno}</span>
                </div>
                {proximoTurno.servicio?.descripcion && (
                  <div className="clientes-panel-servicio-desc">
                    {proximoTurno.servicio.descripcion}
                  </div>
                )}
                {proximoTurno.inmueble?.direccion && (
                  <div className="clientes-panel-servicio-lugar">
                    <MapPin size={13} aria-hidden="true" />
                    <span>{proximoTurno.inmueble.direccion}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Inmuebles del cliente */}
          <section className="clientes-panel-seccion">
            <h3 className="clientes-panel-rotulo">Inmuebles ({inmuebles.length})</h3>
            {inmuebles.length > 0 ? (
              <ul className="clientes-panel-inmuebles" role="list">
                {inmuebles.map((inm) => {
                  const superficie = Number(inm.superficie_total);
                  const tieneM2 = Number.isFinite(superficie) && superficie > 0;
                  const detalle = [inm.barrio, inm.tipo_inmueble].filter(Boolean).join(' · ');

                  return (
                    <li key={inm.id_inmueble} className="clientes-panel-inmueble">
                      <div className="min-w-0">
                        <div className="clientes-panel-inmueble-dir" title={inm.direccion}>
                          {inm.direccion || 'Sin dirección'}
                        </div>
                        {detalle && (
                          <div className="clientes-panel-inmueble-sub" title={detalle}>
                            {detalle}
                          </div>
                        )}
                      </div>
                      <span className={`clientes-panel-inmueble-m2${tieneM2 ? '' : ' is-sin-medir'}`}>
                        {tieneM2 ? `${superficie} m²` : 'Sin medir'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="clientes-tipo-sutil m-0">Todavía no tiene inmuebles registrados.</p>
            )}
          </section>

          {/* CTA principal + acciones administrativas secundarias */}
          <div className="clientes-panel-pie">
            <Button
              variant="primary"
              className="w-100 justify-content-center"
              onClick={() => onAbrirFicha(cliente)}
            >
              <span>Abrir ficha e inmuebles</span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Button>

            <div className="clientes-panel-secundarias">
              <button
                type="button"
                className="clientes-panel-btn-sec"
                onClick={() => onEditar(cliente)}
                disabled={cambiandoEstado}
              >
                <Edit2 size={14} aria-hidden="true" />
                <span>Editar</span>
              </button>

              <button
                type="button"
                className={`clientes-panel-btn-sec ${inactivo ? 'is-exito' : 'is-peligro'}`}
                onClick={() => onCambiarEstado(cliente, inactivo ? 'Activo' : 'Inactivo')}
                disabled={cambiandoEstado}
              >
                {inactivo ? (
                  <>
                    <RotateCcw size={14} aria-hidden="true" />
                    <span>Restaurar</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} aria-hidden="true" />
                    <span>Desactivar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
