// Contenido de los emails de verificación/recuperación.
//
// Todo el CSS va inline a propósito: los clientes de correo (Gmail sobre
// todo) no ejecutan <script> ni cargan hojas de estilo externas, así que
// Tailwind/Google Fonts/íconos de fuente no sirven acá — solo estilos
// inline y una tipografía del sistema. Por lo mismo, los íconos son emoji
// (📧, 🔑, 📱, 🛡️, ⏰) y no la fuente de Material Symbols.
//
// El logo del header se manda como data URI (base64) en vez de <img
// src="https://...">: así el email no depende de que un host externo esté
// arriba para que la marca se vea.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_BASE64 = fs.readFileSync(path.join(__dirname, '../assets/hovy_logo.jpg')).toString('base64');
const LOGO_DATA_URI = `data:image/jpeg;base64,${LOGO_BASE64}`;

const PALETA = {
  primary: '#2d5016',
  primaryDark: '#1e380e',
  surface: '#fef9ef',
  surfaceSoft: '#f4efe5',
  bg: '#e7f0df',
  accent: '#a34805',
  text: '#2c3327',
  muted: '#61675c',
  border: '#dce5d5',
};

const FONT_STACK = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Arma el email completo a partir del contenido específico de cada caso.
// Las 4 plantillas comparten exactamente esta estructura (header de marca,
// bloque del código, aviso de seguridad, footer) y solo cambian el ícono, el
// título, el texto de intro y el de la instrucción final — por eso el molde
// vive en un solo lugar en vez de repetirse 4 veces.
const armarEmail = ({ icono, titulo, intro, codigo, instruccion, seguridadTitulo, seguridadTexto }) => {
  const ttl = process.env.CODIGO_VERIFICACION_TTL_MIN || 15;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:24px 16px; background-color:${PALETA.bg}; font-family:${FONT_STACK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; margin:0 auto; background:${PALETA.surface}; border:1px solid ${PALETA.border}; border-radius:20px; overflow:hidden;">

    <!-- Header de marca -->
    <tr>
      <td style="background:${PALETA.primary}; padding:28px 32px; text-align:center;">
        <div style="display:inline-block; width:88px; height:88px; background:#ffffff; border-radius:50%; text-align:center; line-height:88px;">
          <img src="${LOGO_DATA_URI}" width="64" alt="Hovy" style="width:64px; height:auto; vertical-align:middle; display:inline-block;">
        </div>
        <p style="margin:12px 0 0; color:#e2ecd9; font-size:11px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase;">
          Cuidado y gestión de espacios verdes
        </p>
      </td>
    </tr>

    <!-- Contenido -->
    <tr>
      <td style="padding:36px 32px;">
        <div style="text-align:center; margin-bottom:28px;">
          <div style="font-size:32px; margin-bottom:12px;">${icono}</div>
          <h1 style="margin:0 0 8px; font-size:22px; font-weight:700; color:${PALETA.primaryDark};">${titulo}</h1>
          <p style="margin:0; color:${PALETA.muted}; font-size:14px; line-height:1.5;">${intro}</p>
        </div>

        <!-- Código -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PALETA.surfaceSoft}; border:1px solid #e2dacf; border-radius:16px;">
          <tr>
            <td style="padding:24px; text-align:center;">
              <span style="display:block; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:${PALETA.primary}; margin-bottom:14px;">
                Tu código
              </span>
              <div style="display:inline-block; background:#ffffff; border:2px solid ${PALETA.primary}; border-radius:10px; padding:14px 10px 14px 20px; font-size:28px; font-weight:700; letter-spacing:10px; color:${PALETA.primary}; font-family:${FONT_STACK};">${codigo}</div>
              <p style="margin:16px 0 0; font-size:12px; color:#8a684b;">
                ⏰ Vence en <strong style="color:${PALETA.primary};">${ttl} minutos</strong>
              </p>
            </td>
          </tr>
        </table>

        <p style="text-align:center; color:${PALETA.muted}; font-size:13px; line-height:1.5; margin:24px 0 0;">
          ${instruccion}
        </p>

        <!-- Aviso de seguridad -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px; background:rgba(255,255,255,0.6); border:1px solid #e8ece4; border-radius:12px;">
          <tr>
            <td style="padding:14px 16px; font-size:12px; color:${PALETA.muted}; line-height:1.5;">
              <strong style="display:block; color:#3c4438; margin-bottom:2px;">🛡️ ${seguridadTitulo}</strong>
              ${seguridadTexto}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background:${PALETA.surfaceSoft}; padding:20px 32px; text-align:center; border-top:1px solid #e5ded2;">
        <p style="margin:0 0 4px; font-size:13px; font-weight:600; color:${PALETA.primary};">🌿 Hovy · Espacios Verdes</p>
        <p style="margin:0; font-size:11px; color:#9ca395;">Córdoba, Argentina</p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
};

export const plantillaVerificacionEmail = (codigo) => ({
  subject: 'Verificá tu cuenta de Hovy',
  html: armarEmail({
    icono: '📧',
    titulo: 'Verificá tu cuenta',
    intro: 'Usá este código para confirmar tu email y activar tu cuenta de staff.',
    codigo,
    instruccion: 'Ingresá este código en la pantalla de verificación de la aplicación de Hovy.',
    seguridadTitulo: '¿No creaste esta cuenta?',
    seguridadTexto: 'Si no diste de alta un usuario en Hovy, ignorá este correo.',
  }),
});

export const plantillaRecuperacionPassword = (codigo) => ({
  subject: 'Recuperá tu contraseña de Hovy',
  html: armarEmail({
    icono: '🔑',
    titulo: 'Recuperá tu contraseña',
    intro: 'Usá este código para elegir una contraseña nueva.',
    codigo,
    instruccion: 'Ingresá este código en la pantalla de recuperación de contraseña.',
    seguridadTitulo: '¿No pediste este cambio?',
    seguridadTexto: 'Si no solicitaste recuperar tu contraseña, ignorá este correo: tu cuenta sigue segura.',
  }),
});

export const plantillaVerificacionEmailCliente = (codigo) => ({
  subject: 'Confirmá tu cuenta de Hovy',
  html: armarEmail({
    icono: '📧',
    titulo: '¡Bienvenido a Hovy!',
    intro: 'Estás a un paso de activar tu cuenta. Usá este código para confirmar tu email.',
    codigo,
    instruccion: 'Respondé este código por WhatsApp para confirmar tu cuenta.',
    seguridadTitulo: '¿No pediste registrarte?',
    seguridadTexto: 'Si no iniciaste un registro en Hovy por WhatsApp, ignorá este correo.',
  }),
});

export const plantillaRecuperacionTelefono = (codigo) => ({
  subject: 'Código para recuperar tu cuenta de Hovy',
  html: armarEmail({
    icono: '📱',
    titulo: 'Recuperá tu cuenta',
    intro: 'Usá este código para asociar tu cuenta a tu nuevo número de WhatsApp.',
    codigo,
    instruccion: 'Respondé este código por WhatsApp para completar el cambio de número.',
    seguridadTitulo: '¿No pediste este cambio?',
    seguridadTexto: 'Si no solicitaste recuperar tu cuenta, ignorá este correo.',
  }),
});
