import React, { useState } from 'react';
import { X, Printer, Download, Send, CheckCircle2, ArrowRight, FileText, DollarSign, Zap, Loader2 } from 'lucide-react';
import { descargarBlob, generarPdfDesdeElemento } from '../services/pdfService';
import { enviarComprobanteWhatsApp, construirMensajeComprobante } from '../utils/whatsapp';

export interface NotaVentaData {
  id: string; // e.g. NV01-00000001
  issueDate: string;
  paymentType: 'CONTADO' | 'CREDITO';
  paymentStatus: 'PAGADO' | 'PENDIENTE';
  dueDate?: string;
  companyName: string;
  companyRuc?: string;
  companyAddress?: string;
  companyPhone?: string;
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
  total: number;
  currency?: string;
  notes?: string;
  sellerName?: string;
  convertedToDocId?: string;
}

interface NotaVentaPreviewProps {
  data: NotaVentaData;
  onClose?: () => void;
  onMarkAsPaid?: () => void;
  onConvertToInvoice?: () => void;
  onEmitToSunatDirectly?: (targetDocType: 'F001' | 'B001') => Promise<void>;
}

export const NotaVentaPreview: React.FC<NotaVentaPreviewProps> = ({
  data,
  onClose,
  onMarkAsPaid,
  onConvertToInvoice,
  onEmitToSunatDirectly,
}) => {
  const printRef = React.useRef<HTMLDivElement>(null);
  const currencySymbol = data.currency === 'USD' ? '$' : 'S/';
  const [isTransmitting, setIsTransmitting] = useState(false);

  const targetSerie = data.customerRuc?.length === 11 ? 'F001' : 'B001';
  const targetLabel = data.customerRuc?.length === 11 ? 'Factura Electrónica (F001)' : 'Boleta Electrónica (B001)';

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
      console.error('Error generando PDF de Nota de Venta:', err);
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
      console.error('Error enviando Nota de Venta por WhatsApp:', err);
    }
  };

  const handleSunatTransmit = async () => {
    if (!onEmitToSunatDirectly) return;
    setIsTransmitting(true);
    try {
      await onEmitToSunatDirectly(targetSerie);
    } catch (err: any) {
      alert(err.message || 'Error transmitiendo a SUNAT');
    } finally {
      setIsTransmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static">
      
      {/* Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden text-slate-100 print:border-none print:shadow-none print:bg-white print:max-w-none print:w-full">
        
        {/* Action bar (hidden in print) */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Previsualización de Nota de Venta Interna</h3>
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

        {/* Printable A4 Document */}
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
              </div>

              <div className="border-2 border-slate-900 rounded-2xl p-4 text-center min-w-[200px] bg-slate-50 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                  NOTA DE VENTA INTERNA
                </span>
                <span className="text-base font-extrabold text-emerald-900 block font-mono">
                  N° {data.id}
                </span>
                <div className={`px-3 py-0.5 rounded-full text-[10px] font-black border uppercase inline-block ${
                  data.convertedToDocId
                    ? 'bg-blue-100 text-blue-900 border-blue-300'
                    : data.paymentStatus === 'PAGADO'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                }`}>
                  {data.convertedToDocId
                    ? `✓ SUNAT (${data.convertedToDocId})`
                    : data.paymentStatus === 'PAGADO'
                    ? '✓ CANCELADO / POR EMITIR SUNAT'
                    : '⏳ CREDITO PENDIENTE'}
                </div>
              </div>
            </div>

            {/* Customer & Info Grid */}
            <div className="grid grid-cols-2 gap-6 my-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  DATOS DEL CLIENTE:
                </span>
                <p className="font-bold text-slate-900 text-sm">{data.customerName}</p>
                {data.customerRuc && <p className="text-slate-600">RUC/DNI: {data.customerRuc}</p>}
                {data.customerAddress && <p className="text-slate-600">{data.customerAddress}</p>}
                {data.customerPhone && <p className="text-slate-600">Tel: {data.customerPhone}</p>}
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  DATOS DE LA VENTA:
                </span>
                <p className="text-slate-700">
                  <strong>Fecha de Emisión:</strong> {data.issueDate}
                </p>
                <p className="text-slate-700">
                  <strong>Forma de Pago:</strong> {data.paymentType}
                </p>
                {data.dueDate && (
                  <p className="text-slate-700">
                    <strong>Vencimiento Crédito:</strong> {data.dueDate}
                  </p>
                )}
                {data.sellerName && (
                  <p className="text-slate-700">
                    <strong>Vendedor:</strong> {data.sellerName}
                  </p>
                )}
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
                    <th className="p-2.5 rounded-r-lg text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.items.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
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

            {/* Total Section */}
            <div className="flex justify-between items-center my-6 pt-4 border-t border-slate-200">
              <div className="space-y-1">
                {data.notes && (
                  <p className="text-slate-500 text-[10px] italic">
                    Observación: {data.notes}
                  </p>
                )}
                <p className="text-slate-500 text-[10px]">
                  Documento de control comercial interno.
                </p>
              </div>

              <div className="bg-emerald-50 p-4 rounded-xl space-y-1 border border-emerald-200 text-right min-w-[200px]">
                <span className="text-[10px] font-black text-emerald-900 uppercase tracking-wider block">
                  TOTAL IMPORTE A PAGAR:
                </span>
                <span className="text-2xl font-black text-emerald-950 block">
                  {currencySymbol} {data.total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="mt-8 pt-4 border-t border-dashed border-slate-300 text-center text-[9px] text-slate-500 space-y-1">
              <p className="font-bold text-slate-700 uppercase">
                *** NOTA DE VENTA INTERNA - SIN VALOR TRIBUTARIO SUNAT ***
              </p>
              <p>
                Este documento acredita la transacción comercial interna de bienes y servicios.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
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
            {!data.convertedToDocId && onEmitToSunatDirectly && (
              <button
                onClick={handleSunatTransmit}
                disabled={isTransmitting}
                className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 px-4 py-2.5 rounded-xl transition text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                title={`Transmitir automáticamente a SUNAT como ${targetLabel}`}
              >
                {isTransmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
                ⚡ CLIENTE PAGÓ — TRANSMITIR A SUNAT ({targetSerie})
              </button>
            )}

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
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl transition text-xs font-bold flex items-center gap-1.5 border border-slate-700"
              >
                <ArrowRight className="w-4 h-4" /> Editar en Wizard SUNAT
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
