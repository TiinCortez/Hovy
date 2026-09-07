import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Download, MoreVertical, CheckCircle2, Shield, 
  Mail, FileText, Edit2, Phone, MapPin, Building2, Calendar,
  Star, Search, Plus, Clock, User, RotateCcw,
  ChevronDown, ChevronUp, Bell, AlertTriangle
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import EditClientModal from '../components/ui/EditClientModal'; // <-- IMPORTAMOS EL MODAL
import { supabase } from '../services/supaBaseClient';

export default function ClientInmueblesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Estados de interfaz
  const [showFichaMobile, setShowFichaMobile] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // <-- ESTADO DEL MODAL
  
  // Estados de datos
  const [cliente, setCliente] = useState(null);
  const [inmuebles, setInmuebles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (id === 'mock-jardines') {
      setTimeout(() => {
        if (isMounted) {
          setCliente({
            isMock: true,
            id: 'mock-jardines',
            nombre: "Jardines Gómez S.L.",
            apellido: "",
            contacto: "Martín Gómez",
            tipo_cliente: "EMPRESA",
            estado: "Al día",
            telefono: "34 600 123 456",
            email: "contacto@jardinesgomez.es",
            cuit_cuil: "B-84920194",
            domicilio_fiscal: "Av. San Martín 1240",
            calificacion_promedio: 4.9,
            saldo: 0
          });
          setInmuebles([
            { id_inmueble: 1, direccion: "Av. Paseo del Buen Pastor 450", provincia: "Córdoba", superficie_total: "650", tipo_inmueble: "Residencial", estado_txt: "Mantenimiento Activo", img: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=400" },
            { id_inmueble: 2, direccion: "Ruta 5 km 12", provincia: "Luján", superficie_total: "1800", tipo_inmueble: "Agro / Campo", estado_txt: "Al día", img: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=400" },
            { id_inmueble: 3, direccion: "Boulevard San Juan 890", provincia: "Córdoba", superficie_total: "420", tipo_inmueble: "Comercial", estado_txt: "Pendiente Poda", img: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=400" }
          ]);
          setLoading(false);
        }
      }, 500);
      return () => { isMounted = false; };
    }

    const loadClientData = async () => {
      setLoading(true);
      try {
        const { data: clientData, error: clientError } = await supabase
          .from('clientes')
          .select('*')
          .or(`id.eq.${id},telefono.eq.${id}`)
          .single();

        if (clientError) throw clientError;

        if (clientData) {
          const { data: inmueblesData, error: inmueblesError } = await supabase
            .from('inmuebles')
            .select('*')
            .eq('id_cliente', clientData.id)
            .eq('activo', true);

          if (!inmueblesError && isMounted) {
            setInmuebles(inmueblesData || []);
          }
        }
        if (isMounted) setCliente(clientData);
      } catch (error) {
        console.error('Error al cargar datos reales:', error.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadClientData();
    return () => { isMounted = false; };
  }, [id]);

  // <-- FUNCIÓN PARA ACTUALIZAR EL ESTADO LOCAL CUANDO SE EDITA
  const handleClientUpdated = (updatedClientData) => {
    setCliente(prev => ({ ...prev, ...updatedClientData }));
  };

  if (loading) {
    return (
      <div className="vh-100 d-flex justify-content-center align-items-center" style={{ backgroundColor: '#F8F9FA' }}>
        <div className="spinner-border text-success" role="status"></div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="p-5 text-center">
        <AlertTriangle size={48} className="text-warning mb-3 mx-auto" />
        <h3>Cliente no encontrado</h3>
        <Button onClick={() => navigate('/clients')} variant="outline-primary" className="mt-3 bg-white text-dark">Volver a Clientes</Button>
      </div>
    );
  }

  const nombreMostrar = cliente.razon_social || cliente.nombre || 'Sin Nombre';
  const contactoMostrar = cliente.contacto || `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim();
  const iniciales = nombreMostrar.substring(0, 2).toUpperCase();
  const esMock = cliente.isMock;

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
          <img src="https://i.pravatar.cc/150?img=11" alt="User" className="rounded-circle border" width="32" height="32" />
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
          <span className="d-flex align-items-center gap-2 text-secondary small fw-medium">
             <div className="rounded-circle bg-dark" style={{width: 6, height: 6}}></div> Sincronizado hace 4 min
          </span>
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
                {contactoMostrar && <span className="d-none d-md-inline fw-normal text-secondary fs-5">— {contactoMostrar}</span>}
                <span className="badge bg-light text-secondary border text-uppercase" style={{ fontSize: '0.65rem' }}>{cliente.tipo_cliente}</span>
                <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill d-flex align-items-center gap-1">
                  <CheckCircle2 size={12} /> {cliente.estado || 'Activo'}
                </span>
              </div>
              
              <div className="d-block d-md-none text-secondary small mb-2 d-flex align-items-center gap-1">
                <User size={14} /> Contacto: {contactoMostrar || 'Sin contacto'}
              </div>

              <div className="d-inline-flex align-items-center gap-2 bg-light rounded-3 px-3 py-2 mt-2 mt-md-1 border w-100 w-md-auto">
                <Shield size={16} className="text-secondary flex-shrink-0" />
                <span className="text-dark small fw-medium" style={{ fontSize: '0.8rem' }}>
                  {esMock ? 'Cuenta Corporativa Prioritaria • Contrato Anual' : 'Cuenta Estándar Registrada'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="d-flex flex-row gap-2 w-100 w-xl-auto">
            <Button variant="light" className="btn-sm border shadow-sm flex-grow-1 bg-white text-dark fw-semibold px-4 py-2"><Mail size={16} /> Contactar</Button>
            <Button variant="light" className="btn-sm border shadow-sm flex-grow-1 bg-white text-dark fw-semibold px-4 py-2"><FileText size={16} /> Facturación</Button>
            
            {/* <-- ACÁ CONECTAMOS EL BOTÓN EDITAR --> */}
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

        {/* KPIs */}
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
              <div className="fs-3 fw-bold text-dark">{esMock ? '12' : '0'} <span className="fs-6 fw-normal text-secondary d-block d-sm-inline">activos</span></div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle d-flex flex-column justify-content-between">
              <div className="text-secondary text-uppercase fw-bold mb-2 d-flex justify-content-between align-items-center" style={{fontSize: '0.65rem'}}>
                Estado de Cuenta <FileText size={16} className="text-secondary"/>
              </div>
              <div className="fs-4 fw-bold text-dark">{cliente.estado || 'Al día'} <span className="d-block text-secondary fw-normal mt-1" style={{fontSize: '0.75rem'}}>${cliente.saldo || 0} pend.</span></div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="p-3 bg-light rounded-4 h-100 border border-light-subtle d-flex flex-column justify-content-between">
              <div className="text-secondary text-uppercase fw-bold mb-2 d-flex justify-content-between align-items-center" style={{fontSize: '0.65rem'}}>
                Satisfacción <Star size={16} className="text-secondary"/>
              </div>
              <div className="d-flex align-items-center flex-wrap gap-1 text-warning mt-1">
                <span className="fs-3 fw-bold text-dark me-1">{(cliente.calificacion_promedio || 0).toFixed(1)}</span>
                <div className="d-flex"><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /><Star size={12} fill="currentColor" /></div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* SECCIÓN INMUEBLES ASOCIADOS */}
      <div className="mt-2">
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-end gap-3 mb-4">
          <div className="w-100">
            <h3 className="fw-bold fs-4 text-dark mb-1 d-flex align-items-center">
              Inmuebles Asociados
              <span className="badge bg-dark rounded-circle ms-2 p-2 d-none d-md-flex align-items-center justify-content-center" style={{fontSize: '0.8rem', width: '28px', height: '28px'}}>{inmuebles.length}</span>
            </h3>
            <p className="text-secondary small m-0 d-none d-md-block">Gestión integral de parcelas vinculadas y estados operativos.</p>
            <Button className="d-flex d-md-none w-100 align-items-center justify-content-center gap-2 py-3 rounded-pill shadow-sm mt-3" style={{backgroundColor: '#1B3006', borderColor: '#1B3006'}}>
              <Plus size={18} /> Agregar Nuevo Inmueble
            </Button>
          </div>

          <div className="d-flex flex-column align-items-stretch align-items-lg-end w-100 w-lg-auto gap-3">
            <div className="d-flex w-100 gap-2">
              <div className="d-flex align-items-center gap-2 bg-white rounded-pill px-3 py-2 shadow-sm border w-100">
                <Search size={18} className="text-secondary"/>
                <input type="text" className="form-control border-0 bg-transparent shadow-none small p-0" placeholder="Buscar por predio o calle..."/>
              </div>
              <Button className="d-none d-md-flex text-nowrap align-items-center gap-2 px-4 shadow-sm rounded-pill" style={{backgroundColor: '#1B3006', borderColor: '#1B3006'}}>
                <Building2 size={18} /> Agregar Nuevo Inmueble
              </Button>
            </div>
          </div>
        </div>

        {/* LISTA DE INMUEBLES */}
        <div className="d-flex flex-column gap-3">
          {inmuebles.length === 0 ? (
            <Card className="p-5 text-center shadow-sm border-0 rounded-4">
              <Building2 size={48} className="text-secondary opacity-50 mb-3 mx-auto" />
              <h5 className="fw-bold text-dark">Sin inmuebles registrados</h5>
            </Card>
          ) : (
            inmuebles.map((inmueble) => (
              <Card key={inmueble.id_inmueble} className="border-0 shadow-sm rounded-4 overflow-hidden p-0">
                <div className="row g-0 h-100">
                  <div className="col-12 col-md-3 col-xl-2 position-relative" style={{ minHeight: '160px', backgroundColor: '#e9ecef' }}>
                    {inmueble.img ? (
                       <img src={inmueble.img} alt="Inmueble" className="w-100 h-100 object-fit-cover position-absolute" />
                    ) : (
                       <div className="w-100 h-100 position-absolute d-flex align-items-center justify-content-center text-secondary opacity-50"><Building2 size={40} /></div>
                    )}
                    <span className="position-absolute bottom-0 start-0 m-2 badge bg-dark bg-opacity-75 text-white fw-medium px-2 py-1">
                      {inmueble.tipo_inmueble}
                    </span>
                  </div>
                  
                  <div className="col-12 col-md-9 col-xl-10 p-3 p-md-4 d-flex flex-column justify-content-center bg-white">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="w-100">
                        <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
                          <h5 className="fw-bold text-dark m-0 fs-5">{inmueble.direccion}</h5>
                          <span className={`badge ${inmueble.estado_txt?.includes('Pendiente') ? 'bg-warning-subtle text-warning border-warning-subtle' : 'bg-success-subtle text-success border-success-subtle'} rounded-pill px-2 py-1 d-flex align-items-center gap-1 border`}>
                            {inmueble.estado_txt || 'Activo'}
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
                            <span>Próximo turno: <span className="fw-medium text-dark">{esMock ? 'Mañana' : 'Sin agendar'}</span></span>
                          </div>
                        </div>

                        <div className="d-flex d-md-none flex-column gap-2 text-secondary small mt-3">
                          <div className="d-flex align-items-start gap-2"><MapPin size={16} className="text-secondary mt-1" /><span>{inmueble.direccion}</span></div>
                          <div className="d-flex align-items-start gap-2"><Building2 size={16} className="text-secondary mt-1" /><span>{inmueble.superficie_total} m²</span></div>
                        </div>
                      </div>
                      
                      <div className="d-none d-md-flex gap-2 ms-3">
                        <Button variant="light" className="btn-sm bg-white border shadow-sm text-dark px-3 fw-semibold text-nowrap d-flex align-items-center gap-2"><RotateCcw size={14}/> Ver Detalles</Button>
                        <Button variant="light" className="btn-sm bg-white border shadow-sm text-secondary px-2"><Edit2 size={16} /></Button>
                      </div>
                    </div>

                    <div className="d-flex d-md-none gap-2 w-100 mt-3 pt-3 border-top">
                      <Button variant="light" className="btn-sm bg-light border text-dark flex-grow-1 fw-bold py-2 d-flex align-items-center justify-content-center gap-2">Ver Detalles <ArrowLeft size={16} style={{transform: 'rotate(180deg)'}}/></Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* RENDERIZADO DEL MODAL DE EDICIÓN */}
      <EditClientModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        clientData={cliente}
        onClientUpdated={handleClientUpdated}
      />
      
    </div>
  );
}