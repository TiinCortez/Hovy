import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, MoreVertical, CheckCircle2, Shield, 
  Mail, FileText, Edit2, Phone, MapPin, Building2, Calendar,
  Search, Plus, Clock, User, RotateCcw, Trash2,
  ChevronDown, ChevronUp, Bell, AlertTriangle, MessageCircle, Filter
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import EditClientModal from '../components/ui/EditClientModal'; 
import InmuebleModal from '../components/ui/InmuebleModal';
import InmuebleDetalleModal from '../components/ui/InmuebleDetalleModal';
import { obtenerEnlaceUbicacionWhatsApp } from '../components/ui/inmuebleUbicacion';
import TurnoDetalleModal from '../components/turnos/TurnoDetalleModal';
import ModificarTurnoModal from '../components/turnos/ModificarTurnoModal';
import ClienteService from '../services/api/cliente.service';
import InmuebleService from '../services/api/inmueble.service';
import TurnoService from '../services/api/turno.service';
import ClienteDetalleSkeleton from '../components/skeletons/ClienteDetalleSkeleton';
import { VERDE } from '../styles/colores';
import Badge from '../components/ui/Badge';
import { CAPAS } from '../styles/capas';
import ConfirmarModal from '../components/ui/ConfirmarModal';

export default function ClientInmueblesPage() {
  const { id } = useParams();
  
  const [showFichaMobile, setShowFichaMobile] = useState(false);
  const [inmuebleABorrar, setInmuebleABorrar] = useState(null);
  const [borrandoInmueble, setBorrandoInmueble] = useState(false);
  const [errorBaja, setErrorBaja] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isClientMenuOpen, setIsClientMenuOpen] = useState(false);
  
  const [isInmuebleModalOpen, setIsInmuebleModalOpen] = useState(false);
  const [isDetalleModalOpen, setIsDetalleModalOpen] = useState(false);
  const [selectedInmueble, setSelectedInmueble] = useState(null);
  
  const [cliente, setCliente] = useState(null);
  const [inmuebles, setInmuebles] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [isTurnoDetalleOpen, setIsTurnoDetalleOpen] = useState(false);
  const [isModificarTurnoOpen, setIsModificarTurnoOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // NUEVOS ESTADOS PARA BUSCADOR Y FILTROS
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('Todos'); 
  const [sortBy, setSortBy] = useState('recientes');

  useEffect(() => {
    if (!isClientMenuOpen) return;
    const handleClickOutside = () => setIsClientMenuOpen(false);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsClientMenuOpen(false);
    };
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isClientMenuOpen]);

  useEffect(() => {
    let isMounted = true;

    const loadClientData = async () => {
      setLoading(true);
      try {
        const [clientesResp, turnosResp] = await Promise.all([
          ClienteService.getAll(),
          TurnoService.getAll().catch((err) => {
            console.error('Error al cargar turnos:', err);
            return { data: [] };
          })
        ]);

        if (isMounted) {
          const turnosData = turnosResp.data || [];
          setTurnos(Array.isArray(turnosData) ? turnosData : []);
        }
        
        if (clientesResp.data) {
          const currentClient = clientesResp.data.find(
            c => String(c.telefono) === String(id) || String(c.id_cliente) === String(id)
          );

          if (currentClient) {
            if (isMounted) setCliente(currentClient);
            const inmueblesResp = await InmuebleService.getByCliente(currentClient.id_cliente);
            if (isMounted) setInmuebles(inmueblesResp.data || []);
          } else {
             if (isMounted) setCliente(null);
          }
        }
      } catch (error) {
        console.error('Error al cargar datos del cliente:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadClientData();
    return () => { isMounted = false; };
  }, [id]);

  const handleClientUpdated = (updatedClientData) => {
    setCliente(prev => ({ ...prev, ...updatedClientData }));
  };

  const handleEstadoChange = async (nuevoEstado) => {
    if (!cliente) return;
    try {
      await ClienteService.update(cliente.telefono, { estado: nuevoEstado });
      setCliente(prev => ({ ...prev, estado: nuevoEstado }));
    } catch (error) {
      console.error('Error al cambiar el estado del cliente:', error);
      alert('Hubo un error al actualizar el estado.');
    }
  };

  const handleTurnoUpdated = (turnoActualizado) => {
    setTurnos(prev => prev.map(t => t.idTurno === turnoActualizado.idTurno ? turnoActualizado : t));
  };

  const handleCancelTurno = async (idTurno) => {
    try {
      await TurnoService.cancelar(idTurno);
      setTurnos(prev => prev.map(t => t.idTurno === idTurno ? { ...t, estado: 'CANCELADO' } : t));
      setIsTurnoDetalleOpen(false);
    } catch (error) {
      console.error('Error al cancelar el turno:', error);
      alert('Ocurrió un error al intentar cancelar el turno. Verifique su conexión.');
    }
  };

  const handleChangeTurnoState = async (idTurno, newState, existingData) => {
    try {
      const payload = {
        fecha_programada: existingData.fechaAsignada,
        inicio_desde: existingData.franjaHoraria.horaInicio,
        hasta: existingData.franjaHoraria.horaFin,
        prioridad: existingData.prioridad,
        estado: newState
      };

      const response = await TurnoService.update(idTurno, payload);
      handleTurnoUpdated(response.data);
      return true;
    } catch (error) {
      console.error(`Error al cambiar el estado a ${newState}:`, error);
      alert('Ocurrió un error al actualizar el estado del turno.');
      return false;
    }
  };

  const openInmuebleModal = (inmueble = null) => {
    setSelectedInmueble(inmueble);
    setIsInmuebleModalOpen(true);
  };

  const openDetalleModal = (inmueble) => {
    setSelectedInmueble(inmueble);
    setIsDetalleModalOpen(true);
  };

  const handleInmuebleSaved = (savedInmueble) => {
    setInmuebles(prev => {
      const index = prev.findIndex(i => i.id_inmueble === savedInmueble.id_inmueble);
      if (index !== -1) {
        const newInmuebles = [...prev];
        newInmuebles[index] = savedInmueble;
        return newInmuebles;
      }
      return [...prev, savedInmueble];
    });
    if (isDetalleModalOpen) setSelectedInmueble(savedInmueble);
  };

  // Pide confirmación en un modal antes de dar de baja (no se puede deshacer)
  const handleInmuebleDeleted = (inmuebleData) => {
    setErrorBaja(null);
    setInmuebleABorrar(inmuebleData);
  };

  const confirmarBajaInmueble = async () => {
    setBorrandoInmueble(true);
    setErrorBaja(null);
    try {
      await InmuebleService.delete(inmuebleABorrar.id_inmueble);
      setInmuebles(prev => prev.filter(i => i.id_inmueble !== inmuebleABorrar.id_inmueble));
      setInmuebleABorrar(null);
    } catch (error) {
      console.error('Error al eliminar inmueble:', error);
      setErrorBaja(error.response?.data?.error || 'No se pudo dar de baja el inmueble. Probá de nuevo en unos minutos.');
    } finally {
      setBorrandoInmueble(false);
    }
  };

  // LÓGICA DE FILTRADO Y ORDENAMIENTO DE INMUEBLES
  const filteredInmuebles = inmuebles.filter(inmueble => {
    const search = searchTerm.toLowerCase();
    const dir = (inmueble.direccion || '').toLowerCase();
    const barrio = (inmueble.barrio || '').toLowerCase();
    
    // Filtro por texto
    const matchesSearch = !search || dir.includes(search) || barrio.includes(search);
    
    // Filtro por tipo (Habitada / Lote)
    const matchesType = filterType === 'Todos' || inmueble.tipo_inmueble === filterType;
    
    return matchesSearch && matchesType;
  }).sort((a, b) => {
    if (sortBy === 'az') {
      return (a.direccion || '').localeCompare(b.direccion || '');
    } else if (sortBy === 'antiguos') {
      // Usamos el ID como proxy de antigüedad (menor ID = más antiguo)
      return (a.id_inmueble || 0) - (b.id_inmueble || 0);
    } else {
      // Recientes por defecto (mayor ID = más reciente)
      return (b.id_inmueble || 0) - (a.id_inmueble || 0);
    }
  });

  if (loading) {
    return <ClienteDetalleSkeleton />;
  }

  if (!cliente) {
    return (
      <div className="p-5 text-center mt-5">
        <AlertTriangle size={48} className="text-warning mb-3 mx-auto" />
        <h3 className="fw-bold text-dark">Cliente no encontrado</h3>
        <p className="text-secondary">Es posible que el cliente haya sido eliminado o el enlace sea incorrecto.</p>
        <Link to="/clients" className="btn btn-outline-primary mt-3 bg-white text-dark border-secondary">
          Volver a Clientes
        </Link>
      </div>
    );
  }

  const nombreMostrar = cliente.razon_social || `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim() || 'Sin Nombre';
  const contactoMostrar = `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim();
  const iniciales = nombreMostrar.substring(0, 2).toUpperCase();
  const isInactivo = cliente.estado === 'Inactivo';

  // Próximo turno/servicio agendado del cliente
  const hoyStr = new Date().toISOString().split('T')[0];
  const proximoTurno = turnos
    .filter((t) => {
      if (t.estado === 'CANCELADO' || t.estado === 'REALIZADO') return false;
      const matchId = cliente.id_cliente && t.cliente?.id_cliente && String(t.cliente.id_cliente) === String(cliente.id_cliente);
      const matchTel = cliente.telefono && t.cliente?.telefono && String(t.cliente.telefono) === String(cliente.telefono);
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
    <div className="d-flex flex-column gap-3 pb-5" style={{ backgroundColor: 'var(--hovy-gris-50)', minHeight: '100vh', margin: '-1.5rem', padding: '1.5rem' }}>
      
      {/* HEADER MÓVIL */}
      <div className="d-flex d-md-none align-items-center justify-content-between mb-3 px-2">
        <div className="d-flex align-items-center gap-3">
          <Link to="/clients" className="text-dark d-inline-flex" aria-label="Volver a Clientes">
            <ArrowLeft size={24} aria-hidden="true" />
          </Link>
          <div className="d-flex align-items-center gap-2">
            <Shield size={18} className="text-success" />
            <h1 className="fw-bold m-0 fs-5 text-dark">Detalle De Cliente</h1>
          </div>
        </div>
        <div className="d-flex align-items-center gap-3">
          <Bell size={20} className="text-secondary" />
          <span className="rounded-circle border d-inline-flex align-items-center justify-content-center fw-bold small text-white" style={{ width: 32, height: 32, backgroundColor: 'var(--hovy-verde-600)' }} aria-hidden="true">{iniciales}</span>
        </div>
      </div>

      {/* BREADCRUMB DESKTOP */}
      <div className="d-none d-md-flex align-items-center justify-content-between mb-2">
        <div className="d-flex align-items-center gap-2 text-secondary small fw-medium">
          <Link to="/clients" className="btn btn-link text-dark text-decoration-none p-0 d-flex align-items-center gap-2 fw-semibold">
            <ArrowLeft size={16} aria-hidden="true" /> Volver a Clientes
          </Link>
          <span className="text-muted">/</span>
          <span className="text-muted">Clientes</span>
          <span className="text-muted">/</span>
          <span className="text-muted">{nombreMostrar}</span>
          <span className="text-muted">/</span>
          <span className="text-dark fw-bold">Ficha e Inmuebles</span>
        </div>
        <div className="d-flex align-items-center gap-3">
          <div className="position-relative" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="light"
              icon
              aria-label="Opciones del cliente"
              aria-expanded={isClientMenuOpen}
              onClick={(e) => {
                e.stopPropagation();
                setIsClientMenuOpen(!isClientMenuOpen);
              }}
            >
              <MoreVertical size={16}/>
            </Button>

            {isClientMenuOpen && (
              <div
                className="position-absolute end-0 mt-1 bg-white rounded-3 shadow border py-1"
                style={{ minWidth: '175px', zIndex: CAPAS.menu }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="w-100 btn btn-sm text-start px-3 py-2 d-flex align-items-center gap-2 text-dark border-0 rounded-0"
                  onClick={() => {
                    setIsClientMenuOpen(false);
                    setIsEditModalOpen(true);
                  }}
                >
                  <Edit2 size={14} className="text-secondary" />
                  <span>Editar Cliente</span>
                </button>
                <button
                  type="button"
                  className={`w-100 btn btn-sm text-start px-3 py-2 d-flex align-items-center gap-2 border-0 rounded-0 ${isInactivo ? 'text-success' : 'text-danger'}`}
                  onClick={() => {
                    setIsClientMenuOpen(false);
                    handleEstadoChange(isInactivo ? 'Activo' : 'Inactivo');
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
      </div>

      {/* TARJETA DEL CLIENTE */}
      <Card className="p-3 p-md-4 shadow-sm border-0 rounded-4">
        <div className="d-flex flex-column flex-xl-row justify-content-between align-items-start gap-4 mb-4 pb-4 border-bottom">
          <div className="d-flex gap-3 flex-grow-1 min-w-0">
            <div className="rounded-4 d-flex align-items-center justify-content-center fw-bold text-success flex-shrink-0"
                 style={{ width: '64px', height: '64px', backgroundColor: 'var(--hovy-verde-100)', fontSize: 'var(--hovy-texto-2xl)', border: '1px solid var(--hovy-verde-200)' }}>
              {iniciales}
            </div>
            
            <div className="flex-grow-1">
              <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                <h2 className="fw-bold text-dark m-0 fs-4">{nombreMostrar}</h2>
                <Badge tipo="neutro" conPunto={false}>{cliente.tipo_cliente}</Badge>
                <Badge tipo={isInactivo ? 'pendiente' : 'exito'} conPunto={false}>
                  <CheckCircle2 size={12} aria-hidden="true" /> {cliente.estado || 'Activo'}
                </Badge>
              </div>
              
              <div className="d-block d-md-none text-secondary small mb-2 d-flex align-items-center gap-1">
                <User size={14} /> Contacto: {contactoMostrar || 'Sin contacto'}
              </div>
            </div>
          </div>
          
          <div className="d-flex gap-2 flex-wrap flex-shrink-0 mw-100">
            <Button 
              variant="light" 
              className="btn-sm border shadow-sm bg-white text-success fw-semibold"
              onClick={() => window.open(`https://wa.me/${String(cliente.telefono).replace(/\D/g,'')}`, '_blank')}
            >
              <MessageCircle size={16} /> WhatsApp
            </Button>

            {cliente.email && (
              <Button 
                variant="light" 
                className="btn-sm border shadow-sm bg-white text-primary fw-semibold"
                onClick={() => window.open(`mailto:${cliente.email}`, '_blank')}
              >
                <Mail size={16} /> Correo
              </Button>
            )}

            
            <Button 
              variant="light" 
              className="btn-sm border shadow-sm bg-white text-dark fw-semibold"
              onClick={() => setIsEditModalOpen(true)}
            >
              <Edit2 size={16} className="me-2 d-inline d-xl-none" />
              <Edit2 size={16} className="d-none d-xl-inline" /> 
              <span className="d-inline d-xl-inline ms-xl-1">Editar</span>
            </Button>
          </div>
        </div>

        <div className="mb-4">
          <button 
            className="d-flex d-md-none align-items-center justify-content-between w-100 btn btn-light bg-white border shadow-sm rounded-3 p-3 text-start fw-bold text-dark"
            onClick={() => setShowFichaMobile(!showFichaMobile)}
          >
            <span className="d-flex align-items-center gap-2"><FileText size={18} className="text-secondary"/> Datos del cliente</span>
            {showFichaMobile ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          <div className={`row g-3 mt-1 mt-md-0 ${showFichaMobile ? 'd-flex' : 'd-none d-md-flex'}`}>
            <div className="col-12 col-sm-6">
              <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                <Phone size={18} className="text-secondary mb-1"/>
                <div className="text-secondary text-uppercase fw-bold mb-1" style={{fontSize: 'var(--hovy-texto-xs)'}}>Teléfono</div>
                <div className="fw-medium text-dark small">+{cliente.telefono}</div>
              </div>
            </div>
            <div className="col-12 col-sm-6">
              <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                <Mail size={18} className="text-secondary mb-1"/>
                <div className="text-secondary text-uppercase fw-bold mb-1" style={{fontSize: 'var(--hovy-texto-xs)'}}>Email Principal</div>
                <div className="fw-medium text-dark small text-break">{cliente.email || 'No registrado'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-sm-4">
            <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle d-flex flex-column justify-content-between">
              <div className="text-secondary text-uppercase fw-bold mb-2 d-flex justify-content-between align-items-center" style={{fontSize: 'var(--hovy-texto-xs)'}}>
                Inmuebles <Building2 size={16} className="text-secondary"/>
              </div>
              <div className="fs-3 fw-bold text-dark">{inmuebles.length} <span className="fs-6 fw-normal text-secondary d-block d-sm-inline">predios</span></div>
            </div>
          </div>
          <div className="col-12 col-sm-4">
            <div
              className="p-3 bg-light rounded-4 h-100 border border-light-subtle d-flex flex-column justify-content-between"
              style={proximoTurno ? { cursor: 'pointer', transition: 'transform var(--hovy-duracion-rapida) ease, box-shadow var(--hovy-duracion-rapida) ease' } : undefined}
              onClick={() => {
                if (proximoTurno) setIsTurnoDetalleOpen(true);
              }}
              role={proximoTurno ? 'button' : undefined}
              tabIndex={proximoTurno ? 0 : undefined}
              onKeyDown={(e) => {
                if (proximoTurno && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  setIsTurnoDetalleOpen(true);
                }
              }}
            >
              <div className="text-secondary text-uppercase fw-bold mb-2 d-flex justify-content-between align-items-center" style={{fontSize: 'var(--hovy-texto-xs)'}}>
                Turnos <Calendar size={16} className={proximoTurno ? 'text-success' : 'text-secondary'}/>
              </div>
              {proximoTurno ? (
                <div>
                  <div className="fs-4 fw-bold text-dark">{fechaProximoTurno}</div>
                  {proximoTurno.franjaHoraria?.horaInicio && (
                    <span className="d-block text-secondary fw-normal mt-1" style={{fontSize: 'var(--hovy-texto-md)'}}>
                      {proximoTurno.franjaHoraria.horaInicio.slice(0, 5)} hs
                    </span>
                  )}
                </div>
              ) : (
                <div className="fs-3 fw-bold text-dark">-</div>
              )}
            </div>
          </div>
          <div className="col-12 col-sm-4">
            <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle d-flex flex-column justify-content-between">
              <div className="text-secondary text-uppercase fw-bold mb-2 d-flex justify-content-between align-items-center" style={{fontSize: 'var(--hovy-texto-xs)'}}>
                Estado de Cuenta <FileText size={16} className="text-secondary"/>
              </div>
              <div className="fs-4 fw-bold text-dark">{cliente.estado || 'Activo'} <span className="d-block text-secondary fw-normal mt-1" style={{fontSize: 'var(--hovy-texto-xs)'}}>$0 pend.</span></div>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-2">
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-end gap-3 mb-4">
          <div className="w-100">
            <h3 className="fw-bold fs-4 text-dark mb-1 d-flex align-items-center">
              Inmuebles Asociados
              <span className="badge bg-dark rounded-circle ms-2 p-2 d-none d-md-flex align-items-center justify-content-center" style={{fontSize: 'var(--hovy-texto-xl)', width: '28px', height: '28px', color: 'white'}}>{inmuebles.length}</span>
            </h3>
            <p className="text-secondary small m-0 d-none d-md-block">Gestión integral de parcelas vinculadas y estados operativos.</p>
            <Button 
              className="d-flex d-md-none w-100 align-items-center justify-content-center gap-2 py-3 rounded-pill shadow-sm mt-3" 
              style={{backgroundColor: VERDE, borderColor: VERDE}}
              onClick={() => openInmuebleModal()}
            >
              <Plus size={18} /> Agregar Nuevo Inmueble
            </Button>
          </div>

          <div className="d-flex flex-column align-items-stretch align-items-lg-end w-100 w-lg-auto gap-3">
            {/* SECCIÓN DE BÚSQUEDA Y FILTROS */}
            <div className="d-flex w-100 gap-2">
              <div className="d-flex align-items-center gap-2 bg-white rounded-pill px-3 py-2 shadow-sm border w-100">
                <Search size={18} className="text-secondary"/>
                <input 
                  type="text" 
                  className="form-control border-0 bg-transparent shadow-none small p-0" 
                  placeholder="Buscar por predio o calle…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button 
                className="d-none d-md-flex text-nowrap align-items-center gap-2 px-4 shadow-sm rounded-pill" 
                style={{backgroundColor: VERDE, borderColor: VERDE}}
                onClick={() => openInmuebleModal()}
              >
                <Building2 size={18} /> Agregar Nuevo Inmueble
              </Button>
            </div>
            
            {/* FILTROS TIPO Y ORDEN */}
            <div className="d-flex gap-2 w-100 justify-content-start justify-content-lg-end overflow-x-auto pb-1 pb-md-0 scrollbar-none">
              <div className="d-flex align-items-center gap-1">
                <Filter size={16} className="text-secondary me-1" />
                <select 
                  className="form-select bg-white rounded-pill border shadow-sm text-secondary py-1 px-3 w-auto flex-shrink-0"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  style={{ fontSize: 'var(--hovy-texto-sm)' }}
                >
                  <option value="Todos">Tipo: Todos</option>
                  <option value="Casa Habitada">Casa Habitada</option>
                  <option value="Lote Vacio">Lote Vacío</option>
                </select>
                <select 
                  className="form-select bg-white rounded-pill border shadow-sm text-secondary py-1 px-3 w-auto flex-shrink-0"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{ fontSize: 'var(--hovy-texto-sm)' }}
                >
                  <option value="recientes">Más recientes</option>
                  <option value="antiguos">Más antiguos</option>
                  <option value="az">Alfabético (A-Z)</option>
                </select>
              </div>
            </div>

          </div>
        </div>

        <div className="d-flex flex-column gap-3">
          {inmuebles.length === 0 ? (
            <Card className="p-5 text-center shadow-sm border-0 rounded-4">
              <Building2 size={48} className="text-secondary opacity-50 mb-3 mx-auto" />
              <h5 className="fw-bold text-dark">Sin inmuebles registrados</h5>
              <p className="text-secondary small">Este cliente aún no tiene predios asociados.</p>
            </Card>
          ) : filteredInmuebles.length === 0 ? (
            // ESTADO: NO SE ENCONTRARON RESULTADOS EN LA BÚSQUEDA
            <Card className="p-5 text-center shadow-sm border-0 rounded-4">
              <Search size={40} className="text-secondary opacity-50 mb-3 mx-auto" />
              <h5 className="fw-bold text-dark">No hay resultados</h5>
              <p className="text-secondary small">Ningún inmueble coincide con tu búsqueda o filtro actual.</p>
              <Button 
                variant="light" 
                className="btn-sm border bg-white shadow-sm mt-2" 
                onClick={() => { setSearchTerm(''); setFilterType('Todos'); }}
              >
                Limpiar Filtros
              </Button>
            </Card>
          ) : (
            filteredInmuebles.map((inmueble) => {
              const defaultImg = inmueble.tipo_inmueble === 'Lote Vacio' ? '/Lote.webp' : '/Habitada.webp';
              const imgToRender = inmueble.img || defaultImg;
              const enlaceUbicacionWhatsApp = obtenerEnlaceUbicacionWhatsApp(inmueble);
              const compartirUbicacion = () => {
                if (enlaceUbicacionWhatsApp) {
                  window.open(enlaceUbicacionWhatsApp, '_blank', 'noopener,noreferrer');
                }
              };

              const estadoVeg = inmueble.estado_vegetacion || 'Sin Dato';
              const badgeClass = estadoVeg === 'Alto' ? 'bg-danger-subtle text-danger border-danger-subtle' :
                                 estadoVeg === 'Medio' ? 'bg-warning-subtle text-warning border-warning-subtle' :
                                 estadoVeg === 'Bajo' || estadoVeg === 'Controlado' ? 'bg-success-subtle text-success border-success-subtle' :
                                 'bg-secondary-subtle text-secondary border-secondary-subtle';

              return (
                <Card key={inmueble.id_inmueble} className="border-0 shadow-sm rounded-4 overflow-hidden p-0">
                  <div className="row g-0 h-100">
                    <div className="col-12 col-md-3 col-xl-2 position-relative" style={{ minHeight: '160px', backgroundColor: 'var(--hovy-gris-200)' }}>
                      <img src={imgToRender} alt="" loading="lazy" decoding="async" width="320" height="240" className="w-100 h-100 object-fit-cover position-absolute" />
                      <span className="position-absolute bottom-0 start-0 m-2 badge bg-dark bg-opacity-75 text-white fw-medium px-2 py-1">
                        {inmueble.tipo_inmueble || 'General'}
                      </span>
                    </div>
                    
                    <div className="col-12 col-md-9 col-xl-10 p-3 p-md-4 d-flex flex-column justify-content-center bg-white">
                      <div className="d-flex flex-column flex-xl-row justify-content-between align-items-start gap-3 mb-2">
                        <div className="flex-grow-1 min-w-0">
                          <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
                            <h5 className="fw-bold text-dark m-0 fs-5">{inmueble.direccion}</h5>
                            <span className={`badge ${badgeClass} rounded-pill px-2 py-1 d-flex align-items-center gap-1 border`}>
                              {estadoVeg}
                            </span>
                          </div>
                          
                          <div className="d-none d-md-flex flex-column gap-1 text-secondary small">
                            <div className="d-flex align-items-center gap-2">
                              <MapPin size={16} className="text-secondary" />
                              <span>{inmueble.barrio || 'Sin barrio'}, {inmueble.provincia}</span>
                              <span className="text-muted px-1">•</span>
                              <span className="fw-medium text-dark">{inmueble.superficie_total} m²</span>
                            </div>
                            <div className="d-flex align-items-center gap-2 mt-1">
                              <Clock size={16} className="text-secondary" />
                              <span>Tiempo de trabajo estimado: <span className="fw-medium text-dark">{inmueble.tiempo_promedio_min ? `${inmueble.tiempo_promedio_min} min` : 'Sin estimar'}</span></span>
                            </div>
                          </div>

                          <div className="d-flex d-md-none flex-column gap-2 text-secondary small mt-3">
                            <div className="d-flex align-items-start gap-2"><MapPin size={16} className="text-secondary mt-1" /><span>{inmueble.direccion}</span></div>
                            <div className="d-flex align-items-start gap-2"><Building2 size={16} className="text-secondary mt-1" /><span>{inmueble.superficie_total} m²</span></div>
                          </div>
                        </div>
                        
                        <div className="d-none d-md-flex flex-wrap justify-content-xl-end gap-2 mw-100">
                          <Button 
                            variant="light" 
                            className="btn-sm bg-white border shadow-sm text-primary px-3 fw-semibold text-nowrap d-flex align-items-center gap-2"
                            onClick={() => {
                              if (inmueble.latitud && inmueble.longitud) {
                                window.open(`https://www.google.com/maps/search/?api=1&query=${inmueble.latitud},${inmueble.longitud}`, '_blank');
                              } else {
                                alert('Este inmueble no tiene coordenadas registradas.');
                              }
                            }}
                          >
                            <MapPin size={14}/> Ver en Maps
                          </Button>
                          <Button
                            variant="success"
                            className="btn-sm shadow-sm text-nowrap d-flex align-items-center gap-2"
                            onClick={compartirUbicacion}
                            disabled={!enlaceUbicacionWhatsApp}
                            title={enlaceUbicacionWhatsApp ? 'Compartir destino por WhatsApp' : 'Agregá la ubicación del inmueble para compartirla'}
                          >
                            <MessageCircle size={14} aria-hidden="true" /> Compartir ubicación
                          </Button>
                          <Button 
                            variant="light" 
                            className="btn-sm bg-white border shadow-sm text-dark px-3 fw-semibold text-nowrap d-flex align-items-center gap-2"
                            onClick={() => openDetalleModal(inmueble)}
                          >
                            <RotateCcw size={14}/> Detalles
                          </Button>
                          <Button 
                            variant="light" 
                            className="btn-sm bg-white border shadow-sm text-secondary px-2"
                            onClick={() => openInmuebleModal(inmueble)}
                          >
                            <Edit2 size={16} />
                          </Button>
                        </div>
                      </div>

                      <div className="d-flex d-md-none gap-2 w-100 mt-3 pt-3 border-top flex-wrap">
                        <Button 
                          variant="light" 
                          className="btn-sm bg-white border text-primary flex-grow-1 fw-bold py-2 d-flex align-items-center justify-content-center gap-2"
                          onClick={() => {
                            if (inmueble.latitud && inmueble.longitud) {
                              window.open(`https://www.google.com/maps/search/?api=1&query=${inmueble.latitud},${inmueble.longitud}`, '_blank');
                            } else {
                              alert('No hay coordenadas.');
                            }
                          }}
                        >
                          <MapPin size={16}/> Maps
                        </Button>
                        <Button
                          variant="success"
                          className="btn-sm flex-grow-1 fw-bold py-2 d-flex align-items-center justify-content-center gap-2"
                          onClick={compartirUbicacion}
                          disabled={!enlaceUbicacionWhatsApp}
                          title={enlaceUbicacionWhatsApp ? 'Compartir destino por WhatsApp' : 'Agregá la ubicación del inmueble para compartirla'}
                        >
                          <MessageCircle size={16} aria-hidden="true" /> Compartir ubicación
                        </Button>
                        <Button 
                          variant="light" 
                          className="btn-sm bg-light border text-dark flex-grow-1 fw-bold py-2 d-flex align-items-center justify-content-center gap-2"
                          onClick={() => openDetalleModal(inmueble)}
                        >
                          Detalles <ArrowLeft size={16} style={{transform: 'rotate(180deg)'}}/>
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <EditClientModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        clientData={cliente}
        onClientUpdated={handleClientUpdated}
      />

      <InmuebleDetalleModal
        isOpen={isDetalleModalOpen}
        onClose={() => setIsDetalleModalOpen(false)}
        inmuebleData={selectedInmueble}
        onEdit={(inmueble) => {
          setIsDetalleModalOpen(false);
          openInmuebleModal(inmueble);
        }}
        onDelete={handleInmuebleDeleted}
      />

      <InmuebleModal
        isOpen={isInmuebleModalOpen}
        onClose={() => setIsInmuebleModalOpen(false)}
        inmuebleData={selectedInmueble}
        idCliente={cliente.id_cliente} 
        onSaved={handleInmuebleSaved}
      />

      {isModificarTurnoOpen && proximoTurno && (
        <ModificarTurnoModal
          key={proximoTurno.idTurno}
          isOpen={isModificarTurnoOpen}
          onClose={() => setIsModificarTurnoOpen(false)}
          turnoData={proximoTurno}
          onTurnoUpdated={handleTurnoUpdated}
          turnosExistentes={turnos}
        />
      )}

      <TurnoDetalleModal
        isOpen={isTurnoDetalleOpen}
        onClose={() => setIsTurnoDetalleOpen(false)}
        turnoData={proximoTurno}
        onCancelTurno={handleCancelTurno}
        onEditTurno={() => {
          setIsTurnoDetalleOpen(false);
          setIsModificarTurnoOpen(true);
        }}
        onChangeState={handleChangeTurnoState}
      />

      {inmuebleABorrar && (
        <ConfirmarModal
          titulo="Dar de baja el inmueble"
          mensaje={`¿Querés dar de baja ${inmuebleABorrar.direccion || 'este inmueble'}? No se puede deshacer.`}
          textoConfirmar="Dar de baja"
          procesando={borrandoInmueble}
          error={errorBaja}
          onCancelar={() => setInmuebleABorrar(null)}
          onConfirmar={confirmarBajaInmueble}
        />
      )}
    </div>
  );
}
