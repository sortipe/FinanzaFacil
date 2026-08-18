import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { consultaService } from '../services/consultaService';
import { sunatService } from '../services/sunatService';
import { getNextCorrelative, allocateNextCorrelative } from '../src/services/api';
import { InvoiceItem } from '../types';
import { 
  X, User, Search, Loader2, FileText, Calendar, Truck, MapPin, 
  CheckCircle2, AlertTriangle, Plus, Trash2, Eye, ArrowLeft, 
  Globe, ShieldCheck, ChevronRight, ChevronLeft, Send, Check
} from 'lucide-react';
import { InvoicePreview, InvoicePreviewData } from './InvoicePreview';
import { generarPdfDesdeElemento, descargarBlob } from '../services/pdfService';
import { enviarComprobanteWhatsApp, construirMensajeComprobante, esCelularValido, EnvioWhatsAppResult } from '../utils/whatsapp';

interface GuiaRemisionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (doc: any) => void;
}

const REASONS_SUNAT = [
  { code: '01', label: '01 - Venta' },
  { code: '02', label: '02 - Compra' },
  { code: '04', label: '04 - Traslado entre establecimientos de la misma empresa' },
  { code: '08', label: '08 - Importación' },
  { code: '09', label: '09 - Exportación' },
  { code: '13', label: '13 - Otros motivos de traslado' },
];

