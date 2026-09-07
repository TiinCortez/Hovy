import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Building2, CheckCircle2, Search, SlidersHorizontal, 
  Download, UserPlus, Phone, Mail, Star, ChevronRight, MoreVertical,
  Calendar, Briefcase, User, LayoutGrid
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import NewClientModal from '../components/ui/NewClientModal';
import { supabase } from '../services/supaBaseClient';

// ==========================================
// MOCK DATA (Fidelidad exacta al diseño web.jpg)
// ==========================================
const MOCK_CLIENTS = [
  {
    id: 'mock-jardines', // Este es el que conecta con el detalle que hicimos antes
    nombre: 'Jardines Gómez S.L.',
    contacto: 'Martín Gómez (Director Op.)',
    tipo_cliente: 'Empresa',
    estado: 'Al día',
    telefono: '+54 11 4829-1102',
    email: 'mgomez@jardinesgomez.com',
    calificacion_promedio: 4.9,
    inmuebles_count: 4,
    inmuebles_label: 'vinculados',
    proximo_turno: 'Hoy, 09:00',
    proximo_servicio: 'Mantenimiento integral',
    color: '#E8F5E9',
    textColor: 'text-success',
    icon: Briefcase
  },
  {
    id: 'mock-alamos',
    nombre: 'Estancia Los Álamos',
    contacto: 'Rodrigo Peñaloza (Administrador)',
    tipo_cliente: 'Agro/Predio',
    estado: 'Al día',
    telefono: '+54 2323 54-8890',
    email: 'admon@losalamosagro.com.ar',
    calificacion_promedio: 5.0,
    inmuebles_count: 6,
    inmuebles_label: 'parcelas',
    proximo_turno: 'Mañana, 08:30',
    proximo_servicio: 'Riego e inspección',
    color: '#F1F8E9',
    textColor: 'text-success',
    icon: LayoutGrid
  },
  {
    id: 'mock-vallejo',
    nombre: 'María Vallejo',
    contacto: 'Propietaria Particular',
    tipo_cliente: 'Particular',
    estado: 'Pendiente ($65.000)',
    telefono: '+54 11 6720-3341',
    email: 'vallejo.maria@gmail.com',
    calificacion_promedio: 4.7,
    inmuebles_count: 1,
    inmuebles_label: 'residencia',
    proximo_turno: 'Jue 18, 14:00',
    proximo_servicio: 'Poda de frutales',
    color: '#FFEBEE',
    textColor: 'text-danger',
    icon: User
  },
  {
    id: 'mock-ruiz',
    nombre: 'Carlos Ruiz',
    contacto: 'Desarrollador/Propietario',
    tipo_cliente: 'Particular',
    estado: 'Al día',
    telefono: '+54 11 3190-8822',
    email: 'carlos.ruiz@nordelta.com',
    calificacion_promedio: 4.8,
    inmuebles_count: 2,
    inmuebles_label: 'predios',
    proximo_turno: 'Mañana, 14:30',
    proximo_servicio: 'Poda y fertilización',
    color: '#E8F5E9',
    textColor: 'text-success',
    icon: User
  },
  {
    id: 'mock-silva',
    nombre: 'Residencia Silva',
    contacto: 'Florencia Silva (Contacto)',
    tipo_cliente: 'Particular',
    estado: 'Al día',
    telefono: '+54 11 9912-4530',
    email: 'florsilva@fibertel.com.ar',
    calificacion_promedio: 4.9,
    inmuebles_count: 1,
    inmuebles_label: 'quinta',
    proximo_turno: 'Vie 19, 10:00',
    proximo_servicio: 'Tratamiento fitosanita...',
    color: '#E8F5E9',
    textColor: 'text-success',
    icon: User
  },
  {
    id: 'mock-tipas',
    nombre: 'Complejo Las Tipas',
    contacto: 'Consorcio de Propietarios',
    tipo_cliente: 'Empresa / Barrio',
    estado: 'Pendiente ($110.000)',
    telefono: '+54 11 5012-7711',
    email: 'consorcio@lastipas.com.ar',
    calificacion_promedio: 4.6,
    inmuebles_count: 3,
    inmuebles_label: 'sectores comunes',
    proximo_turno: 'Lun 22, 08:00',
    proximo_servicio: 'Corte perimetral',
    color: '#FFEBEE',
    textColor: 'text-danger',
    icon: Briefcase
  }
];

