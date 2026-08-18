import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { consultaService } from '../services/consultaService';
import { getNextCorrelative, allocateNextCorrelative } from '../src/services/api';
import { 
  X, User, Search, Loader2, Plus, Trash2, Calendar, FileText, 
  CreditCard, CheckCircle2, ArrowRight, DollarSign, Clock, ShieldCheck
} from 'lucide-react';
import { OrdenPagoPreview, OrdenPagoData } from './OrdenPagoPreview';

interface OrdenPagoWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (doc: any) => void;
  onOpenInvoiceWizard?: (prefillData: any) => void;
}

export const OrdenPagoWizard: React.FC<OrdenPagoWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenInvoiceWizard,
}) => {
  const { currentUser, selectedCompany, selectedCompanyId, addTaxDocument } = useStore();

  // Series & Correlative
  const [serie, setSerie] = useState('OPAG');
  const [correlative, setCorrelative] = useState<number | ''>('');

  // Customer Data
  const [customerDocType, setCustomerDocType] = useState<'6' | '1'>('6');
  const [customerDocNumber, setCustomerDocNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState('');

  // Order Info
  const [concept, setConcept] = useState('50% Inicial de Proyecto / Servicio Acordado');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [currency, setCurrency] = useState<'PEN' | 'USD'>('PEN');
  const [bankInfo, setBankInfo] = useState(
    'BCP Soles: 191-98765432-0-12 (CCI: 00219100987654320121)\nBBVA Soles: 0011-0123-0100045678\nYAPE / PLIN: 912 345 678'
  );
  const [notes, setNotes] = useState('Por favor enviar constancia o voucher de pago al correo o WhatsApp de la empresa.');

  // Line Items
  const [items, setItems] = useState<Array<{ id: string; description: string; quantity: number; unitPrice: number; subtotal: number }>>([
    {
      id: '1',
      description: 'Cuota / Pago por Servicios Prestados',
      quantity: 1,
      unitPrice: 250.00,
      subtotal: 250.00,
    },
  ]);

  // Preview & Generated state
  const [generatedOrderData, setGeneratedOrderData] = useState<OrdenPagoData | null>(null);
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
        console.warn('Error obteniendo correlativo para OPAG:', err);
      }
    })();
    return () => { isMounted = false; };
  }, [isOpen, selectedCompanyId, serie]);

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

  // Calculations
  const total = useMemo(() => {
    return items.reduce((acc, i) => acc + (parseFloat(i.subtotal as any) || 0), 0);
  }, [items]);

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

  // Generate Orden de Pago
  const handleGenerateOrder = async () => {
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

    const orderData: OrdenPagoData = {
      id: docId,
      issueDate,
      dueDate,
      paymentStatus: 'PENDIENTE',
      companyName: selectedCompany?.name || 'MI EMPRESA S.A.C.',
      companyRuc: selectedCompany?.ruc || '20601090001',
      companyAddress: selectedCompany?.taxAddress || 'Av. Principal 456, Lima',
      companyPhone: selectedCompany?.solUser || '912345678',
      companyEmail: currentUser?.email,
      customerName,
      customerRuc: customerDocNumber || undefined,
      customerAddress: customerAddress || undefined,
      customerPhone: customerPhone || undefined,
      concept,
      items: items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal,
      })),
      total,
      currency,
      bankInfo,
      notes,
    };

    const newDoc: any = {
      id: docId,
      type: 'orden_pago',
      documentType: 'orden_pago',
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
        description: `Orden de Pago N° ${docId} - ${concept}`,
        amount: total,
        netAmount: total,
        retention: 0,
        date: issueDate,
      },
    };

    addTaxDocument(newDoc);
    setGeneratedOrderData(orderData);
    setShowPreviewModal(true);
    if (onSuccess) onSuccess(newDoc);
  };

  // Convert Orden de Pago to Invoice
  const handleConvertToInvoice = () => {
    if (!generatedOrderData) return;
    const prefill = {
      customerRuc: generatedOrderData.customerRuc,
      customerName: generatedOrderData.customerName,
      customerPhone: generatedOrderData.customerPhone,
      items: generatedOrderData.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal,
      })),
      total: generatedOrderData.total,
      currency: generatedOrderData.currency,
    };
    setShowPreviewModal(false);
    onClose();
    if (onOpenInvoiceWizard) onOpenInvoiceWizard(prefill);
  };

  // Mark as Paid
  const handleMarkAsPaid = () => {
    if (!generatedOrderData) return;
    setGeneratedOrderData({
      ...generatedOrderData,
      paymentStatus: 'PAGADO',
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden text-slate-100 my-8">
          
          {/* Header */}
          <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Emisión de Orden de Pago / Solicitud de Cobro
                  <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30 font-mono">
                    NO SUNAT
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Emita avisos y solicitudes de cobro con vencimiento y cuentas bancarias
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
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4" /> Deudor / Cliente a Cobrar
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tipo Doc.</label>
                  <select
                    value={customerDocType}
                    onChange={(e) => setCustomerDocType(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleSearchCustomer}
                      disabled={isSearchingCustomer}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl transition text-xs font-medium shrink-0 flex items-center gap-1"
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
                    placeholder="CLIENTE DEUDOR S.A.C."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Dirección del Deudor</label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Av. Los Tulipanes 450, Surco, Lima"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Celular WhatsApp</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="912345678"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              {customerSearchError && <p className="text-[11px] text-rose-400">{customerSearchError}</p>}
            </div>

            {/* Order Info */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Parámetros del Cobro y Fechas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Concepto General de Cobro</label>
                  <input
                    type="text"
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="Cuota de Inicial / Servicio de Asesoría"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Fecha Emisión</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Fecha Vencimiento (Límite)</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-purple-500 font-bold text-rose-400"
                  />
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Desglose de Conceptos a Cobrar
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl transition text-xs font-semibold flex items-center gap-1"
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
                      placeholder="Descripción del concepto o cuota..."
                      className="col-span-5 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                        placeholder="Cant"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white text-center focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.10"
                        value={item.unitPrice}
                        onChange={(e) => handleUpdateItem(item.id, 'unitPrice', e.target.value)}
                        placeholder="Monto"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white text-center focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-between">
                      <span className="font-bold text-indigo-400">
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
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-600/10 via-slate-900 to-indigo-600/10 border border-indigo-500/20 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs text-slate-400 block">TOTAL A COBRAR EN ORDEN</span>
                <span className="text-2xl font-black text-indigo-400">
                  {currency === 'USD' ? '$' : 'S/'} {total.toFixed(2)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleGenerateOrder}
                className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold px-6 py-3 rounded-2xl transition shadow-lg shadow-indigo-600/30 flex items-center gap-2 text-xs uppercase tracking-wider"
              >
                <CreditCard className="w-5 h-5" /> Generar Orden de Pago (OPAG)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Orden Pago Preview Modal */}
      {showPreviewModal && generatedOrderData && (
        <OrdenPagoPreview
          data={generatedOrderData}
          onClose={() => setShowPreviewModal(false)}
          onMarkAsPaid={handleMarkAsPaid}
          onConvertToInvoice={handleConvertToInvoice}
        />
      )}
    </>
  );
};
