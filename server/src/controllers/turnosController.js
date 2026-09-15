import { supabaseAdmin } from '../config/supabase.js';

const PRIORIDADES_VALIDAS = ['P1_Reasignado', 'P2_Fijo', 'P3_Casual'];

export const createTurno = async (req, res) => {
    try {
        const {
            id_inmueble,
            id_presupuesto,
            fecha_programada,
            franja_horaria,
            prioridad,
            estado,
            motivo_cancelacion
        } = req.body;

        // 1. Validaciones de presencia de campos obligatorios
        if (!id_inmueble || !fecha_programada || !prioridad) {
            return res.status(400).json({
                ok: false,
                error: 'Los campos id_inmueble, fecha_programada y prioridad son obligatorios'
            });
        }

        // 2. Validación de tipos y formato
        if (isNaN(Number(id_inmueble))) {
            return res.status(400).json({
                ok: false,
                error: 'El id_inmueble debe ser un número entero'
            });
        }

        if (id_presupuesto !== undefined && id_presupuesto !== null && isNaN(Number(id_presupuesto))) {
            return res.status(400).json({
                ok: false,
                error: 'El id_presupuesto debe ser numérico o nulo'
            });
        }

        // 3. Validación de la restricción CHECK de prioridad
        if (!PRIORIDADES_VALIDAS.includes(prioridad)) {
            return res.status(400).json({
                ok: false,
                error: `Prioridad inválida. Opciones permitidas: ${PRIORIDADES_VALIDAS.join(', ')}`
            });
        }

        // 4. Validar que el inmueble exista y esté activo
        const { data: inmueble, error: errInmueble } = await supabaseAdmin
            .from('inmuebles')
            .select('id_inmueble, activo')
            .eq('id_inmueble', id_inmueble)
            .maybeSingle();

        // Validar presupuesto SOLO si fue proporcionado en el body
        if (id_presupuesto) {
            const { data: presupuesto, error: errPresupuesto } = await supabaseAdmin
                .from('presupuestos')
                .select('id_presupuesto, estado') // Traé 'estado' si tu tabla lo maneja
                .eq('id_presupuesto', id_presupuesto)
                .maybeSingle();

            if (errPresupuesto) {
                return res.status(500).json({ ok: false, error: 'Error al verificar el presupuesto' });
            }

            // 1. Verificar si existe
            if (!presupuesto) {
                return res.status(404).json({ ok: false, error: 'El presupuesto especificado no existe' });
            }

            // 2. Verificar que esté activo
            if (!presupuesto.activo) {
                return res.status(400).json({ ok: false, error: 'El presupuesto especificado no está activo' });
            }

            // 3. Si la tabla maneja estados ('Aceptado', 'Pendiente', etc.)
            if (presupuesto.estado && presupuesto.estado !== 'Aceptado') {
                return res.status(400).json({
                    ok: false,
                    error: `El presupuesto debe estar en estado 'Aceptado' (actual: ${presupuesto.estado})`
                });
            }
        }

        if (errInmueble) {
            return res.status(500).json({ ok: false, error: 'Error al verificar el inmueble' });
        }

        if (!inmueble) {
            return res.status(404).json({ ok: false, error: 'El inmueble especificado no existe' });
        }

        if (!inmueble.activo) {
            return res.status(400).json({ ok: false, error: 'No se pueden registrar turnos para un inmueble inactivo' });
        }

        // 5. Armado de payload limpio (lista blanca)
        const nuevoTurno = {
            id_inmueble: Number(id_inmueble),
            id_presupuesto: id_presupuesto ? Number(id_presupuesto) : null,
            fecha_programada,
            franja_horaria: franja_horaria || null,
            prioridad,
            estado: estado || 'Coordinado',
            motivo_cancelacion: motivo_cancelacion || null
        };

        // 6. Inserción en Supabase
        const { data, error } = await supabaseAdmin
            .from('turnos')
            .insert(nuevoTurno)
            .select()
            .single();

        if (error) {
            // Clave foránea inexistente (por ejemplo id_presupuesto no existe)
            if (error.code === '23503') {
                return res.status(400).json({ ok: false, error: 'El presupuesto asociado no existe' });
            }
            return res.status(500).json({ ok: false, error: 'Error al registrar el turno' });
        }

        return res.status(201).json({
            ok: true,
            mensaje: 'Turno registrado correctamente',
            data
        });

    } catch (err) {
        return res.status(500).json({ ok: false, error: 'Error interno del servidor' });
    }
};