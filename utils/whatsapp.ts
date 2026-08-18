export interface ComprobanteWhatsApp {
  phone: string;
  text: string;
  pdfBlob: Blob;
  pdfFilename: string;
  xmlContent?: string;
  xmlFilename?: string;
}

export interface EnvioWhatsAppResult {
  status: 'shared' | 'fallback' | 'cancelled' | 'error';
  waUrl?: string;
}

export const esCelularValido = (phone: string): boolean => /^9\d{8}$/.test(phone || '');

const TIPO_LABEL: Record<string, string> = {
  factura: 'factura',
  boleta: 'boleta',
  nota_credito: 'nota de crédito',
  nota_debito: 'nota de débito',
  rh: 'recibo por honorarios',
};

export const construirMensajeComprobante = (opts: {
  tipo: string;
  serieNumero: string;
  cliente: string;
  monto: number;
  currency?: string;
}): string => {
  const symbol = opts.currency === 'USD' ? '$' : 'S/';
  const tipo = TIPO_LABEL[opts.tipo] || 'comprobante';
  const cliente = opts.cliente ? ` ${opts.cliente}` : '';
  return `Hola${cliente}, le enviamos su ${tipo} ${opts.serieNumero} por ${symbol} ${opts.monto.toFixed(2)}. FinanzaFacil.`;
};

const descargarFile = (file: File) => {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const enviarComprobanteWhatsApp = async (opts: ComprobanteWhatsApp): Promise<EnvioWhatsAppResult> => {
  const files: File[] = [];
  files.push(new File([opts.pdfBlob], opts.pdfFilename, { type: 'application/pdf' }));
  if (opts.xmlContent && opts.xmlFilename) {
    files.push(new File([opts.xmlContent], opts.xmlFilename, { type: 'application/xml' }));
  }

  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (typeof nav.canShare === 'function') {
    let canShareFiles = false;
    try {
      canShareFiles = nav.canShare({ files });
    } catch {}
    if (canShareFiles) {
      try {
        await nav.share({ files, text: opts.text });
        return { status: 'shared' };
      } catch (err: any) {
        if (err && (err.name === 'AbortError' || err.name === 'Abort')) return { status: 'cancelled' };
      }
    }
  }

  files.forEach(descargarFile);
  const waUrl = `https://wa.me/51${opts.phone.replace(/\D/g, '')}?text=${encodeURIComponent(opts.text)}`;
  return { status: 'fallback', waUrl };
};

export const generarLinkSoportePago = (opts: {
  packageName?: string;
  amount?: number;
  userName?: string;
  userEmail?: string;
  supportPhone?: string;
}): string => {
  const phone = (opts.supportPhone || '999888777').replace(/\D/g, '');
  const cleanPhone = phone.startsWith('51') ? phone : `51${phone}`;
  const plan = opts.packageName || 'Suscripción';
  const amountStr = opts.amount !== undefined ? ` (S/ ${opts.amount.toFixed(2)})` : '';
  const email = opts.userEmail ? ` [Email: ${opts.userEmail}]` : '';
  const text = `Hola Soporte FinanzaFacil, mi solicitud de pago para el ${plan}${amountStr}${email} fue rechazada. Quisiera ayuda para solucionar la activación de mi cuenta.`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
};
