import { createClient } from '@supabase/supabase-js';

// Obtenemos las variables de entorno
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validamos que existan para evitar errores silenciosos en la consola
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Faltan las variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el archivo .env');
}

// Inicializamos y exportamos la instancia única del cliente de Supabase
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');