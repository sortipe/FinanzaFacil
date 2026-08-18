import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { getNextCorrelative, allocateNextCorrelative } from '../src/services/api';
import { 
  X, User, Search, Plus, Trash2, DollarSign, CreditCard, 
  Smartphone, Wallet, Receipt, Printer, CheckCircle2, ArrowRight
} from 'lucide-react';
import { TicketPreview, TicketData } from './TicketPreview';

interface TicketVentaWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (doc: any) => void;
}

export const TicketVentaWizard: React.FC<TicketVentaWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser, selectedCompany, selectedCompanyId, addTaxDocument } = useStore();

  // Series & Correlative
  const [serie, setSerie] = useState('TICK');
  const [correlative, setCorrelative] = useState<number | ''>('');

  // Customer Data
  const [customerName, setCustomerName] = useState('PUBLICO EN GENERAL');
  const [customerDoc, setCustomerDoc] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Payment Method
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA' | 'TARJETA' | 'CREDITO'>('EFECTIVO');
  const [amountReceived, setAmountReceived] = useState<string>('');

  // Items
  const [items, setItems] = useState<Array<{ id: string; description: string; quantity: number; unitPrice: number; subtotal: number }>>([
    {
      id: '1',
      description: 'Producto / Servicio General',
      quantity: 1,
      unitPrice: 10.00,
      subtotal: 10.00,
    },
  ]);

  // Ticket Generated Result State
  const [generatedTicketData, setGeneratedTicketData] = useState<TicketData | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Auto correlative
  useEffect(() => {
    if (!isOpen || !selectedCompanyId) return;
    let isMounted = true;
    (async () => {
      try {
        const next = await getNextCorrelative(selectedCompanyId, serie);
        if (isMounted && next) setCorrelative(next);
      } catch (err) {
        console.warn('Error obteniendo correlativo para TICK:', err);
      }
    })();
    return () => { isMounted = false; };
  }, [isOpen, selectedCompanyId, serie]);

  if (!isOpen) return null;

  // Total calculation
  const total = useMemo(() => {
    return items.reduce((acc, item) => acc + (parseFloat(item.subtotal as any) || 0), 0);
  }, [items]);

  // Change Given calculation
  const changeGiven = useMemo(() => {
    const received = parseFloat(amountReceived) || 0;
    return received > total ? received - total : 0;
  }, [amountReceived, total]);

  // Preset Public Customer
  const handleSetPublicCustomer = () => {
    setCustomerName('PUBLICO EN GENERAL');
    setCustomerDoc('');
    setCustomerPhone('');
  };

  // Add Item
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

  // Update Item
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

  // Remove Item
  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter((i) => i.id !== id));
  };

  // Save Ticket Document
  const handleGenerateTicket = async () => {
    if (!selectedCompanyId) return;

    let finalNum = correlative;
    if (!finalNum) {
      finalNum = await allocateNextCorrelative(selectedCompanyId, serie);
    } else {
      await allocateNextCorrelative(selectedCompanyId, serie, Number(finalNum));
    }

    const formattedCorrelative = String(finalNum).padStart(6, '0');
    const docId = `${serie}-${formattedCorrelative}`;
    const now = new Date();
    const issueDate = now.toISOString().split('T')[0];
    const issueTime = now.toTimeString().split(' ')[0].substring(0, 5);

    const ticketData: TicketData = {
      id: docId,
      issueDate,
      issueTime,
      companyName: selectedCompany?.name || 'MI EMPRESA COMERCIAL',
      companyRuc: selectedCompany?.ruc || '20601090001',
      companyAddress: selectedCompany?.taxAddress || 'Av. Comercial 123, Lima',
      companyPhone: selectedCompany?.solUser || '912345678',
      customerName,
      customerDoc: customerDoc || undefined,
      customerPhone: customerPhone || undefined,
      paymentMethod,
      amountReceived: amountReceived ? parseFloat(amountReceived) : undefined,
      changeGiven: amountReceived ? changeGiven : undefined,
      items: items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal,
      })),
      total,
      currency: 'PEN',
      sellerName: currentUser?.name,
    };

    const newDoc: any = {
      id: docId,
      type: 'ticket',
      documentType: 'ticket',
      serie,
      correlative: Number(finalNum),
      issueDate,
      customerRuc: customerDoc || '00000000',
      customerName,
      total,
      status: 'emitido',
      sunatStatus: 'INTERNO',
      createdAt: now.toISOString(),
      metadata: {
        recipientName: customerName,
        recipientRuc: customerDoc,
        description: `Ticket de Venta N° ${docId}`,
        amount: total,
        netAmount: total,
        retention: 0,
        date: issueDate,
      },
    };

    addTaxDocument(newDoc);
    setGeneratedTicketData(ticketData);
    setShowPreviewModal(true);
    if (onSuccess) onSuccess(newDoc);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden text-slate-100 my-8">
          
          {/* Header */}
          <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Emisión de Ticket de Venta / Nota Interna
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-mono">
                    NO SUNAT
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Comprobante privado de venta rápida para mostrador, tienda y control de caja
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

          {/* Form Content */}
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">

            {/* Customer Section */}
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-amber-400" /> Datos del Cliente
                </h3>
                <button
                  type="button"
                  onClick={handleSetPublicCustomer}
                  className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-xl transition font-medium"
                >
                  ⚡ Público en General
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Nombre / Razón Social</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="PUBLICO EN GENERAL"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">DNI / RUC (Opcional)</label>
                  <input
                    type="text"
                    value={customerDoc}
                    onChange={(e) => setCustomerDoc(e.target.value)}
                    placeholder="71234567"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Celular WhatsApp (Opcional)</label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="912345678"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-amber-500"
                  />
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
                  className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl transition text-xs font-semibold flex items-center gap-1 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar Producto
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
                      className="col-span-5 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-amber-500"
                    />
                    <div className="col-span-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                        placeholder="Cant"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white text-center focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.10"
                        value={item.unitPrice}
                        onChange={(e) => handleUpdateItem(item.id, 'unitPrice', e.target.value)}
                        placeholder="P. Unit"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white text-center focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-between">
                      <span className="font-bold text-amber-400">S/ {item.subtotal.toFixed(2)}</span>
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

            {/* Payment Method & Cash Register Calculator */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Payment Method */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Forma de Pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'EFECTIVO', label: '💵 Efectivo' },
                    { id: 'YAPE', label: '📱 Yape' },
                    { id: 'PLIN', label: '📱 Plin' },
                    { id: 'TRANSFERENCIA', label: '🏦 Transf.' },
                    { id: 'TARJETA', label: '💳 Tarjeta' },
                    { id: 'CREDITO', label: '⏳ Crédito' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`py-2 px-2 rounded-xl border text-[11px] font-bold transition ${
                        paymentMethod === m.id
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Change Calculator */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Cálculo de Vuelto (Caja)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[11px] text-slate-400 mb-1">Monto Recibido</span>
                    <input
                      type="number"
                      step="0.50"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      placeholder={`S/ ${total.toFixed(2)}`}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-400 mb-1">Vuelto a Entregar</span>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm font-extrabold text-emerald-400">
                      S/ {changeGiven.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Summary */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/10 border border-amber-500/20 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">TOTAL VENTA INTERNA</span>
                <span className="text-2xl font-black text-amber-400">S/ {total.toFixed(2)}</span>
              </div>
              <button
                type="button"
                onClick={handleGenerateTicket}
                className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black px-6 py-3 rounded-2xl transition shadow-lg shadow-amber-500/20 flex items-center gap-2 text-sm uppercase tracking-wider"
              >
                <Printer className="w-5 h-5" /> Imprimir Ticket (80mm)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Preview Modal */}
      {showPreviewModal && generatedTicketData && (
        <TicketPreview
          data={generatedTicketData}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </>
  );
};
