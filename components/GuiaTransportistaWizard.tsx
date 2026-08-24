import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { consultaService } from '../services/consultaService';
import { sunatService } from '../services/sunatService';
import { getNextCorrelative, allocateNextCorrelative } from '../src/services/api';
import { InvoiceItem, PendingInvoice } from '../types';
import { 
  X, User, Search, Loader2, FileText, Calendar, Truck, MapPin, 
  CheckCircle2, AlertTriangle, Plus, Trash2, Eye, ArrowLeft, 
  Globe, ShieldCheck, ChevronRight, ChevronLeft, Send, Check
} from 'lucide-react';
import { InvoicePreview, InvoicePreviewData } from './InvoicePreview';
import { generarPdfDesdeElemento, descargarBlob } from '../services/pdfService';
import { enviarComprobanteWhatsApp, construirMensajeComprobante, esCelularValido, EnvioWhatsAppResult } from '../utils/whatsapp';

interface GuiaTransportistaWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (doc: any) => void;
}

export const GuiaTransportistaWizard: React.FC<GuiaTransportistaWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser, selectedCompany, selectedCompanyId, sunatGlobalConfig, addTaxDocument, addPendingInvoice } = useStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Remitente (Cliente que contrata el flete)
  const [senderDocType, setSenderDocType] = useState<'6' | '1'>('6');
  const [senderDocNumber, setSenderDocNumber] = useState('');
  const [senderName, setSenderName] = useState('');
  const [isSearchingSender, setIsSearchingSender] = useState(false);
  const [senderSearchError, setSenderSearchError] = useState('');

  // Destinatario (Consignatario que recibe)
  const [recipientDocType, setRecipientDocType] = useState<'6' | '1'>('6');
  const [recipientDocNumber, setRecipientDocNumber] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [isSearchingRecipient, setIsSearchingRecipient] = useState(false);
  const [recipientSearchError, setRecipientSearchError] = useState('');

  // Pagador del Flete
  const [payerType, setPayerType] = useState<'sender' | 'recipient' | 'third_party'>('sender');

  // Documentos Relacionados
  const [relatedDocNumber, setRelatedDocNumber] = useState(''); // e.g. T001-00000045 o F001-00000123

  // Series & Date
  const [serie, setSerie] = useState(selectedCompany?.serieGuiaTransporte || 'V001');
  const [correlative, setCorrelative] = useState<number | ''>('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);

  // Registro MTC y Carga
  const [mtcRegistrationNumber, setMtcRegistrationNumber] = useState('MTC-098234');
  const [transferStartDate, setTransferStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalGrossWeight, setTotalGrossWeight] = useState('100.00');
  const [weightUnit, setWeightUnit] = useState<'KGM' | 'TNE'>('KGM');
  const [packageCount, setPackageCount] = useState('10');

  // Vehículo y Conductor
  const [vehiclePlate, setVehiclePlate] = useState('XYZ-987');
  const [trailerPlate, setTrailerPlate] = useState('REM-456');
  const [driverDni, setDriverDni] = useState('');
  const [driverLicense, setDriverLicense] = useState('Q45892011');
  const [driverName, setDriverName] = useState('');
  const [isSearchingDriver, setIsSearchingDriver] = useState(false);

  // Ruta (Origen y Destino)
  const [originAddress, setOriginAddress] = useState('Av. Argentina 1450, Callao, Lima');
  const [destinationAddress, setDestinationAddress] = useState('Av. Los Frutales 320, Ate, Lima');

  // Bienes transportados
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: '1',
      description: 'Servicio de Flete y Transporte de Mercancías Generales',
      quantity: 1,
      unitPrice: 0,
      subtotal: 0,
      unitMeasure: 'ZZ',
    },
  ]);

  // Emission states
  const [isEmitting, setIsEmitting] = useState(false);
  const [emissionSuccess, setEmissionSuccess] = useState(false);
  const [emittedDoc, setEmittedDoc] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // WhatsApp
  const [isSendingWa, setIsSendingWa] = useState(false);
  const [waFeedback, setWaFeedback] = useState<EnvioWhatsAppResult | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  // Auto fetch correlative
  useEffect(() => {
    if (!isOpen || !selectedCompanyId) return;
    let isMounted = true;
    (async () => {
      try {
        const next = await getNextCorrelative(selectedCompanyId, serie);
        if (isMounted && next) setCorrelative(next);
      } catch (err) {
        console.warn('Error fetching correlative for V001:', err);
      }
    })();
    return () => { isMounted = false; };
  }, [isOpen, selectedCompanyId, serie]);

  // Preview Data
  const previewData: InvoicePreviewData | null = useMemo(() => {
    if (!emittedDoc) return null;
    return {
      id: emittedDoc.id,
      documentType: '31',
      issueDate: emittedDoc.issueDate,
      emitterName: selectedCompany?.name || 'EMPRESA DE TRANSPORTES S.A.C.',
      emitterRuc: selectedCompany?.ruc || '20601090001',
      customerName: emittedDoc.customerName,
      customerRuc: emittedDoc.customerRuc,
      items: items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal,
      })),
      total: 0,
      currency: 'PEN',
      sunatStatus: 'ACEPTADO',
    };
  }, [emittedDoc, selectedCompany, items]);

  if (!isOpen) return null;

  // Search Remitente
  const handleSearchSender = async () => {
    if (!senderDocNumber || (senderDocType === '6' && senderDocNumber.length !== 11) || (senderDocType === '1' && senderDocNumber.length !== 8)) {
      setSenderSearchError('Ingrese un número de documento válido (RUC 11 dígitos / DNI 8 dígitos)');
      return;
    }
    setIsSearchingSender(true);
    setSenderSearchError('');
    try {
      if (senderDocType === '6') {
        const res = await consultaService.consultarRUC(senderDocNumber);
        if (res.success && (res.razonSocial || res.name)) {
          setSenderName(res.razonSocial || res.name || '');
        } else {
          setSenderSearchError(res.error || 'RUC no encontrado en SUNAT');
        }
      } else {
        const res = await consultaService.consultarDNI(senderDocNumber);
        if (res.success && res.name) {
          setSenderName(res.name);
        } else {
          setSenderSearchError(res.error || 'DNI no encontrado en RENIEC');
        }
      }
    } catch (err: any) {
      setSenderSearchError(err.message || 'Error consultando documento');
    } finally {
      setIsSearchingSender(false);
    }
  };

  // Search Destinatario
  const handleSearchRecipient = async () => {
    if (!recipientDocNumber || (recipientDocType === '6' && recipientDocNumber.length !== 11) || (recipientDocType === '1' && recipientDocNumber.length !== 8)) {
      setRecipientSearchError('Ingrese un número de documento válido (RUC 11 dígitos / DNI 8 dígitos)');
      return;
    }
    setIsSearchingRecipient(true);
    setRecipientSearchError('');
    try {
      if (recipientDocType === '6') {
        const res = await consultaService.consultarRUC(recipientDocNumber);
        if (res.success && (res.razonSocial || res.name)) {
          setRecipientName(res.razonSocial || res.name || '');
          if (res.address && res.address !== '-') {
            setDestinationAddress(res.address);
          }
        } else {
          setRecipientSearchError(res.error || 'RUC no encontrado en SUNAT');
        }
      } else {
        const res = await consultaService.consultarDNI(recipientDocNumber);
        if (res.success && res.name) {
          setRecipientName(res.name);
        } else {
          setRecipientSearchError(res.error || 'DNI no encontrado en RENIEC');
        }
      }
    } catch (err: any) {
      setRecipientSearchError(err.message || 'Error consultando documento');
    } finally {
      setIsSearchingRecipient(false);
    }
  };

  // Search Driver DNI
  const handleSearchDriver = async () => {
    if (!driverDni || driverDni.length !== 8) return;
    setIsSearchingDriver(true);
    try {
      const res = await consultaService.consultarDNI(driverDni);
      if (res.success && res.name) {
        setDriverName(res.name);
      }
    } catch (err) {
      console.warn('Error buscando chofer:', err);
    } finally {
      setIsSearchingDriver(false);
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
        unitMeasure: 'NIU',
      } as any,
    ]);
  };

  const handleUpdateItem = (id: string, field: string, value: any) => {
    setItems(
      items.map((item: any) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter((i) => i.id !== id));
  };

  // Next step validation
  const handleNextStep = () => {
    setErrorMessage('');
    if (step === 1) {
      if (!senderDocNumber || !senderName) {
        setErrorMessage('Debe completar el RUC/DNI y la Razón Social del Remitente');
        return;
      }
      if (!recipientDocNumber || !recipientName) {
        setErrorMessage('Debe completar el RUC/DNI y la Razón Social del Destinatario');
        return;
      }
    } else if (step === 2) {
      if (!mtcRegistrationNumber) {
        setErrorMessage('Debe ingresar el Número de Registro MTC del transportista');
        return;
      }
      if (!totalGrossWeight || parseFloat(totalGrossWeight) <= 0) {
        setErrorMessage('Debe ingresar un Peso Bruto Total válido mayor a cero');
        return;
      }
    } else if (step === 3) {
      if (!vehiclePlate.trim()) {
        setErrorMessage('Debe ingresar la Placa Principal del Vehículo');
        return;
      }
      if (!driverLicense.trim()) {
        setErrorMessage('Debe ingresar la Licencia de Conducir del Chofer');
        return;
      }
    } else if (step === 4) {
      if (!originAddress || !destinationAddress) {
        setErrorMessage('Debe especificar tanto el Punto de Partida como el de Llegada');
        return;
      }
    } else if (step === 5) {
      if (items.some((i) => !i.description.trim())) {
        setErrorMessage('Todos los bienes deben tener una descripción');
        return;
      }
    }
    setStep((prev) => (prev < 6 ? ((prev + 1) as any) : prev));
  };

  // Submit & Emit to SUNAT
  const handleEmitToSunat = async () => {
    if (!selectedCompanyId) {
      setErrorMessage('No hay empresa seleccionada');
      return;
    }
    setIsEmitting(true);
    setErrorMessage('');

    try {
      let finalNum = correlative;
      if (!finalNum) {
        finalNum = await allocateNextCorrelative(selectedCompanyId, serie);
      } else {
        await allocateNextCorrelative(selectedCompanyId, serie, Number(finalNum));
      }

      const formattedCorrelative = String(finalNum).padStart(6, '0');
      const docId = `${serie}-${formattedCorrelative}`;

      const payload = {
        id: docId,
        documentType: '31',
        issueDate,
        senderRuc: senderDocNumber,
        senderName,
        recipientRuc: recipientDocNumber,
        recipientName,
        payerRuc: payerType === 'sender' ? senderDocNumber : recipientDocNumber,
        payerName: payerType === 'sender' ? senderName : recipientName,
        mtcRegistrationNumber,
        grossWeight: totalGrossWeight,
        weightUnit,
        packagesCount: packageCount,
        originAddress,
        destinationAddress,
        vehiclePlate: vehiclePlate.toUpperCase(),
        trailerPlate: trailerPlate ? trailerPlate.toUpperCase() : undefined,
        driverDni,
        driverLicense,
        driverName,
        docRefId: relatedDocNumber || undefined,
        items,
      };

      const userCredentials = {
        ruc: selectedCompany?.ruc || currentUser?.ruc,
        user: selectedCompany?.solUser || selectedCompany?.sunatUser,
        pass: selectedCompany?.solPass || selectedCompany?.sunatPass,
        certBase64: selectedCompany?.certBase64,
        certPass: selectedCompany?.certPass,
        env: selectedCompany?.sunatEnv || 'PRODUCTION',
        emitterName: selectedCompany?.businessName || selectedCompany?.name || 'EMPRESA DE TRANSPORTES S.A.C.'
      };

      const pendingPayload = {
        invoiceData: {
          id: docId,
          documentType: '31',
          issueDate,
          senderRuc,
          senderName,
          customerRuc: recipientDocNumber,
          customerName: recipientName,
          customerType: recipientDocType || (recipientDocNumber?.length === 8 ? '1' : '6'),
          payerRuc: payerType === 'sender' ? senderDocNumber : recipientDocNumber,
          payerName: payerType === 'sender' ? senderName : recipientName,
          emitterName: selectedCompany?.businessName || selectedCompany?.name || 'EMPRESA DE TRANSPORTES S.A.C.',
          mtcRegistrationNumber,
          items,
          total: 0,
          currency: 'PEN',
          grossWeight: totalGrossWeight,
          weightUnit,
          packagesCount: packageCount,
          originAddress,
          destinationAddress,
          vehiclePlate: vehiclePlate.toUpperCase(),
          trailerPlate: trailerPlate ? trailerPlate.toUpperCase() : undefined,
          driverLicense,
          driverDni,
          driverName,
          docRefId: relatedDocNumber || undefined
        },
        credentials: userCredentials
      };

      const buildPendingTransportista = (errorMsg: string): PendingInvoice => ({
        id: docId,
        userId: currentUser?.id || '',
        companyId: selectedCompanyId || '',
        serie,
        correlative: Number(finalNum) || 1,
        documentType: 'guia_transportista',
        payload: pendingPayload,
        customerDocType: recipientDocType === '1' || recipientDocNumber?.length === 8 ? 'DNI' : 'RUC',
        customerDocNumber: recipientDocNumber,
        customerName: recipientName,
        customerPhone: recipientPhone,
        amount: 0,
        createdAt: issueDate,
        lastAttempt: new Date().toISOString().split('T')[0],
        attemptCount: 0,
        status: 'PENDIENTE',
        lastError: errorMsg
      });

      const res = await sunatService.emitirGuiaTransportista(
        payload,
        'LOCAL_TOKEN',
        'http://localhost:3001/api',
        userCredentials,
        serie
      );

      if (res.success) {
        const newDoc: any = {
          id: docId,
          type: 'guia_transportista',
          documentType: 'guia_transportista',
          serie,
          correlative: Number(finalNum),
          issueDate,
          customerRuc: recipientDocNumber,
          customerName: recipientName,
          total: 0,
          status: 'emitido',
          sunatStatus: 'ACEPTADO',
          xmlContent: res.xmlContent,
          cdrBase64: res.cdrBase64,
          pdfUrl: res.pdfUrl,
          createdAt: new Date().toISOString(),
          extraData: payload,
        };

        addTaxDocument(newDoc);
        setEmittedDoc(newDoc);
        setEmissionSuccess(true);
        setStep(6);
        if (onSuccess) onSuccess(newDoc);
      } else {
        const errMsg = res.error || 'Error emitiendo Guía de Remisión Transportista ante SUNAT';
        addPendingInvoice(buildPendingTransportista(errMsg));
        setErrorMessage(`${errMsg}. Se guardó en "Pendientes SUNAT" para reintento automático.`);
      }
    } catch (err: any) {
      const errMsg = 'Error inesperado: ' + (err.message || 'Error de conexión con el motor SUNAT');
      if (typeof docId !== 'undefined') {
        try {
          addPendingInvoice(buildPendingTransportista(errMsg));
        } catch {}
      }
      setErrorMessage(`${errMsg}. Se guardó en "Pendientes SUNAT" para reintento automático.`);
    } finally {
      setIsEmitting(false);
    }
  };

  // WhatsApp sending
  const handleSendWhatsApp = async () => {
    if (!recipientPhone || !esCelularValido(recipientPhone)) {
      setWaFeedback({ success: false, error: 'Ingrese un número de celular peruano válido (9 dígitos)' });
      return;
    }
    setIsSendingWa(true);
    setWaFeedback(null);
    try {
      let pdfBlob = new Blob();
      if (pdfRef.current) {
        pdfBlob = await generarPdfDesdeElemento(pdfRef.current, {
          filename: `${emittedDoc.id}.pdf`,
        });
      }
      const mensaje = construirMensajeComprobante({
        tipo: 'factura',
        serieNumero: emittedDoc.id,
        cliente: recipientName,
        monto: 0,
      });

      const res = await enviarComprobanteWhatsApp({
        phone: recipientPhone,
        text: mensaje,
        pdfBlob,
        pdfFilename: `${emittedDoc.id}.pdf`,
      });
      setWaFeedback(res);
    } catch (err: any) {
      setWaFeedback({ success: false, error: err.message || 'Error al enviar por WhatsApp' });
    } finally {
      setIsSendingWa(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden text-slate-100 my-8">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-blue-950/50 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Guía de Remisión Transportista Electrónica
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
                  SUNAT 31 · Serie V001
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Emitido por la empresa de transportes para sustentar el flete de carga ante SUNAT
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

        {/* Steps indicator */}
        <div className="px-6 py-3 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between overflow-x-auto text-xs">
          {[
            { n: 1, title: 'Remitente / Dest' },
            { n: 2, title: 'Registro MTC / Carga' },
            { n: 3, title: 'Vehículo / Chofer' },
            { n: 4, title: 'Ruta Origen-Destino' },
            { n: 5, title: 'Bienes' },
            { n: 6, title: 'Emisión SUNAT' },
          ].map((s) => (
            <div
              key={s.n}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl transition ${
                step === s.n
                  ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30'
                  : step > s.n
                  ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                  : 'text-slate-500'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  step === s.n
                    ? 'bg-white text-blue-700 font-bold'
                    : step > s.n
                    ? 'bg-emerald-400 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {step > s.n ? '✓' : s.n}
              </span>
              <span className="whitespace-nowrap">{s.title}</span>
            </div>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* PASO 1: Remitente, Destinatario y Pagador */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Remitente */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                  <User className="w-4 h-4" /> Remitente (Quien contrata el envío)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Tipo Doc.</label>
                    <select
                      value={senderDocType}
                      onChange={(e) => setSenderDocType(e.target.value as any)}
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
                        value={senderDocNumber}
                        onChange={(e) => setSenderDocNumber(e.target.value)}
                        placeholder={senderDocType === '6' ? '20601090001' : '45892011'}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleSearchSender}
                        disabled={isSearchingSender}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl transition text-xs font-medium flex items-center gap-1 shrink-0"
                      >
                        {isSearchingSender ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Buscar
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Razón Social / Nombres</label>
                    <input
                      type="text"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="EMPRESA REMITENTE S.A.C."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                {senderSearchError && <p className="text-[11px] text-rose-400">{senderSearchError}</p>}
              </div>

              {/* Destinatario */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                  <User className="w-4 h-4" /> Destinatario (Consignatario que recibe)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Tipo Doc.</label>
                    <select
                      value={recipientDocType}
                      onChange={(e) => setRecipientDocType(e.target.value as any)}
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
                        value={recipientDocNumber}
                        onChange={(e) => setRecipientDocNumber(e.target.value)}
                        placeholder={recipientDocType === '6' ? '20554433221' : '71234567'}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleSearchRecipient}
                        disabled={isSearchingRecipient}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl transition text-xs font-medium flex items-center gap-1 shrink-0"
                      >
                        {isSearchingRecipient ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Buscar
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Razón Social / Nombres</label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="ALMACENES LIMA S.A.C."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                {recipientSearchError && <p className="text-[11px] text-rose-400">{recipientSearchError}</p>}
              </div>

              {/* Pagador del flete */}
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-3">
                <label className="block text-xs font-medium text-slate-400">Pagador del Flete de Transporte</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setPayerType('sender')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                      payerType === 'sender'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                    }`}
                  >
                    El Remitente
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayerType('recipient')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                      payerType === 'recipient'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                    }`}
                  >
                    El Destinatario
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayerType('third_party')}
                    className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                      payerType === 'third_party'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                    }`}
                  >
                    Tercero
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PASO 2: Registro MTC y Datos de Carga */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-semibold text-purple-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Registro MTC y Parámetros de la Carga
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">N° Registro MTC (Transportista)</label>
                    <input
                      type="text"
                      value={mtcRegistrationNumber}
                      onChange={(e) => setMtcRegistrationNumber(e.target.value)}
                      placeholder="MTC-098234"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Fecha Inicio de Traslado</label>
                    <input
                      type="date"
                      value={transferStartDate}
                      onChange={(e) => setTransferStartDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Peso Bruto Total</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={totalGrossWeight}
                        onChange={(e) => setTotalGrossWeight(e.target.value)}
                        placeholder="100.00"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-purple-500"
                      />
                      <select
                        value={weightUnit}
                        onChange={(e) => setWeightUnit(e.target.value as any)}
                        className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white shrink-0"
                      >
                        <option value="KGM">Kilos (KGM)</option>
                        <option value="TNE">Toneladas (TNE)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">N° de Bultos / Pallets</label>
                    <input
                      type="number"
                      value={packageCount}
                      onChange={(e) => setPackageCount(e.target.value)}
                      placeholder="10"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PASO 3: Vehículo y Conductor */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                  <Truck className="w-4 h-4" /> Datos de Vehículo y Conductor (Flete)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Placa Principal del Vehículo</label>
                    <input
                      type="text"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                      placeholder="XYZ-987"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Placa Carreta / Remolque (Opcional)</label>
                    <input
                      type="text"
                      value={trailerPlate}
                      onChange={(e) => setTrailerPlate(e.target.value.toUpperCase())}
                      placeholder="REM-456"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">DNI del Chofer</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={driverDni}
                        onChange={(e) => setDriverDni(e.target.value)}
                        placeholder="45892011"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleSearchDriver}
                        disabled={isSearchingDriver}
                        className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-xl transition text-xs font-medium shrink-0 flex items-center gap-1"
                      >
                        {isSearchingDriver ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Buscar
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Licencia de Conducir</label>
                    <input
                      type="text"
                      value={driverLicense}
                      onChange={(e) => setDriverLicense(e.target.value)}
                      placeholder="Q45892011"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-400 mb-1">Nombres Completos del Chofer</label>
                    <input
                      type="text"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="Carlos Alberto Mendoza Ruiz"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PASO 4: Ruta Origen-Destino */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Ruta de Transporte (Origen y Destino)
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Punto de Partida (Origen)</label>
                    <input
                      type="text"
                      value={originAddress}
                      onChange={(e) => setOriginAddress(e.target.value)}
                      placeholder="Av. Argentina 1450, Callao, Lima"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Punto de Llegada (Destino)</label>
                    <input
                      type="text"
                      value={destinationAddress}
                      onChange={(e) => setDestinationAddress(e.target.value)}
                      placeholder="Av. Los Frutales 320, Ate, Lima"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Doc. Referencia / Guía Remitente Asociada (Opcional)</label>
                    <input
                      type="text"
                      value={relatedDocNumber}
                      onChange={(e) => setRelatedDocNumber(e.target.value.toUpperCase())}
                      placeholder="T001-00000045"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PASO 5: Bienes */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" /> Bienes Transportados en el Flete
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl transition text-xs font-medium flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar Ítem
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center gap-3"
                  >
                    <span className="text-xs font-bold text-slate-500 w-5 text-center">{idx + 1}</span>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                      placeholder="Descripción del bien o servicio de carga"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={item.unitMeasure || 'NIU'}
                      onChange={(e) => handleUpdateItem(item.id, 'unitMeasure', e.target.value)}
                      className="w-28 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white"
                    >
                      <option value="NIU">Unidad (NIU)</option>
                      <option value="KGM">Kilos (KGM)</option>
                      <option value="TNE">Toneladas (TNE)</option>
                      <option value="ZZ">Servicio (ZZ)</option>
                    </select>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 1)}
                      className="w-20 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white text-center"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={items.length <= 1}
                      className="text-slate-500 hover:text-rose-400 disabled:opacity-30 transition p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PASO 6: Emisión a SUNAT / Resultado */}
          {step === 6 && (
            <div className="space-y-6 text-center py-4">
              {emissionSuccess ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Guía Transportista Emitida Exitosamente</h3>
                    <p className="text-xs text-emerald-400 font-mono mt-1">
                      Comprobante N° {emittedDoc?.id} · Estado SUNAT: ACEPTADO
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                    <button
                      onClick={() => setShowPreviewModal(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition text-xs font-semibold flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" /> Ver PDF / Vista Previa
                    </button>
                    {emittedDoc?.xmlContent && (
                      <button
                        onClick={() => descargarBlob(new Blob([emittedDoc.xmlContent], { type: 'text/xml' }), `${emittedDoc.id}.xml`)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-xl transition text-xs font-semibold flex items-center gap-2 border border-slate-700"
                      >
                        Descargar XML
                      </button>
                    )}
                  </div>

                  {/* WhatsApp send box */}
                  <div className="mt-6 p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-left space-y-3 max-w-md mx-auto">
                    <label className="block text-xs font-medium text-slate-300">
                      Enviar PDF por WhatsApp al Cliente / Chofer
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        placeholder="912345678"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        onClick={handleSendWhatsApp}
                        disabled={isSendingWa}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition text-xs font-semibold flex items-center gap-1 shrink-0"
                      >
                        {isSendingWa ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Enviar
                      </button>
                    </div>
                    {waFeedback && (
                      <p className={`text-xs ${waFeedback.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {waFeedback.success ? '¡Mensaje enviado por WhatsApp!' : waFeedback.error}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-300">
                    Se emitirá la Guía de Remisión Transportista <strong className="text-blue-400">Serie V001</strong> ante SUNAT.
                  </p>
                  <button
                    onClick={handleEmitToSunat}
                    disabled={isEmitting}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-3 rounded-2xl font-bold text-sm transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 mx-auto"
                  >
                    {isEmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Truck className="w-5 h-5" />}
                    Emitir a SUNAT (Serie V001)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        {step < 6 && (
          <div className="px-6 py-4 bg-slate-950/50 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as any) : prev))}
              disabled={step === 1}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition text-xs font-semibold flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition text-xs font-semibold flex items-center gap-1 shadow-md shadow-blue-600/20"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
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

      {/* PDF Modal Preview */}
      {showPreviewModal && previewData && (
        <InvoicePreview
          data={previewData}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </div>
  );
};
