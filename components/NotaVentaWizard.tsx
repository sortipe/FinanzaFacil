import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { consultaService } from '../services/consultaService';
import { sunatService } from '../services/sunatService';
import { getNextCorrelative, allocateNextCorrelative } from '../src/services/api';
import { 
  X, User, Search, Loader2, Plus, Trash2, Calendar, FileText, 
  CheckCircle2, ArrowRight, DollarSign, Clock, Tag
} from 'lucide-react';
import { NotaVentaPreview, NotaVentaData } from './NotaVentaPreview';

interface NotaVentaWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (doc: any) => void;
  onOpenInvoiceWizard?: (prefillData: any) => void;
}

export const NotaVentaWizard: React.FC<NotaVentaWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenInvoiceWizard,
}) => {
  const { currentUser, selectedCompany, selectedCompanyId, sunatGlobalConfig, addTaxDocument } = useStore();

  // Series & Correlative
  const [serie, setSerie] = useState('NV01');
  const [correlative, setCorrelative] = useState<number | ''>('');

  // Customer Data
  const [customerDocType, setCustomerDocType] = useState<'6' | '1'>('6');
  const [customerDocNumber, setCustomerDocNumber] = useState('');
  const [customerName, setCustomerName] = useState('PUBLICO EN GENERAL');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState('');

  // Sales Info
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentType, setPaymentType] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });
  const [currency, setCurrency] = useState<'PEN' | 'USD'>('PEN');
  const [notes, setNotes] = useState('');

  // Line Items
  const [items, setItems] = useState<Array<{ id: string; description: string; quantity: number; unitPrice: number; subtotal: number }>>([
    {
      id: '1',
      description: 'Producto / Mercadería General',
      quantity: 1,
      unitPrice: 50.00,
      subtotal: 50.00,
    },
  ]);

  // Preview State
  const [generatedNotaData, setGeneratedNotaData] = useState<NotaVentaData | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Auto fetch correlative
  useEffect(() => {
    if (!isOpen || !selectedCompanyId) return;
    let isMounted = true;
    (async () => {
      try {
        const next = await getNextCorrelative(selectedCompanyId, serie);
        if (isMounted && next) setCorrelative(next);
      } catch (err) {
        console.warn('Error obteniendo correlativo para NV01:', err);
      }
    })();
    return () => { isMounted = false; };
  }, [isOpen, selectedCompanyId, serie]);

  // Calculations
  const total = useMemo(() => {
    return items.reduce((acc, i) => acc + (parseFloat(i.subtotal as any) || 0), 0);
  }, [items]);

  if (!isOpen) return null;

  // Search Customer
  const handleSearchCustomer = async () => {
    if (!customerDocNumber || (customerDocType === '6' && customerDocNumber.length !== 11) || (customerDocType === '1' && customerDocNumber.length !== 8)) {
      setCustomerSearchError('Ingrese un número de documento válido (RUC 11 dígitos / DNI 8 dígitos)');
      return;
    }
    setIsSearchingCustomer(true);
    setCustomerSearchError('');
    try {
      if (customerDocType === '6') {
        const res = await consultaService.consultarRUC(customerDocNumber);
        if (res.success && (res.razonSocial || res.name)) {
          setCustomerName(res.razonSocial || res.name || '');
          if (res.address && res.address !== '-') {
            setCustomerAddress(res.address);
          }
        } else {
          setCustomerSearchError(res.error || 'RUC no encontrado en SUNAT');
        }
      } else {
        const res = await consultaService.consultarDNI(customerDocNumber);
        if (res.success && res.name) {
          setCustomerName(res.name);
        } else {
          setCustomerSearchError(res.error || 'DNI no encontrado en RENIEC');
        }
      }
    } catch (err: any) {
      setCustomerSearchError(err.message || 'Error consultando documento');
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  // Items Management
  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        description: '',
        quantity: 1,
        unitPrice: 0,
        subtotal: 0,
      },
    ]);
  };

  const handleUpdateItem = (id: string, field: string, value: any) => {
    setItems(
      items.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          const qty = field === 'quantity' ? parseFloat(value) || 0 : item.quantity;
          const price = field === 'unitPrice' ? parseFloat(value) || 0 : item.unitPrice;
          updated.subtotal = +(qty * price).toFixed(2);
        }
        return updated;
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter((i) => i.id !== id));
  };

  // Generate Nota de Venta
  const handleGenerateNota = async () => {
    if (!selectedCompanyId) return;
    if (!customerName.trim()) {
      setCustomerSearchError('Debe ingresar el Nombre o Razón Social del Cliente');
      return;
    }

    let finalNum = correlative;
    if (!finalNum) {
      finalNum = await allocateNextCorrelative(selectedCompanyId, serie);
    } else {
      await allocateNextCorrelative(selectedCompanyId, serie, Number(finalNum));
    }

    const formattedCorrelative = String(finalNum).padStart(6, '0');
    const docId = `${serie}-${formattedCorrelative}`;

    const notaData: NotaVentaData = {
      id: docId,
      issueDate,
      paymentType,
      paymentStatus: paymentType === 'CONTADO' ? 'PAGADO' : 'PENDIENTE',
      dueDate: paymentType === 'CREDITO' ? dueDate : undefined,
      companyName: selectedCompany?.name || 'MI EMPRESA S.A.C.',
      companyRuc: selectedCompany?.ruc || '20601090001',
      companyAddress: selectedCompany?.taxAddress || 'Av. Principal 456, Lima',
      companyPhone: selectedCompany?.solUser || '912345678',
      customerName,
      customerRuc: customerDocNumber || undefined,
      customerAddress: customerAddress || undefined,
      customerPhone: customerPhone || undefined,
      items: items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal,
      })),
      total,
      currency,
      notes,
      sellerName: currentUser?.name,
    };

    const newDoc: any = {
      id: docId,
      type: 'nota_venta',
      documentType: 'nota_venta',
      serie,
      correlative: Number(finalNum),
      issueDate,
      customerRuc: customerDocNumber || '00000000',
      customerName,
      total,
      status: 'emitido',
      sunatStatus: 'INTERNO',
      createdAt: new Date().toISOString(),
      metadata: {
        recipientName: customerName,
        recipientRuc: customerDocNumber,
        recipientPhone: customerPhone,
        description: `Nota de Venta N° ${docId}`,
        amount: total,
        netAmount: total,
        retention: 0,
        date: issueDate,
      },
    };

    addTaxDocument(newDoc);
    setGeneratedNotaData(notaData);
    setShowPreviewModal(true);
    if (onSuccess) onSuccess(newDoc);
  };

  // Convert to Invoice
  const handleConvertToInvoice = () => {
    if (!generatedNotaData) return;
    const prefill = {
      customerRuc: generatedNotaData.customerRuc,
      customerName: generatedNotaData.customerName,
      customerPhone: generatedNotaData.customerPhone,
      items: generatedNotaData.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal,
      })),
      total: generatedNotaData.total,
      currency: generatedNotaData.currency,
    };
    setShowPreviewModal(false);
    onClose();
    if (onOpenInvoiceWizard) onOpenInvoiceWizard(prefill);
  };

  // Direct 1-Click SUNAT emission upon payment
  const handleEmitToSunatDirectly = async (targetDocType: 'F001' | 'B001') => {
    if (!generatedNotaData || !selectedCompanyId) return;

    const userCredentials = {
      ruc: selectedCompany?.ruc || sunatGlobalConfig?.demo_ruc || '20601090001',
      user: selectedCompany?.sunatUser || sunatGlobalConfig?.demo_user || 'MODDATOS',
      pass: selectedCompany?.sunatPass || sunatGlobalConfig?.demo_pass || 'moddatos',
      env: sunatGlobalConfig?.environment || 'sandbox',
      emitterName: selectedCompany?.name || 'MI EMPRESA S.A.C.',
    };

    const payload = {
      recipientRuc: generatedNotaData.customerRuc || '00000000',
      recipientName: generatedNotaData.customerName,
      date: generatedNotaData.issueDate,
      items: generatedNotaData.items,
      total: generatedNotaData.total,
      currency: generatedNotaData.currency || 'PEN',
      paymentType: 'contado',
    };

    const res = await sunatService.emitirFactura(
      payload,
      'LOCAL_TOKEN',
      'http://localhost:3001/api',
      userCredentials,
      targetDocType
    );

    if (res.success) {
      const nextNum = Math.floor(Math.random() * 100000);
      const sunatDocId = `${targetDocType}-${String(nextNum).padStart(6, '0')}`;

      const sunatDoc: any = {
        id: sunatDocId,
        type: targetDocType === 'F001' ? 'factura' : 'boleta',
        documentType: targetDocType === 'F001' ? 'factura' : 'boleta',
        serie: targetDocType,
        correlative: nextNum,
        issueDate: generatedNotaData.issueDate,
        customerRuc: generatedNotaData.customerRuc || '00000000',
        customerName: generatedNotaData.customerName,
        total: generatedNotaData.total,
        status: 'emitido',
        sunatStatus: 'ACEPTADO',
        xmlContent: res.xmlContent,
        cdrBase64: res.cdrBase64,
        pdfUrl: res.pdfUrl,
        createdAt: new Date().toISOString(),
        metadata: {
          recipientName: generatedNotaData.customerName,
          recipientRuc: generatedNotaData.customerRuc || '00000000',
          recipientPhone: generatedNotaData.customerPhone,
          description: `Convertido de Nota de Venta N° ${generatedNotaData.id}`,
          amount: generatedNotaData.total,
          netAmount: generatedNotaData.total,
          retention: 0,
          date: generatedNotaData.issueDate,
        },
      };

      addTaxDocument(sunatDoc);
      setGeneratedNotaData({
        ...generatedNotaData,
        convertedToDocId: sunatDocId,
        paymentStatus: 'PAGADO',
      });
      alert(`¡Comprobante ${sunatDocId} transmitido y ACEPTADO por SUNAT exitosamente!`);
    } else {
      throw new Error(res.error || 'Error emitiendo comprobante ante SUNAT');
    }
  };

  // Mark as Paid
  const handleMarkAsPaid = () => {
    if (!generatedNotaData) return;
    setGeneratedNotaData({
      ...generatedNotaData,
      paymentStatus: 'PAGADO',
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden text-slate-100 my-8">
          
          {/* Header */}
          <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-emerald-950/50 to-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Emisión de Nota de Venta Interna
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                    NO SUNAT
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Comprobante privado de venta en hoja A4 / A5 para control comercial e inventario
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body */}
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">

            {/* Customer Information */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4" /> Datos del Cliente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tipo Doc.</label>
                  <select
                    value={customerDocType}
                    onChange={(e) => setCustomerDocType(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="6">RUC (6)</option>
                    <option value="1">DNI (1)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">N° Documento</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customerDocNumber}
                      onChange={(e) => setCustomerDocNumber(e.target.value)}
                      placeholder={customerDocType === '6' ? '20601090001' : '71234567'}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleSearchCustomer}
                      disabled={isSearchingCustomer}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl transition text-xs font-medium shrink-0 flex items-center gap-1"
                    >
                      {isSearchingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Buscar
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Nombre / Razón Social</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="PUBLICO EN GENERAL"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Dirección del Cliente</label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Av. Los Pinos 123, Lima"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Celular WhatsApp</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="912345678"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              {customerSearchError && <p className="text-[11px] text-rose-400">{customerSearchError}</p>}
            </div>

            {/* Sales Terms */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Modalidad y Fechas de Venta
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Forma de Pago</label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CONTADO">Contado (Pagado)</option>
                    <option value="CREDITO">Crédito (Pendiente)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Fecha Emisión</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {paymentType === 'CREDITO' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Fecha Vencimiento</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500 font-bold text-amber-400"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Moneda</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PEN">Soles (S/)</option>
                    <option value="USD">Dólares ($)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Detalle de Productos / Servicios
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl transition text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar Ítem
                </button>
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 grid grid-cols-12 gap-2 items-center text-xs"
                  >
                    <span className="col-span-1 text-slate-500 font-bold text-center">{idx + 1}</span>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                      placeholder="Descripción del producto..."
                      className="col-span-5 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                        placeholder="Cant"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white text-center focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.10"
                        value={item.unitPrice}
                        onChange={(e) => handleUpdateItem(item.id, 'unitPrice', e.target.value)}
                        placeholder="P. Unit"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white text-center focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-between">
                      <span className="font-bold text-emerald-400">
                        {currency === 'USD' ? '$' : 'S/'} {item.subtotal.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={items.length <= 1}
                        className="text-slate-500 hover:text-rose-400 disabled:opacity-30 p-1 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Summary */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600/10 via-slate-900 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs text-slate-400 block">TOTAL NOTA DE VENTA</span>
                <span className="text-2xl font-black text-emerald-400">
                  {currency === 'USD' ? '$' : 'S/'} {total.toFixed(2)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleGenerateNota}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-6 py-3 rounded-2xl transition shadow-lg shadow-emerald-600/30 flex items-center gap-2 text-xs uppercase tracking-wider"
              >
                <FileText className="w-5 h-5" /> Emitir Nota de Venta (Serie NV01)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Nota Preview Modal */}
      {showPreviewModal && generatedNotaData && (
        <NotaVentaPreview
          data={generatedNotaData}
          onClose={() => setShowPreviewModal(false)}
          onMarkAsPaid={handleMarkAsPaid}
          onConvertToInvoice={handleConvertToInvoice}
          onEmitToSunatDirectly={handleEmitToSunatDirectly}
        />
      )}
    </>
  );
};
