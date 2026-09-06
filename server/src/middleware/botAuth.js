import crypto from 'crypto';

// Creacion de la X-API-KEY (autenticacion) para el futuro bot (n8n) que va a interactuar con la APP.

// Esta implementacion es aparte del JWT del usuario.
// Se realiza para que el bot pueda interactuar con la api, siempre validando la persona por su numero de telefono.
// Y validando el token que tiene asignado el bot con el backend con un secreto compartido (X-API-KEY).

const HEADER = 'x-api-key';

export const verificarApiKeyBot = (req, res, next) => {
  const esperada = process.env.BOT_API_KEY;
  
  // Condicion de error por si la key no esta configurada.
  if (!esperada) {
    console.error('BOT_API_KEY no está definida. Revisar el .env del server.');
    return res.status(500).json({
      ok: false,
      error: 'El servidor no tiene configurada la autenticación del bot.',
    });
  }

  const recibida = req.get(HEADER);

  if (!recibida) {
    return res.status(401).json({
      ok: false,
      error: `Falta el header ${HEADER}.`,
    });
  }

  // Comparación en tiempo constante. Con === el bucle sale en el primer
  // carácter distinto, así que midiendo cuánto tarda la respuesta se puede
  // adivinar la key carácter por carácter. timingSafeEqual siempre tarda lo
  // mismo, pero exige buffers del mismo largo: si difieren, ya sabemos que no
  // coincide.
  const bufRecibida = Buffer.from(recibida);
  const bufEsperada = Buffer.from(esperada);

  const coincide =
    bufRecibida.length === bufEsperada.length &&
    crypto.timingSafeEqual(bufRecibida, bufEsperada);

  if (!coincide) {
    // Nunca logeamos la key (ni cuando la recibimos, ni cuando la esperamos).
    return res.status(403).json({
      ok: false,
      error: 'API key inválida.',
    });
  }

  next();
};
