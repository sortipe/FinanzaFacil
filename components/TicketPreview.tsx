import React from 'react';
import { X, Printer, Download, Send, AlertCircle } from 'lucide-react';
import { descargarBlob, generarPdfDesdeElemento } from '../services/pdfService';
import { enviarComprobanteWhatsApp, construirMensajeComprobante } from '../utils/whatsapp';

export interface TicketData {
  id: string; // e.g. TICK-00000001
  issueDate: string;
  issueTime?: string;
  companyName: string;
  companyRuc?: string;
  companyAddress?: string;
  companyPhone?: string;
  customerName: string;
  customerDoc?: string;
  customerPhone?: string;
  paymentMethod: 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA' | 'TARJETA' | 'CREDITO';
  amountReceived?: number;
  changeGiven?: number;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
  total: number;
  currency?: string;
  sellerName?: string;
}

interface TicketPreviewProps {
  data: TicketData;
  onClose?: () => void;
}

export const TicketPreview: React.FC<TicketPreviewProps> = ({ data, onClose }) => {
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
      console.error('Error generando PDF de Ticket:', err);
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
      console.error('Error enviando por WhatsApp:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static">
      
      {/* Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden text-slate-100 print:border-none print:shadow-none print:bg-white print:max-w-none print:w-full">
        
        {/* Action bar (hidden in print) */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between print:hidden">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            🎟️ Previsualización de Ticket Térmico
          </h3>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Printable Ticket Receipt (80mm styling) */}
        <div className="p-6 overflow-y-auto max-h-[75vh] print:max-h-none print:p-2">
          <div
            ref={printRef}
            className="w-[320px] mx-auto bg-amber-50 text-slate-900 p-5 rounded-2xl shadow-inner font-mono text-[11px] leading-tight border border-amber-200/80 print:w-[80mm] print:shadow-none print:border-none print:p-0 print:mx-0 print:bg-white print:text-black"
          >
            {/* Header */}
            <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-400">
              <h1 className="text-sm font-black tracking-wider uppercase text-slate-950 print:text-black">
                {data.companyName}
              </h1>
              {data.companyRuc && (
                <p className="text-[10px] text-slate-700">RUC: {data.companyRuc}</p>
              )}
              {data.companyAddress && (
                <p className="text-[10px] text-slate-600">{data.companyAddress}</p>
              )}
              {data.companyPhone && (
                <p className="text-[10px] text-slate-600">Tel: {data.companyPhone}</p>
              )}
            </div>

            {/* Document Title & Correlative */}
            <div className="text-center py-2 border-b border-dashed border-slate-400">
              <p className="font-bold text-xs uppercase text-slate-900">
                TICKET DE VENTA INTERNA
              </p>
              <p className="font-extrabold text-sm text-blue-900 mt-0.5 print:text-black">
                N° {data.id}
              </p>
            </div>

            {/* General Info */}
            <div className="py-2.5 border-b border-dashed border-slate-400 space-y-1 text-[10px] text-slate-800">
              <div className="flex justify-between">
                <span>FECHA / HORA:</span>
                <span className="font-bold">{data.issueDate} {data.issueTime || '14:30'}</span>
              </div>
              <div className="flex justify-between">
                <span>CLIENTE:</span>
                <span className="font-bold truncate max-w-[170px]">{data.customerName}</span>
              </div>
              {data.customerDoc && (
                <div className="flex justify-between">
                  <span>DOC. CLIENTE:</span>
                  <span>{data.customerDoc}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>FORMA PAGO:</span>
                <span className="font-bold text-emerald-800 print:text-black">{data.paymentMethod}</span>
              </div>
              {data.sellerName && (
                <div className="flex justify-between">
                  <span>ATENDIDO POR:</span>
                  <span>{data.sellerName}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="py-3 border-b border-dashed border-slate-400 space-y-1.5 text-[10px]">
              <div className="grid grid-cols-12 font-bold text-slate-950 pb-1 border-b border-slate-300">
                <span className="col-span-2">CANT</span>
                <span className="col-span-6">DESCRIPCIÓN</span>
                <span className="col-span-4 text-right">TOTAL</span>
              </div>
              {data.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 text-slate-800 items-start">
                  <span className="col-span-2 font-bold">{item.quantity}</span>
                  <span className="col-span-6 leading-none pr-1">{item.description}</span>
                  <span className="col-span-4 text-right font-medium">
                    {currencySymbol} {item.subtotal.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total Breakdown */}
            <div className="py-2.5 space-y-1 text-[11px] text-slate-900 border-b border-dashed border-slate-400">
              <div className="flex justify-between font-black text-sm pt-1">
                <span>TOTAL A PAGAR:</span>
                <span>{currencySymbol} {data.total.toFixed(2)}</span>
              </div>
              {data.amountReceived !== undefined && data.amountReceived > 0 && (
                <>
                  <div className="flex justify-between text-[10px] text-slate-700 pt-1">
                    <span>MONTO RECIBIDO:</span>
                    <span>{currencySymbol} {data.amountReceived.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-emerald-800 print:text-black">
                    <span>VUELTO A ENTREGAR:</span>
                    <span>{currencySymbol} {(data.changeGiven || 0).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Footer Disclaimer & QR */}
            <div className="text-center pt-3 space-y-2 text-[9px] text-slate-600">
              <div className="w-20 h-20 bg-slate-900 p-1 rounded-lg mx-auto flex items-center justify-center text-white print:border print:border-black print:bg-white print:text-black">
                <span className="text-[8px] font-bold text-center">QR TICKET INTERNO</span>
              </div>
              <p className="font-bold text-slate-800">¡Gracias por su preferencia y compra!</p>
              <div className="p-1.5 rounded-lg bg-amber-200/60 border border-amber-300 text-[8px] font-bold text-amber-950 uppercase print:border-none print:bg-transparent">
                *** DOCUMENTO DE VENTA INTERNO ***<br />
                *** SIN VALOR TRIBUTARIO SUNAT ***
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons (hidden in print) */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20"
          >
            <Printer className="w-4 h-4" /> Imprimir Ticket (80mm)
          </button>
          <button
            onClick={handleDownloadPdf}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl transition text-xs font-bold flex items-center gap-1.5 border border-slate-700"
          >
            <Download className="w-4 h-4" /> PDF
          </button>
          {data.customerPhone && (
            <button
              onClick={handleWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl transition text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              <Send className="w-4 h-4" /> WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
