import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, Search, UserPlus, X } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAvisos } from '../components/ui/avisosContext';
import NewClientModal from '../components/ui/NewClientModal';
import EditClientModal from '../components/ui/EditClientModal';
import ClienteService from '../services/api/cliente.service';
import InmuebleService from '../services/api/inmueble.service';
import TurnoService from '../services/api/turno.service';
import ClientesSkeleton from '../components/skeletons/ClientesSkeleton';
import ClienteCard from '../components/clientes/ClienteCard';
import ClientePanelDetalle from '../components/clientes/ClientePanelDetalle';
import { obtenerAhoraTurnos } from '../components/turnos/agendaTurnos';
import {
  esClienteInactivo,
  filtrarYOrdenarClientes,
  normalizarTipoCliente,
  obtenerClaveCliente,
  obtenerInmueblesCliente,
  obtenerProximoTurnoCliente,
} from '../components/clientes/clientesUtils';
import '../components/clientes/clientes.scss';

const FILTROS_TIPO = [
  { key: 'Todos', label: 'Todos' },
  { key: 'Fijo', label: 'Fijos' },
  { key: 'Casual', label: 'Casuales' },
  { key: 'Empresa', label: 'Empresas' },
];

export default function ClientsPage() {
  const { avisar } = useAvisos();
  const navigate = useNavigate();

  const [segmento, setSegmento] = useState('Todos'); // 'Todos' | 'Fijo' | 'Casual' | 'Empresa' | 'Inactivos'
  const [searchTerm, setSearchTerm] = useState('');
  const [orden, setOrden] = useState('recientes'); // 'recientes' | 'az' | 'proximo'

  const [clients, setClients] = useState([]);
  const [inmuebles, setInmuebles] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  const ultimoTriggerRef = useRef(null);
  const hoyIso = obtenerAhoraTurnos().fecha;

  useEffect(() => {
    let isMounted = true;

    const loadClients = async () => {
      setLoading(true);
      try {
        const [clientsResponse, inmueblesResponse, turnosResponse] = await Promise.all([
          ClienteService.getAll(),
          InmuebleService.getAll().catch((err) => {
            console.error('Error al cargar inmuebles:', err);
            return { data: [] };
          }),
          TurnoService.getAll().catch((err) => {
            console.error('Error al cargar turnos:', err);
            return { data: [] };
          }),
        ]);

        if (!isMounted) return;

        if (Array.isArray(clientsResponse?.data)) {
          const sortedClients = [...clientsResponse.data].sort(
            (a, b) => new Date(b.fecha_alta || 0) - new Date(a.fecha_alta || 0),
          );
          setClients(sortedClients);
        }

        const inmsData = inmueblesResponse?.data?.data || inmueblesResponse?.data || [];
        setInmuebles(Array.isArray(inmsData) ? inmsData : []);

        const turnosData = turnosResponse?.data || [];
        setTurnos(Array.isArray(turnosData) ? turnosData : []);
      } catch (error) {
        console.error('Error al cargar datos desde el servidor:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadClients();
    return () => { isMounted = false; };
  }, []);

  // Conteos de segmentos (resumen + filtro unificados)
  const conteos = useMemo(() => {
    const resultado = { Todos: 0, Fijo: 0, Casual: 0, Empresa: 0, Inactivos: 0 };
    clients.forEach((cliente) => {
      if (esClienteInactivo(cliente)) {
        resultado.Inactivos += 1;
      } else {
        resultado.Todos += 1;
        const tipo = normalizarTipoCliente(cliente.tipo_cliente);
        if (tipo in resultado) resultado[tipo] += 1;
      }
    });
    return resultado;
  }, [clients]);

  // Próximo turno e inmuebles indexados por cliente para evitar recálculos por tarjeta
  const proximosPorClave = useMemo(() => {
    const mapa = new Map();
    clients.forEach((cliente) => {
      const clave = obtenerClaveCliente(cliente);
      mapa.set(clave, obtenerProximoTurnoCliente(cliente, turnos, hoyIso));
    });
    return mapa;
  }, [clients, turnos, hoyIso]);

  const inmueblesPorClave = useMemo(() => {
    const mapa = new Map();
    clients.forEach((cliente) => {
      const clave = obtenerClaveCliente(cliente);
      mapa.set(clave, obtenerInmueblesCliente(cliente, inmuebles));
    });
    return mapa;
  }, [clients, inmuebles]);

  const filteredClients = useMemo(
    () => filtrarYOrdenarClientes(clients, {
      segmento,
      busqueda: searchTerm,
      orden,
      proximosPorClave,
    }),
    [clients, segmento, searchTerm, orden, proximosPorClave],
  );

  const selectedClient = useMemo(
    () => (selectedKey ? clients.find((c) => obtenerClaveCliente(c) === selectedKey) || null : null),
    [clients, selectedKey],
  );

  const handleClientCreated = (newClient) => {
    setClients((prev) => [newClient, ...prev]);
  };

  const handleClientUpdated = (updatedClient) => {
    const claveEditada = editingClient ? obtenerClaveCliente(editingClient) : null;
    setClients((prev) => prev.map((c) => (
      (c.id_cliente && updatedClient.id_cliente && c.id_cliente === updatedClient.id_cliente)
      || c.telefono === editingClient?.telefono
        ? { ...c, ...updatedClient }
        : c
    )));

    if (claveEditada && selectedKey === claveEditada) {
      setSelectedKey(obtenerClaveCliente(updatedClient));
    }
  };

  const handleEstadoChange = async (cliente, nuevoEstado) => {
    setCambiandoEstado(true);
    try {
      await ClienteService.update(cliente.telefono, { estado: nuevoEstado });
      setClients((prev) => prev.map((c) => (
        c.telefono === cliente.telefono ? { ...c, estado: nuevoEstado } : c
      )));
    } catch (error) {
      console.error('Error al cambiar el estado del cliente:', error);
      avisar('No se pudo cambiar el estado del cliente. Intentá de nuevo.');
    } finally {
      setCambiandoEstado(false);
    }
  };

  const handleSeleccionarCliente = (cliente, triggerEl) => {
    const clave = obtenerClaveCliente(cliente);
    if (selectedKey === clave) {
      setSelectedKey(null);
      return;
    }
    ultimoTriggerRef.current = triggerEl || null;
    setSelectedKey(clave);
  };

  const handleCerrarPanel = () => {
    setSelectedKey(null);
    const trigger = ultimoTriggerRef.current;
    if (trigger && trigger.isConnected) {
      window.requestAnimationFrame(() => trigger.focus());
    }
  };

  const handleAbrirFicha = (cliente) => {
    const idRuta = cliente.id_cliente || cliente.telefono;
    navigate(`/clients/${idRuta}/inmuebles`);
  };

  const handleLimpiarFiltros = () => {
    setSearchTerm('');
    setSegmento('Todos');
  };

  const panelAbierto = Boolean(selectedClient);

  return (
    <div className="d-flex flex-column gap-4 pb-5">
      {/* Cabecera: título + buscador protagonista + acción principal */}
      <div className="clientes-cabecera">
        <h1 className="clientes-titulo">Clientes</h1>

        <div className="clientes-cabecera-controles">
          <div className="clientes-buscador">
            <label htmlFor="clientes-buscar" className="visually-hidden">
              Buscar clientes por nombre, teléfono o correo
            </label>
            <Search size={17} className="text-secondary flex-shrink-0" aria-hidden="true" />
            <input
              id="clientes-buscar"
              type="search"
              placeholder={segmento === 'Inactivos' ? 'Buscar en inactivos…' : 'Buscar cliente o teléfono…'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="clientes-buscador-limpiar"
                aria-label="Limpiar búsqueda"
                onClick={() => setSearchTerm('')}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          <Button
            variant="primary"
            className="text-nowrap flex-shrink-0"
            aria-label="Nuevo Cliente"
            onClick={() => setIsModalOpen(true)}
          >
            <UserPlus size={16} aria-hidden="true" />
            <span className="d-none d-sm-inline">Nuevo Cliente</span>
          </Button>
        </div>
      </div>

      {/* Barra unificada: chips de resumen/filtro + acceso secundario a inactivos + orden */}
      <div className="clientes-barra-filtros">
        <div className="clientes-chips" role="group" aria-label="Filtrar clientes activos por tipo">
          {FILTROS_TIPO.map(({ key, label }) => {
            const activo = segmento === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={activo}
                className={`clientes-chip${activo ? ' is-active' : ''}`}
                onClick={() => setSegmento(key)}
              >
                <span>{label}</span>
                <span className="clientes-chip-conteo">{conteos[key]}</span>
              </button>
            );
          })}
        </div>

        <div className="clientes-barra-secundaria">
          <button
            type="button"
            aria-pressed={segmento === 'Inactivos'}
            className={`clientes-inactivos-btn${segmento === 'Inactivos' ? ' is-active' : ''}`}
            onClick={() => setSegmento((prev) => (prev === 'Inactivos' ? 'Todos' : 'Inactivos'))}
          >
            <Archive size={15} aria-hidden="true" />
            <span>Inactivos ({conteos.Inactivos})</span>
          </button>

          <select
            className="form-select clientes-orden"
            aria-label="Ordenar clientes"
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
          >
            <option value="recientes">Más recientes</option>
            <option value="az">Alfabético (A–Z)</option>
            <option value="proximo">Próximo servicio</option>
          </select>
        </div>
      </div>

      {segmento === 'Inactivos' && (
        <div className="clientes-aviso-inactivos" role="status">
          <span>Estás viendo clientes inactivos. Tocá uno para revisar sus datos o restaurarlo.</span>
          <button type="button" onClick={() => setSegmento('Todos')}>
            Volver a activos
          </button>
        </div>
      )}

      {/* Contenido principal: Master-Detail (grilla destilada + panel lateral) */}
      {loading ? (
        <ClientesSkeleton />
      ) : filteredClients.length === 0 ? (
        <Card className="p-5 text-center border-0 shadow-sm rounded-4">
          <p className="fw-semibold text-dark mb-1">
            {clients.length === 0
              ? 'Todavía no hay clientes registrados'
              : searchTerm
                ? 'No hay coincidencias para tu búsqueda'
                : 'No hay clientes en esta categoría'}
          </p>
          <p className="text-secondary small mb-3">
            {clients.length === 0
              ? 'Agregá tu primer cliente para gestionar sus inmuebles y turnos.'
              : 'Probá limpiando los filtros o cambiando de categoría.'}
          </p>
          <div>
            {clients.length === 0 ? (
              <Button variant="primary" onClick={() => setIsModalOpen(true)}>
                <UserPlus size={16} aria-hidden="true" /> Nuevo Cliente
              </Button>
            ) : (
              <Button variant="light" className="border bg-white" onClick={handleLimpiarFiltros}>
                Ver todos los activos
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="clientes-layout">
          <div className="clientes-grid-contenedor">
            <ul className={`clientes-grid${panelAbierto ? ' con-panel' : ''}`} role="list">
              {filteredClients.map((cliente) => {
                const clave = obtenerClaveCliente(cliente);
                const inmueblesCliente = inmueblesPorClave.get(clave) || [];
                const proximoTurno = proximosPorClave.get(clave) || null;

                return (
                  <ClienteCard
                    key={clave}
                    cliente={cliente}
                    cantidadInmuebles={inmueblesCliente.length}
                    proximoTurno={proximoTurno}
                    seleccionado={selectedKey === clave}
                    onSeleccionar={handleSeleccionarCliente}
                  />
                );
              })}
            </ul>

            <p className="clientes-pie-conteo mt-3 mb-0">
              Mostrando {filteredClients.length} {filteredClients.length === 1 ? 'cliente' : 'clientes'}
            </p>
          </div>

          {selectedClient && (
            <ClientePanelDetalle
              cliente={selectedClient}
              inmuebles={inmueblesPorClave.get(obtenerClaveCliente(selectedClient)) || []}
              proximoTurno={proximosPorClave.get(obtenerClaveCliente(selectedClient)) || null}
              cambiandoEstado={cambiandoEstado}
              bloqueadoPorModal={isModalOpen || Boolean(editingClient)}
              onCerrar={handleCerrarPanel}
              onAbrirFicha={handleAbrirFicha}
              onEditar={(cliente) => setEditingClient(cliente)}
              onCambiarEstado={handleEstadoChange}
            />
          )}
        </div>
      )}

      <NewClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onClientCreated={handleClientCreated}
      />

      <EditClientModal
        isOpen={Boolean(editingClient)}
        onClose={() => setEditingClient(null)}
        clientData={editingClient}
        onClientUpdated={handleClientUpdated}
      />
    </div>
  );
}
