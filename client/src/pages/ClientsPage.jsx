import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Building2, 
  CheckCircle2, 
  Clock, 
  Search, 
  SlidersHorizontal, 
  Download, 
  UserPlus, 
  Phone, 
  Mail, 
  Star, 
  ChevronRight, 
  MoreVertical,
  Calendar,
  Home,
  ChevronDown
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import NewClientModal from '../components/ui/NewClientModal';
import { supabase } from '../services/supaBaseClient';

export default function ClientsPage() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para datos reales y modal
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Cargar clientes desde la base de datos Supabase
  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error al cargar clientes:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleClientCreated = (newClient) => {
    setClients(prev => [newClient, ...prev]);
  };

  const kpis = [
    { title: 'TOTAL CLIENTES', value: clients.length.toString(), badge: 'Base Activa', badgeType: 'success', icon: Users },
    { title: 'INMUEBLES ACTIVOS', value: '86', detail: 'Fincas gestionadas', icon: Building2 },
    { title: 'CLIENTES AL DÍA', value: clients.length.toString(), badge: '100% cartera', badgeType: 'success', icon: CheckCircle2 },
    { title: 'PAGOS PENDIENTES', value: '0', badge: '$0 ARS', badgeType: 'warning', icon: Clock }
  ];

  const filteredClients = clients.filter(client => {
    const fullName = `${client.nombre || ''} ${client.apellido || ''}`.toLowerCase();
    const razonSocial = (client.razon_social || '').toLowerCase();
    const search = searchTerm.toLowerCase();

    const matchesSearch = fullName.includes(search) || 
                          razonSocial.includes(search) || 
                          (client.telefono || '').includes(search);

    if (activeFilter === 'Todos') return matchesSearch;
    if (activeFilter === 'Empresas') return matchesSearch && client.tipo_cliente === 'Empresa';
    if (activeFilter === 'Particulares') return matchesSearch && (client.tipo_cliente === 'Casual' || client.tipo_cliente === 'Fijo');
    return matchesSearch;
  });

  return (
    <div className="d-flex flex-column gap-4 pb-5">
      
      {/* 1. Header de Sección */}
      <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-light text-success fw-semibold text-uppercase px-2 py-1" style={{ fontSize: '0.7rem' }}>
              Directorio Operativo
            </span>
            <span className="rounded-circle bg-secondary d-inline-block" style={{ width: '4px', height: '4px' }}></span>
            <span className="text-secondary small fw-medium">Temporada 2026</span>
          </div>
          <h2 className="fw-bold fs-2 text-dark m-0">Clientes</h2>
          <p className="text-secondary small m-0">Directorio general de clientes y gestión integral de inmuebles vinculados.</p>
        </div>

        {/* Acciones del Header */}
        <div className="d-flex align-items-center gap-2 w-100 w-md-auto overflow-x-auto pb-1 pb-md-0">
          <Button variant="outline-primary" className="btn-sm text-nowrap rounded-3 bg-white">
            <Download size={16} /> Exportar (.csv)
          </Button>
          <Button variant="outline-primary" className="btn-sm text-nowrap rounded-3 bg-white">
            <SlidersHorizontal size={16} /> Filtros
          </Button>
          {/* Conexión para abrir el Modal */}
          <Button 
            variant="primary" 
            className="btn-sm text-nowrap rounded-3 ms-auto ms-md-0"
            onClick={() => setIsModalOpen(true)}
          >
            <UserPlus size={16} /> + Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* 2. Tarjetas KPI */}
      <div className="row g-3 flex-nowrap flex-md-wrap overflow-x-auto pb-2 pb-md-0 scrollbar-none">
        {kpis.map((kpi, index) => {
          const IconComponent = kpi.icon;
          return (
            <div key={index} className="col-9 col-sm-6 col-xl-3 flex-shrink-0 flex-md-shrink-1">
              <Card className="h-100 p-3 shadow-sm border-0">
                <div className="d-flex align-items-start justify-content-between mb-2">
                  <span className="text-secondary fw-bold text-uppercase" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                    {kpi.title}
                  </span>
                  <div className="p-2 rounded-3 bg-light text-success d-flex align-items-center justify-content-center">
                    <IconComponent size={18} />
                  </div>
                </div>
                <div>
                  <h3 className="fw-bold text-dark m-0 fs-3">{kpi.value}</h3>
                  {kpi.badge && (
                    <span className={`badge mt-2 fw-semibold ${kpi.badgeType === 'warning' ? 'bg-warning text-dark' : 'bg-success-subtle text-success'}`}>
                      {kpi.badge}
                    </span>
                  )}
                  {kpi.detail && (
                    <p className="text-secondary small m-0 mt-2">{kpi.detail}</p>
                  )}
                </div>
              </Card>
            </div>
          );
        })}
      </div>

      {/* 3. Filtros y Búsqueda */}
      <Card className="p-2 p-md-3 shadow-sm border-0">
        <div className="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center justify-content-between gap-3">
          <div className="input-group bg-light rounded-4 px-3 py-1 border-0 flex-grow-1">
            <span className="input-group-text bg-transparent border-0 text-secondary p-0 me-2">
              <Search size={18} />
            </span>
            <input 
              type="text" 
              className="form-control bg-transparent border-0 shadow-none text-dark small"
              placeholder="Buscar por nombre, apellido, empresa, teléfono..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="d-flex align-items-center gap-2 overflow-x-auto pb-1 pb-lg-0 scrollbar-none">
            {['Todos', 'Empresas', 'Particulares'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`btn btn-sm rounded-pill text-nowrap px-3 py-1 font-semibold ${
                  activeFilter === filter 
                    ? 'btn-primary' 
                    : 'btn-light text-secondary border'
                }`}
                style={{ fontSize: '0.8rem' }}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* 4. Grid de Tarjetas de Clientes Reales */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Cargando clientes...</span>
          </div>
        </div>
      ) : filteredClients.length === 0 ? (
        <Card className="p-5 text-center border-0 shadow-sm">
          <p className="text-secondary m-0">No se encontraron clientes registrados.</p>
        </Card>
      ) : (
        <div className="row g-3">
          {filteredClients.map((client) => {
            const initials = `${client.nombre?.[0] || ''}${client.apellido?.[0] || ''}`.toUpperCase() || 'CL';
            const fullName = `${client.nombre} ${client.apellido}`;
            const clientSubtitle = client.razon_social || client.tipo_cliente;

            return (
              <div key={client.id || client.telefono} className="col-12 col-md-6 col-xl-4">
                <Card className="h-100 p-3 shadow-sm border-0 d-flex flex-column justify-between">
                  <div>
                    <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
                      <div className="d-flex align-items-center gap-3">
                        <div 
                          className="rounded-3 d-flex align-items-center justify-content-center fw-bold text-success"
                          style={{ width: '44px', height: '44px', backgroundColor: '#cbecc1' }}
                        >
                          {initials}
                        </div>
                        <div>
                          <h5 className="fw-bold text-dark m-0 fs-6">{fullName}</h5>
                          <p className="text-secondary small m-0 text-truncate" style={{ maxWidth: '180px' }}>
                            {clientSubtitle}
                          </p>
                        </div>
                      </div>
                      <button className="btn btn-sm btn-link text-secondary p-0">
                        <MoreVertical size={18} />
                      </button>
                    </div>

                    <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
                      <span className="badge bg-light text-secondary border rounded-pill px-2 py-1 small">
                        {client.tipo_cliente}
                      </span>
                      <span className="badge rounded-pill px-2 py-1 small bg-success-subtle text-success">
                        Activo
                      </span>
                      <div className="ms-auto d-flex align-items-center gap-1 text-warning small fw-bold">
                        <Star size={14} fill="#ffc107" />
                        <span className="text-dark">{(client.calificacion_promedio || 0).toFixed(1)}</span>
                      </div>
                    </div>

                    <div className="p-2 rounded-3 bg-light mb-3 d-flex flex-column gap-1">
                      <div className="d-flex align-items-center gap-2 text-secondary small">
                        <Phone size={14} />
                        <span className="text-dark fw-medium">+{client.telefono}</span>
                      </div>
                      {client.email && (
                        <div className="d-flex align-items-center gap-2 text-secondary small">
                          <Mail size={14} />
                          <span className="text-dark fw-medium text-truncate">{client.email}</span>
                        </div>
                      )}
                    </div>

                    <div className="row g-2 mb-3">
                      <div className="col-6">
                        <div className="p-2 rounded-3 bg-light">
                          <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Inmuebles</span>
                          <span className="fw-bold text-dark small d-flex align-items-center gap-1 mt-1">
                            <Home size={14} className="text-success" /> Ver Ficha
                          </span>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="p-2 rounded-3 bg-light">
                          <span className="text-secondary d-block" style={{ fontSize: '0.7rem' }}>Próximo servicio</span>
                          <span className="fw-bold text-dark small d-flex align-items-center gap-1 mt-1 text-truncate">
                            <Calendar size={14} className="text-success" /> Sin agendar
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => navigate(`/clients/${client.id || client.telefono}/inmuebles`)}
                    className="btn btn-light w-100 rounded-3 text-success fw-bold small d-flex align-items-center justify-content-center gap-2 py-2 mt-2"
                  >
                    Ver Inmuebles & Ficha <ChevronRight size={16} />
                  </button>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Footer / Paginación */}
      <div className="d-flex flex-column flex-sm-row align-items-center justify-between gap-3 pt-3 border-top">
        <span className="text-secondary small">
          Mostrando <strong className="text-dark">{filteredClients.length}</strong> clientes
        </span>
      </div>

      {/* Modal de Nuevo Cliente */}
      <NewClientModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onClientCreated={handleClientCreated}
      />

    </div>
  );
}