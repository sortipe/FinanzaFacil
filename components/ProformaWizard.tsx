import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { consultaService } from '../services/consultaService';
import { getNextCorrelative, allocateNextCorrelative } from '../src/services/api';
import { 
  X, User, Search, Loader2, Plus, Trash2, Calendar, FileText, 
  Clock, ShieldCheck, ArrowRight, Printer, Send, DollarSign
} from 'lucide-react';
import { ProformaPreview, ProformaData } from './ProformaPreview';

interface ProformaWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (doc: any) => void;
  onOpenInvoiceWizard?: (prefillData: any) => void;
}

export const ProformaWizard: React.FC<ProformaWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenInvoiceWizard,
}) => {
  const { currentUser, selectedCompany, selectedCompanyId, addTaxDocument } = useStore();

  // Series & Correlative
  const [serie, setSerie] = useState('PROF');
  const [correlative, setCorrelative] = useState<number | ''>('');

  // Customer Data
  const [customerDocType, setCustomerDocType] = useState<'6' | '1'>('6');
  const [customerDocNumber, setCustomerDocNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState('');

  // Offer Conditions
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [validityDays, setValidityDays] = useState(15);
  const [deliveryTime, setDeliveryTime] = useState('2 a 3 días hábiles');
  const [paymentTerms, setPaymentTerms] = useState('50% Adelanto, 50% Contra Entrega');
  const [currency, setCurrency] = useState<'PEN' | 'USD'>('PEN');
  const [includesIgv, setIncludesIgv] = useState(true);
  const [bankInfo, setBankInfo] = useState(
    'BCP Soles: 191-98765432-0-12 (CCI: 00219100987654320121)\nBBVA Soles: 0011-0123-0100045678\nYAPE / PLIN: 912 345 678'
  );
  const [notes, setNotes] = useState('Precios válidos según plazo de vigencia especificado.');

  // Line Items
  const [items, setItems] = useState<Array<{ id: string; description: string; quantity: number; unitPrice: number; subtotal: number }>>([
    {
      id: '1',
      description: 'Servicio / Producto de Cotización Comercial',
      quantity: 1,
      unitPrice: 100.00,
      subtotal: 100.00,
    },
  ]);

  // Preview & Generated state
  const [generatedProformaData, setGeneratedProformaData] = useState<ProformaData | null>(null);
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
        console.warn('Error obteniendo correlativo para PROF:', err);
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

  // Due Date calculation
  const dueDate = useMemo(() => {
    const d = new Date(issueDate);
    d.setDate(d.getDate() + Number(validityDays));
    return d.toISOString().split('T')[0];
  }, [issueDate, validityDays]);

  // Calculations
  const { subtotal, igv, total } = useMemo(() => {
    const rawTotal = items.reduce((acc, i) => acc + (parseFloat(i.subtotal as any) || 0), 0);
    if (includesIgv) {
      const sub = +(rawTotal / 1.18).toFixed(2);
      const tax = +(rawTotal - sub).toFixed(2);
      return { subtotal: sub, igv: tax, total: rawTotal };
    } else {
      const tax = +(rawTotal * 0.18).toFixed(2);
      const tot = +(rawTotal + tax).toFixed(2);
      return { subtotal: rawTotal, igv: tax, total: tot };
    }
  }, [items, includesIgv]);

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

  // Generate Proforma
  const handleGenerateProforma = async () => {
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

    const proformaData: ProformaData = {
      id: docId,
      issueDate,
      validityDays,
      dueDate,
      deliveryTime,
      paymentTerms,
      companyName: selectedCompany?.name || 'MI EMPRESA S.A.C.',
      companyRuc: selectedCompany?.ruc || '20601090001',
      companyAddress: selectedCompany?.taxAddress || 'Av. Principal 456, Lima',
      companyPhone: selectedCompany?.solUser || '912345678',
      companyEmail: currentUser?.email,
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
      subtotal,
      igv,
      total,
      currency,
      bankInfo,
      notes,
    };

    const newDoc: any = {
      id: docId,
      type: 'proforma',
      documentType: 'proforma',
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
        description: `Cotización Commercial N° ${docId}`,
        amount: total,
        netAmount: subtotal,
        retention: 0,
        date: issueDate,
      },
    };

    addTaxDocument(newDoc);
    setGeneratedProformaData(proformaData);
    setShowPreviewModal(true);
    if (onSuccess) onSuccess(newDoc);
  };

  // Convert Proforma to Official SUNAT Invoice/Boleta
  const handleConvertToInvoice = () => {
    if (!generatedProformaData) return;
    const prefill = {
      customerRuc: generatedProformaData.customerRuc,
      customerName: generatedProformaData.customerName,
      customerPhone: generatedProformaData.customerPhone,
      items: generatedProformaData.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal,
      })),
      total: generatedProformaData.total,
      currency: generatedProformaData.currency,
    };
    setShowPreviewModal(false);
    onClose();
    if (onOpenInvoiceWizard) onOpenInvoiceWizard(prefill);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden text-slate-100 my-8">
          
          {/* Header */}
          <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-blue-950/50 to-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Emisión de Cotización / Proforma Comercial
                  <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30 font-mono">
                    NO SUNAT
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Crea presupuestos formales para clientes con conversión directa a Factura/Boleta
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
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4" /> Datos del Cliente / Empresa
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tipo Doc.</label>
                  <select
                    value={customerDocType}
                    onChange={(e) => setCustomerDocType(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500"
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
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleSearchCustomer}
                      disabled={isSearchingCustomer}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl transition text-xs font-medium shrink-0 flex items-center gap-1"
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
                    placeholder="EMPRESA CLIENTE S.A.C."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1">Dirección del Cliente</label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Av. Javier Prado Este 1230, San Isidro, Lima"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Celular WhatsApp</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="912345678"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {customerSearchError && <p className="text-[11px] text-rose-400">{customerSearchError}</p>}
            </div>

            {/* Offer Terms */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Términos y Condiciones de la Cotización
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Fecha Emisión</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Validez (Días)</label>
                  <select
                    value={validityDays}
                    onChange={(e) => setValidityDays(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={7}>7 días hábiles</option>
                    <option value={15}>15 días hábiles</option>
                    <option value={30}>30 días hábiles</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tiempo de Entrega</label>
                  <input
                    type="text"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    placeholder="2 a 3 días hábiles"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Moneda</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="PEN">Soles (S/)</option>
                    <option value="USD">Dólares ($)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Detalle de Productos o Servicios Cotizados
                </h3>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includesIgv}
                      onChange={(e) => setIncludesIgv(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-blue-600"
                    />
                    Precios incluyen IGV (18%)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl transition text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Ítem
                  </button>
                </div>
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
                      placeholder="Descripción detallada del producto o servicio..."
                      className="col-span-5 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                        placeholder="Cant"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white text-center focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.10"
                        value={item.unitPrice}
                        onChange={(e) => handleUpdateItem(item.id, 'unitPrice', e.target.value)}
                        placeholder="P. Unit"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white text-center focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-between">
                      <span className="font-bold text-blue-400">
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
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600/10 via-slate-900 to-blue-600/10 border border-blue-500/20 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs text-slate-400 block">TOTAL COTIZADO</span>
                <span className="text-2xl font-black text-blue-400">
                  {currency === 'USD' ? '$' : 'S/'} {total.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Subtotal: {subtotal.toFixed(2)} | IGV: {igv.toFixed(2)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleGenerateProforma}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-6 py-3 rounded-2xl transition shadow-lg shadow-blue-600/30 flex items-center gap-2 text-xs uppercase tracking-wider"
              >
                <FileText className="w-5 h-5" /> Generar Proforma (Serie PROF)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Proforma Preview Modal */}
      {showPreviewModal && generatedProformaData && (
        <ProformaPreview
          data={generatedProformaData}
          onClose={() => setShowPreviewModal(false)}
          onConvertToInvoice={handleConvertToInvoice}
        />
      )}
    </>
  );
};
