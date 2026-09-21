// Normalización de emails.
//
// Mismo motivo que normalizarTelefono: `email` es UNIQUE y se usa para buscar
// cuentas (login, recuperación, verificación), y para Postgres
// "Juan@Mail.com" y "juan@mail.com" son strings distintos. Sin normalizar, un
// email cargado con mayúscula no se encuentra después escrito en minúscula (y
// hasta permitiría dos cuentas con "el mismo" email). Por eso todo email se
// pasa por acá antes de guardarlo o de buscarlo.
//
//   "  Juan.Perez@Hotmail.COM " -> "juan.perez@hotmail.com"
//
// Devuelve undefined si no vino nada, para que los handlers sigan
// distinguiendo "no mandó el campo" de "lo mandó".
export const normalizarEmail = (valor) => {
  if (valor === undefined || valor === null) return valor;
  return String(valor).trim().toLowerCase();
};
