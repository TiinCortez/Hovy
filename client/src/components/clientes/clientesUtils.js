// Utilidades puras del directorio de Clientes.
import { compararHorarioTurnos, formatearHoraCorta } from '../turnos/agendaTurnos.js';

export function normalizarTexto(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function obtenerClaveCliente(cliente) {
  return String(cliente?.id_cliente ?? cliente?.telefono ?? '');
}

export function obtenerNombreCliente(cliente) {
  const completo = `${cliente?.nombre || ''} ${cliente?.apellido || ''}`.trim();
  return completo || cliente?.razon_social || 'Sin nombre';
}

export function obtenerInicialesCliente(cliente) {
  const nombre = (cliente?.nombre || '').trim();
  const apellido = (cliente?.apellido || '').trim();
  if (nombre && apellido) return `${nombre[0]}${apellido[0]}`.toUpperCase();
  const fallback = obtenerNombreCliente(cliente).replace(/\s+/g, '');
  return (fallback.slice(0, 2) || 'CL').toUpperCase();
}

export function normalizarTipoCliente(tipo) {
  const limpio = String(tipo || '').trim().toLowerCase();
  if (limpio === 'empresa') return 'Empresa';
  if (limpio === 'fijo') return 'Fijo';
  return 'Casual';
}

export function esClienteInactivo(cliente) {
  return String(cliente?.estado || '').trim().toLowerCase() === 'inactivo';
}

// Formatea celulares argentinos canónicos (549 + 10 dígitos) a un formato legible.
export function formatearTelefono(telefono) {
  if (telefono === undefined || telefono === null || String(telefono).trim() === '') {
    return 'Sin teléfono';
  }
  const texto = String(telefono).trim();
  const digitos = texto.replace(/\D/g, '');

  if (digitos.startsWith('549') && digitos.length === 13) {
    const nacional = digitos.slice(3);
    // AMBA / Buenos Aires (código de área 11: 2 dígitos + 4-4)
    if (nacional.startsWith('11')) {
      return `+54 9 11 ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
    }
    // Resto del país (3 dígitos de área + 3-4, p. ej. 351, 383, 280)
    return `+54 9 ${nacional.slice(0, 3)} ${nacional.slice(3, 6)}-${nacional.slice(6)}`;
  }

  return texto;
}

export function obtenerInmueblesCliente(cliente, inmuebles = []) {
  if (!cliente?.id_cliente) return [];
  return inmuebles.filter((inm) => String(inm.id_cliente) === String(cliente.id_cliente));
}

export function obtenerProximoTurnoCliente(cliente, turnos = [], hoyIso) {
  if (!cliente) return null;
  return turnos
    .filter((t) => {
      if (!t || t.estado === 'CANCELADO' || t.estado === 'REALIZADO') return false;
      const coincideId = cliente.id_cliente && t.cliente?.id_cliente
        && String(t.cliente.id_cliente) === String(cliente.id_cliente);
      const coincideTel = cliente.telefono && t.cliente?.telefono
        && String(t.cliente.telefono) === String(cliente.telefono);
      return (coincideId || coincideTel) && t.fechaAsignada && t.fechaAsignada >= hoyIso;
    })
    .sort((a, b) => a.fechaAsignada.localeCompare(b.fechaAsignada) || compararHorarioTurnos(a, b))[0] || null;
}

export function formatearFechaCortaTurno(fechaIso) {
  if (!fechaIso || typeof fechaIso !== 'string') return null;
  const partes = fechaIso.split('-').map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return null;
  const [anio, mes, dia] = partes;
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export function formatearHoraTurno(turno) {
  const inicio = formatearHoraCorta(turno?.franjaHoraria?.horaInicio);
  return inicio ? `${inicio} hs` : null;
}

export function filtrarYOrdenarClientes(clientes, { segmento, busqueda, orden, proximosPorClave }) {
  const consulta = normalizarTexto(busqueda.trim());
  const consultaDigitos = busqueda.replace(/\D/g, '');

  const filtrados = clientes.filter((cliente) => {
    const inactivo = esClienteInactivo(cliente);
    if (segmento === 'Inactivos') {
      if (!inactivo) return false;
    } else {
      if (inactivo) return false;
      if (segmento !== 'Todos' && normalizarTipoCliente(cliente.tipo_cliente) !== segmento) {
        return false;
      }
    }

    if (!consulta) return true;

    const camposTexto = [
      obtenerNombreCliente(cliente),
      cliente.razon_social,
      cliente.email,
      cliente.telefono,
    ];
    const coincideTexto = camposTexto.some((campo) => normalizarTexto(campo).includes(consulta));
    const coincideTelefono = consultaDigitos.length >= 2
      && String(cliente.telefono || '').replace(/\D/g, '').includes(consultaDigitos);

    return coincideTexto || coincideTelefono;
  });

  return filtrados.sort((a, b) => {
    if (orden === 'az') {
      return obtenerNombreCliente(a).localeCompare(obtenerNombreCliente(b), 'es');
    }
    if (orden === 'proximo') {
      const turnoA = proximosPorClave.get(obtenerClaveCliente(a));
      const turnoB = proximosPorClave.get(obtenerClaveCliente(b));
      if (turnoA && !turnoB) return -1;
      if (!turnoA && turnoB) return 1;
      if (turnoA && turnoB) {
        const cmpFecha = turnoA.fechaAsignada.localeCompare(turnoB.fechaAsignada)
          || compararHorarioTurnos(turnoA, turnoB);
        if (cmpFecha !== 0) return cmpFecha;
      }
    }
    return new Date(b.fecha_alta || 0) - new Date(a.fecha_alta || 0);
  });
}
