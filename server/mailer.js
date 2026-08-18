const nodemailer = require('nodemailer');

const DEFAULT_FROM = 'buzon@finanzafacil.com';

// Devuelve un transporte de correo.
// Prefiere sendmail local (equivalente a mail() de PHP, sin credenciales).
// Si no hay sendmail y existen EMAIL_USER/EMAIL_PASS, cae a SMTP.
// En desarrollo sin servidor de correo, retorna null y el envío se loguea.
function createTransport() {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const port = parseInt(process.env.EMAIL_PORT || '465');
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
      port: port,
      secure: port === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
  if (process.env.EMAIL_USE_SENDMAIL === 'true') {
    return nodemailer.createTransport({
      sendmail: true,
      newline: 'unix',
      path: process.env.EMAIL_SENDMAIL_PATH || '/usr/sbin/sendmail'
    });
  }
  return null;
}

// Envía un correo. Devuelve { sent: boolean, warning?: string }.
// Si no hay transporte disponible (dev sin correo), loguea y no falla.
async function sendEmail({ to, subject, html, from }) {
  const transporter = createTransport();
  if (!transporter) {
    return { sent: false, warning: 'No hay transporte de correo configurado (sendmail no disponible ni credenciales SMTP).' };
  }
  try {
    await transporter.sendMail({
      from: from || `"FinanzaFacil" <${process.env.EMAIL_FROM || DEFAULT_FROM}>`,
      to,
      subject,
      html
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, warning: err.message };
  }
}

module.exports = { sendEmail, DEFAULT_FROM };
