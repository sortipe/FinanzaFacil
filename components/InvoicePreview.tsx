import React from 'react';

export interface InvoicePreviewItem {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  total: number;
}

export interface InvoicePreviewData {
  documentType: 'factura' | 'boleta' | 'nota_credito' | 'nota_debito' | 'rh' | string;
  serieNumero: string;
  issueDate: string;
  emitterName: string;
  emitterRuc: string;
  emitterAddress?: string;
  customerName: string;
  customerDocNumber?: string;
  customerDocTypeLabel?: string;
  customerAddress?: string;
  customerPhone?: string;
  items: InvoicePreviewItem[];
  subtotal?: number;
  igv?: number;
  total: number;
  currency?: string;
  sunatStatus?: string;
}

const TITLES: Record<string, string> = {
  factura: 'FACTURA ELECTRÓNICA',
  boleta: 'BOLETA DE VENTA ELECTRÓNICA',
  nota_credito: 'NOTA DE CRÉDITO ELECTRÓNICA',
  nota_debito: 'NOTA DE DÉBITO ELECTRÓNICA',
  rh: 'RECIBO POR HONORARIOS ELECTRÓNICO',
};

const formatMoney = (n: number, currency?: string): string => {
  const symbol = currency === 'USD' ? '$' : 'S/';
  return `${symbol} ${n.toFixed(2)}`;
};

export const InvoicePreview: React.FC<{ data: InvoicePreviewData }> = ({ data }) => {
  const title = TITLES[data.documentType] || 'COMPROBANTE ELECTRÓNICO';
  const subtotal = parseFloat((data.total / 1.18).toFixed(2));
  const igv = parseFloat((data.total - subtotal).toFixed(2));
  const items = data.items && data.items.length > 0 ? data.items : [];

  return (
    <div className="w-[640px] bg-white text-gray-900 font-sans">
      <div className="p-8">
        {/* Encabezado */}
        <div className="flex justify-between items-start border-b-2 border-amber-500 pb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-amber-600 uppercase italic leading-tight">{title}</h1>
            <p className="text-sm font-black text-gray-800 uppercase mt-2 truncate">{data.emitterName}</p>
            <p className="text-[11px] font-bold text-gray-600 mt-0.5">RUC: {data.emitterRuc || '—'}</p>
            {data.emitterAddress && <p className="text-[10px] font-semibold text-gray-500 mt-0.5 uppercase">{data.emitterAddress}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-[9px] font-black uppercase text-gray-400">Serie - Número</p>
            <p className="text-xl font-mono font-black text-gray-900">{data.serieNumero}</p>
            <p className="text-[10px] font-bold text-gray-600 mt-1">Fecha Emisión: {data.issueDate}</p>
          </div>
        </div>

        {/* Datos del cliente */}
        <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div className="col-span-2">
            <p className="text-[9px] font-black uppercase text-gray-400">Cliente</p>
            <p className="font-black text-gray-900 uppercase">{data.customerName || '—'}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase text-gray-400">{data.customerDocTypeLabel === 'DNI' ? 'DNI' : 'RUC'}</p>
            <p className="font-mono font-bold text-gray-800">{data.customerDocNumber || '—'}</p>
          </div>
          {data.customerAddress && (
            <div>
              <p className="text-[9px] font-black uppercase text-gray-400">Dirección</p>
              <p className="font-bold text-gray-800 uppercase">{data.customerAddress}</p>
            </div>
          )}
          {data.customerPhone && (
            <div>
              <p className="text-[9px] font-black uppercase text-gray-400">Celular</p>
              <p className="font-bold text-gray-800">{data.customerPhone}</p>
            </div>
          )}
        </div>

        {/* Detalle de ítems */}
        <table className="mt-6 w-full text-xs">
          <thead>
            <tr className="bg-amber-500 text-white">
              <th className="text-left px-3 py-2.5 font-black uppercase text-[9px]">Descripción</th>
              <th className="text-center px-2 py-2.5 font-black uppercase text-[9px] w-16">Cant.</th>
              <th className="text-right px-2 py-2.5 font-black uppercase text-[9px] w-24">P. Unit.</th>
              <th className="text-right px-3 py-2.5 font-black uppercase text-[9px] w-28">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-3 border-b border-gray-200 text-gray-500 italic">Comprobante electrónico</td>
              </tr>
            )}
            {items.map((item, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2.5 border-b border-gray-200 font-bold text-gray-800">{item.description || '—'}</td>
                <td className="px-2 py-2.5 border-b border-gray-200 text-center font-semibold text-gray-700">{item.quantity}</td>
                <td className="px-2 py-2.5 border-b border-gray-200 text-right font-semibold text-gray-700">{formatMoney(item.unitPrice, data.currency)}</td>
                <td className="px-3 py-2.5 border-b border-gray-200 text-right font-black text-gray-900">{formatMoney(item.total, data.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1.5 text-xs">
            <div className="flex justify-between font-bold text-gray-600">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal, data.currency)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-600">
              <span>IGV (18%)</span>
              <span>{formatMoney(igv, data.currency)}</span>
            </div>
            <div className="flex justify-between items-center bg-amber-500 text-white px-3 py-2.5 rounded-lg font-black text-sm">
              <span>Total</span>
              <span>{formatMoney(data.total, data.currency)}</span>
            </div>
          </div>
        </div>

        {/* Pie */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center">
          <p className="text-[9px] text-gray-400 italic">
            Este comprobante fue generado y enviado mediante FinanzaFacil. Representación impresa de la
            versión electrónica emitida de conformidad con el Decreto Legislativo N° 943 y normas SUNAT.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreview;
