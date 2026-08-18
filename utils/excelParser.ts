export interface ParsedExpenseRow {
  date: string;
  merchantName: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  invoiceNumber: string;
  notes?: string;
  isValid: boolean;
  error?: string;
}

export const downloadExpenseTemplateCsv = () => {
  const headers = ['Fecha (YYYY-MM-DD)', 'Proveedor', 'Categoria', 'Descripcion', 'Monto', 'Moneda (PEN/USD)', 'Nro_Invoice', 'Notas'];
  const sampleRows = [
    ['2026-08-10', 'Meta Platforms Inc', 'Publicidad Digital', 'Anuncios Facebook Ads Agosto', '150.00', 'USD', 'INV-894721', 'Campana lanzamiento'],
    ['2026-08-12', 'Hostinger', 'Hosting & Cloud', 'Renovación VPS Servidor', '120.00', 'USD', 'H-90812', 'Servidor principal'],
    ['2026-08-14', 'Google LLC', 'Software & IA', 'Suscripcion Google Workspace', '45.00', 'PEN', 'G-33910', 'Correos corporativos'],
  ];

  const csvContent = '\uFEFF' + [
    headers.join(','),
    ...sampleRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Plantilla_Egresos_No_SUNAT.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const parseExpenseCsv = (text: string): ParsedExpenseRow[] => {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  // Determine delimiter (, or ;)
  const firstLine = lines[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';

  // Check if line 0 is header
  const isHeader = firstLine.toLowerCase().includes('fecha') || firstLine.toLowerCase().includes('proveedor') || firstLine.toLowerCase().includes('monto');
  const dataLines = isHeader ? lines.slice(1) : lines;

  return dataLines.map((line, idx) => {
    // Basic CSV cell split taking quotes into account
    const regex = new RegExp(`(?:^|${delimiter})(?:"([^"]*)"|([^"${delimiter}]*))`, 'g');
    const cells: string[] = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      cells.push((match[1] !== undefined ? match[1] : match[2] || '').trim());
    }

    const rawDate = cells[0] || '';
    const merchantName = cells[1] || 'Varios';
    const category = cells[2] || 'Otros Egresos No SUNAT';
    const description = cells[3] || 'Egreso no SUNAT';
    const rawAmount = cells[4] || '0';
    const rawCurrency = (cells[5] || 'PEN').toUpperCase();
    const invoiceNumber = cells[6] || '';
    const notes = cells[7] || '';

    // Validate amount
    const cleanAmount = parseFloat(rawAmount.replace(/[^0-9.-]/g, ''));
    const amount = isNaN(cleanAmount) ? 0 : Math.abs(cleanAmount);
    const currency = rawCurrency === 'USD' || rawCurrency === '$' ? 'USD' : 'PEN';

    // Format Date YYYY-MM-DD
    let date = rawDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      // Try parsing DD/MM/YYYY
      const parts = rawDate.split(/[\/\.-]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else if (parts[2].length === 4) {
          date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      date = new Date().toISOString().split('T')[0];
    }

    const isValid = amount > 0 && description.length > 0;
    const error = amount <= 0 ? 'Monto inválido' : !description ? 'Falta descripción' : undefined;

    return {
      date,
      merchantName,
      category,
      description,
      amount,
      currency,
      invoiceNumber,
      notes,
      isValid,
      error,
    };
  });
};
