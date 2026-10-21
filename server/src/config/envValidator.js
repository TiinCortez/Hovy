/**
 * Validador de Variables de Entorno - Hovy API
 * 
 * Se ejecuta al iniciar el servidor para verificar que las configuraciones críticas
 * existan antes de atender peticiones, evitando caídas silenciosas o errores 500 en runtime.
 */

export function validarVariablesEntorno() {
  const faltantesObligatorias = [];
  const advertencias = [];

  // 1. Variables Críticas (Obligatorias para el funcionamiento del backend)
  if (!process.env.SUPABASE_URL) {
    faltantesObligatorias.push('SUPABASE_URL (URL del proyecto Supabase)');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    faltantesObligatorias.push('SUPABASE_SERVICE_ROLE_KEY (Service Role Secret para administración)');
  }

  // 2. Variables de Seguridad
  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      faltantesObligatorias.push('JWT_SECRET (Secreto para firmar tokens JWT en producción)');
    } else {
      advertencias.push('JWT_SECRET no está definida. Se utilizará un secreto por defecto solo para desarrollo.');
    }
  }

  // 3. Variables de Integración (Opcionales / Advertencias)
  if (!process.env.BOT_API_KEY) {
    advertencias.push('BOT_API_KEY no está configurada. Las llamadas del bot de WhatsApp (n8n) serán rechazadas.');
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.EMAIL_FROM) {
    advertencias.push('SMTP_HOST, SMTP_USER, SMTP_PASS o EMAIL_FROM no están configurados. El envío de correos (recuperación de contraseña / bienvenidas) fallará.');
  }

  // Cobros con Mercado Pago (opcionales: solo se advierte). MERCADOPAGO_PAYMENT_RETURN_URL es opcional.
  if (!process.env.MERCADOPAGO_PUBLIC_BASE_URL || !process.env.MERCADOPAGO_WEBHOOK_SECRET) {
    advertencias.push('MERCADOPAGO_PUBLIC_BASE_URL o MERCADOPAGO_WEBHOOK_SECRET no están configuradas. No se podrán generar cobros ni confirmar pagos por webhook.');
  }

  // Si faltan variables críticas, detener el arranque con un mensaje claro y educativo
  if (faltantesObligatorias.length > 0) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ ERROR FATAL: Faltan variables de entorno requeridas en el backend');
    console.error('='.repeat(70));
    faltantesObligatorias.forEach((v) => console.error(`   • ${v}`));
    console.error('\n👉 SOLUCIÓN PARA DESARROLLADORES:');
    console.error('   1. Asegurate de tener el archivo "server/.env" creado.');
    console.error('   2. Podés guiarte copiando la plantilla:');
    console.error('      cp server/.env.example server/.env');
    console.error('   3. Completá las credenciales de Supabase del entorno que vayas a usar.\n');
    console.error('='.repeat(70) + '\n');

    process.exit(1);
  }

  // Si hay advertencias pero no son críticas, mostrarlas en amarillo
  if (advertencias.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn('\n⚠️  ADVERTENCIAS DE CONFIGURACIÓN (.env):');
    advertencias.forEach((adv) => console.warn(`   • ${adv}`));
    console.warn('');
  }
}
