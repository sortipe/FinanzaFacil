import Tesseract from 'tesseract.js';
import { ReceiptData } from './geminiService';

const analyzeReceiptOCR = async (base64Image: string, mimeType: string): Promise<ReceiptData> => {
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const { data } = await Tesseract.recognize(dataUrl, 'spa+eng', {
    logger: () => {},
  });

  const text = data.text;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const result = parseReceiptText(lines, text);
  result.rawText = text;

  if (result.ruc && result.ruc.length === 11) {
    try {
      const res = await fetch(`/consultar-ruc?ruc=${result.ruc}`);
      const json = await res.json();
      if (json.success && json.razonSocial) {
        result.merchant = json.razonSocial;
      }
    } catch {}
  }

  return result;
};

function parseReceiptText(lines: string[], fullText: string): ReceiptData {
  let total = 0;
  let date = new Date().toISOString().split('T')[0];
  let merchant = '';
  let ruc = '';
  let invoiceNumber = '';
  let subtotal = 0;
  let igv = 0;
  let category = 'Otros';

  for (const line of lines) {
    const clean = line.replace(/\s+/g, ' ').trim();

    // RUC: exactly 11 digits
    const rucMatch = clean.match(/\b(\d{11})\b/);
    if (rucMatch && !ruc) {
      ruc = rucMatch[1];
    }

    // Invoice number: F001-00000001, B001-00000001, E001-000001, FA01-00000001, etc.
    const invMatch = clean.match(/\b([FBEFA]{1,2}\d{3}-\d{6,8})\b/i);
    if (invMatch && !invoiceNumber) {
      invoiceNumber = invMatch[1].toUpperCase();
    }

    // Date: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD de MES de YYYY
    const dateSlash = clean.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
    if (dateSlash && date === new Date().toISOString().split('T')[0]) {
      const [, d, m, y] = dateSlash;
      date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    const months: Record<string, string> = {
      'ENERO': '01', 'FEBRERO': '02', 'MARZO': '03', 'ABRIL': '04',
      'MAYO': '05', 'JUNIO': '06', 'JULIO': '07', 'AGOSTO': '08',
      'SETIEMBRE': '09', 'SEPTIEMBRE': '09', 'OCTUBRE': '10', 'NOVIEMBRE': '11', 'DICIEMBRE': '12',
    };
    const dateWord = clean.match(/(\d{1,2})\s*(?:DE\s*)?([A-ZÁÉÍÓÚ]+)\s*(?:DE\s*)?(\d{4})/i);
    if (dateWord && date === new Date().toISOString().split('T')[0]) {
      const day = dateWord[1].padStart(2, '0');
      const mon = months[dateWord[2].toUpperCase()];
      if (mon) date = `${dateWord[3]}-${mon}-${day}`;
    }

    // Amounts: look for total/subtotal/IGV
    const amountMatch = clean.match(/S\/?\s*([\d,]+\.?\d*)/);
    const keywordLower = clean.toLowerCase();

    if (keywordLower.includes('total') && !keywordLower.includes('sub') && !keywordLower.includes('neto') && amountMatch) {
      total = parseAmount(amountMatch[1]);
    } else if (keywordLower.includes('subtotal') && amountMatch) {
      subtotal = parseAmount(amountMatch[1]);
    } else if ((keywordLower.includes('igv') || keywordLower.includes('impuesto')) && amountMatch) {
      igv = parseAmount(amountMatch[1]);
    } else if (keywordLower.includes('neto') && amountMatch) {
      subtotal = parseAmount(amountMatch[1]);
    }

    // Merchant: first line that looks like a name (no digits dominance, not a receipt label)
    if (!merchant && clean.length > 3) {
      const digitRatio = (clean.match(/\d/g) || []).length / clean.length;
      const skipWords = ['ruc', 'ticket', 'boleta', 'factura', 'fecha', 'caja', 'turno', 'operador', 'ticket:', 'serie', 'corr.', 'cajero', 'fono', 'tel'];
      const isLabel = skipWords.some(w => keywordLower.includes(w));
      if (digitRatio < 0.4 && !isLabel && !clean.startsWith('S/') && !clean.startsWith('TOTAL')) {
        merchant = clean.substring(0, 80);
      }
    }
  }

  // If no total found via keyword, try the largest amount on the receipt
  if (total === 0) {
    const allAmounts: number[] = [];
    for (const line of lines) {
      const matches = line.match(/S\/?\s*([\d,]+\.?\d*)/g);
      if (matches) {
        for (const m of matches) {
          const val = parseAmount(m.replace(/S\/?\s*/, ''));
          if (val > 0) allAmounts.push(val);
        }
      }
    }
    if (allAmounts.length > 0) {
      total = Math.max(...allAmounts);
    }
  }

  // If no subtotal/IGV, calculate from total
  if (total > 0 && subtotal === 0) {
    subtotal = Math.round((total / 1.18) * 100) / 100;
    igv = Math.round((total - subtotal) * 100) / 100;
  }

  // Detect category from text
  const catMap: [RegExp, string][] = [
    [/\b(restaurante|comida|almuerzo|cena|desayuno|menu|menú|hamburguesa|pollo|pizza|cafe|café|bebida|alimentos?)\b/i, 'Alimentacion'],
    [/\b(taxi|uber|movilidad|transporte|gasolina|gas|estacionamiento|peaje|combustible)\b/i, 'Transporte'],
    [/\b(hotel|alojamiento|hospedaje|airbnb)\b/i, 'Hospedaje'],
    [/\b(medico|farmacia|medicina|hospital|clinica|clínica|salud|dental)\b/i, 'Salud'],
    [/\b(telefono|móvil|movil|internet|servicio|luz|agua|electricidad|telefonia)\b/i, 'Servicios'],
    [/\b(ropa|zapato|vestido|moda|supermercado|tienda|market)\b/i, 'Otros'],
  ];
  for (const [re, cat] of catMap) {
    if (re.test(fullText)) { category = cat; break; }
  }

  return { total, date, merchant, category, ruc, invoiceNumber, subtotal, igv };
}

function parseAmount(s: string): number {
  const cleaned = s.trim();
  if (cleaned.includes('.')) {
    const val = parseFloat(cleaned.replace(/,/g, ''));
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  }
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    const lastPart = parts[parts.length - 1];
    if (lastPart.length === 2) {
      const val = parseFloat(parts.join('.'));
      return isNaN(val) ? 0 : Math.round(val * 100) / 100;
    }
    const val = parseFloat(cleaned.replace(/,/g, ''));
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  }
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : Math.round(val * 100) / 100;
}

export { analyzeReceiptOCR };
