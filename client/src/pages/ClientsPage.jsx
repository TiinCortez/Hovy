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
import ClienteService from '../services/api/cliente.service';

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
      try {
        const response = await ClienteService.getAll();
        
        if (isMounted && response.data) {
          const sortedClients = response.data.sort((a, b) => new Date(b.fecha_alta) - new Date(a.fecha_alta));
          setClients(sortedClients);
        }
      } catch (error) {
        console.error('Error al cargar clientes desde el servidor:', error);
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

  const filteredClients = clients.filter(client => {
    const fullName = `${client.nombre || ''} ${client.apellido || ''}`.toLowerCase();
    const search = searchTerm.toLowerCase();
    const matchesSearch = fullName.includes(search) || (client.telefono || '').includes(search) || (client.razon_social || '').toLowerCase().includes(search);

    if (activeFilter === 'Todos') return matchesSearch;
    if (activeFilter === 'Empresas') return matchesSearch && (client.tipo_cliente === 'Empresa' || client.tipo_cliente === 'EMPRESA');
    if (activeFilter === 'Particulares' || activeFilter === 'Casual') return matchesSearch && (client.tipo_cliente === 'Casual' || client.tipo_cliente === 'Particular');
    if (activeFilter === 'Fijo') return matchesSearch && client.tipo_cliente === 'Fijo';
    
    return matchesSearch;
  });

  return (
    <div className="d-flex flex-column gap-4 pb-5">
      
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

      <div className="row g-3 flex-nowrap flex-md-wrap overflow-x-auto pb-2 pb-md-0 scrollbar-none">
        <div className="col-9 col-sm-6 col-xl-3 flex-shrink-0 flex-md-shrink-1">
          <Card className="h-100 p-3 shadow-sm border-0 rounded-4">
            <div className="d-flex align-items-start justify-content-between mb-2">
              <span className="text-secondary fw-bold text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>TOTAL CLIENTES</span>
              <div className="text-success"><Users size={18} /></div>
            </div>
            <div>
              <h3 className="fw-bold text-dark m-0 fs-3">{clients.length}</h3>
              <span className="badge mt-2 fw-medium bg-success-subtle text-success d-inline-flex align-items-center gap-1 border border-success-subtle px-2 py-1">Registrados en sistema</span>
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
                {clients.filter(c => c.tipo_cliente === 'Empresa' || c.tipo_cliente === 'EMPRESA' || c.tipo_cliente === 'Fijo').length}
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
                {clients.filter(c => c.tipo_cliente === 'Casual').length}
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
        <div className="input-group bg-white rounded-pill px-3 py-2 border shadow-sm flex-grow-1" style={{ maxWidth: '300px' }}>
          <span className="input-group-text bg-transparent border-0 text-secondary p-0 me-2"><Search size={18} /></span>
          <input 
            type="text" 
            className="form-control bg-transparent border-0 shadow-none text-dark small p-0"
            placeholder="Buscar por nombre, teléfono..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="d-flex align-items-center gap-2 overflow-x-auto pb-1 pb-lg-0 scrollbar-none w-100 w-lg-auto flex-grow-1">
          {['Todos', 'Empresas', 'Fijo', 'Casual'].map((filter) => {
            let count = 0;
            if (filter === 'Todos') count = clients.length;
            if (filter === 'Empresas') count = clients.filter(c => c.tipo_cliente === 'Empresa' || c.tipo_cliente === 'EMPRESA').length;
            if (filter === 'Fijo') count = clients.filter(c => c.tipo_cliente === 'Fijo').length;
            if (filter === 'Casual') count = clients.filter(c => c.tipo_cliente === 'Casual').length;

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
                {filter} ({count})
              </button>
            )
          })}
        </div>
        
        <select className="form-select bg-white rounded-pill border shadow-sm text-secondary small py-2 w-auto flex-shrink-0">
          <option>Ordenar: Más recientes</option>
          <option>Ordenar: Alfabético</option>
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
            
            const statusText = client.estado || 'Activo';
            const statusBadge = statusText.includes('Pendiente') ? 'bg-danger-subtle text-danger border-danger-subtle' : 'bg-success-subtle text-success border-success-subtle';
            const statusDot = statusText.includes('Pendiente') ? 'bg-danger' : 'bg-success';
            
            const ClientIcon = getClientIcon(client.tipo_cliente);
            const cardBgColor = getClientColor(client.tipo_cliente);
            const cardTextColor = getClientTextColor(client.tipo_cliente);

            return (
              <div key={client.id_cliente || client.telefono} className="col-12 col-md-6 col-xl-4">
                <Card className="h-100 p-4 shadow-sm border-0 rounded-4 d-flex flex-column justify-between bg-white">
                  
                  <div className="d-flex align-items-start gap-3 mb-3">
                    <div className={`rounded-3 d-flex align-items-center justify-content-center fw-bold fs-5 flex-shrink-0 ${cardTextColor}`}
                         style={{ width: '48px', height: '48px', backgroundColor: cardBgColor }}>
                      {initials}
                    </div>
                    <div className="flex-grow-1 overflow-hidden mt-1">
                      <div className="d-flex justify-content-between align-items-start">
                        <h5 className="fw-bold text-dark m-0 fs-5 text-truncate" title={fullName}>{fullName}</h5>
                        <button className="btn btn-sm btn-link text-secondary p-0 m-0"><MoreVertical size={18} /></button>
                      </div>
                      <p className="text-secondary small m-0 text-truncate">{client.razon_social || 'Cliente Estándar'}</p>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2 mb-3">
                    <span className="badge bg-light text-secondary border rounded-pill px-2 py-1 small fw-medium d-flex align-items-center gap-1">
                      <ClientIcon size={12}/> {client.tipo_cliente}
                    </span>
                    <span className={`badge rounded-pill px-2 py-1 small border ${statusBadge} d-flex align-items-center gap-1`}>
                      <div className={`rounded-circle ${statusDot}`} style={{width: 6, height: 6}}></div> {statusText}
                    </span>
                    <div className="ms-auto d-flex align-items-center gap-1 text-warning small fw-bold">
                      <Star size={14} fill="currentColor" />
                      <span className="text-dark">{Number(client.calificacion_promedio || 0).toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="d-flex flex-column gap-2 text-secondary small mb-4">
                    <div className="d-flex align-items-center gap-2"><Phone size={16} /> <span>{client.telefono}</span></div>
                    {client.email && (
                      <div className="d-flex align-items-center gap-2"><Mail size={16} /> <span className="text-truncate" title={client.email}>{client.email}</span></div>
                    )}
                  </div>

                  <div className="row g-0 mb-4 bg-light rounded-3 border overflow-hidden">
                    <div className="col-5 p-2 px-3 border-end">
                      <span className="text-secondary d-block fw-semibold mb-1" style={{ fontSize: '0.65rem' }}>Inmuebles</span>
                      <span className="fw-bold text-dark small d-flex align-items-center gap-1 text-truncate">
                        <Building2 size={14} className="text-secondary" /> - vinculados
                      </span>
                    </div>
                    <div className="col-7 p-2 px-3">
                      <span className="text-secondary d-block fw-semibold mb-1" style={{ fontSize: '0.65rem' }}>Próximo servicio</span>
                      <div className="d-flex flex-column">
                        <span className="fw-bold text-dark small d-flex align-items-center gap-1 text-truncate">
                          <Calendar size={14} className="text-secondary" /> Sin agendar
                        </span>
                        <span className="text-secondary text-truncate mt-1" style={{ fontSize: '0.75rem' }}>---</span>
                      </div>
                    </div>
                  </div>

                  <Button 
                    onClick={() => navigate(`/clients/${client.telefono}/inmuebles`)}
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
    </div>
  );
}