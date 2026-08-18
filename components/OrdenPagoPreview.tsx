import React from 'react';
import { X, Printer, Download, Send, CreditCard, CheckCircle2, ArrowRight, Clock, AlertTriangle } from 'lucide-react';
import { descargarBlob, generarPdfDesdeElemento } from '../services/pdfService';
import { enviarComprobanteWhatsApp, construirMensajeComprobante } from '../utils/whatsapp';

export interface OrdenPagoData {
  id: string; // e.g. OPAG-00000001
  issueDate: string;
  dueDate: string;
  paymentStatus: 'PENDIENTE' | 'PAGADO' | 'ANULADO';
  companyName: string;
  companyRuc?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  customerName: string;
  customerRuc?: string;
  customerAddress?: string;
  customerPhone?: string;
  concept: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
  total: number;
  currency?: string;
  bankInfo?: string;
  notes?: string;
}

interface OrdenPagoPreviewProps {
  data: OrdenPagoData;
  onClose?: () => void;
  onMarkAsPaid?: () => void;
  onConvertToInvoice?: () => void;
}

export const OrdenPagoPreview: React.FC<OrdenPagoPreviewProps> = ({
  data,
  onClose,
  onMarkAsPaid,
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
      console.error('Error generando PDF de Orden de Pago:', err);
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
      console.error('Error enviando Orden de Pago por WhatsApp:', err);
    }
  };

  const statusBadge = {
    PENDIENTE: { bg: 'bg-amber-100 text-amber-900 border-amber-300', text: '⏳ PENDIENTE DE PAGO' },
    PAGADO: { bg: 'bg-emerald-100 text-emerald-900 border-emerald-300', text: '✓ PAGADO / COBRADO' },
    ANULADO: { bg: 'bg-rose-100 text-rose-900 border-rose-300', text: '✕ ANULADO' },
  }[data.paymentStatus] || { bg: 'bg-slate-100 text-slate-900 border-slate-300', text: data.paymentStatus };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static">
      
      {/* Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden text-slate-100 print:border-none print:shadow-none print:bg-white print:max-w-none print:w-full">
        
        {/* Action bar (hidden in print) */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Previsualización de Orden de Pago / Solicitud de Cobro</h3>
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

        {/* Printable Document */}
        <div className="p-6 overflow-y-auto max-h-[75vh] print:max-h-none print:p-0">
          <div
            ref={printRef}
            className="w-full max-w-2xl mx-auto bg-white text-slate-900 p-8 rounded-2xl shadow-xl font-sans text-xs leading-relaxed border border-slate-200 print:shadow-none print:border-none print:p-0 print:mx-0 print:max-w-none"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
              <div className="space-y-1">
                <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                  {data.companyName}
                </h1>
                {data.companyRuc && <p className="text-slate-600 font-semibold">RUC: {data.companyRuc}</p>}
                {data.companyAddress && <p className="text-slate-600 max-w-xs">{data.companyAddress}</p>}
                {data.companyPhone && <p className="text-slate-600">Tel: {data.companyPhone}</p>}
                {data.companyEmail && <p className="text-slate-600">Email: {data.companyEmail}</p>}
              </div>

              <div className="border-2 border-slate-900 rounded-2xl p-4 text-center min-w-[200px] bg-slate-50 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                  ORDEN DE PAGO INTERNA
                </span>
                <span className="text-base font-extrabold text-indigo-900 block font-mono">
                  N° {data.id}
                </span>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase inline-block ${statusBadge.bg}`}>
                  {statusBadge.text}
                </div>
              </div>
            </div>

            {/* Customer & Due Date Grid */}
            <div className="grid grid-cols-2 gap-6 my-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  DEUDOR / CLIENTE:
                </span>
                <p className="font-bold text-slate-900 text-sm">{data.customerName}</p>
                {data.customerRuc && <p className="text-slate-600">RUC/DNI: {data.customerRuc}</p>}
                {data.customerAddress && <p className="text-slate-600">{data.customerAddress}</p>}
                {data.customerPhone && <p className="text-slate-600">Tel: {data.customerPhone}</p>}
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  DATOS DE VENCIMIENTO:
                </span>
                <p className="text-slate-700">
                  <strong>Fecha de Emisión:</strong> {data.issueDate}
                </p>
                <p className="text-slate-900 font-bold text-rose-700">
                  <strong>Fecha Límite de Pago:</strong> {data.dueDate}
                </p>
                <p className="text-slate-700">
                  <strong>Concepto:</strong> {data.concept}
                </p>
              </div>
            </div>

            {/* Items Table */}
            <div className="my-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] uppercase font-bold">
                    <th className="p-2.5 rounded-l-lg text-center">Item</th>
                    <th className="p-2.5">Descripción del Concepto / Cuota</th>
                    <th className="p-2.5 text-center">Cant.</th>
                    <th className="p-2.5 text-right">Monto Unitario</th>
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

            {/* Total & Payment Instructions */}
            <div className="grid grid-cols-12 gap-6 my-6 pt-4 border-t border-slate-200">
              <div className="col-span-7 space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  INSTRUCCIONES Y MEDIOS DE PAGO AUTORIZADOS:
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

              <div className="col-span-5 bg-indigo-50/50 p-4 rounded-xl space-y-2 border border-indigo-200 text-right">
                <span className="text-[10px] font-black text-indigo-900 uppercase tracking-wider block">
                  MONTO TOTAL A CANCELAR:
                </span>
                <span className="text-2xl font-black text-indigo-950 block">
                  {currencySymbol} {data.total.toFixed(2)}
                </span>
                <span className="text-[9px] text-slate-500 block">
                  Referencia de Pago: N° {data.id}
                </span>
              </div>
            </div>

            {/* Legal Disclaimer */}
            <div className="mt-8 pt-4 border-t border-dashed border-slate-300 text-center text-[9px] text-slate-500 space-y-1">
              <p className="font-bold text-slate-700 uppercase">
                *** ORDEN DE PAGO / SOLICITUD DE COBRO INTERNA NO SUNAT ***
              </p>
              <p>
                Este documento constituye un aviso formal de cobro. Al confirmarse el pago se emitirá el comprobante electrónico correspondiente.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Actions (hidden in print) */}
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
              <Download className="w-4 h-4" /> PDF
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

          <div className="flex items-center gap-2">
            {data.paymentStatus !== 'PAGADO' && onMarkAsPaid && (
              <button
                onClick={onMarkAsPaid}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl transition text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-4 h-4" /> Marcar como Pagado
              </button>
            )}

            {onConvertToInvoice && (
              <button
                onClick={onConvertToInvoice}
                className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white px-4 py-2.5 rounded-xl transition text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
              >
                <ArrowRight className="w-4 h-4" /> Factura / Boleta SUNAT
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
