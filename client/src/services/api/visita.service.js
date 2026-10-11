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

  // Contactada -> Confirmada: { tipo_inmueble, superficie_total, provincia, tipo_cliente? }
  confirmar: async (idSolicitud, payload) => {
    const response = await httpService.post(`/visitas/${idSolicitud}/confirmar`, payload);
    return response.data;
  },

  // Replaces the visit's service set: servicios = [{ id_servicio, superficie_m2 }]
  setServicios: async (idSolicitud, servicios) => {
    const response = await httpService.put(`/visitas/${idSolicitud}/servicios`, { servicios });
    return response.data;
  },

  // Internal estimate (never shown to the client)
  getEstimado: async (idSolicitud) => {
    const response = await httpService.get(`/visitas/${idSolicitud}/estimado`);
    return response.data;
  },

  // Accepts the final price: { monto_total, nota? }
  aceptarPresupuesto: async (idSolicitud, payload) => {
    const response = await httpService.post(`/visitas/${idSolicitud}/presupuesto`, payload);
    return response.data;
  },

  // Confirmada -> Cancelada
  cancelar: async (idSolicitud) => {
    const response = await httpService.post(`/visitas/${idSolicitud}/cancelar`);
    return response.data;
  },

  // params: { fecha?, desde?, hasta?, dias?, limite? } -> data: [{ fecha, disponibles: [{ inicio_desde, hasta }] }]
  getDisponibilidad: async (idSolicitud, params) => {
    const response = await httpService.get(`/visitas/${idSolicitud}/disponibilidad`, { params });
    return response.data;
  },

  // { fecha_programada, prioridad, inicio_desde?, hasta? } (Confirmada -> Realizada)
  agendarTurno: async (idSolicitud, payload) => {
    const response = await httpService.post(`/visitas/${idSolicitud}/turno`, payload);
    return response.data;
  },

  // Botón "Contactar": Pendiente -> Contactada
  contactar: async (idSolicitud) => {
    const response = await httpService.patch(`/visitas/${idSolicitud}/contactar`);
    return response.data;
  },
};

export default VisitaService;
