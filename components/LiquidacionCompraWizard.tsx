import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { consultaService } from '../services/consultaService';
import { sunatService } from '../services/sunatService';
import { getNextCorrelative, allocateNextCorrelative } from '../src/services/api';
import { InvoiceItem, PendingInvoice } from '../types';
import { 
  X, User, Search, Loader2, FileText, Calendar, DollarSign, 
  CheckCircle2, AlertTriangle, Plus, Trash2, Eye, ArrowLeft, 
  Globe, ShieldCheck, ChevronRight, ChevronLeft, Send, Check
} from 'lucide-react';
import { InvoicePreview, InvoicePreviewData } from './InvoicePreview';
import { generarPdfDesdeElemento, descargarBlob } from '../services/pdfService';
import { enviarComprobanteWhatsApp, construirMensajeComprobante, esCelularValido, EnvioWhatsAppResult } from '../utils/whatsapp';

interface LiquidacionCompraWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (doc: any) => void;
}

const UNIDADES_SUNAT = [
  { code: 'KGM', label: 'Kilogramos (KGM)' },
  { code: 'TNE', label: 'Toneladas (TNE)' },
  { code: 'NIU', label: 'Unidades (NIU)' },
  { code: 'ZZ', label: 'Sacos / Bolsas / Cajas (ZZ)' },
  { code: 'MTR', label: 'Metros (MTR)' },
];