export const GuiaRemisionWizard: React.FC<GuiaRemisionWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser, selectedCompany, selectedCompanyId, sunatGlobalConfig, addTaxDocument } = useStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Destinatario
  const [recipientDocType, setRecipientDocType] = useState<'6' | '1'>('6');
  const [recipientDocNumber, setRecipientDocNumber] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [relatedDocNumber, setRelatedDocNumber] = useState(''); // e.g. F001-00000123
  const [isSearchingRuc, setIsSearchingRuc] = useState(false);
  const [docSearchError, setDocSearchError] = useState('');

  // Series & Date
  const [serie, setSerie] = useState('T001');
  const [correlative, setCorrelative] = useState<number | ''>('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);

  // Transfer Data
  const [transferReason, setTransferReason] = useState('01');
  const [transportMode, setTransportMode] = useState<'01' | '02'>('02'); // 02=Privado, 01=Público
  const [transferStartDate, setTransferStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalGrossWeight, setTotalGrossWeight] = useState('50.00');
  const [weightUnit, setWeightUnit] = useState<'KGM' | 'TNE'>('KGM');
  const [packageCount, setPackageCount] = useState('5');

  // Route (Origin & Destination)
  const [startAddress, setStartAddress] = useState(selectedCompany?.taxAddress || 'AV. ARGENTINA 1450, LIMA');
  const [endAddress, setEndAddress] = useState('');

  // Transport details
  // Private transport (02)
  const [vehiclePlate, setVehiclePlate] = useState('ABC-123');
  const [driverDocNumber, setDriverDocNumber] = useState('');
  const [driverLicense, setDriverLicense] = useState('');
  const [driverName, setDriverName] = useState('');

  // Public transport (01)
  const [carrierRuc, setCarrierRuc] = useState('');
  const [carrierName, setCarrierName] = useState('');

  // Items
  const [items, setItems] = useState<InvoiceItem[]>([
    { quantity: 5, unit: 'NIU', description: 'Cajas de Repuestos Industriales', unitPrice: 100, total: 500 }
  ]);

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

  // Fetch next correlative
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

  if (!isOpen) return null;

  // Search RUC/DNI for recipient
  const handleSearchRecipient = async () => {
    setDocSearchError('');
    if (!recipientDocNumber.trim()) return;

    setIsSearchingRuc(true);
    try {
      if (recipientDocNumber.length === 11) {
        const data = await consultaService.consultarRUC(recipientDocNumber);
        if (data && (data.razonSocial || data.name)) {
          setRecipientName(data.razonSocial || data.name || '');
          if (data.address) setEndAddress(data.address);
        } else {
          setDocSearchError('No se encontró RUC en SUNAT');
        }
      } else if (recipientDocNumber.length === 8) {
        const data = await consultaService.consultarDNI(recipientDocNumber);
        if (data && data.name) {
          setRecipientName(data.name);
        } else {
          setDocSearchError('No se encontró DNI en RENIEC');
        }
      }
    } catch (err: any) {
      setDocSearchError('Consulta no disponible. Ingresa la razón social manualmente.');
    } finally {
      setIsSearchingRuc(false);
    }
  };

  // Item helpers
  const handleAddItem = () => {
    setItems(prev => [...prev, { quantity: 1, unit: 'NIU', description: '', unitPrice: 0, total: 0 }]);
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

  // Format Preview Data
  const previewData: InvoicePreviewData = {
    serieNumero: `${serie}-${String(correlative || 1).padStart(8, '0')}`,
    documentType: 'GUÍA DE REMISIÓN ELECTRÓNICA REMITENTE',
    issueDate,
    currency: 'PEN',
    emitterName: selectedCompany?.businessName || selectedCompany?.name || currentUser?.name || 'EMPRESA EMISORA S.A.C.',
    emitterRuc: selectedCompany?.ruc || currentUser?.ruc || '20000000001',
    emitterAddress: startAddress || 'LIMA, PERÚ',
    customerName: recipientName || 'DESTINATARIO',
    customerDocNumber: recipientDocNumber || '00000000001',
    customerDocTypeLabel: recipientDocType === '6' ? 'RUC' : 'DNI',
    customerAddress: endAddress || 'DIRECCIÓN DE LLEGADA',
    items,
    total: parseFloat(totalGrossWeight) || 0,
    sunatStatus: 'ACEPTADO',
  };

  // Emit Guía de Remisión
  const handleEmit = async () => {
    setEmissionError('');
    if (!recipientDocNumber.trim() || !recipientName.trim()) {
      setEmissionError('Debes ingresar el RUC/DNI y Razón Social del destinatario.');
      return;
    }
    if (!endAddress.trim()) {
      setEmissionError('Debes especificar la dirección del Punto de Llegada (Destino).');
      return;
    }

    setIsEmitting(true);
    try {
      let finalCorr = correlative || 1;
      if (selectedCompanyId) {
        try {
          const resCorr = await allocateNextCorrelative(selectedCompanyId, serie, typeof correlative === 'number' ? correlative : undefined);
          if (resCorr?.next) finalCorr = resCorr.next;
        } catch {}
      }

      const formattedId = `${serie}-${String(finalCorr).padStart(8, '0')}`;
      const token = selectedCompany?.sunatToken || sunatGlobalConfig.sunatToken || '';
      const apiUrl = selectedCompany?.sunatApiUrl || sunatGlobalConfig.sunatApiUrl || 'https://sandbox.apisunat.pe/api/v3';

      const payload = {
        date: issueDate,
        recipientDocType,
        recipientRuc: recipientDocNumber,
        recipientName,
        transferReason,
        transportMode,
        transferStartDate,
        totalGrossWeight: parseFloat(totalGrossWeight) || 1,
        weightUnit,
        packageCount: parseInt(packageCount) || 1,
        startAddress,
        endAddress,
        vehiclePlate: transportMode === '02' ? vehiclePlate : undefined,
        driverDocNumber: transportMode === '02' ? driverDocNumber : undefined,
        driverLicense: transportMode === '02' ? driverLicense : undefined,
        driverName: transportMode === '02' ? driverName : undefined,
        carrierRuc: transportMode === '01' ? carrierRuc : undefined,
        carrierName: transportMode === '01' ? carrierName : undefined,
        relatedDocNumber: relatedDocNumber.trim() || undefined,
        items,
      };

      const resp = await sunatService.emitirGuiaRemision(payload, token, apiUrl, {
        emitterName: selectedCompany?.businessName || selectedCompany?.name || currentUser?.name
      }, serie);

      if (resp.success) {
        const newDoc = {
          id: formattedId,
          userId: currentUser?.id || '',
          companyId: selectedCompanyId || '',
          accountantId: selectedCompany?.assignedAccountantId || '',
          name: `Guía de Remisión ${formattedId} - ${recipientName}`,
          fileUrl: resp.xmlContent || '',
          mimeType: 'application/xml',
          uploadDate: issueDate,
          periodMonth: new Date(issueDate).toLocaleString('es-ES', { month: 'long' }),
          periodYear: new Date(issueDate).getFullYear(),
          sunatStatus: (resp.sunatStatus || 'ACEPTADO') as any,
          documentType: 'factura' as any,
          uploadedBy: 'USER' as const,
          xmlContent: resp.xmlContent,
          cdrBase64: resp.cdrBase64,
          metadata: {
            recipientName,
            recipientRuc: recipientDocNumber,
            recipientPhone,
            description: `Traslado de bienes: ${items[0]?.description || 'Mercadería'}`,
            amount: parseFloat(totalGrossWeight) || 0,
            date: issueDate,
          }
        };

        addTaxDocument(newDoc);
        setEmittedDoc(newDoc);
        setStep(6);
        if (onSuccess) onSuccess(newDoc);
      } else {
        setEmissionError(resp.error || 'Error al emitir Guía de Remisión a SUNAT.');
      }
    } catch (err: any) {
      setEmissionError('Error inesperado: ' + err.message);
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
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-200">
            <Truck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base md:text-lg font-black text-gray-900 uppercase tracking-tight">
                Emisión de Guía de Remisión Electrónica Remitente
              </h2>
              <span className="bg-blue-100 text-blue-800 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase">
                SUNAT 09 · {serie}
              </span>
            </div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
              Sustenta el traslado de bienes dentro del país ante SUNAT y la Policía de Carreteras
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-3 md:grid-cols-6 bg-gray-100 p-1.5 rounded-2xl gap-1 text-center">
          <div className={`py-1.5 rounded-xl text-[9px] font-black uppercase ${step === 1 ? 'bg-white text-brand-600 shadow-xs' : 'text-gray-400'}`}>1. Destinatario</div>
          <div className={`py-1.5 rounded-xl text-[9px] font-black uppercase ${step === 2 ? 'bg-white text-brand-600 shadow-xs' : 'text-gray-400'}`}>2. Traslado</div>
          <div className={`py-1.5 rounded-xl text-[9px] font-black uppercase ${step === 3 ? 'bg-white text-brand-600 shadow-xs' : 'text-gray-400'}`}>3. Origen/Destino</div>
          <div className={`py-1.5 rounded-xl text-[9px] font-black uppercase ${step === 4 ? 'bg-white text-brand-600 shadow-xs' : 'text-gray-400'}`}>4. Vehículo</div>
          <div className={`py-1.5 rounded-xl text-[9px] font-black uppercase ${step === 5 ? 'bg-white text-brand-600 shadow-xs' : 'text-gray-400'}`}>5. Bienes</div>
          <div className={`py-1.5 rounded-xl text-[9px] font-black uppercase ${step === 6 ? 'bg-emerald-500 text-white shadow-xs' : 'text-gray-400'}`}>6. Emisión</div>
        </div>

        {emissionError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-2 text-xs font-bold">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{emissionError}</span>
          </div>
        )}

        {/* STEP 1: DESTINATARIO */}
        {step === 1 && (
          <div className="space-y-5">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-2 border-b pb-2">
              <User className="w-4 h-4 text-brand-600" /> Datos del Destinatario y Comprobante Relacionado
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Tipo Documento *</label>
                <select
                  value={recipientDocType}
                  onChange={e => setRecipientDocType(e.target.value as any)}
                  className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none"
                >
                  <option value="6">RUC (6)</option>
                  <option value="1">DNI (1)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">N° RUC o DNI Destinatario *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Ej. 206010900012 o 45892011"
                    value={recipientDocNumber}
                    onChange={e => setRecipientDocNumber(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSearchRecipient}
                    disabled={isSearchingRuc}
                    className="px-4 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition shrink-0 flex items-center gap-1.5 shadow-sm"
                  >
                    {isSearchingRuc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span>SUNAT/RENIEC</span>
                  </button>
                </div>
                {docSearchError && <p className="text-[10px] text-red-500 font-bold mt-1">{docSearchError}</p>}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Razón Social / Nombres Completos *</label>
              <input
                type="text"
                required
                placeholder="Ej. COMERCIALIZADORA LIMA S.A.C."
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Factura / Boleta Asociada (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. F001-00000123"
                  value={relatedDocNumber}
                  onChange={e => setRelatedDocNumber(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Teléfono Celular (WhatsApp Destinatario)</label>
                <input
                  type="text"
                  placeholder="Ej. 987654321"
                  value={recipientPhone}
                  onChange={e => setRecipientPhone(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-gray-100">
              <button onClick={onClose} className="px-5 py-3 text-xs font-black uppercase text-gray-500 hover:bg-gray-100 rounded-2xl">
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!recipientDocNumber.trim() || !recipientName.trim()) {
                    setDocSearchError('Ingresa el RUC/DNI y la Razón Social del destinatario.');
                    return;
                  }
                  setStep(2);
                }}
                className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition shadow-md flex items-center gap-1"
              >
                <span>Siguiente: Datos Traslado</span> <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: DATOS DEL TRASLADO */}
        {step === 2 && (
          <div className="space-y-5">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-2 border-b pb-2">
              <Truck className="w-4 h-4 text-brand-600" /> Motivo y Caracterización del Traslado
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Motivo del Traslado (SUNAT) *</label>
                <select
                  value={transferReason}
                  onChange={e => setTransferReason(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none"
                >
                  {REASONS_SUNAT.map(r => (
                    <option key={r.code} value={r.code}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Modalidad de Transporte *</label>
                <select
                  value={transportMode}
                  onChange={e => setTransportMode(e.target.value as any)}
                  className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none"
                >
                  <option value="02">02 - Transporte Privado (Vehículo Propio / Chofer)</option>
                  <option value="01">01 - Transporte Público (Empresa de Transporte Carga)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Fecha Inicio Traslado *</label>
                <input
                  type="date"
                  required
                  value={transferStartDate}
                  onChange={e => setTransferStartDate(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Peso Bruto Total *</label>
                <div className="flex gap-2">
                  <select
                    value={weightUnit}
                    onChange={e => setWeightUnit(e.target.value as any)}
                    className="bg-gray-50 border-2 border-gray-100 p-3 rounded-2xl text-xs font-black text-gray-900 outline-none"
                  >
                    <option value="KGM">Kilos (KGM)</option>
                    <option value="TNE">Toneladas (TNE)</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="50.00"
                    value={totalGrossWeight}
                    onChange={e => setTotalGrossWeight(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">N° Bultos / Paquetes *</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="5"
                  value={packageCount}
                  onChange={e => setPackageCount(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-gray-100">
              <button onClick={() => setStep(1)} className="px-5 py-3 text-xs font-black uppercase text-gray-500 hover:bg-gray-100 rounded-2xl flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition shadow-md flex items-center gap-1"
              >
                <span>Siguiente: Ruta Origen/Destino</span> <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: RUTA (ORIGEN Y DESTINO) */}
        {step === 3 && (
          <div className="space-y-5">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-2 border-b pb-2">
              <MapPin className="w-4 h-4 text-emerald-600" /> Pistas y Direcciones de la Ruta de Transporte
            </h3>

            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Punto de Partida (Origen / Almacén de Salida) *</label>
              <input
                type="text"
                required
                placeholder="Ej. Av. Argentina 1450, Cercado de Lima, Lima"
                value={startAddress}
                onChange={e => setStartAddress(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Punto de Llegada (Destino / Dirección de Entrega) *</label>
              <input
                type="text"
                required
                placeholder="Ej. Av. Larco 820, Miraflores, Lima"
                value={endAddress}
                onChange={e => setEndAddress(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none"
              />
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-gray-100">
              <button onClick={() => setStep(2)} className="px-5 py-3 text-xs font-black uppercase text-gray-500 hover:bg-gray-100 rounded-2xl flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <button
                onClick={() => {
                  if (!startAddress.trim() || !endAddress.trim()) {
                    setEmissionError('Debes ingresar la dirección de origen y destino.');
                    return;
                  }
                  setStep(4);
                }}
                className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition shadow-md flex items-center gap-1"
              >
                <span>Siguiente: Vehículo</span> <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: VEHÍCULO / TRANSPORTISTA */}
        {step === 4 && (
          <div className="space-y-5">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-2 border-b pb-2">
              <Truck className="w-4 h-4 text-purple-600" />
              {transportMode === '02' ? 'Datos del Vehículo y Conductor (Transporte Privado)' : 'Datos de la Empresa de Transporte (Transporte Público)'}
            </h3>

            {transportMode === '02' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Placa del Vehículo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. ABC-123"
                      value={vehiclePlate}
                      onChange={e => setVehiclePlate(e.target.value.toUpperCase())}
                      className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Licencia de Conducir Chofer *</label>
                    <input
                      type="text"
                      placeholder="Ej. Q45892011"
                      value={driverLicense}
                      onChange={e => setDriverLicense(e.target.value.toUpperCase())}
                      className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">DNI del Chofer</label>
                    <input
                      type="text"
                      placeholder="Ej. 45892011"
                      value={driverDocNumber}
                      onChange={e => setDriverDocNumber(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Nombre Chofer</label>
                    <input
                      type="text"
                      placeholder="Ej. Carlos Alberto Mendoza"
                      value={driverName}
                      onChange={e => setDriverName(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">RUC Empresa de Transportes *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 20554433221"
                    value={carrierRuc}
                    onChange={e => setCarrierRuc(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase block mb-1.5">Razón Social Transportista *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. TRANSPORTE Y CARGA EXPRESS S.A.C."
                    value={carrierName}
                    onChange={e => setCarrierName(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 outline-none"
                  />
                </div>
              </div>
            )}

            <div className="pt-4 flex items-center justify-between border-t border-gray-100">
              <button onClick={() => setStep(3)} className="px-5 py-3 text-xs font-black uppercase text-gray-500 hover:bg-gray-100 rounded-2xl flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <button
                onClick={() => setStep(5)}
                className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition shadow-md flex items-center gap-1"
              >
                <span>Siguiente: Bienes</span> <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: BIENES A TRASLADAR */}
        {step === 5 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-600" /> Detalle de Bienes a Trasladar
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3.5 py-2 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1 border border-brand-200"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Bien
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-2xl border border-gray-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-6">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Descripción del Bien</label>
                    <input
                      type="text"
                      placeholder="Ej. Cajas de Repuestos Industriales, Maquinaria..."
                      value={item.description}
                      onChange={e => handleUpdateItem(idx, 'description', e.target.value)}
                      className="w-full bg-white border border-gray-200 p-2.5 rounded-xl text-xs font-bold text-gray-900 outline-none"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Unidad SUNAT</label>
                    <select
                      value={item.unit}
                      onChange={e => handleUpdateItem(idx, 'unit', e.target.value)}
                      className="w-full bg-white border border-gray-200 p-2.5 rounded-xl text-xs font-bold text-gray-900 outline-none"
                    >
                      <option value="NIU">Unidades (NIU)</option>
                      <option value="KGM">Kilogramos (KGM)</option>
                      <option value="TNE">Toneladas (TNE)</option>
                      <option value="ZZ">Cajas / Paquetes (ZZ)</option>
                    </select>
                  </div>

                  <div className="md:col-span-3 flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => handleUpdateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
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
              <button onClick={() => setStep(4)} className="px-5 py-3 text-xs font-black uppercase text-gray-500 hover:bg-gray-100 rounded-2xl flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPreviewModal(true)}
                  className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-black uppercase tracking-wider rounded-2xl transition flex items-center gap-1.5"
                >
                  <Eye className="w-4 h-4" /> Vista Previa PDF
                </button>
                <button
                  onClick={handleEmit}
                  disabled={isEmitting}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition shadow-md flex items-center gap-2"
                >
                  {isEmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>Emitir Guía a SUNAT ({serie})</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: ÉXITO Y ACCIONES */}
        {step === 6 && emittedDoc && (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">
                ¡Guía de Remisión Emitida Exitosamente!
              </h3>
              <p className="text-xs text-gray-500 mt-1 font-bold">
                Comprobante <strong className="text-gray-900">{emittedDoc.id}</strong> aceptado por SUNAT.
              </p>
            </div>

            {/* Quick Share Options */}
            <div className="p-5 bg-gray-50 rounded-3xl border border-gray-200 max-w-md mx-auto space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-700">Enviar Guía por WhatsApp</h4>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Número WhatsApp Transportista/Cliente"
                  value={waPhone || recipientPhone}
                  onChange={e => setWaPhone(e.target.value)}
                  className="flex-1 bg-white border border-gray-300 p-2.5 rounded-xl text-xs font-bold text-gray-900 outline-none"
                />
                <button
                  onClick={async () => {
                    const phoneToUse = waPhone || recipientPhone;
                    if (!phoneToUse || !esCelularValido(phoneToUse)) {
                      alert('Ingresa un número celular de 9 dígitos válido.');
                      return;
                    }
                    setWaSending(true);
                    const msg = construirMensajeComprobante({
                      tipo: 'factura',
                      serieNumero: emittedDoc.id,
                      cliente: recipientName,
                      monto: parseFloat(totalGrossWeight) || 0,
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
