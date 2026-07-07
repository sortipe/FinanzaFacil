import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { consultaService } from '../services/consultaService';
import { InvoiceItem } from '../types';
import {
  X, User, Search, Loader2, FileText, Calendar, DollarSign,
  CheckCircle2, AlertTriangle, Plus, Trash2, Eye, ArrowLeft,
  Globe, ShieldCheck, ChevronRight, ChevronLeft, FileInput, CloudOff, ToggleLeft, ToggleRight
} from 'lucide-react';

interface WizardData {
  customerDocType: 'DNI' | 'RUC';
  customerDocNumber: string;
  customerName: string;
  customerAddress: string;
  customerEmail: string;
  documentType: 'factura' | 'boleta';
  sendToSunat: boolean;
  serie: string;
  correlative: number | '';
  issueDate: string;
  currency: 'PEN' | 'USD';
  operationType: string;
  items: InvoiceItem[];
}

const getNextCorrelative = (userId: string, serie: string): number => {
  const key = `ff_corr_${userId}_${serie}`;
  const last = parseInt(localStorage.getItem(key) || '0', 10);
  return Math.max(last + 1, 1);
};

const saveCorrelative = (userId: string, serie: string, corr: number) => {
  localStorage.setItem(`ff_corr_${userId}_${serie}`, String(corr));
};

const padCorrelative = (n: number): string => String(n).padStart(8, '0');

const getDefaultData = (user?: any): WizardData => ({
  customerDocType: 'RUC',
  customerDocNumber: '',
  customerName: '',
  customerAddress: '',
  customerEmail: '',
  documentType: 'factura',
  sendToSunat: true,
  serie: user?.serieFactura || 'F001',
  correlative: 1,
  issueDate: new Date().toISOString().split('T')[0],
  currency: 'PEN',
  operationType: '0101',
  items: [{ quantity: 1, unit: 'NIU', description: '', unitPrice: 0, total: 0 }]
});

const STEPS = ['Cliente', 'Factura', 'Items', 'Resumen'];

interface EmitResult {
  id: string;
  name: string;
  sunatStatus: string;
  xmlContent?: string;
  cdrBase64?: string;
  amount?: number;
  customerName?: string;
}

interface Props {
  onClose: () => void;
  onEmitted: (result: EmitResult) => void;
}

