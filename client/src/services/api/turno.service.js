import httpService from './http.service';

const TurnoService = {
  // Listar todos los turnos
  getAll: async () => {
    const response = await httpService.get('/turnos');
    return response.data;
  },

  // Crear un nuevo turno (Alta)
  create: async (turnoData) => {
    const response = await httpService.post('/turnos/nuevo', turnoData);
    return response.data;
  },

  // Obtener detalle de un turno específico (Consulta)
  getById: async (idTurno) => {
    const response = await httpService.get(`/turnos/${idTurno}`);
    return response.data;
  },

  // Modificar un turno existente (Modificación)
  update: async (idTurno, turnoData) => {
    const response = await httpService.put(`/turnos/${idTurno}`, turnoData);
    return response.data;
  },

  // Cancelar/Dar de baja un turno (Baja lógica)
  cancelar: async (idTurno, motivo = null) => {
    const response = await httpService.patch(`/turnos/${idTurno}/cancelar`, {
      motivo_cancelacion: motivo
    });
    return response.data;
  }
};

export default TurnoService;