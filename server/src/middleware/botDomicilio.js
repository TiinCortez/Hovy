import { geocodificarCoordenadas } from '../services/geocodingService.js';
import { normalizarCoordenadas, ERROR_COORDENADAS_INVALIDAS } from '../utils/coordenadas.js';

// Traduce el pin de ubicación de WhatsApp a un domicilio fiscal escrito.
//
// El cliente que se está dando de alta por el bot no tipea su domicilio: manda
// la ubicación exacta desde donde está parado y n8n reenvía esa latitud/longitud
// en el body. Este middleware la resuelve contra Nominatim y deja en
// req.body.domicilio_fiscal un único string "Calle, Barrio, Provincia", que es
// el formato que espera la columna (es texto libre, no tres campos como en
// inmuebles).
//
// Va como middleware y no adentro de un controller propio del bot justamente
// para no tener uno: las rutas /api/bot/clientes reusan createCliente y
// updateCliente del canal web tal cual, y esos controllers siguen sin saber que
// existen las coordenadas. La latitud y la longitud que quedan en el body no
// molestan porque ambos destructuran solo los campos que conocen.
//
// A diferencia del pin en inmuebles, acá las coordenadas NO se guardan: la tabla
// clientes no tiene columnas para ellas y lo que interesa es la dirección.

const ERROR_COORDENADAS_INCOMPLETAS =
  'latitud y longitud tienen que venir juntas: con una sola no se puede resolver el domicilio.';

const vinoElDato = (valor) =>
  valor !== undefined && valor !== null && String(valor).trim() !== '';

export const resolverDomicilioFiscal = async (req, res, next) => {
  const body = req.body ?? {};

  const vinoLatitud = vinoElDato(body.latitud);
  const vinoLongitud = vinoElDato(body.longitud);

  // Sin pin no hay nada que resolver: el alta sigue como siempre, con el
  // domicilio_fiscal que haya venido escrito (o sin ninguno, que es válido).
  if (!vinoLatitud && !vinoLongitud) return next();

  // Media coordenada es un error del workflow armando el body, no algo que el
  // cliente pueda corregir contestando otra cosa.
  if (vinoLatitud !== vinoLongitud) {
    return res.status(400).json({ ok: false, error: ERROR_COORDENADAS_INCOMPLETAS });
  }

  const coordenadas = normalizarCoordenadas(body.latitud, body.longitud);

  if (!coordenadas) {
    return res.status(400).json({ ok: false, error: ERROR_COORDENADAS_INVALIDAS });
  }

  // Si además mandaron el domicilio escrito, ese gana: es lo que el cliente
  // confirmó en la conversación, y la geocodificación inversa es una
  // aproximación al punto. Igual validamos las coordenadas arriba para que un
  // pin mal armado no pase silencioso.
  if (vinoElDato(body.domicilio_fiscal)) return next();

  try {
    const { direccion, barrio, provincia } = await geocodificarCoordenadas(coordenadas);

    // filter(Boolean) y no un template literal: cuando Nominatim no devuelve el
    // barrio, el string tiene que quedar "Calle, Provincia" y no "Calle, ,
    // Provincia".
    const domicilio = [direccion, barrio, provincia].filter(Boolean).join(', ');

    // Nominatim caído o un punto en el medio del campo no pueden frenar el alta:
    // domicilio_fiscal es nullable, así que el cliente se crea igual y el bot ve
    // el campo en null en la respuesta para pedir la dirección a mano y
    // completarla después con el PUT.
    if (domicilio) {
      req.body.domicilio_fiscal = domicilio;
    }

    return next();
  } catch (err) {
    console.error('Error inesperado al resolver el domicilio fiscal:', err);
    return next();
  }
};
