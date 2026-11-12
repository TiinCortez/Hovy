import httpService from './http.service';

const NotificacionService = {
  // Activas (el server sincroniza antes de responder): campana y Dashboard
  getActivas: async () => {
    const response = await httpService.get('/notificaciones');
    return response.data;
  },

  // Resueltas y Canceladas de los últimos 60 días
  getHistorial: async () => {
    const response = await httpService.get('/notificaciones/historial');
    return response.data;
  },

  // X + confirmación: Activa -> Cancelada
  cancelar: async (idNotificacion) => {
    const response = await httpService.patch(`/notificaciones/${idNotificacion}/cancelar`);
    return response.data;
  },

  // Historial: Cancelada -> Activa
  restaurar: async (idNotificacion) => {
    const response = await httpService.patch(`/notificaciones/${idNotificacion}/restaurar`);
    return response.data;
  },
};

export default NotificacionService;