export const LiquidacionCompraWizard: React.FC<LiquidacionCompraWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser, selectedCompany, selectedCompanyId, sunatGlobalConfig, addTaxDocument, addPendingInvoice } = useStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Seller/Vendor (Persona sin RUC)
  const [sellerDocType, setSellerDocType] = useState<'1' | '4' | '7'>('1');
  const [sellerDocNumber, setSellerDocNumber] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [purchaseLocation, setPurchaseLocation] = useState('');
  const [sellerPhone, setSellerPhone] = useState('');
  const [isSearchingReniec, setIsSearchingReniec] = useState(false);
  const [reniecError, setReniecError] = useState('');

  // Series & Correlative
  const [serie, setSerie] = useState(selectedCompany?.serieLiquidacion || 'E001');
  const [correlative, setCorrelative] = useState<number | ''>('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState<'PEN' | 'USD'>('PEN');

  // Items
  const [items, setItems] = useState<InvoiceItem[]>([
    { quantity: 100, unit: 'KGM', description: 'Sacos de Maíz Amarillo Primario', unitPrice: 2.50, total: 250.00 }
  ]);

  // Tax & Retention Rates
  const [retentionRate, setRetentionRate] = useState<number>(1.5); // Default 1.5% Renta
  const [includeIgv, setIncludeIgv] = useState<boolean>(true); // IGV 18%

  // Emission State
  const [isEmitting, setIsEmitting] = useState(false);
  const [emittedDoc, setEmittedDoc] = useState<any | null>(null);
  const [emissionError, setEmissionError] = useState('');

  // Preview & PDF
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  // WhatsApp
  const [waPhone, setWaPhone] = useState('');
  const [waSending, setWaSending] = useState(false);
  const [waResult, setWaResult] = useState<EnvioWhatsAppResult | null>(null);

  // Fetch correlative when company or serie changes
  useEffect(() => {
    if (selectedCompanyId && serie) {
      getNextCorrelative(selectedCompanyId, serie)
        .then(res => {
          if (res?.next) setCorrelative(res.next);
        })
        .catch(() => {
          setCorrelative(1);
        });
    } else {
      setCorrelative(1);
    }
  }, [selectedCompanyId, serie]);

  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (it.total || 0), 0);
  }, [items]);

  const igv = useMemo(() => {
    return includeIgv ? Math.round(subtotal * 0.18 * 100) / 100 : 0;
  }, [subtotal, includeIgv]);

  const grossTotal = useMemo(() => {
    return subtotal + igv;
  }, [subtotal, igv]);

  const retentionAmount = useMemo(() => {
    return Math.round(grossTotal * (retentionRate / 100) * 100) / 100;
  }, [grossTotal, retentionRate]);

  const netTotalToPay = useMemo(() => {
    return Math.round((grossTotal - retentionAmount) * 100) / 100;
  }, [grossTotal, retentionAmount]);

  const isStepValid = useMemo(() => {
    switch (step) {
      case 1:
        return (
          sellerDocNumber.trim() !== '' &&
          sellerName.trim() !== '' &&
          purchaseLocation.trim() !== ''
        );
      case 2:
        return items.every(
          item =>
            item.description.trim() !== '' &&
            item.unit !== '' &&
            item.quantity > 0 &&
            item.unitPrice > 0
        );
      case 3:
        return retentionRate >= 0;
      default:
        return true;
    }
  }, [step, sellerDocNumber, sellerName, purchaseLocation, items, retentionRate]);

  if (!isOpen) return null;

  // Search RENIEC for DNI
  const handleSearchReniec = async () => {
    setReniecError('');
    if (!sellerDocNumber || sellerDocNumber.length !== 8) {
      setReniecError('El DNI debe tener 8 dígitos');
      return;
    }

    setIsSearchingReniec(true);
    try {
      const data = await consultaService.consultarDNI(sellerDocNumber);
      if (data && data.name) {
        setSellerName(data.name);
      } else {
        setReniecError('No se encontraron datos para este DNI en RENIEC. Ingrésalos manualmente.');
      }
    } catch (err: any) {
      setReniecError('Consulta a RENIEC no disponible. Ingresa los nombres manualmente.');
    } finally {
      setIsSearchingReniec(false);
    }
  };

  // Item helpers
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { quantity: 1, unit: 'KGM', description: '', unitPrice: 0, total: 0 }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      const q = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
      const p = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(item.unitPrice as string) || 0;
      item.total = Math.round(q * p * 100) / 100;
      updated[index] = item;
      return updated;
    });
  };

  // Preview Data Format
  const previewData: InvoicePreviewData = {
    serieNumero: `${serie}-${String(correlative || 1).padStart(8, '0')}`,
    documentType: 'LIQUIDACIÓN DE COMPRA ELECTRÓNICA',
    issueDate,
    currency,
    emitterName: selectedCompany?.businessName || selectedCompany?.name || currentUser?.name || 'EMPRESA EMISORA S.A.C.',
    emitterRuc: selectedCompany?.ruc || currentUser?.ruc || '20000000001',
    emitterAddress: selectedCompany?.taxAddress || 'LIMA, PERÚ',
    customerName: sellerName || 'VENDEDOR NO HABITUADO',
    customerDocNumber: sellerDocNumber || '00000000',
    customerDocTypeLabel: sellerDocType === '1' ? 'DNI' : sellerDocType === '4' ? 'C.E.' : 'PASAPORTE',
    customerAddress: purchaseLocation || 'LUGAR DE COMPRA',
    items,
    subtotal,
    igv,
    total: grossTotal,
    sunatStatus: 'ACEPTADO',
  };

  // Emit Liquidación de Compra
  const handleEmit = async () => {
    setEmissionError('');
    if (!sellerName.trim() || !sellerDocNumber.trim() || !purchaseLocation.trim()) {
      setEmissionError('Debes completar el número de documento, nombres del vendedor y lugar de compra.');
      return;
    }
    if (items.some(item => !item.description.trim() || item.quantity <= 0 || item.unitPrice <= 0)) {
      setEmissionError('Todos los ítems deben tener descripción, cantidad y precio unitario válidos.');
      return;
    }

    setIsEmitting(true);
    try {
      // Allocate correlative
      let finalCorr = correlative || 1;
      if (selectedCompanyId) {
        try {
          const resCorr = await allocateNextCorrelative(selectedCompanyId, serie, typeof correlative === 'number' ? correlative : undefined);
          if (resCorr?.next) finalCorr = resCorr.next;
        } catch {}
      }

      const formattedId = `${serie}-${String(finalCorr).padStart(8, '0')}`;
      const token = selectedCompany?.sunatToken || sunatGlobalConfig.sunatToken || '';
      const apiUrl = '';

      const payload = {
        documentId: formattedId,
        recipientDocType: sellerDocType,
        recipientDocNumber: sellerDocNumber,
        recipientName: sellerName,
        purchaseLocation,
        date: issueDate,
        items,
        subtotal,
        igv,
        retentionRate,
        retentionAmount,
        total: grossTotal,
        netTotal: netTotalToPay,
      };

      const resp = await sunatService.emitirLiquidacionCompra(payload, token, apiUrl, {
        ruc: selectedCompany?.ruc || currentUser?.ruc,
        user: selectedCompany?.solUser,
        pass: selectedCompany?.solPass,
        env: selectedCompany?.sunatEnv || 'PRODUCTION',
        certBase64: selectedCompany?.certBase64,
        certPass: selectedCompany?.certPass,
        emitterName: selectedCompany?.businessName || selectedCompany?.name || currentUser?.name
      }, serie, currency);

      const buildPendingLiquidacion = (errorMsg: string): PendingInvoice => ({
        id: formattedId,
        userId: currentUser?.id || '',
        companyId: selectedCompanyId || '',
        serie,
        correlative: Number(finalCorr) || 1,
        documentType: 'liquidacion_compra',
        payload: {
          invoiceData: {
            id: formattedId,
            issueDate,
            customerRuc: sellerDocNumber,
            customerName: sellerName,
            customerType: sellerDocType,
            purchaseLocation,
            items,
            subtotal,
            igv,
            retentionRate,
            retentionAmount,
            total: grossTotal,
            netTotal: netTotalToPay,
            currency: currency || 'PEN',
            documentType: '04'
          },
          credentials: {
            ruc: selectedCompany?.ruc || currentUser?.ruc,
            user: selectedCompany?.solUser,
            pass: selectedCompany?.solPass,
            env: selectedCompany?.sunatEnv || 'PRODUCTION',
            certBase64: selectedCompany?.certBase64,
            certPass: selectedCompany?.certPass,
            emitterName: selectedCompany?.businessName || selectedCompany?.name || currentUser?.name
          }
        },
        customerDocType: sellerDocType === '1' ? 'DNI' : 'RUC',
        customerDocNumber: sellerDocNumber,
        customerName: sellerName,
        customerPhone: sellerPhone,
        amount: netTotalToPay,
        createdAt: issueDate,
        lastAttempt: new Date().toISOString().split('T')[0],
        attemptCount: 0,
        status: 'PENDIENTE',
        lastError: errorMsg
      });

      if (resp.success) {
        const newDoc = {
          id: formattedId,
          userId: currentUser?.id || '',
          companyId: selectedCompanyId || '',
          accountantId: selectedCompany?.assignedAccountantId || '',
          name: `Liquidación de Compra ${formattedId} - ${sellerName}`,
          fileUrl: resp.xmlContent || '',
          mimeType: 'application/xml',
          uploadDate: issueDate,
          periodMonth: new Date(issueDate).toLocaleString('es-ES', { month: 'long' }),
          periodYear: new Date(issueDate).getFullYear(),
          sunatStatus: (resp.sunatStatus || 'ACEPTADO') as any,
          documentType: 'liquidacion_compra' as any,
          uploadedBy: 'USER' as const,
          xmlContent: resp.xmlContent,
          cdrBase64: resp.cdrBase64,
          metadata: {
            recipientName: sellerName,
            recipientRuc: sellerDocNumber,
            recipientPhone: sellerPhone,
            description: items[0]?.description || 'Liquidación de Compra Electrónica',
            amount: netTotalToPay,
            retention: retentionAmount,
            netAmount: netTotalToPay,
            date: issueDate,
          }
        };

        addTaxDocument(newDoc);
        setEmittedDoc(newDoc);
        setStep(4);
        if (onSuccess) onSuccess(newDoc);
      } else {
        const errMsg = resp.error || 'Error al emitir Liquidación de Compra a SUNAT.';
        addPendingInvoice(buildPendingLiquidacion(errMsg));
        setEmissionError(`${errMsg} Se guardó en "Pendientes SUNAT" para reintento automático.`);
      }
    } catch (err: any) {
      const errMsg = 'Error inesperado: ' + (err.message || 'Desconocido');
      if (typeof formattedId !== 'undefined') {
        try {
          addPendingInvoice(buildPendingLiquidacion(errMsg));
        } catch {}
      }
      setEmissionError(`${errMsg}. Se guardó en "Pendientes SUNAT" para reintento automático.`);
    } finally {
      setIsEmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 md:p-6 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-[2.5rem] max-w-4xl w-full p-6 md:p-8 shadow-2xl relative border-2 border-brand-100 max-h-[92vh] overflow-y-auto space-y-6">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 p-2.5 rounded-full hover:bg-gray-100 transition z-10"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3.5">
          <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200">
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base md:text-lg font-black text-gray-900 uppercase tracking-tight">
                Emisión de Liquidación de Compra Electrónica
              </h2>
              <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase">
                SUNAT 04 · {serie}
              </span>
            </div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
              Emitido por el comprador para adquisiciones a productores o vendedores sin RUC
            </p>
          </div>
        </div>

        {/* Wizard Step Indicator */}
        <div className="grid grid-cols-4 bg-gray-100 p-1.5 rounded-2xl gap-1 text-center">
          <div className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all ${step === 1 ? 'bg-white text-brand-600 shadow-xs' : 'text-gray-400'}`}>
            1. Vendedor sin RUC
          </div>
          <div className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all ${step === 2 ? 'bg-white text-brand-600 shadow-xs' : 'text-gray-400'}`}>
            2. Productos Primarios
          </div>
          <div className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all ${step === 3 ? 'bg-white text-brand-600 shadow-xs' : 'text-gray-400'}`}>
            3. Retención & Impuestos
          </div>
          <div className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all ${step === 4 ? 'bg-emerald-500 text-white shadow-xs' : 'text-gray-400'}`}>
            4. Emisión SUNAT
          </div>
        </div>

        {emissionError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-2 text-xs font-bold">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{emissionError}</span>
          </div>
        )}

        {/* STEP 1: DATOS DEL VENDEDOR */}
        {step === 1 && (
          <div className="space-y-5">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-2 border-b pb-2">
              <User className="w-4 h-4 text-brand-600" /> Datos del Vendedor (Persona Natural sin RUC)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Tipo Documento *</label>
                <select
                  value={sellerDocType}
                  onChange={e => setSellerDocType(e.target.value as any)}
                  className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none focus:border-brand-500"
                >
                  <option value="1">1 - DNI (8 dígitos)</option>
                  <option value="4">4 - Carnet de Extranjería</option>
                  <option value="7">7 - Pasaporte</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">N° Documento Identidad *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Ej. 45892011"
                    value={sellerDocNumber}
                    onChange={e => setSellerDocNumber(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none focus:border-brand-500"
                  />
                  {sellerDocType === '1' && (
                    <button
                      type="button"
                      onClick={handleSearchReniec}
                      disabled={isSearchingReniec}
                      className="px-4 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition shrink-0 flex items-center gap-1.5 shadow-sm"
                    >
                      {isSearchingReniec ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      <span>RENIEC</span>
                    </button>
                  )}
                </div>
                {reniecError && <p className="text-[10px] text-red-500 font-bold mt-1">{reniecError}</p>}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Nombres y Apellidos Completos *</label>
              <input
                type="text"
                required
                placeholder="Ej. Juan Carlos Pérez Gómez"
                value={sellerName}
                onChange={e => setSellerName(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none focus:border-brand-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Lugar de Compra / Adquisición *</label>
                <input
                  type="text"
                  placeholder="Ej. Huaral, Lima - Fundo San José"
                  value={purchaseLocation}
                  onChange={e => setPurchaseLocation(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Teléfono Celular (WhatsApp)</label>
                <input
                  type="text"
                  placeholder="Ej. 987654321"
                  value={sellerPhone}
                  onChange={e => setSellerPhone(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-gray-100">
              <button onClick={onClose} className="px-5 py-3 text-xs font-black uppercase text-gray-500 hover:bg-gray-100 rounded-2xl">
                Cancelar
              </button>
              <div className="flex flex-col items-end gap-1.5">
                {!isStepValid && (
                  <p className="text-[10px] text-amber-600 font-bold">Complete todos los campos obligatorios (*)</p>
                )}
                <button
                  disabled={!isStepValid}
                  onClick={() => {
                    if (!sellerDocNumber.trim() || !sellerName.trim() || !purchaseLocation.trim()) {
                      setReniecError('Ingresa el número de documento, nombres del vendedor y lugar de compra.');
                      return;
                    }
                    setStep(2);
                  }}
                  className="px-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider rounded-2xl transition shadow-md flex items-center gap-1"
                >
                  <span>Siguiente: Productos</span> <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: PRODUCTOS PRIMARIOS */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-600" /> Detalle de Productos Primarios
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3.5 py-2 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1 border border-brand-200"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Ítem
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-5">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Descripción del Producto</label>
                    <input
                      type="text"
                      placeholder="Ej. Sacos de Maíz Amarillo, Chatarra de Fierro..."
                      value={item.description}
                      onChange={e => handleUpdateItem(idx, 'description', e.target.value)}
                      className="w-full bg-white border border-gray-200 p-2.5 rounded-xl text-xs font-bold text-gray-900 outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Unidad SUNAT</label>
                    <select
                      value={item.unit}
                      onChange={e => handleUpdateItem(idx, 'unit', e.target.value)}
                      className="w-full bg-white border border-gray-200 p-2.5 rounded-xl text-xs font-bold text-gray-900 outline-none"
                    >
                      {UNIDADES_SUNAT.map(u => (
                        <option key={u.code} value={u.code}>{u.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => handleUpdateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-gray-200 p-2.5 rounded-xl text-xs font-bold text-gray-900 outline-none"
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">P. Unitario</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={item.unitPrice}
                        onChange={e => handleUpdateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-gray-200 p-2.5 rounded-xl text-xs font-bold text-gray-900 outline-none"
                      />
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition mt-4"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-gray-100">
              <button onClick={() => setStep(1)} className="px-5 py-3 text-xs font-black uppercase text-gray-500 hover:bg-gray-100 rounded-2xl flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <div className="flex flex-col items-end gap-1.5">
                {!isStepValid && (
                  <p className="text-[10px] text-amber-600 font-bold">Todos los ítems deben tener descripción, unidad, cantidad y precio válidos</p>
                )}
                <button
                  disabled={!isStepValid}
                  onClick={() => setStep(3)}
                  className="px-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider rounded-2xl transition shadow-md flex items-center gap-1"
                >
                  <span>Siguiente: Impuestos</span> <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: IMPUESTOS & RETENCIÓN */}
        {step === 3 && (
          <div className="space-y-5">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-2 border-b pb-2">
              <DollarSign className="w-4 h-4 text-emerald-600" /> Cálculos de IGV y Retención del Impuesto a la Renta
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-gray-50 rounded-3xl border border-gray-200 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-700">Configuración de Impuestos</h4>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeIgv}
                    onChange={e => setIncludeIgv(e.target.checked)}
                    className="rounded text-brand-600 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-gray-800">Aplica IGV (18%)</span>
                </label>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Tasa de Retención de Renta *</label>
                  <select
                    value={retentionRate}
                    onChange={e => setRetentionRate(parseFloat(e.target.value))}
                    className="w-full bg-white border border-gray-200 p-3 rounded-2xl text-xs font-bold text-gray-900 outline-none"
                  >
                    <option value={1.5}>1.5% - Retención Primaria Estándar</option>
                    <option value={4.0}>4.0% - Retención Especial</option>
                    <option value={0.0}>0.0% - Sin Retención</option>
                  </select>
                </div>
              </div>

              {/* Totals Summary Card */}
              <div className="p-5 bg-emerald-50/60 rounded-3xl border-2 border-emerald-200 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900">Resumen de Liquidación</h4>
                
                <div className="space-y-2 text-xs font-medium text-emerald-950">
                  <div className="flex justify-between">
                    <span>Subtotal Bienes:</span>
                    <span className="font-bold">S/ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IGV (18%):</span>
                    <span className="font-bold">S/ {igv.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-emerald-200 pt-1 text-red-700 font-bold">
                    <span>- Retención Renta ({retentionRate}%):</span>
                    <span>-S/ {retentionAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-emerald-300 pt-2 text-base font-black text-emerald-900">
                    <span>NETO A PAGAR:</span>
                    <span>S/ {netTotalToPay.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-gray-100">
              <button onClick={() => setStep(2)} className="px-5 py-3 text-xs font-black uppercase text-gray-500 hover:bg-gray-100 rounded-2xl flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setShowPreviewModal(true)}
                  className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-black uppercase tracking-wider rounded-2xl transition flex items-center gap-1.5"
                >
                  <Eye className="w-4 h-4" /> Vista Previa PDF
                </button>
                <div className="flex flex-col items-end gap-1.5">
                  {!isStepValid && (
                    <p className="text-[10px] text-amber-600 font-bold">Complete todos los campos obligatorios (*)</p>
                  )}
                  <button
                    onClick={handleEmit}
                    disabled={isEmitting || !isStepValid}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider rounded-2xl transition shadow-md flex items-center gap-2"
                  >
                    {isEmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    <span>Emitir a SUNAT ({serie})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: RESULTADO Y ACCIONES FINALES */}
        {step === 4 && emittedDoc && (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">
                ¡Liquidación de Compra Emitida Exitosamente!
              </h3>
              <p className="text-xs text-gray-500 mt-1 font-bold">
                Comprobante <strong className="text-gray-900">{emittedDoc.id}</strong> aceptado por SUNAT.
              </p>
            </div>

            {/* Quick Share Options */}
            <div className="p-5 bg-gray-50 rounded-3xl border border-gray-200 max-w-md mx-auto space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-700">Enviar Comprobante al Vendedor</h4>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Número de WhatsApp (ej. 987654321)"
                  value={waPhone || sellerPhone}
                  onChange={e => setWaPhone(e.target.value)}
                  className="flex-1 bg-white border border-gray-300 p-2.5 rounded-xl text-xs font-bold text-gray-900 outline-none"
                />
                <button
                  onClick={async () => {
                    const phoneToUse = waPhone || sellerPhone;
                    if (!phoneToUse || !esCelularValido(phoneToUse)) {
                      alert('Ingresa un número celular de 9 dígitos válido.');
                      return;
                    }
                    setWaSending(true);
                    const msg = construirMensajeComprobante({
                      tipo: 'factura',
                      serieNumero: emittedDoc.id,
                      cliente: sellerName,
                      monto: netTotalToPay,
                    });
                    let pdfBlob = new Blob();
                    if (pdfRef.current) {
                      pdfBlob = await generarPdfDesdeElemento(pdfRef.current, { filename: `${emittedDoc.id}.pdf` });
                    }
                    const res = await enviarComprobanteWhatsApp({
                      phone: phoneToUse,
                      text: msg,
                      pdfBlob,
                      pdfFilename: `${emittedDoc.id}.pdf`
                    });
                    setWaResult(res);
                    setWaSending(false);
                  }}
                  disabled={waSending}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 shadow-sm"
                >
                  {waSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Enviar WA</span>
                </button>
              </div>

              {waResult && (
                <p className="text-[10px] font-bold text-emerald-700">
                  {waResult.status === 'shared' ? '✓ Enviado por WhatsApp' : '✓ Enlace listo para enviar'}
                </p>
              )}
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-center gap-4">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition shadow-md"
              >
                Finalizar y Cerrar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden printable PDF */}
      {previewData && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: '800px', zIndex: -9999, opacity: 0.01, pointerEvents: 'none', background: '#ffffff' }}>
          <div ref={pdfRef}>
            <InvoicePreview data={previewData} />
          </div>
        </div>
      )}

      {/* PDF PREVIEW MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4">
            <button
              onClick={() => setShowPreviewModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <InvoicePreview data={previewData} />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-5 py-2.5 bg-gray-200 text-gray-800 rounded-xl text-xs font-black uppercase"
              >
                Cerrar
              </button>
              <button
                onClick={async () => {
                  if (!pdfRef.current) return;
                  setIsGeneratingPdf(true);
                  try {
                    const blob = await generarPdfDesdeElemento(pdfRef.current, { filename: `${previewData.serieNumero}.pdf` });
                    descargarBlob(blob, `${previewData.serieNumero}.pdf`);
                  } catch (e) {
                    console.error('Error al generar PDF:', e);
                  } finally {
                    setIsGeneratingPdf(false);
                  }
                }}
                disabled={isGeneratingPdf}
                className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5"
              >
                {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Descargar PDF A4
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