export const InvoiceWizard: React.FC<Props> = ({ onClose, onEmitted }) => {
  const { currentUser, sunatGlobalConfig } = useStore();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(() => {
    const userId = currentUser?.id;
    const defaults = getDefaultData(currentUser);
    const serie = defaults.serie;
    const corr = userId ? getNextCorrelative(userId, serie) : 1;
    return { ...defaults, correlative: corr };
  });
  const [searching, setSearching] = useState(false);
  const [emitting, setEmitting] = useState(false);
  const [error, setError] = useState('');
  const [sunatResponse, setSunatResponse] = useState('');
  const [cdrInfo, setCdrInfo] = useState<{code: string; description: string} | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [consultaCpe, setConsultaCpe] = useState<{success: boolean; statusCode: string; description: string; raw: string} | null>(null);
  const [success, setSuccess] = useState(false);

  const extractCdrStatus = (soapXml: string): {code: string; description: string} | null => {
    try {
      const matchCode = soapXml.match(/<cbc:ResponseCode[^>]*>([^<]+)<\/cbc:ResponseCode>/);
      const matchDesc = soapXml.match(/<cbc:Description[^>]*>([^<]+)<\/cbc:Description>/);
      if (matchCode) return { code: matchCode[1], description: matchDesc?.[1] || '' };
    } catch {}
    return null;
  };

  const update = (partial: Partial<WizardData>) => setData(prev => ({ ...prev, ...partial }));

  const handleSearch = async () => {
    const doc = data.customerDocNumber;
    if (doc.length !== 8 && doc.length !== 11) { setError('El documento debe tener 8 (DNI) o 11 (RUC) dígitos'); return; }
    setSearching(true); setError('');
    try {
      if (doc.length === 8) {
        const res = await consultaService.consultarDNI(doc);
        if (res.success && res.name) update({ customerName: res.name });
        else setError(res.error || 'No se encontró el DNI');
      } else {
        const res = await consultaService.consultarRUC(doc);
        if (res.success && res.razonSocial) update({ customerName: res.razonSocial, customerAddress: res.address || '' });
        else setError(res.error || 'No se encontró el RUC');
      }
    } catch { setError('Error al consultar'); }
    finally { setSearching(false); }
  };

  const emitir = async () => {
    setEmitting(true); setError('');

    const isDni = data.customerDocType === 'DNI';
    const total = data.items.reduce((s, i) => s + i.total, 0);

    if (data.sendToSunat && (!currentUser?.solUser || !currentUser?.solPass)) {
      setError('Credenciales SOL no configuradas. Ve a Configuración SUNAT.'); setEmitting(false); return;
    }

    const payload = {
      invoiceData: {
        id: `${data.serie}-${typeof data.correlative === 'number' ? padCorrelative(data.correlative) : '00000001'}`,
        issueDate: data.issueDate,
        customerRuc: data.customerDocNumber,
        customerName: data.customerName,
        customerType: isDni ? '1' : '6',
        emitterName: currentUser?.businessName || 'MI EMPRESA S.A.C.',
        items: data.items.map(i => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.total
        })),
        total: total.toFixed(2),
        currency: data.currency,
        hasEstablishment: true
      },
      credentials: {
        ruc: currentUser?.ruc,
        user: currentUser?.solUser,
        pass: currentUser?.solPass,
        certBase64: currentUser?.certBase64,
        certPass: currentUser?.certPass,
        env: 'PRODUCTION'
      }
    };

    try {
      if (!data.sendToSunat) {
        // === FLUJO INTERNO (sin envío a SUNAT) ===
        if (currentUser?.id && typeof data.correlative === 'number') {
          saveCorrelative(currentUser.id, data.serie, data.correlative);
        }
        setSuccess(true);
        setCdrInfo({ code: '---', description: 'Interno - No enviado a SUNAT' });
        const paddedCorr = typeof data.correlative === 'number' ? padCorrelative(data.correlative) : '00000001';
        onEmitted({
          id: `${data.serie}-${paddedCorr}`,
          name: `${data.documentType === 'factura' ? 'F' : 'B'}${data.serie}-${paddedCorr}`,
          sunatStatus: 'INTERNO',
          amount: total,
          customerName: data.customerName
        });
        setEmitting(false);
        return;
      }

      // === FLUJO NORMAL (con envío a SUNAT) ===
      const response = await fetch('http://localhost:5555/emitir-factura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (result.success) {
        // Guardar correlativo usado
        if (currentUser?.id && typeof data.correlative === 'number') {
          saveCorrelative(currentUser.id, data.serie, data.correlative);
          // Pre-cargar siguiente correlativo para el próximo wizard
          localStorage.setItem(`ff_corr_next_${currentUser.id}_${data.serie}`, String(data.correlative + 1));
        }
        setSuccess(true);
        setSunatResponse(result.sunatResponse || '');
        const cdrInfoVal = result.cdrCode ? { code: result.cdrCode, description: result.cdrDesc || '' } : (result.cdrBase64 ? extractCdrStatus(result.sunatResponse) : null);
        setCdrInfo(cdrInfoVal);
        const paddedCorr = typeof data.correlative === 'number' ? padCorrelative(data.correlative) : '00000001';
        onEmitted({
          id: `${data.serie}-${paddedCorr}`,
          name: `${data.documentType === 'factura' ? 'F' : 'B'}${data.serie}-${paddedCorr}`,
          sunatStatus: 'ACEPTADO',
          xmlContent: result.xmlContent,
          cdrBase64: result.cdrBase64,
          amount: total,
          customerName: data.customerName
        });
        // Verificar estado con SUNAT (ConsultaCPE)
        setVerificando(true);
        try {
          const tipoDoc = data.documentType === 'factura' ? '01' : '03';
          const correlativoNum = parseInt(String(data.correlative).replace(/^0+/, ''), 10);
          const cpeResp = await fetch('http://localhost:5555/consultar-cpe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ruc: currentUser?.ruc,
              tipo: tipoDoc,
              serie: data.serie,
              numero: correlativoNum,
              credentials: { ruc: currentUser?.ruc, user: currentUser?.solUser, pass: currentUser?.solPass, env: 'PRODUCTION' }
            })
          });
          const cpeResult = await cpeResp.json();
          setConsultaCpe(cpeResult);
          if (cpeResult.success && cpeResult.statusCode === '0') {
            setCdrInfo({ code: cpeResult.statusCode, description: cpeResult.description || 'Aceptado' });
          }
        } catch {}
        setVerificando(false);
      } else {
        setError(result.error || 'Error del servidor SUNAT');
        if (result.sunatResponse) setSunatResponse(result.sunatResponse);
      }
    } catch (err: any) {
      setError('Error de conexión: ' + (err.message || 'Desconocido'));
    } finally { setEmitting(false); }
  };

  const canGoNext = (): boolean => {
    if (step === 0) return !!data.customerDocNumber && !!data.customerName;
    if (step === 1) return !!data.serie && !!data.issueDate;
    if (step === 2) return data.items.length > 0 && data.items.every(i => i.description && i.quantity > 0 && i.unitPrice >= 0);
    return true;
  };

  const next = () => { if (canGoNext()) { setStep(s => s + 1); setError(''); } };
  const prev = () => { setStep(s => s - 1); setError(''); };

  const addItem = () => setData(prev => ({
    ...prev,
    items: [...prev.items, { quantity: 1, unit: 'NIU', description: '', unitPrice: 0, total: 0 }]
  }));

  const updateItem = (idx: number, partial: Partial<InvoiceItem>) => setData(prev => {
    const items = [...prev.items];
    items[idx] = { ...items[idx], ...partial };
    if (partial.unitPrice !== undefined || partial.quantity !== undefined) {
      const unitPrice = partial.unitPrice ?? items[idx].unitPrice;
      const qty = partial.quantity ?? items[idx].quantity;
      items[idx].total = parseFloat((unitPrice * qty * 1.18).toFixed(2));
    }
    return { ...prev, items };
  });

  const removeItem = (idx: number) => setData(prev => ({
    ...prev, items: prev.items.filter((_, i) => i !== idx)
  }));

  const totalGeneral = data.items.reduce((s, i) => s + i.total, 0);
  const totalGravada = data.items.reduce((s, i) => s + (i.unitPrice * i.quantity), 0);
  const totalIgv = totalGeneral - totalGravada;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
      <div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 bg-brand-700 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3">
            <FileInput className="w-7 h-7" />
            <h3 className="text-lg font-black uppercase tracking-tight text-white">
              {success ? '¡Comprobante Emitido!' : `Emisión de ${data.documentType === 'factura' ? 'Factura' : 'Boleta'}${!data.sendToSunat ? ' Interna' : ''} Electrónica`}
            </h3>
          </div>
          {!emitting && !success && (
            <button onClick={onClose} className="text-white hover:rotate-90 transition-transform"><X className="w-6 h-6" /></button>
          )}
        </div>

        {!success && (
          <div className="flex px-8 pt-6 pb-2 bg-white shrink-0">
            {STEPS.map((label, i) => (
              <div key={i} className="flex-1 flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-black ${
                  i === step ? 'bg-brand-700 text-white shadow-md' :
                  i < step ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`ml-2 text-[9px] font-black uppercase hidden sm:block ${
                  i === step ? 'text-brand-700' : 'text-gray-400'
                }`}>{label}</span>
                {i < STEPS.length - 1 && <div className="flex-1 h-0.5 mx-2 bg-gray-100"><div className={`h-full ${i < step ? 'bg-green-500' : ''}`} style={{ width: i === step - 1 ? '100%' : '0%' }} /></div>}
              </div>
            ))}
          </div>
        )}

        <div className="p-8 overflow-y-auto flex-1">
          {success ? (
            <div className="text-center py-8 space-y-6">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-black text-green-900 uppercase">{data.documentType === 'factura' ? 'Factura' : 'Boleta'} Emitida</h4>
                <p className="text-sm text-gray-500 font-bold">{data.serie}-{typeof data.correlative === 'number' ? padCorrelative(data.correlative) : ''}</p>
                {!data.sendToSunat ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-full border border-amber-200 text-xs font-bold text-amber-700">
                    <CloudOff className="w-4 h-4" /> Interno — No enviado a SUNAT
                  </div>
                ) : verificando ? (
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Verificando con SUNAT...</div>
                ) : (<>
                  {consultaCpe ? (
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${
                        consultaCpe.statusCode === '0' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'
                      }`}>
                        {consultaCpe.statusCode === '0' ? '✅' : '⚠️'} SUNAT: Código {consultaCpe.statusCode || 'N/A'} — {consultaCpe.description || (consultaCpe.statusCode === '0' ? 'Aceptado' : 'Ver respuesta')}
                      </div>
                    ) : cdrInfo ? (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full border border-green-200 text-xs font-bold text-green-700">
                        CDR: {cdrInfo.code} — {cdrInfo.description || 'Aceptado'}
                      </div>
                    ) : null}
                  </>
                )}
                {sunatResponse && (
                  <details className="text-left bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                    <summary className="text-[10px] font-bold text-gray-500 uppercase p-3 cursor-pointer hover:bg-gray-100">Ver respuesta SUNAT</summary>
                    <pre className="text-[9px] text-gray-700 p-3 max-h-48 overflow-auto whitespace-pre-wrap break-all">{sunatResponse}</pre>
                  </details>
                )}
                {consultaCpe?.raw && (
                  <details className="text-left bg-blue-50 rounded-xl border border-blue-200 overflow-hidden">
                    <summary className="text-[10px] font-bold text-blue-600 uppercase p-3 cursor-pointer hover:bg-blue-100">Ver Consulta CPE (raw)</summary>
                    <pre className="text-[9px] text-gray-700 p-3 max-h-32 overflow-auto whitespace-pre-wrap break-all">{consultaCpe.raw}</pre>
                  </details>
                )}
              </div>
              <button onClick={onClose}
                className="w-full py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-green-700 transition">
                Regresar al Dashboard
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-sm">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  <span className="text-red-700 font-bold text-xs">{error}</span>
                  <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                </div>
              )}

              {/* STEP 1: CLIENTE */}
              {step === 0 && (
                <div className="space-y-5">
                  <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider">Datos del Cliente</h4>
                  <div className="flex gap-2">
                    {(['RUC', 'DNI'] as const).map(t => (
                      <button key={t} type="button" onClick={() => update({ customerDocType: t, customerDocNumber: '', customerName: '', customerAddress: '' })}
                        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                          data.customerDocType === t ? 'bg-brand-700 text-white shadow-md' : 'bg-gray-50 text-gray-400 border border-gray-200'
                        }`}>{t}</button>
                    ))}
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">N° Documento</label>
                    <div className="relative">
                      <input type="text" maxLength={11} placeholder={data.customerDocType === 'DNI' ? '12345678' : '20123456789'}
                        className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 pr-12 rounded-xl text-sm font-mono font-bold text-gray-900 outline-none focus:border-brand-600 focus:bg-white"
                        value={data.customerDocNumber} onChange={e => update({ customerDocNumber: e.target.value })} />
                      <button type="button" onClick={handleSearch} disabled={searching}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand-100 text-brand-700 rounded-lg hover:bg-brand-200 disabled:opacity-50 transition">
                        {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">{data.customerDocType === 'DNI' ? 'Nombres' : 'Razón Social'}</label>
                    <input type="text" placeholder={data.customerDocType === 'DNI' ? 'Juan Pérez' : 'EMPRESA S.A.C."'}
                      className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-brand-600 focus:bg-white uppercase"
                      value={data.customerName} onChange={e => update({ customerName: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Dirección</label>
                    <input type="text" placeholder="Av. Principal 123"
                      className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-brand-600 focus:bg-white uppercase"
                      value={data.customerAddress} onChange={e => update({ customerAddress: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Email (opcional)</label>
                    <input type="email" placeholder="cliente@email.com"
                      className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm text-gray-900 outline-none focus:border-brand-600 focus:bg-white"
                      value={data.customerEmail} onChange={e => update({ customerEmail: e.target.value })} />
                  </div>
                </div>
              )}

              {/* STEP 2: FACTURA */}
              {step === 1 && (
                <div className="space-y-5">
                  <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider">Datos del Comprobante</h4>
                  <div className="flex gap-2">
                    {(['factura', 'boleta'] as const).map(t => {
                      const serie = t === 'factura' ? (currentUser?.serieFactura || 'F001') : (currentUser?.serieBoleta || 'B001');
                      const handleClick = () => {
                        const next = currentUser?.id ? getNextCorrelative(currentUser.id, serie) : 1;
                        update({ documentType: t, serie, correlative: next });
                      };
                      return (
                        <button key={t} type="button" onClick={handleClick}
                          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            data.documentType === t ? 'bg-brand-700 text-white shadow-md' : 'bg-gray-50 text-gray-400 border border-gray-200'
                          }`}>{t === 'factura' ? 'Factura' : 'Boleta'}</button>
                      );
                    })}
                  </div>
                  {/* Toggle Enviar a SUNAT */}
                  <div className="flex items-center justify-between bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl">
                    <div className="flex items-center gap-2">
                      {data.sendToSunat ? <Globe className="w-4 h-4 text-blue-600" /> : <CloudOff className="w-4 h-4 text-amber-600" />}
                      <span className="text-xs font-bold text-gray-700">Enviar a SUNAT</span>
                      {!data.sendToSunat && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[8px] font-black uppercase">Interno</span>}
                    </div>
                    <button type="button" onClick={() => update({ sendToSunat: !data.sendToSunat })}
                      className={`relative w-12 h-6 rounded-full transition-all ${data.sendToSunat ? 'bg-brand-600' : 'bg-gray-300'}`}>
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${data.sendToSunat ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Serie</label>
                      <input type="text" maxLength={4} placeholder="F001"
                        className={`w-full bg-gray-50 border-2 p-3.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-brand-600 focus:bg-white uppercase ${
                          (data.documentType === 'factura' && !data.serie.startsWith('F')) || (data.documentType === 'boleta' && !data.serie.startsWith('B')) || data.serie.length !== 4
                            ? 'border-red-400 bg-red-50' : 'border-gray-200'
                        }`}
                        value={data.serie} onChange={e => {
                          const newSerie = e.target.value.toUpperCase();
                          const next = currentUser?.id ? getNextCorrelative(currentUser.id, newSerie) : 1;
                          update({ serie: newSerie, correlative: next });
                        }} />
                      {(data.documentType === 'factura' && !data.serie.startsWith('F')) &&
                        <p className="text-[9px] text-red-500 mt-1 ml-1">Serie de factura debe empezar con F</p>}
                      {(data.documentType === 'boleta' && !data.serie.startsWith('B')) &&
                        <p className="text-[9px] text-red-500 mt-1 ml-1">Serie de boleta debe empezar con B</p>}
                      {data.serie.length > 0 && data.serie.length !== 4 &&
                        <p className="text-[9px] text-red-500 mt-1 ml-1">Debe tener exactamente 4 caracteres</p>}
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">N° Correlativo</label>
                      <input type="text" maxLength={8}
                        className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-brand-600 focus:bg-white"
                        value={typeof data.correlative === 'number' ? padCorrelative(data.correlative) : ''}
                        onChange={e => {
                          const v = e.target.value.replace(/\D/g, '');
                          update({ correlative: v ? parseInt(v, 10) : '' });
                        }}
                        placeholder="00000000" />
                      <p className="text-[8px] text-gray-400 mt-1 ml-1">Se enviará como: {data.serie}-{typeof data.correlative === 'number' ? padCorrelative(data.correlative) : ''}</p>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Fecha de Emisión</label>
                      <input type="date"
                        className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-brand-600 focus:bg-white"
                        value={data.issueDate} onChange={e => update({ issueDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Moneda</label>
                      <select className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-brand-600 focus:bg-white"
                        value={data.currency} onChange={e => update({ currency: e.target.value as 'PEN' | 'USD' })}>
                        <option value="PEN">Soles (S/)</option>
                        <option value="USD">Dólares ($)</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Tipo Operación</label>
                      <select className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-brand-600 focus:bg-white"
                        value={data.operationType} onChange={e => update({ operationType: e.target.value })}>
                        <option value="0101">Venta Interna</option>
                        <option value="0200">Exportación</option>
                        <option value="0401">Venta no domiciliados</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: ITEMS */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider">Detalle de Items</h4>
                    <button type="button" onClick={addItem}
                      className="flex items-center gap-1 px-3 py-2 bg-brand-100 text-brand-700 rounded-lg text-[10px] font-black uppercase hover:bg-brand-200 transition">
                      <Plus className="w-3 h-3" /> Agregar Item
                    </button>
                  </div>
                  <div className="space-y-3">
                    {data.items.map((item, idx) => (
                      <div key={idx} className="p-4 bg-gray-50 rounded-2xl border-2 border-gray-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black text-gray-400 uppercase">Item #{idx + 1}</span>
                          {data.items.length > 1 && (
                            <button type="button" onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-600 transition">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-2">
                            <label className="text-[8px] font-black text-gray-400 uppercase mb-1 block">Cant.</label>
                            <input type="number" min={1} step={1} placeholder="1"
                              className="w-full bg-white border-2 border-gray-200 p-2 rounded-lg text-xs font-bold text-gray-900 outline-none focus:border-brand-600"
                              value={item.quantity} onChange={e => updateItem(idx, { quantity: parseInt(e.target.value) || 0 })} />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[8px] font-black text-gray-400 uppercase mb-1 block">Und.</label>
                            <select className="w-full bg-white border-2 border-gray-200 p-2 rounded-lg text-xs font-bold text-gray-900 outline-none focus:border-brand-600"
                              value={item.unit} onChange={e => updateItem(idx, { unit: e.target.value })}>
                              <option value="NIU">NIU</option>
                              <option value="ZZ">ZZ</option>
                              <option value="KG">KG</option>
                              <option value="M3">M3</option>
                            </select>
                          </div>
                          <div className="col-span-4">
                            <label className="text-[8px] font-black text-gray-400 uppercase mb-1 block">Descripción</label>
                            <input type="text" placeholder="Servicio / Producto"
                              className="w-full bg-white border-2 border-gray-200 p-2 rounded-lg text-xs font-bold text-gray-900 outline-none focus:border-brand-600"
                              value={item.description} onChange={e => updateItem(idx, { description: e.target.value })} />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[8px] font-black text-gray-400 uppercase mb-1 block">V. Unit.</label>
                            <input type="number" min={0} step={0.01} placeholder="0.00"
                              className="w-full bg-white border-2 border-gray-200 p-2 rounded-lg text-xs font-bold text-gray-900 outline-none focus:border-brand-600"
                              value={item.unitPrice} onChange={e => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })} />
                          </div>
                          <div className="col-span-2">
                            <label className="text-[8px] font-black text-gray-400 uppercase mb-1 block">Total</label>
                            <div className="w-full bg-gray-100 border-2 border-gray-100 p-2 rounded-lg text-xs font-black text-gray-700 text-right">
                              S/ {item.total.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 4: RESUMEN */}
              {step === 3 && (
                <div className="space-y-5">
                  <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider">Resumen y Emisión</h4>
                  <div className="border-4 border-brand-50 bg-white p-6 rounded-[1.5rem] shadow-inner space-y-4">
                    <div className="space-y-2 text-xs font-bold text-gray-700">
                      <h5 className="text-[9px] font-black text-brand-700 uppercase tracking-widest border-b border-brand-100 pb-2">Cliente</h5>
                      <p className="flex justify-between"><span className="text-gray-400">Documento:</span><span>{data.customerDocType}: {data.customerDocNumber}</span></p>
                      <p className="flex justify-between"><span className="text-gray-400">Nombre:</span><span>{data.customerName}</span></p>
                      {data.customerAddress && <p className="flex justify-between"><span className="text-gray-400">Dirección:</span><span>{data.customerAddress}</span></p>}
                    </div>
                    <div className="space-y-2 text-xs font-bold text-gray-700">
                      <h5 className="text-[9px] font-black text-brand-700 uppercase tracking-widest border-b border-brand-100 pb-2">Comprobante</h5>
                      <p className="flex justify-between"><span className="text-gray-400">Tipo:</span><span>{data.documentType === 'factura' ? 'Factura' : 'Boleta'} {data.serie}-{typeof data.correlative === 'number' ? padCorrelative(data.correlative) : ''} {!data.sendToSunat && <span className="text-amber-600 text-[8px] font-black">(Interno)</span>}</span></p>
                      <p className="flex justify-between"><span className="text-gray-400">Fecha:</span><span>{data.issueDate}</span></p>
                      <p className="flex justify-between"><span className="text-gray-400">Moneda:</span><span>{data.currency === 'PEN' ? 'Soles' : 'Dólares'}</span></p>
                    </div>
                    <div className="space-y-2 text-xs font-bold text-gray-700">
                      <h5 className="text-[9px] font-black text-brand-700 uppercase tracking-widest border-b border-brand-100 pb-2">Items</h5>
                      {data.items.map((item, idx) => (
                        <p key={idx} className="flex justify-between border-b border-gray-50 pb-1">
                          <span className="text-gray-400">{item.quantity} x {item.description}</span>
                          <span>S/ {item.total.toFixed(2)}</span>
                        </p>
                      ))}
                    </div>
                    <div className="ml-auto w-full max-w-[220px] space-y-2 pt-4 border-t-2 border-brand-700 text-right">
                      <p className="text-xs font-bold text-gray-500 flex justify-between">
                        <span>Subtotal (sin IGV):</span>
                        <span>S/ {totalGravada.toFixed(2)}</span>
                      </p>
                      <p className="text-xs font-bold text-gray-500 flex justify-between">
                        <span>IGV (18%):</span>
                        <span>S/ {totalIgv.toFixed(2)}</span>
                      </p>
                      <p className="text-brand-900 font-black text-sm flex justify-between">
                        <span>Total:</span>
                        <span className="text-brand-600 text-lg">S/ {totalGeneral.toFixed(2)}</span>
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={emitir} disabled={emitting}
                    className="w-full py-4 bg-brand-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center hover:bg-brand-900 transition-all disabled:opacity-60">
                    {emitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Emitiendo...</>
                    ) : data.sendToSunat ? (
                      <><Globe className="w-4 h-4 mr-2" /> Emitir Oficialmente a SUNAT</>
                    ) : (
                      <><FileText className="w-4 h-4 mr-2" /> Emitir como Interno (sin SUNAT)</>
                    )}
                  </button>
                </div>
              )}

              {/* NAVIGATION */}
              <div className="flex gap-3 mt-8">
                {step > 0 && (
                  <button type="button" onClick={prev} disabled={emitting}
                    className="flex-1 py-4 border-2 border-brand-100 text-brand-700 rounded-2xl font-black uppercase text-[10px] hover:bg-brand-50 transition flex items-center justify-center gap-2">
                    <ArrowLeft className="w-3.5 h-3.5" /> Anterior
                  </button>
                )}
                {step < STEPS.length - 1 && (
                  <button type="button" onClick={next} disabled={!canGoNext() || emitting}
                    className="flex-1 py-4 bg-brand-700 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl flex items-center justify-center gap-2 hover:bg-brand-900 transition disabled:opacity-50">
                    Siguiente <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
