import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Building2, CheckCircle2, Search,
  UserPlus, Phone, Mail, Star, MoreVertical,
  Calendar, Briefcase, User, LayoutGrid, MessageCircle, Edit2, Trash2, RotateCcw
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import NewClientModal from '../components/ui/NewClientModal';
import EditClientModal from '../components/ui/EditClientModal';
import ClienteService from '../services/api/cliente.service';
import InmuebleService from '../services/api/inmueble.service';
import TurnoService from '../services/api/turno.service';
import { obtenerEnlaceWhatsApp } from '../services/whatsapp';

export default function ClientsPage() {
  const navigate = useNavigate();
  const [estadoFiltro, setEstadoFiltro] = useState('Activos');
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  const [ordenarAz, setOrdenarAz] = useState(false);

  const [clients, setClients] = useState([]);
  const [inmuebles, setInmuebles] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingClient, setEditingClient] = useState(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = () => setOpenMenuId(null);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuId]);

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
          })
        ]);

        if (isMounted) {
          if (clientsResponse.data) {
            const sortedClients = clientsResponse.data.sort((a, b) => new Date(b.fecha_alta) - new Date(a.fecha_alta));
            setClients(sortedClients);
          }

          const inmsData = inmueblesResponse.data?.data || inmueblesResponse.data || [];
          setInmuebles(Array.isArray(inmsData) ? inmsData : []);

          const turnosData = turnosResponse.data || [];
          setTurnos(Array.isArray(turnosData) ? turnosData : []);
        }
      } catch (error) {
        console.error('Error al cargar datos desde el servidor:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadClients();
    return () => { isMounted = false; };
  }, []);

  const handleClientCreated = (newClient) => {
    setClients(prev => [newClient, ...prev]);
  };

  const handleClientUpdated = (updatedClient) => {
    setClients(prev => prev.map(c =>
      (c.id_cliente && updatedClient.id_cliente && c.id_cliente === updatedClient.id_cliente) ||
      c.telefono === editingClient?.telefono
        ? { ...c, ...updatedClient }
        : c
    ));
  };

  const handleEstadoChange = async (cliente, nuevoEstado) => {
    try {
      // Usamos el servicio existente para hacer el PUT al backend
      await ClienteService.update(cliente.telefono, { estado: nuevoEstado });
      // Actualizamos el estado local de React para reflejar el cambio al instante
      setClients(prev => prev.map(c =>
        c.telefono === cliente.telefono ? { ...c, estado: nuevoEstado } : c
      ));
    } catch (error) {
      console.error('Error al cambiar el estado del cliente:', error);
      alert('Hubo un error al actualizar el estado.');
    }
  };

  const getClientIcon = (tipo) => {
    if (tipo === 'Empresa' || tipo === 'EMPRESA') return Briefcase;
    if (tipo === 'Fijo') return LayoutGrid;
    return User;
  };

  const getClientColor = (tipo) => {
    if (tipo === 'Empresa' || tipo === 'EMPRESA') return '#E8F5E9';
    if (tipo === 'Fijo') return '#F1F8E9';
    return '#FFEBEE';
  };

  const getClientTextColor = (tipo) => {
    if (tipo === 'Empresa' || tipo === 'EMPRESA') return 'text-success';
    if (tipo === 'Fijo') return 'text-success';
    return 'text-danger';
  };

  const clientesActivos = clients.filter(c => c.estado !== 'Inactivo');
  const clientesInactivos = clients.filter(c => c.estado === 'Inactivo');

  const baseClients = estadoFiltro === 'Inactivos' ? clientesInactivos : clientesActivos;

  const filteredClients = baseClients.filter(client => {
    const fullName = `${client.nombre || ''} ${client.apellido || ''}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    const matchesSearch = fullName.includes(search) || (client.telefono || '').includes(search) || (client.razon_social || '').toLowerCase().includes(search);

    // Si no coincide con la búsqueda de texto dentro del grupo actual, lo descartamos
    if (!matchesSearch) return false;

    // Si estamos viendo Inactivos, mostramos todos los inactivos que coincidan con la búsqueda
    if (estadoFiltro === 'Inactivos') return true;

    // Dentro de Activos, filtramos por categoría
    if (activeFilter === 'Todos') return true;
    if (activeFilter === 'Empresas') return (client.tipo_cliente === 'Empresa' || client.tipo_cliente === 'EMPRESA');
    if (activeFilter === 'Particulares' || activeFilter === 'Casual') return (client.tipo_cliente === 'Casual' || client.tipo_cliente === 'Particular');
    if (activeFilter === 'Fijo') return client.tipo_cliente === 'Fijo';

    return true;
  }).sort((a, b) => {
    // NUEVA LÓGICA DE ORDENAMIENTO
    if (ordenarAz) {
      const nombreA = `${a.nombre || ''} ${a.apellido || ''}`.trim().toLowerCase() || (a.razon_social || '').toLowerCase();
      const nombreB = `${b.nombre || ''} ${b.apellido || ''}`.trim().toLowerCase() || (b.razon_social || '').toLowerCase();
      return nombreA.localeCompare(nombreB);
    }

    // Fallback: ordenar por los más recientes
    return new Date(b.fecha_alta) - new Date(a.fecha_alta);
  });

  return (
    <div className="d-flex flex-column gap-4 pb-5">

      <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
        <div>
          <h2 className="fw-bold fs-2 text-dark m-0">Clientes</h2>
          <p className="text-secondary small m-0">Directorio general de clientes y gestión integral de inmuebles vinculados.</p>
        </div>

        <div className="d-flex align-items-center gap-2 w-100 w-md-auto overflow-x-auto pb-1 pb-md-0">
          <Button variant="primary" className="text-nowrap ms-auto ms-md-0" onClick={() => setIsModalOpen(true)}>
            <UserPlus size={16} /> + Nuevo Cliente
          </Button>
        </div>
      </div>

      <div className="row g-3 flex-nowrap flex-md-wrap overflow-x-auto pb-2 pb-md-0 scrollbar-none">
        <div className="col-9 col-sm-6 col-xl-3 flex-shrink-0 flex-md-shrink-1">
          <Card className="h-100 p-3 shadow-sm border-0 rounded-4">
            <div className="d-flex align-items-start justify-content-between mb-2">
              <span className="text-secondary fw-bold text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>TOTAL ACTIVOS</span>
              <div className="text-success"><Users size={18} /></div>
            </div>
            <div>
              <h3 className="fw-bold text-dark m-0 fs-3">{clientesActivos.length}</h3>
              <span className="badge mt-2 fw-medium bg-success-subtle text-success d-inline-flex align-items-center gap-1 border border-success-subtle px-2 py-1">Clientes activos</span>
            </div>
          </Card>
        </div>

        <div className="col-9 col-sm-6 col-xl-3 flex-shrink-0 flex-md-shrink-1">
          <Card className="h-100 p-3 shadow-sm border-0 rounded-4">
            <div className="d-flex align-items-start justify-content-between mb-2">
              <span className="text-secondary fw-bold text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>EMPRESAS / FIJOS</span>
              <div className="text-secondary"><Building2 size={18} /></div>
            </div>
            <div>
              <h3 className="fw-bold text-dark m-0 fs-3">
                {clientesActivos.filter(c => c.tipo_cliente === 'Empresa' || c.tipo_cliente === 'EMPRESA' || c.tipo_cliente === 'Fijo').length}
              </h3>
              <p className="text-secondary small m-0 mt-2">Cuentas corporativas y regulares</p>
            </div>
          </Card>
        </div>

        <div className="col-9 col-sm-6 col-xl-3 flex-shrink-0 flex-md-shrink-1">
          <Card className="h-100 p-3 shadow-sm border-0 rounded-4">
            <div className="d-flex align-items-start justify-content-between mb-2">
              <span className="text-secondary fw-bold text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>CASUALES</span>
              <div className="text-success"><CheckCircle2 size={18} /></div>
            </div>
            <div>
              <h3 className="fw-bold text-dark m-0 fs-3">
                {clientesActivos.filter(c => c.tipo_cliente === 'Casual').length}
              </h3>
              <span className="badge mt-2 fw-medium bg-success-subtle text-success d-inline-flex align-items-center gap-1 border border-success-subtle px-2 py-1">Servicios esporádicos</span>
            </div>
          </Card>
        </div>

        <div className="col-9 col-sm-6 col-xl-3 flex-shrink-0 flex-md-shrink-1">
          <Card className="h-100 p-3 shadow-sm border-0 rounded-4">
            <div className="d-flex align-items-start justify-content-between mb-2">
              <span className="text-secondary fw-bold text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>CON PAGOS PENDIENTES</span>
              <div className="text-danger"><Calendar size={18} /></div>
            </div>
            <div>
              <h3 className="fw-bold text-dark m-0 fs-3">0</h3>
              <p className="text-danger small m-0 mt-2 fw-medium">$0 ARS <span className="text-secondary fw-normal">saldo acumulado</span></p>
            </div>
          </Card>
        </div>
      </div>

      <div className="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center justify-content-between gap-3 mt-2">
        <div className="d-flex flex-wrap align-items-center gap-2">
          {/* Switch principal: Activos vs Inactivos */}
          <div className="bg-white p-1 rounded-pill shadow-sm border d-inline-flex flex-row flex-nowrap flex-shrink-0">
            <button
              type="button"
              onClick={() => setEstadoFiltro('Activos')}
              className={`btn btn-sm rounded-pill fw-bold px-3 py-1 border-0 text-nowrap ${
                estadoFiltro === 'Activos'
                  ? 'text-white shadow-sm'
                  : 'text-secondary bg-transparent'
              }`}
              style={estadoFiltro === 'Activos' ? { backgroundColor: '#1B3006' } : {}}
            >
              Activos ({clientesActivos.length})
            </button>
            <button
              type="button"
              onClick={() => setEstadoFiltro('Inactivos')}
              className={`btn btn-sm rounded-pill fw-bold px-3 py-1 border-0 text-nowrap ${
                estadoFiltro === 'Inactivos'
                  ? 'bg-warning-subtle border border-warning-subtle shadow-sm'
                  : 'text-secondary bg-transparent'
              }`}
              style={estadoFiltro === 'Inactivos' ? { color: '#856404' } : {}}
            >
              Inactivos ({clientesInactivos.length})
            </button>
          </div>

          <div className="input-group bg-white rounded-pill px-3 py-2 border shadow-sm flex-grow-1" style={{ maxWidth: '280px', minWidth: '220px' }}>
            <span className="input-group-text bg-transparent border-0 text-secondary p-0 me-2"><Search size={18} /></span>
            <input
              type="text"
              className="form-control bg-transparent border-0 shadow-none text-dark small p-0"
              placeholder={estadoFiltro === 'Inactivos' ? 'Buscar en inactivos...' : 'Buscar en activos...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Sub-filtros exclusivos dentro de Activos */}
        {estadoFiltro === 'Activos' && (
          <div className="d-flex align-items-center gap-2 overflow-x-auto pb-1 pb-lg-0 scrollbar-none w-100 w-lg-auto flex-grow-1">
            {['Todos', 'Empresas', 'Fijo', 'Casual'].map((filter) => {
              let count = 0;
              if (filter === 'Todos') count = clientesActivos.length;
              if (filter === 'Empresas') count = clientesActivos.filter(c => c.tipo_cliente === 'Empresa' || c.tipo_cliente === 'EMPRESA').length;
              if (filter === 'Fijo') count = clientesActivos.filter(c => c.tipo_cliente === 'Fijo').length;
              if (filter === 'Casual') count = clientesActivos.filter(c => c.tipo_cliente === 'Casual').length;

              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`btn btn-sm rounded-pill text-nowrap px-3 py-2 fw-medium shadow-sm border ${
                    activeFilter === filter
                      ? 'btn-primary'
                      : 'bg-white text-secondary'
                  }`}
                  style={activeFilter === filter ? { backgroundColor: '#1B3006', borderColor: '#1B3006' } : {}}
                >
                  {filter} ({count})
                </button>
              );
            })}
          </div>
        )}

        <select
          className="form-select bg-white rounded-pill border shadow-sm text-secondary small py-2 w-auto flex-shrink-0 ms-lg-auto"
          value={ordenarAz ? 'az' : 'recientes'}
          onChange={(e) => setOrdenarAz(e.target.value === 'az')}
        >
          <option value="recientes">Ordenar: Más recientes</option>
          <option value="az">Ordenar: Alfabético</option>
        </select>

      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border" style={{ color: '#1B3006' }} role="status"></div></div>
      ) : filteredClients.length === 0 ? (
        <Card className="p-5 text-center border-0 shadow-sm rounded-4"><p className="text-secondary m-0">No se encontraron clientes con esos filtros.</p></Card>
      ) : (
        <div className="row g-3">
          {filteredClients.map((client) => {
            const initials = `${client.nombre?.[0] || ''}${client.apellido?.[0] || ''}`.toUpperCase() || 'CL';
            const fullName = `${client.nombre || ''} ${client.apellido || ''}`.trim() || client.razon_social;

            const isInactivo = client.estado === 'Inactivo';
            const clientKey = client.id_cliente || client.telefono;
            const isMenuOpen = openMenuId === clientKey;

            const ClientIcon = getClientIcon(client.tipo_cliente);
            const cardBgColor = getClientColor(client.tipo_cliente);
            const cardTextColor = getClientTextColor(client.tipo_cliente);

            const enlaceWhatsApp = obtenerEnlaceWhatsApp(client.telefono);

            // Cantidad de inmuebles registrados
            const cantidadInmuebles = inmuebles.filter(
              (inm) => String(inm.id_cliente) === String(client.id_cliente)
            ).length;

            // Próximo turno/servicio agendado
            const hoyStr = new Date().toISOString().split('T')[0];
            const proximoTurno = turnos
              .filter((t) => {
                if (t.estado === 'CANCELADO' || t.estado === 'REALIZADO') return false;
                const matchId = client.id_cliente && t.cliente?.id_cliente && String(t.cliente.id_cliente) === String(client.id_cliente);
                const matchTel = client.telefono && t.cliente?.telefono && String(t.cliente.telefono) === String(client.telefono);
                return (matchId || matchTel) && t.fechaAsignada && t.fechaAsignada >= hoyStr;
              })
              .sort((a, b) => a.fechaAsignada.localeCompare(b.fechaAsignada))[0];

            const fechaProximoTurno = proximoTurno?.fechaAsignada
              ? (() => {
                  const [y, m, d] = proximoTurno.fechaAsignada.split('-').map(Number);
                  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
                })()
              : null;

            return (
              <div key={clientKey} className="col-12 col-md-6 col-xl-4">
                <Card
                  className="h-100 p-3 shadow-sm border-0 rounded-4 d-flex flex-column justify-content-between bg-white position-relative"
                  style={{ cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
                  onClick={() => navigate(`/clients/${client.telefono}/inmuebles`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/clients/${client.telefono}/inmuebles`);
                    }
                  }}
                >
                  <div>
                    <div className="d-flex align-items-start gap-3 mb-2">
                      <div
                        className={`rounded-3 d-flex align-items-center justify-content-center fw-bold fs-6 flex-shrink-0 ${cardTextColor}`}
                        style={{ width: '40px', height: '40px', backgroundColor: cardBgColor }}
                      >
                        {initials}
                      </div>
                      <div className="flex-grow-1 min-w-0">
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <h6 className="fw-bold text-dark m-0 fs-6 text-truncate" title={fullName}>{fullName}</h6>
                          <div className="position-relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="light"
                              icon
                              aria-label="Opciones del cliente"
                              aria-expanded={isMenuOpen}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(isMenuOpen ? null : clientKey);
                              }}
                            >
                              <MoreVertical size={16} />
                            </Button>

                            {isMenuOpen && (
                              <div
                                className="position-absolute end-0 mt-1 bg-white rounded-3 shadow border py-1"
                                style={{ minWidth: '175px', zIndex: 1050 }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="w-100 btn btn-sm text-start px-3 py-2 d-flex align-items-center gap-2 text-dark border-0 rounded-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    setEditingClient(client);
                                  }}
                                >
                                  <Edit2 size={14} className="text-secondary" />
                                  <span>Editar Cliente</span>
                                </button>
                                <button
                                  type="button"
                                  className={`w-100 btn btn-sm text-start px-3 py-2 d-flex align-items-center gap-2 border-0 rounded-0 ${isInactivo ? 'text-success' : 'text-danger'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    handleEstadoChange(client, isInactivo ? 'Activo' : 'Inactivo');
                                  }}
                                >
                                  {isInactivo ? (
                                    <>
                                      <RotateCcw size={14} />
                                      <span>Restaurar Cliente</span>
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 size={14} />
                                      <span>Eliminar Cliente</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-secondary small m-0 text-truncate" style={{ fontSize: '0.78rem' }}>{client.razon_social || 'Cliente Estándar'}</p>
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="badge bg-light text-secondary border rounded-pill px-2 py-1 small fw-medium d-flex align-items-center gap-1">
                        <ClientIcon size={12}/> {client.tipo_cliente}
                      </span>

                      <div className="ms-auto d-flex align-items-center gap-1 text-warning small fw-bold">
                        <Star size={13} fill="currentColor" />
                        <span className="text-dark" style={{ fontSize: '0.8rem' }}>{Number(client.calificacion_promedio || 0).toFixed(1)}</span>
                      </div>
                    </div>

                    <div className="d-flex flex-column gap-1 text-secondary small mb-3">
                      <div className="d-flex align-items-center justify-content-between gap-2">
                        <div className="d-flex align-items-center gap-2 text-truncate">
                          <Phone size={14} className="flex-shrink-0 text-secondary" />
                          <span className="text-truncate">{client.telefono}</span>
                        </div>
                        {enlaceWhatsApp && (
                          <a
                            href={enlaceWhatsApp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline-success border-0 p-1 px-2 d-inline-flex align-items-center gap-1 text-decoration-none rounded-pill flex-shrink-0"
                            style={{ fontSize: '0.75rem', backgroundColor: '#eaf8ef' }}
                            title={`Contactar a ${fullName} por WhatsApp`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MessageCircle size={13} />
                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>
                      {client.email && (
                        <div className="d-flex align-items-center gap-2 text-truncate">
                          <Mail size={14} className="flex-shrink-0 text-secondary" />
                          <span className="text-truncate" title={client.email}>{client.email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="row g-0 bg-light rounded-3 border overflow-hidden mt-auto">
                    <div className="col-5 p-2 px-2 border-end">
                      <span className="text-secondary d-block fw-semibold mb-1" style={{ fontSize: '0.65rem' }}>Inmuebles</span>
                      <span className="fw-bold text-dark small d-flex align-items-center gap-1 text-truncate">
                        <Building2 size={13} className="text-secondary" /> {cantidadInmuebles > 0 ? cantidadInmuebles : '-'}
                      </span>
                    </div>
                    <div className="col-7 p-2 px-2">
                      <span className="text-secondary d-block fw-semibold mb-1" style={{ fontSize: '0.65rem' }}>Próximo servicio</span>
                      <div className="d-flex flex-column">
                        <span className="fw-bold text-dark small d-flex align-items-center gap-1 text-truncate">
                          <Calendar size={13} className={fechaProximoTurno ? 'text-success' : 'text-secondary'} /> {fechaProximoTurno || '-'}
                          {proximoTurno?.franjaHoraria?.horaInicio && (<span className="text-secondary" style={{ fontSize: '0.92rem' }}>{proximoTurno.franjaHoraria.horaInicio.slice(0, 5)} hs</span>)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filteredClients.length > 0 && (
        <div className="d-flex flex-column flex-sm-row align-items-center justify-content-between gap-3 pt-3 mt-2">
          <span className="text-secondary small fw-medium">
            Mostrando {filteredClients.length} cliente(s)
          </span>
          <div className="d-flex align-items-center gap-1">
            <button className="btn btn-sm btn-white text-secondary border shadow-sm px-2 bg-white" disabled>&lt;</button>
            <button className="btn btn-sm btn-primary border shadow-sm px-3" style={{backgroundColor: '#1B3006', borderColor: '#1B3006'}}>1</button>
            <button className="btn btn-sm btn-white text-secondary border shadow-sm px-2 bg-white" disabled>&gt;</button>
          </div>
        </div>
      )}

      <NewClientModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onClientCreated={handleClientCreated} />
      <EditClientModal
        isOpen={Boolean(editingClient)}
        onClose={() => setEditingClient(null)}
        clientData={editingClient}
        onClientUpdated={handleClientUpdated}
      />
    </div>
  );
}
