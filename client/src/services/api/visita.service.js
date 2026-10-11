import httpService from './http.service';

const VisitaService = {
  // Todas las solicitudes en cualquier estado (sin filtro); más nuevas primero
  getAll: async () => {
    const response = await httpService.get('/visitas');
    return response.data;
  },

  // Solicitudes de visita pendientes: son las que alimentan el panel de notificaciones
  getPendientes: async () => {
    const response = await httpService.get('/visitas', { params: { estado: 'Pendiente' } });
    return response.data;
  },

  // Detalle completo de una solicitud (página "Ver detalles")
  getById: async (idSolicitud) => {
    const response = await httpService.get(`/visitas/${idSolicitud}`);
    return response.data;
  },

  // Botón "Contactar": Pendiente -> Contactada
  contactar: async (idSolicitud) => {
    const response = await httpService.patch(`/visitas/${idSolicitud}/contactar`);
    return response.data;
  },
};

export default VisitaService;