export default function ClientsPage() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadClients = async () => {
      setLoading(true);
      let realClients = [];
      
      try {
        // Intentamos traer los reales de Supabase
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          realClients = data;
        }
      } catch (error) {
        console.warn('Error silencioso al cargar BD. Se usarán solo mocks.', error.message);
      } finally {
        // IMPORTANTE: Mezclamos Mocks con Reales SIEMPRE (incluso si la BD falla)
        if (isMounted) {
          setClients([...MOCK_CLIENTS, ...realClients]);
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

  const filteredClients = clients.filter(client => {
    const fullName = `${client.nombre || ''} ${client.apellido || ''}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    const matchesSearch = fullName.includes(search) || (client.telefono || '').includes(search);

    if (activeFilter === 'Todos') return matchesSearch;
    if (activeFilter === 'Empresas') return matchesSearch && (client.tipo_cliente === 'Empresa' || client.tipo_cliente === 'Empresa / Barrio');
    if (activeFilter === 'Particulares') return matchesSearch && client.tipo_cliente === 'Particular';
    if (activeFilter === 'Pendientes') return matchesSearch && client.estado?.includes('Pendiente');
    if (activeFilter === 'Al día') return matchesSearch && client.estado === 'Al día';
    
    return matchesSearch;
  });

  return (
    <div className="d-flex flex-column gap-4 pb-5">
      
      {/* ==========================================
          HEADER DE SECCIÓN
      ========================================== */}
      <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="text-success fw-bold text-uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>Directorio Operativo</span>
            <span className="rounded-circle bg-secondary d-inline-block" style={{ width: '4px', height: '4px' }}></span>
            <span className="text-secondary small fw-medium">Temporada 2026</span>
          </div>
          <h2 className="fw-bold fs-2 text-dark m-0">Clientes</h2>
          <p className="text-secondary small m-0">Directorio general de clientes y gestión integral de inmuebles vinculados.</p>
        </div>

        <div className="d-flex align-items-center gap-2 w-100 w-md-auto overflow-x-auto pb-1 pb-md-0">
          <Button variant="outline-primary" className="btn-sm text-nowrap rounded-3 bg-white shadow-sm border-light-subtle text-dark fw-medium px-3 py-2">
            <Download size={16} /> Exportar (.csv)
          </Button>
          <Button variant="outline-primary" className="btn-sm text-nowrap rounded-3 bg-white shadow-sm border-light-subtle text-dark fw-medium px-3 py-2">
            <SlidersHorizontal size={16} /> Filtros Avanzados
          </Button>
          <Button variant="primary" className="btn-sm text-nowrap rounded-3 ms-auto ms-md-0 shadow-sm fw-medium px-4 py-2" onClick={() => setIsModalOpen(true)} style={{backgroundColor: '#1B3006', borderColor: '#1B3006'}}>
            <UserPlus size={16} /> + Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* ==========================================
          TARJETAS DE KPIS (Como en web.jpg)
      ========================================== */}
      <div className="row g-3 flex-nowrap flex-md-wrap overflow-x-auto pb-2 pb-md-0 scrollbar-none">
        
        <div className="col-9 col-sm-6 col-xl-3 flex-shrink-0 flex-md-shrink-1">
          <Card className="h-100 p-3 shadow-sm border-0 rounded-4">
            <div className="d-flex align-items-start justify-content-between mb-2">
              <span className="text-secondary fw-bold text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>TOTAL CLIENTES</span>
              <div className="text-success"><Users size={18} /></div>
            </div>
            <div>
              <h3 className="fw-bold text-dark m-0 fs-3">48</h3>
              <span className="badge mt-2 fw-medium bg-success-subtle text-success d-inline-flex align-items-center gap-1 border border-success-subtle px-2 py-1">↑ +4 incorporados este mes</span>
            </div>
          </Card>
        </div>
        
        <div className="col-9 col-sm-6 col-xl-3 flex-shrink-0 flex-md-shrink-1">
          <Card className="h-100 p-3 shadow-sm border-0 rounded-4">
            <div className="d-flex align-items-start justify-content-between mb-2">
              <span className="text-secondary fw-bold text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>INMUEBLES ACTIVOS</span>
              <div className="text-secondary"><Building2 size={18} /></div>
            </div>
            <div>
              <h3 className="fw-bold text-dark m-0 fs-3">86</h3>
              <p className="text-secondary small m-0 mt-2">predios bajo mantenimiento activo</p>
            </div>
          </Card>
        </div>

        <div className="col-9 col-sm-6 col-xl-3 flex-shrink-0 flex-md-shrink-1">
          <Card className="h-100 p-3 shadow-sm border-0 rounded-4">
            <div className="d-flex align-items-start justify-content-between mb-2">
              <span className="text-secondary fw-bold text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>CLIENTES AL DÍA</span>
              <div className="text-success"><CheckCircle2 size={18} /></div>
            </div>
            <div>
              <h3 className="fw-bold text-dark m-0 fs-3">42</h3>
              <span className="badge mt-2 fw-medium bg-success-subtle text-success d-inline-flex align-items-center gap-1 border border-success-subtle px-2 py-1">87.5% cumplimiento de cuota y abonos</span>
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
              <h3 className="fw-bold text-dark m-0 fs-3">6</h3>
              <p className="text-danger small m-0 mt-2 fw-medium">$420.000 ARS <span className="text-secondary fw-normal">saldo acumulado</span></p>
            </div>
          </Card>
        </div>

      </div>

      {/* ==========================================
          FILTROS Y BÚSQUEDA
      ========================================== */}
      <div className="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center justify-content-between gap-3 mt-2">
        <div className="input-group bg-white rounded-pill px-3 py-2 border shadow-sm flex-grow-1" style={{ maxWidth: '300px' }}>
          <span className="input-group-text bg-transparent border-0 text-secondary p-0 me-2"><Search size={18} /></span>
          <input 
            type="text" 
            className="form-control bg-transparent border-0 shadow-none text-dark small p-0"
            placeholder="Buscar por nombre, empresa..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="d-flex align-items-center gap-2 overflow-x-auto pb-1 pb-lg-0 scrollbar-none w-100 w-lg-auto flex-grow-1">
          {['Todos', 'Al día', 'Pendientes', 'Empresas', 'Particulares'].map((filter) => {
            // Lógica simple para los números del mockup
            let count = '';
            if (filter === 'Todos') count = '(48)';
            if (filter === 'Al día') count = '(42)';
            if (filter === 'Pendientes') count = '(6)';
            if (filter === 'Empresas') count = '(18)';
            if (filter === 'Particulares') count = '(30)';

            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`btn btn-sm rounded-pill text-nowrap px-3 py-2 fw-medium shadow-sm border ${
                  activeFilter === filter 
                    ? 'btn-primary' 
                    : 'bg-white text-secondary'
                }`}
                style={activeFilter === filter ? {backgroundColor: '#1B3006', borderColor: '#1B3006'} : {}}
              >
                {filter} {count}
              </button>
            )
          })}
        </div>
        
        <select className="form-select bg-white rounded-pill border shadow-sm text-secondary small py-2 w-auto flex-shrink-0">
          <option>Ordenar: Más recientes</option>
          <option>Ordenar: Alfabético</option>
        </select>
      </div>

      {/* ==========================================
          GRID DE CLIENTES
      ========================================== */}
      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-success" role="status"></div></div>
      ) : filteredClients.length === 0 ? (
        <Card className="p-5 text-center border-0 shadow-sm rounded-4"><p className="text-secondary m-0">No se encontraron clientes.</p></Card>
      ) : (
        <div className="row g-3">
          {filteredClients.map((client) => {
            const initials = `${client.nombre?.[0] || ''}${client.apellido?.[0] || ''}`.toUpperCase() || 'CL';
            const fullName = client.nombre;
            const statusText = client.estado || 'Al día';
            const statusBadge = statusText.includes('Pendiente') ? 'bg-danger-subtle text-danger border-danger-subtle' : 'bg-success-subtle text-success border-success-subtle';
            const statusDot = statusText.includes('Pendiente') ? 'bg-danger' : 'bg-success';
            const ClientIcon = client.icon || User;

            return (
              <div key={client.id || client.telefono} className="col-12 col-md-6 col-xl-4">
                <Card className="h-100 p-4 shadow-sm border-0 rounded-4 d-flex flex-column justify-between bg-white">
                  
                  {/* Encabezado Tarjeta */}
                  <div className="d-flex align-items-start gap-3 mb-3">
                    <div className={`rounded-3 d-flex align-items-center justify-content-center fw-bold fs-5 flex-shrink-0 ${client.textColor || 'text-success'}`}
                         style={{ width: '48px', height: '48px', backgroundColor: client.color || '#E8F5E9' }}>
                      {initials}
                    </div>
                    <div className="flex-grow-1 overflow-hidden mt-1">
                      <div className="d-flex justify-content-between align-items-start">
                        <h5 className="fw-bold text-dark m-0 fs-5 text-truncate">{fullName}</h5>
                        <button className="btn btn-sm btn-link text-secondary p-0 m-0"><MoreVertical size={18} /></button>
                      </div>
                      <p className="text-secondary small m-0 text-truncate">{client.contacto}</p>
                    </div>
                  </div>

                  {/* Badges de Categoría y Estado */}
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <span className="badge bg-light text-secondary border rounded-pill px-2 py-1 small fw-medium d-flex align-items-center gap-1">
                      <ClientIcon size={12}/> {client.tipo_cliente}
                    </span>
                    <span className={`badge rounded-pill px-2 py-1 small border ${statusBadge} d-flex align-items-center gap-1`}>
                      <div className={`rounded-circle ${statusDot}`} style={{width: 6, height: 6}}></div> {statusText}
                    </span>
                    <div className="ms-auto d-flex align-items-center gap-1 text-warning small fw-bold">
                      <Star size={14} fill="currentColor" />
                      <span className="text-dark">{(client.calificacion_promedio || 0).toFixed(1)}</span>
                    </div>
                  </div>

                  {/* Contacto */}
                  <div className="d-flex flex-column gap-2 text-secondary small mb-4">
                    <div className="d-flex align-items-center gap-2"><Phone size={16} /> <span>{client.telefono}</span></div>
                    {client.email && (
                      <div className="d-flex align-items-center gap-2"><Mail size={16} /> <span className="text-truncate">{client.email}</span></div>
                    )}
                  </div>

                  {/* Info Inmuebles y Próximo Turno */}
                  <div className="row g-0 mb-4 bg-light rounded-3 border overflow-hidden">
                    <div className="col-5 p-2 px-3 border-end">
                      <span className="text-secondary d-block fw-semibold mb-1" style={{ fontSize: '0.65rem' }}>Inmuebles</span>
                      <span className="fw-bold text-dark small d-flex align-items-center gap-1 text-truncate">
                        <Building2 size={14} className="text-secondary" /> {client.inmuebles_count || 0} {client.inmuebles_label || 'vinculados'}
                      </span>
                    </div>
                    <div className="col-7 p-2 px-3">
                      <span className="text-secondary d-block fw-semibold mb-1" style={{ fontSize: '0.65rem' }}>Próximo servicio</span>
                      <div className="d-flex flex-column">
                        <span className="fw-bold text-dark small d-flex align-items-center gap-1 text-truncate">
                          <Calendar size={14} className="text-secondary" /> {client.proximo_turno || 'Sin agendar'}
                        </span>
                        <span className="text-secondary text-truncate mt-1" style={{ fontSize: '0.75rem' }}>{client.proximo_servicio || '---'}</span>
                      </div>
                    </div>
                  </div>

                  <Button 
                    onClick={() => navigate(`/clients/${client.id || client.telefono}/inmuebles`)}
                    variant="light"
                    className="w-100 rounded-pill text-dark fw-bold small d-flex align-items-center justify-content-center gap-2 py-2 bg-light border shadow-sm"
                  >
                    Ver Inmuebles & Ficha <ChevronRight size={16} />
                  </Button>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* ==========================================
          PAGINACIÓN
      ========================================== */}
      <div className="d-flex flex-column flex-sm-row align-items-center justify-content-between gap-3 pt-3 mt-2">
        <span className="text-secondary small fw-medium">
          Mostrando 1-6 de 48 clientes
        </span>
        <div className="d-flex align-items-center gap-1">
          <button className="btn btn-sm btn-white text-secondary border shadow-sm px-2 bg-white">&lt;</button>
          <button className="btn btn-sm btn-primary border shadow-sm px-3" style={{backgroundColor: '#1B3006', borderColor: '#1B3006'}}>1</button>
          <button className="btn btn-sm btn-white text-secondary border shadow-sm px-3 bg-white">2</button>
          <button className="btn btn-sm btn-white text-secondary border shadow-sm px-3 bg-white">3</button>
          <span className="text-secondary px-1">...</span>
          <button className="btn btn-sm btn-white text-secondary border shadow-sm px-3 bg-white">8</button>
          <button className="btn btn-sm btn-white text-secondary border shadow-sm px-2 bg-white">&gt;</button>
        </div>
      </div>

      <NewClientModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onClientCreated={handleClientCreated} />
    </div>
  );
}