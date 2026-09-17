// utils/horariosHelper.js
import { supabaseAdmin } from '../config/supabase.js';

export const horaAMinutos = (horaStr) => {
    if (!horaStr) return 0;
    const [h, m] = horaStr.split(':').map(Number);
    return h * 60 + m;
};

export const minutosAHora = (minutos) => {
    const h = String(Math.floor(minutos / 60)).padStart(2, '0');
    const m = String(minutos % 60).padStart(2, '0');
    return `${h}:${m}:00`;
};

/**
 * Verifica si el horario propuesto choca con CUALQUIER turno ya asignado ese día.
 * (Agenda global de la cuadrilla)
 */
export const validarSolapamientoTurno = async ({
    fecha_programada,
    inicio_desde,
    hasta,
    id_turno_a_excluir = null
}) => {
    let query = supabaseAdmin
        .from('turnos')
        .select('id_turno, inicio_desde, hasta')
        .eq('fecha_programada', fecha_programada)
        .neq('estado', 'Cancelado')
        .not('inicio_desde', 'is', null)
        .not('hasta', 'is', null)
        .lt('inicio_desde', hasta)   // ExistenteInicio < NuevoHasta
        .gt('hasta', inicio_desde);   // ExistenteHasta > NuevoInicio

    // Si estamos editando un turno existente, no lo comparamos contra sí mismo
    if (id_turno_a_excluir) {
        query = query.neq('id_turno', id_turno_a_excluir);
    }

    const { data: turnosSolapados, error } = await query;
    if (error) throw error;

    return turnosSolapados && turnosSolapados.length > 0;
};

/**
 * Recomienda horarios libres en el día considerando todos los turnos agendados
 * y sumando 1 hora (60 min) de traslado/margen al finalizar cada trabajo.
 */
export const obtenerHorariosDisponiblesHelper = async ({
    fecha_programada,
    duracionTurnoMinutos = 120, // 2 horas por defecto
    bufferMinutos = 60,         // 1 hora de viaje y margen
    jornadaInicio = '08:00:00',
    jornadaFin = '18:00:00'
}) => {
    // Traemos TODOS los turnos activos de ese día sin importar de qué inmueble sean
    const { data: turnosOcupados, error } = await supabaseAdmin
        .from('turnos')
        .select('inicio_desde, hasta')
        .eq('fecha_programada', fecha_programada)
        .neq('estado', 'Cancelado')
        .not('inicio_desde', 'is', null)
        .not('hasta', 'is', null);

    if (error) throw error;

    const inicioJornada = horaAMinutos(jornadaInicio);
    const finJornada = horaAMinutos(jornadaFin);

    // Mapeamos los turnos agregando la hora de traslado al final
    const ocupados = turnosOcupados
        .map(t => ({
            desde: horaAMinutos(t.inicio_desde),
            hastaConBuffer: horaAMinutos(t.hasta) + bufferMinutos
        }))
        .sort((a, b) => a.desde - b.desde);

    const disponibles = [];
    let cursor = inicioJornada;

    for (const turno of ocupados) {
        if (turno.desde > cursor) {
            const espacioLibre = turno.desde - cursor;
            if (espacioLibre >= duracionTurnoMinutos) {
                disponibles.push({
                    inicio_desde: minutosAHora(cursor),
                    hasta: minutosAHora(cursor + duracionTurnoMinutos)
                });
            }
        }
        if (turno.hastaConBuffer > cursor) {
            cursor = turno.hastaConBuffer;
        }
    }

    while (cursor + duracionTurnoMinutos <= finJornada) {
        disponibles.push({
            inicio_desde: minutosAHora(cursor),
            hasta: minutosAHora(cursor + duracionTurnoMinutos)
        });
        cursor += duracionTurnoMinutos + bufferMinutos;
    }

    return disponibles;
};