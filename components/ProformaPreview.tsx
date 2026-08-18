import React from 'react';
import { X, Printer, Download, Send, ArrowRight, ShieldCheck, Calendar, FileText } from 'lucide-react';
import { descargarBlob, generarPdfDesdeElemento } from '../services/pdfService';
import { enviarComprobanteWhatsApp, construirMensajeComprobante } from '../utils/whatsapp';

export interface ProformaData {
  id: string; // e.g. PROF-00000001
  issueDate: string;
  validityDays: number;
  dueDate: string;
  deliveryTime?: string;
  paymentTerms?: string;
  companyName: string;
  companyRuc?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  customerName: string;
  customerRuc?: string;
  customerAddress?: string;
  customerPhone?: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
  subtotal: number;
  igv: number;
  total: number;
  currency?: string;
  bankInfo?: string;
  notes?: string;
}

interface ProformaPreviewProps {
  data: ProformaData;
  onClose?: () => void;
  onConvertToInvoice?: () => void;
}

export const ProformaPreview: React.FC<ProformaPreviewProps> = ({
  data,
  onClose,
  onConvertToInvoice,
}) => {
  const printRef = React.useRef<HTMLDivElement>(null);
  const currencySymbol = data.currency === 'USD' ? '$' : 'S/';

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    try {
      const blob = await generarPdfDesdeElemento(printRef.current, {
        filename: `${data.id}.pdf`,
      });
      descargarBlob(blob, `${data.id}.pdf`);
    } catch (err) {
      console.error('Error generando PDF de Proforma:', err);
    }
  };

  const handleWhatsApp = async () => {
    if (!data.customerPhone) {
      alert('No se ha registrado un número de celular del cliente');
      return;
    }
    try {
      let pdfBlob = new Blob();
      if (printRef.current) {
        pdfBlob = await generarPdfDesdeElemento(printRef.current, {
          filename: `${data.id}.pdf`,
        });
      }
      const mensaje = construirMensajeComprobante({
        tipo: 'factura',
        serieNumero: data.id,
        cliente: data.customerName,
        monto: data.total,
      });

      await enviarComprobanteWhatsApp({
        phone: data.customerPhone,
        text: mensaje,
        pdfBlob,
        pdfFilename: `${data.id}.pdf`,
      });
    } catch (err) {
      console.error('Error enviando Proforma por WhatsApp:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static">
      
      {/* Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden text-slate-100 print:border-none print:shadow-none print:bg-white print:max-w-none print:w-full">
        
        {/* Action bar (hidden in print) */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <h3 className="text-sm font-bold text-white">Previsualización de Cotización / Proforma Commercial</h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Printable A4 Proforma document */}
        <div className="p-6 overflow-y-auto max-h-[75vh] print:max-h-none print:p-0">
          <div
            ref={printRef}
            className="w-full max-w-2xl mx-auto bg-white text-slate-900 p-8 rounded-2xl shadow-xl font-sans text-xs leading-relaxed border border-slate-200 print:shadow-none print:border-none print:p-0 print:mx-0 print:max-w-none"
          >
            {/* Document Header */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
              <div className="space-y-1">
                <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                  {data.companyName}
                </h1>
                {data.companyRuc && <p className="text-slate-600 font-semibold">RUC: {data.companyRuc}</p>}
                {data.companyAddress && <p className="text-slate-600 max-w-xs">{data.companyAddress}</p>}
                {data.companyPhone && <p className="text-slate-600">Teléfono: {data.companyPhone}</p>}
                {data.companyEmail && <p className="text-slate-600">Email: {data.companyEmail}</p>}
              </div>

              <div className="border-2 border-slate-900 rounded-2xl p-4 text-center min-w-[200px] bg-slate-50">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                  PROFORMA / COTIZACIÓN
                </span>
                <span className="text-base font-extrabold text-blue-900 block my-1">
                  N° {data.id}
                </span>
                <span className="text-[10px] text-slate-600 block">
                  PROCESO COMERCIAL DIRECTO
                </span>
              </div>
            </div>

            {/* Info Grid: Customer & Terms */}
            <div className="grid grid-cols-2 gap-6 my-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
              {/* Customer */}
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  CLIENTE / EMPRESA:
                </span>
                <p className="font-bold text-slate-900 text-sm">{data.customerName}</p>
                {data.customerRuc && <p className="text-slate-600">RUC/DNI: {data.customerRuc}</p>}
                {data.customerAddress && <p className="text-slate-600">{data.customerAddress}</p>}
                {data.customerPhone && <p className="text-slate-600">Tel: {data.customerPhone}</p>}
              </div>

              {/* Terms */}
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  CONDICIONES DE LA OFERTA:
                </span>
                <p className="text-slate-700">
                  <strong>Fecha de Emisión:</strong> {data.issueDate}
                </p>
                <p className="text-slate-700">
                  <strong>Validez de Oferta:</strong> {data.validityDays} días (Vence: {data.dueDate})
                </p>
                <p className="text-slate-700">
                  <strong>Tiempo de Entrega:</strong> {data.deliveryTime || 'Inmediato'}
                </p>
                <p className="text-slate-700">
                  <strong>Forma de Pago:</strong> {data.paymentTerms || 'Contado / 50% Adelanto'}
                </p>
              </div>
            </div>

            {/* Items Table */}
            <div className="my-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] uppercase font-bold">
                    <th className="p-2.5 rounded-l-lg text-center">Item</th>
                    <th className="p-2.5">Descripción del Producto / Servicio</th>
                    <th className="p-2.5 text-center">Cant.</th>
                    <th className="p-2.5 text-right">P. Unitario</th>
                    <th className="p-2.5 rounded-r-lg text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2.5 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 font-medium text-slate-900">{item.description}</td>
                      <td className="p-2.5 text-center font-bold">{item.quantity}</td>
                      <td className="p-2.5 text-right text-slate-700">
                        {currencySymbol} {item.unitPrice.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-right font-bold text-slate-900">
                        {currencySymbol} {item.subtotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & Bank Accounts */}
            <div className="grid grid-cols-12 gap-6 my-6 pt-4 border-t border-slate-200">
              <div className="col-span-7 space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  CUENTAS BANCARIAS PARA DEPOSITO:
                </span>
                <p className="text-slate-600 text-[11px] whitespace-pre-line">
                  {data.bankInfo || `BCP Soles: 191-98765432-0-12 (CCI: 00219100987654320121)\nBBVA Soles: 0011-0123-0100045678\nYAPE / PLIN: 912 345 678`}
                </p>
                {data.notes && (
                  <p className="text-slate-500 text-[10px] italic pt-1">
                    Nota: {data.notes}
                  </p>
                )}
              </div>

              <div className="col-span-5 bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{currencySymbol} {data.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>IGV (18%):</span>
                  <span>{currencySymbol} {data.igv.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-300">
                  <span>TOTAL OFERTA:</span>
                  <span className="text-blue-900">{currencySymbol} {data.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Legal Disclaimer */}
            <div className="mt-8 pt-4 border-t border-dashed border-slate-300 text-center text-[9px] text-slate-500 space-y-1">
              <p className="font-bold text-slate-700 uppercase">
                *** PROFORMA / PRESUPUESTO COMERCIAL SIN VALOR TRIBUTARIO SUNAT ***
              </p>
              <p>
                Los precios y disponibilidades de stock están garantizados durante la vigencia de la proforma.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons (hidden in print) */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl transition text-xs font-bold flex items-center gap-1.5 border border-slate-700"
            >
              <Printer className="w-4 h-4" /> Imprimir (A4)
            </button>
            <button
              onClick={handleDownloadPdf}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl transition text-xs font-bold flex items-center gap-1.5 border border-slate-700"
            >
              <Download className="w-4 h-4" /> Descargar PDF
            </button>
            {data.customerPhone && (
              <button
                onClick={handleWhatsApp}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl transition text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <Send className="w-4 h-4" /> Enviar por WhatsApp
              </button>
            )}
          </div>

          {onConvertToInvoice && (
            <button
              onClick={onConvertToInvoice}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl transition text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-600/30"
            >
              <ArrowRight className="w-4 h-4" /> Convertir a Factura / Boleta SUNAT
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
