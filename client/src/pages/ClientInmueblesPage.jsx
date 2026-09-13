import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Download, MoreVertical, CheckCircle2, Shield, 
  Mail, FileText, Edit2, Phone, MapPin, Building2, Calendar,
  Star, Search, Plus, Clock, User, RotateCcw,
  ChevronDown, ChevronUp, Bell, AlertTriangle, MessageCircle, Filter
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import EditClientModal from '../components/ui/EditClientModal'; 
import InmuebleModal from '../components/ui/InmuebleModal';
import InmuebleDetalleModal from '../components/ui/InmuebleDetalleModal';
import ClienteService from '../services/api/cliente.service';
import InmuebleService from '../services/api/inmueble.service';

export default function ClientInmueblesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [showFichaMobile, setShowFichaMobile] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [isInmuebleModalOpen, setIsInmuebleModalOpen] = useState(false);
  const [isDetalleModalOpen, setIsDetalleModalOpen] = useState(false);
  const [selectedInmueble, setSelectedInmueble] = useState(null);
  
  const [cliente, setCliente] = useState(null);
  const [inmuebles, setInmuebles] = useState([]);
  const [loading, setLoading] = useState(true);

  // NUEVOS ESTADOS PARA BUSCADOR Y FILTROS
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('Todos'); 
  const [sortBy, setSortBy] = useState('recientes');

  useEffect(() => {
    let isMounted = true;

    const loadClientData = async () => {
      setLoading(true);
      try {
        const clientesResp = await ClienteService.getAll();
        
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

  const handleInmuebleDeleted = async (inmuebleData) => {
    if (!window.confirm('¿Está seguro de que desea dar de baja este inmueble? Esta acción no se puede deshacer.')) return;
    try {
      await InmuebleService.delete(inmuebleData.id_inmueble);
      setInmuebles(prev => prev.filter(i => i.id_inmueble !== inmuebleData.id_inmueble));
    } catch (error) {
      console.error('Error al eliminar inmueble:', error);
      alert(error.response?.data?.error || 'Ocurrió un error al intentar eliminar el inmueble.');
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
    return (
      <div className="vh-100 d-flex justify-content-center align-items-center" style={{ backgroundColor: '#F8F9FA' }}>
        <div className="spinner-border" style={{ color: '#1B3006' }} role="status"></div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="p-5 text-center mt-5">
        <AlertTriangle size={48} className="text-warning mb-3 mx-auto" />
        <h3 className="fw-bold text-dark">Cliente no encontrado</h3>
        <p className="text-secondary">Es posible que el cliente haya sido eliminado o el enlace sea incorrecto.</p>
        <Button onClick={() => navigate('/clients')} variant="outline-primary" className="mt-3 bg-white text-dark border-secondary">
          Volver a Clientes
        </Button>
      </div>
    );
  }

  const nombreMostrar = cliente.razon_social || `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim() || 'Sin Nombre';
  const contactoMostrar = `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim();
  const iniciales = nombreMostrar.substring(0, 2).toUpperCase();

  return (
    <div className="d-flex flex-column gap-3 pb-5" style={{ backgroundColor: '#F8F9FA', minHeight: '100vh', margin: '-1.5rem', padding: '1.5rem' }}>
      
      {/* HEADER MÓVIL */}
      <div className="d-flex d-md-none align-items-center justify-content-between mb-3 px-2">
        <div className="d-flex align-items-center gap-3">
          <ArrowLeft size={24} className="text-dark" onClick={() => navigate('/clients')} />
          <div className="d-flex align-items-center gap-2">
            <Shield size={18} className="text-success" />
            <h1 className="fw-bold m-0 fs-5 text-dark">Detalle De Cliente</h1>
          </div>
        </div>
        <div className="d-flex align-items-center gap-3">
          <Bell size={20} className="text-secondary" />
          <img src={`https://ui-avatars.com/api/?name=${iniciales}&background=random`} alt="User" className="rounded-circle border" width="32" height="32" />
        </div>
      </div>

      {/* BREADCRUMB DESKTOP */}
      <div className="d-none d-md-flex align-items-center justify-content-between mb-2">
        <div className="d-flex align-items-center gap-2 text-secondary small fw-medium">
          <button onClick={() => navigate('/clients')} className="btn btn-link text-dark text-decoration-none p-0 d-flex align-items-center gap-2 fw-semibold hover-opacity">
            <ArrowLeft size={16} /> Volver a Clientes
          </button>
          <span className="text-muted">/</span>
          <span className="text-muted">Clientes</span>
          <span className="text-muted">/</span>
          <span className="text-muted">{nombreMostrar}</span>
          <span className="text-muted">/</span>
          <span className="text-dark fw-bold">Ficha e Inmuebles</span>
        </div>
        <div className="d-flex align-items-center gap-3">
          <button className="btn btn-sm btn-white border bg-white rounded-2 shadow-sm text-secondary px-2"><Download size={16}/></button>
          <button className="btn btn-sm btn-white border bg-white rounded-2 shadow-sm text-secondary px-2"><MoreVertical size={16}/></button>
        </div>
      </div>

      {/* TARJETA DEL CLIENTE */}
      <Card className="p-3 p-md-4 shadow-sm border-0 rounded-4">
        <div className="d-flex flex-column flex-xl-row justify-content-between align-items-start gap-4 mb-4 pb-4 border-bottom">
          <div className="d-flex gap-3 w-100 w-xl-auto">
            <div className="rounded-4 d-flex align-items-center justify-content-center fw-bold text-success flex-shrink-0"
                 style={{ width: '64px', height: '64px', backgroundColor: '#E8F5E9', fontSize: '1.5rem', border: '1px solid #C8E6C9' }}>
              {iniciales}
            </div>
            
            <div className="flex-grow-1">
              <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                <h2 className="fw-bold text-dark m-0 fs-4">{nombreMostrar}</h2>
                <span className="badge bg-light text-secondary border text-uppercase" style={{ fontSize: '0.65rem' }}>{cliente.tipo_cliente}</span>
                <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill d-flex align-items-center gap-1">
                  <CheckCircle2 size={12} /> {cliente.estado || 'Activo'}
                </span>
              </div>
              
              <div className="d-block d-md-none text-secondary small mb-2 d-flex align-items-center gap-1">
                <User size={14} /> Contacto: {contactoMostrar || 'Sin contacto'}
              </div>
            </div>
          </div>
          
          <div className="d-flex flex-row gap-2 w-100 w-xl-auto flex-wrap">
            <Button 
              variant="light" 
              className="btn-sm border shadow-sm flex-grow-1 bg-white text-success fw-semibold px-4 py-2"
              onClick={() => window.open(`https://wa.me/${String(cliente.telefono).replace(/\D/g,'')}`, '_blank')}
            >
              <MessageCircle size={16} /> WhatsApp
            </Button>

            {cliente.email && (
              <Button 
                variant="light" 
                className="btn-sm border shadow-sm flex-grow-1 bg-white text-primary fw-semibold px-4 py-2"
                onClick={() => window.open(`mailto:${cliente.email}`, '_blank')}
              >
                <Mail size={16} /> Correo
              </Button>
            )}

            <Button variant="light" className="btn-sm border shadow-sm flex-grow-1 bg-white text-dark fw-semibold px-4 py-2">
              <FileText size={16} /> Facturación
            </Button>
            
            <Button 
              variant="light" 
              className="btn-sm border shadow-sm bg-white text-dark fw-semibold px-4 py-2 flex-grow-1 flex-xl-grow-0"
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
            <span className="d-flex align-items-center gap-2"><FileText size={18} className="text-secondary"/> Ficha Técnica y Fiscal</span>
            {showFichaMobile ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          <div className={`row g-3 mt-1 mt-md-0 ${showFichaMobile ? 'd-flex' : 'd-none d-md-flex'}`}>
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                <Phone size={18} className="text-secondary mb-1"/>
                <div className="text-secondary text-uppercase fw-bold mb-1" style={{fontSize: '0.65rem'}}>Teléfono</div>
                <div className="fw-medium text-dark small">+{cliente.telefono}</div>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                <Mail size={18} className="text-secondary mb-1"/>
                <div className="text-secondary text-uppercase fw-bold mb-1" style={{fontSize: '0.65rem'}}>Email Principal</div>
                <div className="fw-medium text-dark small text-break">{cliente.email || 'No registrado'}</div>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                <FileText size={18} className="text-secondary mb-1"/>
                <div className="text-secondary text-uppercase fw-bold mb-1" style={{fontSize: '0.65rem'}}>NIF / CUIT</div>
                <div className="fw-medium text-dark small">{cliente.cuit_cuil || 'No registrado'}</div>
              </div>
            </div>
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle">
                <MapPin size={18} className="text-secondary mb-1"/>
                <div className="text-secondary text-uppercase fw-bold mb-1" style={{fontSize: '0.65rem'}}>Dirección Fiscal</div>
                <div className="fw-medium text-dark small">{cliente.domicilio_fiscal || 'No registrada'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-6 col-lg-3">
            <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle d-flex flex-column justify-content-between">
              <div className="text-secondary text-uppercase fw-bold mb-2 d-flex justify-content-between align-items-center" style={{fontSize: '0.65rem'}}>
                Inmuebles <Building2 size={16} className="text-secondary"/>
              </div>
              <div className="fs-3 fw-bold text-dark">{inmuebles.length} <span className="fs-6 fw-normal text-secondary d-block d-sm-inline">predios</span></div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle d-flex flex-column justify-content-between">
              <div className="text-secondary text-uppercase fw-bold mb-2 d-flex justify-content-between align-items-center" style={{fontSize: '0.65rem'}}>
                Turnos <Calendar size={16} className="text-secondary"/>
              </div>
              <div className="fs-3 fw-bold text-dark">0 <span className="fs-6 fw-normal text-secondary d-block d-sm-inline">activos</span></div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle d-flex flex-column justify-content-between">
              <div className="text-secondary text-uppercase fw-bold mb-2 d-flex justify-content-between align-items-center" style={{fontSize: '0.65rem'}}>
                Estado de Cuenta <FileText size={16} className="text-secondary"/>
              </div>
              <div className="fs-4 fw-bold text-dark">{cliente.estado || 'Activo'} <span className="d-block text-secondary fw-normal mt-1" style={{fontSize: '0.75rem'}}>$0 pend.</span></div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle d-flex flex-column justify-content-between">
              <div className="text-secondary text-uppercase fw-bold mb-2 d-flex justify-content-between align-items-center" style={{fontSize: '0.65rem'}}>
                Satisfacción <Star size={16} className="text-secondary"/>
              </div>
              <div className="d-flex align-items-center flex-wrap gap-1 text-warning mt-1">
                <span className="fs-3 fw-bold text-dark me-1">{Number(cliente.calificacion_promedio || 0).toFixed(1)}</span>
                <div className="d-flex"><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /></div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-2">
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-end gap-3 mb-4">
          <div className="w-100">
            <h3 className="fw-bold fs-4 text-dark mb-1 d-flex align-items-center">
              Inmuebles Asociados
              <span className="badge bg-dark rounded-circle ms-2 p-2 d-none d-md-flex align-items-center justify-content-center" style={{fontSize: '1.2rem', width: '28px', height: '28px', color: 'white'}}>{inmuebles.length}</span>
            </h3>
            <p className="text-secondary small m-0 d-none d-md-block">Gestión integral de parcelas vinculadas y estados operativos.</p>
            <Button 
              className="d-flex d-md-none w-100 align-items-center justify-content-center gap-2 py-3 rounded-pill shadow-sm mt-3" 
              style={{backgroundColor: '#1B3006', borderColor: '#1B3006'}}
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
                  placeholder="Buscar por predio o calle..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button 
                className="d-none d-md-flex text-nowrap align-items-center gap-2 px-4 shadow-sm rounded-pill" 
                style={{backgroundColor: '#1B3006', borderColor: '#1B3006'}}
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
                  style={{ fontSize: '0.80rem' }}
                >
                  <option value="Todos">Tipo: Todos</option>
                  <option value="Casa Habitada">Casa Habitada</option>
                  <option value="Lote Vacio">Lote Vacío</option>
                </select>
                <select 
                  className="form-select bg-white rounded-pill border shadow-sm text-secondary py-1 px-3 w-auto flex-shrink-0"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{ fontSize: '0.80rem' }}
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

              const estadoVeg = inmueble.estado_vegetacion || 'Sin Dato';
              const badgeClass = estadoVeg === 'Alto' ? 'bg-danger-subtle text-danger border-danger-subtle' :
                                 estadoVeg === 'Medio' ? 'bg-warning-subtle text-warning border-warning-subtle' :
                                 estadoVeg === 'Bajo' || estadoVeg === 'Controlado' ? 'bg-success-subtle text-success border-success-subtle' :
                                 'bg-secondary-subtle text-secondary border-secondary-subtle';

              return (
                <Card key={inmueble.id_inmueble} className="border-0 shadow-sm rounded-4 overflow-hidden p-0">
                  <div className="row g-0 h-100">
                    <div className="col-12 col-md-3 col-xl-2 position-relative" style={{ minHeight: '160px', backgroundColor: '#e9ecef' }}>
                      <img src={imgToRender} alt="Inmueble" className="w-100 h-100 object-fit-cover position-absolute" />
                      <span className="position-absolute bottom-0 start-0 m-2 badge bg-dark bg-opacity-75 text-white fw-medium px-2 py-1">
                        {inmueble.tipo_inmueble || 'General'}
                      </span>
                    </div>
                    
                    <div className="col-12 col-md-9 col-xl-10 p-3 p-md-4 d-flex flex-column justify-content-center bg-white">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="w-100">
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
                        
                        <div className="d-none d-md-flex gap-2 ms-3">
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
      
    </div>
  );
}