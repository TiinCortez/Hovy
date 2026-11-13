import { createContext, useContext } from 'react';

export const AvisosContext = createContext(null);

// Avisos flotantes de toda la app (reemplazan a window.alert).
//   const { avisar } = useAvisos();
//   avisar('No se pudo guardar el cliente.');            // error: queda hasta cerrarlo
//   avisar('Cliente guardado.', { tipo: 'ok' });          // ok / aviso: se va solo
export function useAvisos() {
  const contexto = useContext(AvisosContext);
  if (!contexto) throw new Error('useAvisos necesita estar dentro de <AvisosProvider>.');
  return contexto;
}
