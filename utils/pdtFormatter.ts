import { Expense } from '../types';

const SUNAT_COLUMNS = [
  'Periodo', 'TipoDoc', 'SerieNum', 'FechaEmision',
  'RUC', 'RazonSocial', 'BaseImponible', 'IGV', 'Total',
  'TipoOperacion'
];

export function formatPdtRow(
  exp: Expense,
  tipoDoc: string,
  periodo: string
): string {
  const subtotal = exp.subtotal || (exp.amount / 1.18);
  const igv = exp.igv || (exp.amount - subtotal);
  return [
    periodo,
    tipoDoc,
    exp.invoiceNumber || '',
    exp.date,
    exp.ruc || '',
    exp.description.replace(/,/g, ' '),
    subtotal.toFixed(2),
    igv.toFixed(2),
    exp.amount.toFixed(2),
    '0101'
  ].join(',');
}

export function buildPdtCsv(
  expenses: Expense[],
  incomeDocs: { name: string; amount: number; date: string; ruc?: string }[],
  periodo: string
): string {
  const header = SUNAT_COLUMNS.join(',');
  const compras = expenses
    .filter(e => !e.isPrivate)
    .map(e => formatPdtRow(e, '01', periodo));
  const ventas = incomeDocs.map(d => {
    const monto = d.amount;
    const subtotal = monto / 1.18;
    const igv = monto - subtotal;
    return [
      periodo, '01', d.name, d.date,
      d.ruc || '', d.name.replace(/,/g, ' '),
      subtotal.toFixed(2), igv.toFixed(2), monto.toFixed(2), '0101'
    ].join(',');
  });
  return [header, ...compras, ...ventas].join('\n');
}
