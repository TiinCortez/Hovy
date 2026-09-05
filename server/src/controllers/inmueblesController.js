import { supabaseAdmin } from "../config/supabase.js";

// Función auxiliar para geocodificar con Nominatim
const geocodificarDireccion = async (direccion, provincia, barrio) => {
  try {
    // Armamos la consulta combinando calle/número, barrio y ciudad
    const busqueda = `${direccion}, ${provincia || ''},${barrio || ''}, Argentina`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(busqueda)}&limit=1`;

    const respuesta = await fetch(url, {
      headers: {
        // Nominatim requiere obligatoriamente un User-Agent identificatorio
        'User-Agent': 'ValleArmoniaBackend/1.0 (contacto@vallearmonia.com)'
      }
    });

    const data = await respuesta.json();

    if (data && data.length > 0) {
      return {
        latitud: parseFloat(data[0].lat),
        longitud: parseFloat(data[0].lon)
      };
    }

    // Si no encontró resultados exactos, retornamos null
    return { latitud: null, longitud: null };
  } catch (error) {
    console.error("Error al consultar Nominatim:", error.message);
    return { latitud: null, longitud: null };
  }
};

export const getInmuebles = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('inmuebles')
      .select('*');

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    res.status(200).json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

// POST /api/inmuebles
export const createInmueble = async (req, res) => {
  try {
    const {
      id_cliente,
      provincia,
      barrio,
      manzana,
      lote,
      direccion,
      tipo_inmueble,
      superficie_total,
      superficie_construida,
      superficie_mantenible,
      estado_vegetacion,
      altura_cesped_cm,
      tiempo_promedio_min,
      // Si el frontend ya manda lat/long las usamos 
      latitud: latManual,
      longitud: lonManual
    } = req.body;
    // Validación lógica de superficies
    if (
      superficie_construida !== undefined &&
      superficie_total !== undefined &&
      Number(superficie_construida) > Number(superficie_total)
    ) {
      return res.status(400).json({
        ok: false,
        error: "La superficie construida no puede ser mayor a la superficie total"
      });
    }
    // Validación básica de campos obligatorios
    if (!id_cliente || !direccion || !tipo_inmueble || !provincia || !barrio) {
      return res.status(400).json({
        ok: false,
        error: "id_cliente, direccion, tipo_inmueble, provincia y barrio son campos obligatorios"
      });
    }

    let latitud = latManual;
    let longitud = lonManual;

    // Si el frontend no mandó coordenadas manuales, consultamos a Nominatim
    if (!latitud || !longitud) {
      const coords = await geocodificarDireccion(direccion, provincia, barrio);
      latitud = coords.latitud;
      longitud = coords.longitud;
    }

    // Insertar el nuevo inmueble en Supabase
    const { data, error } = await supabaseAdmin
      .from('inmuebles')
      .insert([
        {
          id_cliente,
          provincia,
          barrio,
          manzana,
          lote,
          direccion,
          tipo_inmueble,
          superficie_total,
          superficie_construida,
          superficie_mantenible,
          estado_vegetacion,
          altura_cesped_cm,
          tiempo_promedio_min,
          latitud,
          longitud
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.status(201).json({
      ok: true,
      data,
      coordenadasObtenidas: Boolean(latitud && longitud)
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

