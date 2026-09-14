// Envío de emails transaccionales (código de verificación / recuperación).
//
// Esta es la única capa que sabe que el envío se hace con Nodemailer/SMTP. Si
// más adelante se migra a un proveedor tipo Resend, el cambio queda contenido
// acá adentro: se reemplaza el transporter y el cuerpo de enviarEmail, y el
// resto del backend (templates, controllers) no se entera.

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE !== 'false',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const enviarEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
};
