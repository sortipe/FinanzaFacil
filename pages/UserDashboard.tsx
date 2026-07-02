
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Expense, TaxDocument } from '../types';
import { Plus, Camera, Loader2, DollarSign, Search, Calendar, Tag, Image as ImageIcon, X, Clock, PieChart as PieChartIcon, BarChart as BarChartIcon, Upload, RefreshCw, Sparkles, Save, Hash, FileText, User, ShieldCheck, Lock, Eye, EyeOff, Download, ChevronDown, FileSpreadsheet, History, DownloadCloud, ExternalLink, PlusCircle, MessageCircleMore, Headphones, TrendingUp, TrendingDown, CalendarDays, CalendarRange, FileInput, ReceiptText, Printer, CheckCircle2, ArrowLeft, Globe, AlertTriangle, ExternalLink as ExtIcon, ShoppingBag, Briefcase, Users, HelpCircle } from 'lucide-react';
import { analyzeReceipt, fileToBase64 } from '../services/geminiService';
import { sunatService } from '../services/sunatService';
import { consultaService } from '../services/consultaService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { SunatSettings } from '../components/SunatSettings';


export const UserDashboard: React.FC = () => {
  const { currentUser, expenses, taxDocuments, addExpense, addTaxDocument, sunatGlobalConfig } = useStore();
  const [isUploading, setIsUploading] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'settings'>('dashboard');
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [docFilter, setDocFilter] = useState<'all' | 'rh' | 'factura' | 'pdt'>('all');
  const [previewDoc, setPreviewDoc] = useState<TaxDocument | null>(null);
  
  const downloadFile = (content: string, filename: string, type: string, isBase64: boolean = false) => {
    try {
      let blob;
      if (isBase64) {
        const binary = atob(content);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
        blob = new Blob([array], { type });
      } else {
        blob = new Blob([content], { type });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error("Download failed", err);
      alert("Error al descargar el archivo");
    }
  };
  
  // Invoice Flow States
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceStep, setInvoiceStep] = useState<'form' | 'preview' | 'sync'>('form');
  const [invoiceForm, setInvoiceForm] = useState({
    recipientRuc: '',
    recipientName: '',
    recipientAddress: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    serie: 'F001',
    currency: 'PEN',
    paymentType: 'CONTADO',
    hasDetraction: false,
    detractionCode: '001',
    detractionPercent: 10,
    isExport: false,
    hasEstablishment: true
  });
  
  // Receipt Flow States
  const [receiptStep, setReceiptStep] = useState<'form' | 'preview' | 'sync'>('form');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSunatPortal, setShowSunatPortal] = useState(false);
  const [sunatStatusMsg, setSunatStatusMsg] = useState('');
  const [syncError, setSyncError] = useState('');
  const [receiptForm, setReceiptForm] = useState({
    recipientName: '',
    recipientRuc: '',
    recipientAddress: '',
    description: '',
    amount: '',
    applyRetention: false,
    date: new Date().toISOString().split('T')[0]
  });

  const [isSearchingRuc, setIsSearchingRuc] = useState(false);

  const handleSearchReceiptDoc = async () => {
    const doc = receiptForm.recipientRuc;
    if (doc.length !== 8 && doc.length !== 11) {
       alert("El documento debe tener 8 (DNI) o 11 (RUC) dígitos.");
       return;
    }
    setIsSearchingRuc(true);
    try {
       if (doc.length === 8) {
         const res = await consultaService.consultarDNI(doc);
         if (res.success && res.name) {
           setReceiptForm(prev => ({ ...prev, recipientName: res.name! }));
         } else {
           alert(res.error || "No se encontró el DNI.");
         }
       } else {
         const res = await consultaService.consultarRUC(doc);
         if (res.success && res.razonSocial) {
           setReceiptForm(prev => ({ 
             ...prev, 
             recipientName: res.razonSocial!,
             recipientAddress: res.address || ''
           }));
         } else {
           alert(res.error || "No se encontró el RUC.");
         }
       }
    } catch (err) {
       alert("Error al consultar DNI/RUC");
    } finally {
       setIsSearchingRuc(false);
    }
  };

  const handleSearchInvoiceDoc = async () => {
    const doc = invoiceForm.recipientRuc;
    if (doc.length !== 8 && doc.length !== 11) {
       alert("El documento debe tener 8 (DNI) o 11 (RUC) dígitos.");
       return;
    }
    setIsSearchingRuc(true);
    try {
       if (doc.length === 8) {
         const res = await consultaService.consultarDNI(doc);
         if (res.success && res.name) {
           setInvoiceForm(prev => ({ ...prev, recipientName: res.name! }));
         } else {
           alert(res.error || "No se encontró el DNI.");
         }
       } else {
         const res = await consultaService.consultarRUC(doc);
         if (res.success && res.razonSocial) {
           setInvoiceForm(prev => ({ 
             ...prev, 
             recipientName: res.razonSocial!,
             recipientAddress: res.address || ''
           }));
         } else {
           alert(res.error || "No se encontró el RUC.");
         }
       }
    } catch (err) {
       alert("Error al consultar DNI/RUC");
    } finally {
       setIsSearchingRuc(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Expense Form State
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Alimentación');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [ruc, setRuc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [previewInternal, setPreviewInternal] = useState<string | null>(null);

  const myExpenses = useMemo(() => expenses.filter(e => e.userId === currentUser?.id), [expenses, currentUser]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthTotal = myExpenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((sum, e) => sum + e.amount, 0);

    const dailyData = Array.from({length: 7}, (_, i) => {
      const d = new Date(); d.setDate(now.getDate() - (6 - i));
      const dStr = d.toISOString().split('T')[0];
      return { 
        name: d.toLocaleDateString('es-ES', { weekday: 'short' }), 
        monto: myExpenses.filter(e => e.date === dStr).reduce((sum, e) => sum + e.amount, 0) 
      };
    });

    return { monthTotal, dailyData };
  }, [myExpenses]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const base64 = await fileToBase64(file);
      setPreviewInternal(base64);
      handleAnalyze(base64, file.type);
    }
  };

  const handleAnalyze = async (base64: string, mime: string) => {
    setAnalyzing(true);
    try {
      const data = await analyzeReceipt(base64, mime);
      setAmount(data.total.toString());
      setDescription(data.merchant);
      setDate(data.date);
      setCategory(data.category);
      if (data.ruc) setRuc(data.ruc);
      if (data.invoiceNumber) setInvoiceNumber(data.invoiceNumber);
    } catch (err) {
      console.error("AI Analysis failed", err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !currentUser) return;
    
    addExpense({
      id: Date.now().toString(),
      userId: currentUser.id,
      amount: parseFloat(amount),
      currency: 'PEN',
      description,
      date,
      category,
      internalVoucherUrl: previewInternal || undefined,
      accountantVoucherUrl: isPrivate ? undefined : (previewInternal || undefined),
      ruc,
      invoiceNumber,
      isPrivate
    });

    setAmount(''); setDescription(''); setPreviewInternal(null); setRuc(''); setInvoiceNumber(''); setIsPrivate(false);
    setIsUploading(false);
  };

  const handleReceiptFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as any;
    setReceiptForm(prev => ({ ...prev, [name]: type === 'checkbox' ? (e.target as any).checked : value }));
  };

  const handleOfficialSync = async () => {
    setSyncError('');
    const activeToken = currentUser?.sunatToken || sunatGlobalConfig.sunatToken;
    
    if (!currentUser?.user || !currentUser?.pass) {
      setSyncError("Credenciales SOL (usuario y contraseña) no configuradas en tu cuenta.");
      return;
    }
    if (!activeToken) {
      setSyncError("Token de Acceso APISUNAT no configurado. Obtén tu token en app.apisunat.pe.");
      return;
    }
    setReceiptStep('sync');
    setIsSyncing(true);
    setSunatStatusMsg('Iniciando comunicación con SUNAT...');
    
    try {
      const response = await sunatService.emitirReciboHonorarios(
        receiptForm, 
        activeToken,
        currentUser?.sunatApiUrl || sunatGlobalConfig.sunatApiUrl || 'http://localhost:5555',
        {
          ruc: currentUser?.ruc,
          user: currentUser?.user,
          pass: currentUser?.pass,
          certBase64: currentUser?.certBase64,
          certPass: currentUser?.certPass,
          emitterName: currentUser?.businessName,
          env: currentUser?.sunatEnv || 'BETA'
        }
      );

      
      if (response.success) {
        setSunatStatusMsg(`¡Éxito! Estado: ${response.sunatStatus}`);
        await new Promise(r => setTimeout(r, 1500));
        emitTaxDocument('RH', true, response.pdfUrl || '', response.sunatStatus || 'SENT', response.xmlUrl || '', (response as any).xmlContent, (response as any).cdrBase64);
      } else {
        setSyncError(`Error SUNAT: ${response.error}`);
        setReceiptStep('preview');
      }
    } catch (error: any) {
      setSyncError("Error de conexión con el servicio de SUNAT: " + (error?.message || "Desconocido"));
      setReceiptStep('preview');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleInvoiceOfficialSync = async () => {
    setSyncError('');
    const activeToken = currentUser?.sunatToken || sunatGlobalConfig.sunatToken;

    if (!currentUser?.user || !currentUser?.pass) {
      setSyncError("Credenciales SOL (usuario y contraseña) no configuradas en tu cuenta.");
      return;
    }
    if (!activeToken) {
      setSyncError("Token de Acceso APISUNAT no configurado. Obtén tu token en app.apisunat.pe.");
      return;
    }
    
    setInvoiceStep('sync');
    setIsSyncing(true);
    
    try {
      const response = await sunatService.emitirFactura(
        {
          ...invoiceForm,
          // ... rest of payload
          items: [
            {
              description: invoiceForm.description,
              quantity: 1,
              unitPrice: parseFloat(invoiceForm.amount) / 1.18 // Calculamos el valor base para que el total coincida
            }
          ],
          totalIgv: parseFloat(invoiceForm.amount) - (parseFloat(invoiceForm.amount) / 1.18),
          total: parseFloat(invoiceForm.amount)
        }, 
        activeToken,
        currentUser?.sunatApiUrl || sunatGlobalConfig.sunatApiUrl || 'http://localhost:5555',
        {
          ruc: currentUser?.ruc,
          user: currentUser?.user,
          pass: currentUser?.pass,
          certBase64: currentUser?.certBase64,
          certPass: currentUser?.certPass,
          emitterName: currentUser?.businessName,
          env: currentUser?.sunatEnv || 'BETA'
        },
        invoiceForm.serie,
        invoiceForm.currency
      );

      
      if (response.success) {
        await new Promise(r => setTimeout(r, 1500));
        emitTaxDocument('FACTURA', true, response.pdfUrl || '', response.sunatStatus || 'SENT', response.xmlUrl || '', (response as any).xmlContent, (response as any).cdrBase64);
      } else {
        setSyncError(`Error SUNAT: ${response.error}`);
        setInvoiceStep('preview');
      }
    } catch (error: any) {
      setSyncError("Error de conexión con el servicio de SUNAT: " + (error?.message || "Desconocido"));
      setInvoiceStep('preview');
    } finally {
      setIsSyncing(false);
    }
  };

  const emitTaxDocument = (type: 'RH' | 'FACTURA', isOfficial: boolean, pdfUrl: string = '', sunatStatus: string = 'PENDING', xmlUrl: string = '', xmlContent?: string, cdrBase64?: string) => {
    if (!currentUser) return;
    
    let finalXmlUrl = xmlUrl;
    if (xmlContent) {
      const blob = new Blob([xmlContent], { type: 'text/xml' });
      finalXmlUrl = URL.createObjectURL(blob);
    }

    let cdrUrl = '';
    if (cdrBase64) {
      const binary = atob(cdrBase64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
      const blob = new Blob([array], { type: 'application/zip' });
      cdrUrl = URL.createObjectURL(blob);
    }
    const form = type === 'RH' ? receiptForm : invoiceForm;
    const total = parseFloat(form.amount);
    const retention = type === 'RH' && (form as any).applyRetention ? total * 0.08 : 0;
    
    const newDoc: TaxDocument = {
      id: `${type}-${Date.now()}`,
      userId: currentUser.id,
      accountantId: currentUser.assignedAccountantId || 'u2',
      name: type === 'RH' ? `R. Honorarios E001-${Math.floor(Math.random()*10000)}` : `Factura F001-${Math.floor(Math.random()*10000)}`,
      fileUrl: pdfUrl, // URL real proporcionada por la API
      pdfUrl: pdfUrl,
      xmlUrl: finalXmlUrl,
      cdrUrl: cdrUrl,
      xmlContent: xmlContent,
      cdrBase64: cdrBase64,
      mimeType: 'application/pdf',
      uploadDate: new Date().toISOString().split('T')[0],
      periodMonth: new Date().toLocaleDateString('es-ES', { month: 'long' }),
      periodYear: new Date().getFullYear(),
      sunatStatus: sunatStatus as any,
      sunatHash: isOfficial ? Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join('') : undefined,
      metadata: { ...form, amount: total, retention, netAmount: total - retention } as any
    };

    addTaxDocument(newDoc);
    
    // También agregamos al historial de movimientos general
    addExpense({
      id: `EXP-${Date.now()}`,
      userId: currentUser.id,
      amount: total,
      currency: 'PEN',
      description: `${type === 'RH' ? 'Recibo' : 'Factura'} a ${form.recipientName}`,
      date: new Date().toISOString().split('T')[0],
      category: type === 'RH' ? 'Ingresos' : 'Ventas',
      ruc: form.recipientRuc,
      isPrivate: false
    });
    if (type === 'RH') {
      setShowReceiptModal(false);
      setReceiptStep('form');
    } else {
      setShowInvoiceModal(false);
      setInvoiceStep('form');
    }
  };

  if (!currentUser) return null;
  const filteredDocs = taxDocuments.filter(d => 
    d.userId === currentUser.id && 
    (docFilter === 'all' || 
     (docFilter === 'rh' ? d.id.startsWith('RH-') : 
      docFilter === 'factura' ? d.id.startsWith('FACTURA-') : 
      !d.id.startsWith('RH-') && !d.id.startsWith('FACTURA-')))
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Hola, {currentUser.name}</h2>
          <p className="text-gray-500 text-sm font-medium tracking-tight">Gestiona tus finanzas personales y tributarias</p>
        </div>
        
        {(!currentUser.user || !currentUser.pass) && (
          <div className="flex-1 bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl flex items-center animate-pulse">
            <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 shrink-0" />
            <div>
              <p className="text-xs font-black text-amber-900 uppercase tracking-tighter">Acceso SUNAT Pendiente</p>
              <p className="text-[10px] text-amber-700 font-bold uppercase">Configura tu usuario y clave SOL en el perfil para emitir comprobantes.</p>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 w-full lg:w-auto items-center">
          {/* Bloque Ingresos */}
          <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md p-1.5 rounded-[2rem] border border-gray-100 shadow-sm w-full lg:w-auto">
             <div className="px-4 py-2 rounded-2xl bg-brand-50 text-brand-700 font-black text-[10px] uppercase tracking-widest flex items-center">
                <TrendingUp className="w-4 h-4 mr-2" /> INGRESOS
             </div>
             <div className="flex gap-1.5">
                <button onClick={() => setShowInvoiceModal(true)} className="bg-brand-700 text-white px-4 py-2.5 rounded-xl hover:bg-brand-900 transition flex items-center shadow-sm font-black text-[9px] uppercase tracking-wider active:scale-95">
                  <FileInput className="w-3.5 h-3.5 mr-1.5" /> FACTURACIÓN
                </button>
                <button onClick={() => setShowReceiptModal(true)} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition flex items-center shadow-sm font-black text-[9px] uppercase tracking-wider active:scale-95">
                  <ReceiptText className="w-3.5 h-3.5 mr-1.5" /> RECIBO RH
                </button>
             </div>
          </div>

          {/* Bloque Egresos */}
          <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md p-1.5 rounded-[2rem] border border-gray-100 shadow-sm w-full lg:w-auto">
             <div className="px-4 py-2 rounded-2xl bg-orange-50 text-orange-600 font-black text-[10px] uppercase tracking-widest flex items-center">
                <TrendingDown className="w-4 h-4 mr-2" /> EGRESOS
             </div>
             <button onClick={() => setIsUploading(!isUploading)} className={`px-5 py-2.5 rounded-xl transition flex items-center shadow-sm font-black text-[9px] uppercase tracking-wider active:scale-95 ${isUploading ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-brand-600 text-white hover:bg-brand-700'}`}>
                {isUploading ? <X className="w-3.5 h-3.5 mr-1.5"/> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                {isUploading ? 'Cerrar' : 'SUBIR GASTO'}
             </button>
          </div>

          <button 
            onClick={() => setActiveView(activeView === 'dashboard' ? 'settings' : 'dashboard')} 
            className={`p-3 rounded-2xl transition shadow-lg flex items-center justify-center active:scale-95 ${activeView === 'settings' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-100'}`}
          >
            <ShieldCheck className="w-5 h-5" />
          </button>
        </div>
      </header>

      {activeView === 'settings' ? (
        <div className="animate-fade-in-up">
           <button onClick={() => setActiveView('dashboard')} className="mb-6 flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-800 transition">
             <ArrowLeft className="w-4 h-4" /> Volver al Dashboard
           </button>
           <SunatSettings />
        </div>
      ) : (
        <>

      {/* FORMULARIO DE GASTOS - DISEÑO MEJORADO CON ALTO CONTRASTE */}
      {isUploading && (
        <div className="bg-white rounded-[2rem] shadow-2xl border-2 border-brand-100 p-6 md:p-10 animate-fade-in-up relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Sparkles className="w-24 h-24 text-brand-500" />
          </div>
          
          <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight mb-8 flex items-center">
             <div className="p-2 bg-brand-50 rounded-lg mr-3"><PlusCircle className="w-5 h-5 text-brand-600"/></div>
             Registrar Gasto con IA
          </h3>

          <form onSubmit={handleSubmitExpense} className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Foto y Cámara */}
            <div className="space-y-6">
               <div 
                 onClick={() => fileInputRef.current?.click()}
                 className={`relative h-64 rounded-3xl border-4 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden group ${previewInternal ? 'border-brand-500 bg-white' : 'border-gray-100 bg-gray-50 hover:border-brand-300'}`}
               >
                 {previewInternal ? (
                   <>
                    <img src={`data:image/jpeg;base64,${previewInternal}`} className="w-full h-full object-contain" alt="Preview" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white font-black uppercase text-xs">Cambiar Imagen</div>
                   </>
                 ) : (
                   <>
                    <div className="p-4 bg-white rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform"><Camera className="w-10 h-10 text-brand-500"/></div>
                    <p className="text-sm font-black text-gray-500 uppercase tracking-widest text-center px-4">Tomar Foto o Elegir Galería</p>
                    <p className="text-[10px] text-gray-400 mt-1 font-bold">Compatible con cámara móvil</p>
                   </>
                 )}
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileSelect} />
                 
                 {analyzing && (
                   <div className="absolute inset-0 bg-brand-600/90 flex flex-col items-center justify-center text-white space-y-4 backdrop-blur-sm">
                      <Loader2 className="w-12 h-12 animate-spin"/>
                      <p className="text-sm font-black uppercase tracking-widest animate-pulse">Escaneando recibo...</p>
                   </div>
                 )}
               </div>

               {/* SELECTOR DE PRIVACIDAD */}
               <div className="bg-gray-50 p-6 rounded-3xl border-2 border-gray-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-xl ${isPrivate ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {isPrivate ? <Lock className="w-5 h-5"/> : <Users className="w-5 h-5"/>}
                      </div>
                      <div>
                        <p className="text-xs font-black text-gray-800 uppercase tracking-tighter">Privacidad del Gasto</p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">{isPrivate ? 'Privado (Solo yo)' : 'Compartido (Contador)'}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setIsPrivate(!isPrivate)} className={`w-14 h-8 rounded-full transition-all relative shadow-inner ${isPrivate ? 'bg-red-500' : 'bg-green-500'}`}>
                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${isPrivate ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
               </div>
            </div>

            {/* CAMPOS DE DATOS - FONDO CLARO Y TEXTO NEGRO PARA MÁXIMA VISIBILIDAD */}
            <div className="space-y-5">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Establecimiento / Comercio</label>
                  <div className="relative">
                    <ShoppingBag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <input 
                      type="text" 
                      required 
                      className="w-full bg-white border-gray-200 border-2 p-4 pl-12 rounded-2xl text-sm font-bold text-gray-900 focus:border-brand-500 outline-none transition-all uppercase placeholder:text-gray-300" 
                      placeholder="Nombre de la empresa"
                      value={description} 
                      onChange={e => setDescription(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Monto (S/)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-600" />
                      <input 
                        type="number" 
                        step="0.01" 
                        required 
                        className="w-full bg-white border-gray-200 border-2 p-4 pl-12 rounded-2xl text-sm font-black text-gray-900 focus:border-brand-500 outline-none transition-all" 
                        placeholder="0.00"
                        value={amount} 
                        onChange={e => setAmount(e.target.value)} 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Fecha</label>
                    <input 
                      type="date" 
                      required 
                      className="w-full bg-white border-gray-200 border-2 p-4 rounded-2xl text-sm font-bold text-gray-900 focus:border-brand-500 outline-none transition-all" 
                      value={date} 
                      onChange={e => setDate(e.target.value)} 
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">RUC del Emisor</label>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <input 
                      type="text" 
                      maxLength={11}
                      className="w-full bg-white border-gray-200 border-2 p-4 pl-12 rounded-2xl text-sm font-mono font-bold text-gray-900 focus:border-brand-500 outline-none transition-all" 
                      placeholder="Opcional"
                      value={ruc} 
                      onChange={e => setRuc(e.target.value)} 
                    />
                  </div>
                </div>
              </div>

              <button type="submit" className={`w-full py-4 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl mt-6 transition active:scale-[0.98] flex items-center justify-center ${isPrivate ? 'bg-gray-800 hover:bg-black' : 'bg-brand-600 hover:bg-brand-700'}`}>
                {isPrivate ? <Lock className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {isPrivate ? 'Guardar Gasto Privado' : 'Guardar y Enviar al Contador'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DASHBOARD STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Gasto Acumulado Mes</p>
           <h4 className="text-3xl font-black text-gray-900">S/ {stats.monthTotal.toFixed(2)}</h4>
           <div className="h-10 mt-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.dailyData}><Bar dataKey="monto" fill="#fb8c00" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
        </div>
        <div className="bg-gradient-to-br from-brand-600 to-brand-700 p-6 rounded-3xl shadow-xl text-white relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none group-hover:scale-125 transition-transform"><ShieldCheck className="w-20 h-20" /></div>
           <p className="text-[10px] font-black text-orange-200 uppercase tracking-widest mb-1">Estatus SUNAT</p>
           <div className="flex items-center space-x-2">
              <h4 className="text-2xl font-black italic">Normal</h4>
              <ShieldCheck className="w-6 h-6 text-brand-100" />
           </div>
           <p className="text-[9px] mt-2 opacity-80 uppercase font-bold">Sin observaciones pendientes</p>
        </div>
        
        {/* BOTÓN DE SOPORTE - WHATSAPP */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between relative group cursor-pointer" onClick={() => window.open('https://wa.me/51999888777', '_blank')}>
           <div className="absolute top-4 right-4 text-green-500 animate-pulse"><MessageCircleMore className="w-6 h-6"/></div>
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Asesoría Directa</p>
           <div className="flex items-center space-x-3 mt-4">
              <div className="p-3 bg-green-50 rounded-2xl text-green-600 group-hover:bg-green-600 group-hover:text-white transition-all"><Headphones className="w-6 h-6"/></div>
              <div>
                <p className="text-xs font-black text-gray-800 uppercase leading-tight">¿Dudas con tus impuestos?</p>
                <p className="text-[10px] text-green-600 font-bold uppercase tracking-tighter">Hablar con mi contador</p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MOVIMIENTOS RECIENTES */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="font-black text-gray-800 mb-6 flex items-center text-sm uppercase tracking-tighter"><Clock className="w-5 h-5 mr-2 text-brand-500" /> Historial de Movimientos</h3>
          <div className="space-y-3">
            {myExpenses.slice().reverse().slice(0, 10).map(exp => (
              <div key={exp.id} className={`flex items-center justify-between p-4 rounded-2xl border transition ${exp.isPrivate ? 'bg-gray-50 border-gray-100 border-dashed' : 'bg-white border-gray-50 hover:border-brand-100'}`}>
                <div className="flex items-center space-x-4">
                  <div className={`p-2.5 rounded-xl ${exp.isPrivate ? 'bg-gray-200 text-gray-400' : 'bg-brand-50 text-brand-600'}`}>
                    {exp.isPrivate ? <Lock className="w-4 h-4"/> : <Users className="w-4 h-4"/>}
                  </div>
                  <div>
                    <p className="font-black text-gray-900 text-sm uppercase truncate max-w-[150px]">{exp.description}</p>
                    <div className="flex items-center space-x-2">
                       <p className="text-[9px] text-gray-400 font-bold uppercase">{exp.date}</p>
                       {exp.isPrivate && <span className="text-[8px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-1.5 py-0.5 rounded">Personal</span>}
                    </div>
                  </div>
                </div>
                <p className={`font-black ${exp.isPrivate ? 'text-gray-500' : 'text-gray-900'}`}>S/ {exp.amount.toFixed(2)}</p>
              </div>
            ))}
            {myExpenses.length === 0 && <div className="py-20 text-center text-gray-400 text-xs italic">No hay movimientos registrados.</div>}
          </div>
        </div>

        {/* BUZÓN TRIBUTARIO (PDT Y RH POR MES) */}
        <div className="bg-white rounded-3xl border border-brand-100 shadow-sm overflow-hidden flex flex-col h-fit">
           <div className="p-6 border-b">
              <h3 className="font-black text-gray-800 mb-4 flex items-center text-xs uppercase tracking-widest"><FileText className="w-5 h-5 mr-2 text-brand-600" /> Mi Buzón Tributario</h3>
              <div className="flex bg-gray-50 p-1 rounded-xl">
                  {['all', 'rh', 'factura', 'pdt'].map(f => (
                    <button key={f} onClick={() => setDocFilter(f as any)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${docFilter === f ? 'bg-white text-brand-600 shadow-sm border border-brand-100' : 'text-gray-400'}`}>
                      {f === 'all' ? 'Todo' : f === 'rh' ? 'RH' : f === 'factura' ? 'Factura' : 'PDT'}
                    </button>
                  ))}
               </div>
           </div>
           <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
              {filteredDocs.length === 0 && <div className="py-10 text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest">Buzón Vacío</div>}
              {filteredDocs.slice().reverse().map(doc => (
                <div key={doc.id} onClick={() => setPreviewDoc(doc)} className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 flex flex-col space-y-4 hover:border-brand-300 transition cursor-pointer group">
                   <div className="flex items-center justify-between">
                      <div className="bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100 font-black text-[9px] text-gray-500 uppercase">{doc.periodMonth} {doc.periodYear}</div>
                      {doc.sunatStatus === 'SENT' ? <span className="text-[8px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black uppercase flex items-center"><CheckCircle2 className="w-3 h-3 mr-1"/> SUNAT OK</span> : <span className="text-[8px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-black uppercase">Enviado</span>}
                   </div>
                   <div className="flex items-center space-x-4">
                      <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">{doc.id.startsWith('RH-') ? <ReceiptText className="w-6 h-6 text-blue-700"/> : <FileText className="w-6 h-6 text-brand-600"/>}</div>
                      <div className="min-w-0 flex-1"><p className="text-xs font-black text-gray-900 truncate uppercase tracking-tighter">{doc.name}</p><p className="text-[9px] font-bold text-gray-400 uppercase">{doc.id.startsWith('RH-') ? 'C. Electrónico' : 'Declaración Mensual'}</p></div>
                   </div>
                </div>
              ))}
           </div>
        </div>

        </div>

        </>
      )}

      {/* MODAL DE EMISIÓN DE RECIBO */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
           <div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-fade-in-up flex flex-col max-h-[90vh]">
              <div className="p-6 bg-blue-700 text-white flex justify-between items-center shrink-0">
                 <div className="flex items-center space-x-3"><ReceiptText className="w-7 h-7"/><h3 className="text-lg font-black uppercase tracking-tight text-white">Emisión de R. Honorarios</h3></div>
                 <button onClick={() => {setShowReceiptModal(false); setReceiptStep('form');}} className="text-white hover:rotate-90 transition-transform"><X className="w-6 h-6"/></button>
              </div>

              <div className="p-8 bg-white overflow-y-auto flex-1">
                 {receiptStep === 'form' ? (
                   <form className="space-y-6" onSubmit={e => { e.preventDefault(); setReceiptStep('preview'); }}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                         <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">DNI / RUC del Receptor</label>
                            <div className="relative">
                               <input type="text" name="recipientRuc" placeholder="10XXXXXXXXX" required maxLength={11} className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 pr-12 rounded-xl text-sm font-mono font-bold text-gray-900 outline-none focus:border-blue-600 focus:bg-white" value={receiptForm.recipientRuc} onChange={handleReceiptFormChange} />
                               <button type="button" onClick={handleSearchReceiptDoc} disabled={isSearchingRuc} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 transition">
                                 {isSearchingRuc ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
                               </button>
                            </div>
                         </div>
                         <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Razón Social o Nombres</label>
                            <input type="text" name="recipientName" placeholder="CLIENTE S.A.C." required className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-blue-600 focus:bg-white uppercase" value={receiptForm.recipientName} onChange={handleReceiptFormChange} />
                         </div>
                         <div className="sm:col-span-2">
                            <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Dirección del Cliente (Opcional)</label>
                            <input type="text" name="recipientAddress" placeholder="Av... (Se autocompleta con RUC)" className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-blue-600 focus:bg-white uppercase" value={receiptForm.recipientAddress} onChange={handleReceiptFormChange} />
                         </div>
                         <div className="sm:col-span-2">
                            <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Concepto del Servicio</label>
                            <textarea name="description" placeholder="Detalla el servicio realizado..." required className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm font-bold text-gray-900 h-24 outline-none focus:border-blue-600 focus:bg-white" value={receiptForm.description} onChange={handleReceiptFormChange}></textarea>
                         </div>
                         <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Monto Neto (S/)</label>
                            <input type="number" name="amount" placeholder="0.00" required className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm font-black text-gray-900 outline-none focus:border-blue-600 focus:bg-white" value={receiptForm.amount} onChange={handleReceiptFormChange} />
                         </div>
                         <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Fecha</label>
                            <input type="date" name="date" required className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-blue-600 focus:bg-white" value={receiptForm.date} onChange={handleReceiptFormChange} />
                         </div>
                         <div className="sm:col-span-2 flex items-center bg-gray-50 border-2 border-gray-200 p-4 rounded-xl">
                            <input type="checkbox" id="applyRetention" name="applyRetention" className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" checked={receiptForm.applyRetention} onChange={handleReceiptFormChange} />
                            <label htmlFor="applyRetention" className="ml-3 text-sm font-bold text-gray-700">Aplica Retención del Impuesto a la Renta (8%)</label>
                         </div>
                      </div>
                      <button type="submit" className="w-full py-4 bg-blue-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-800 shadow-xl flex items-center justify-center transition-all"><Eye className="w-4 h-4 mr-2" /> Previsualizar Borrador</button>
                   </form>
                 ) : receiptStep === 'preview' ? (
                   <div className="space-y-6">
                      <div className="border-4 border-blue-50 bg-white p-8 rounded-[1.5rem] shadow-inner">
                         <h4 className="text-blue-700 font-black text-xs uppercase mb-6 tracking-widest border-b border-blue-100 pb-2">Vista Previa</h4>
                         <div className="space-y-4 text-xs font-bold text-gray-700">
                            <p className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-400 uppercase text-[9px]">Receptor:</span><span className="font-black text-gray-900">{receiptForm.recipientName}</span></p>
                            <p className="flex flex-col space-y-1"><span className="text-gray-400 uppercase text-[9px]">Concepto:</span><span className="italic text-gray-600 leading-tight">"{receiptForm.description}"</span></p>
                            <div className="ml-auto w-full max-w-[250px] space-y-2 pt-6 border-t-2 border-blue-700 text-right">
                               <p className="text-gray-400 uppercase text-[9px]">Monto Bruto S/ {parseFloat(receiptForm.amount || '0').toFixed(2)}</p>
                               {receiptForm.applyRetention && <p className="text-red-400 uppercase text-[9px]">Retención (8%) S/ <span className="text-red-500 font-bold">-{(parseFloat(receiptForm.amount || '0') * 0.08).toFixed(2)}</span></p>}
                               <p className="text-blue-900 font-black uppercase text-[10px]">Neto Pagar S/ <span className="text-blue-700 text-lg">{(parseFloat(receiptForm.amount || '0') * (receiptForm.applyRetention ? 0.92 : 1)).toFixed(2)}</span></p>
                            </div>
                         </div>
                      </div>
                      {syncError && (
                         <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 font-bold text-xs">
                           <AlertTriangle className="w-5 h-5 mb-1 inline-block mr-2" />
                           {syncError}
                         </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-3">
                         <button type="button" onClick={() => setReceiptStep('form')} className="flex-1 py-4 border-2 border-blue-100 text-blue-600 rounded-2xl font-black uppercase text-[10px] hover:bg-blue-50 transition">Corregir Datos</button>
                         <button type="button" onClick={handleOfficialSync} className="flex-1 py-4 bg-blue-700 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl flex items-center justify-center hover:bg-blue-800 transition"><Globe className="w-3.5 h-3.5 mr-2"/> Generar Recibo</button>
                      </div>
                   </div>
                 ) : (
                   <div className="text-center py-12 space-y-6 bg-white">
                      {isSyncing ? (
                        <>
                          <Loader2 className="w-16 h-16 text-blue-700 animate-spin mx-auto"/>
                          <div className="space-y-2">
                             <p className="text-sm font-black uppercase tracking-widest text-blue-900">Sincronizando con SUNAT...</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><CheckCircle2 className="w-10 h-10"/></div>
                          <div className="space-y-2">
                             <h4 className="text-xl font-black text-green-900 uppercase">¡Emisión Exitosa!</h4>
                             <p className="text-xs text-gray-500 font-bold max-w-xs mx-auto">Tu documento ha sido procesado correctamente.</p>
                          </div>
                           <button onClick={() => emitTaxDocument('RH', true)} className="w-full py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl mt-6 hover:bg-green-700 transition">Archivar en Buzón</button>
                        </>
                      )}
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* MODAL DE EMISIÓN DE FACTURA */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
           <div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-fade-in-up flex flex-col max-h-[90vh]">
              <div className="p-6 bg-brand-700 text-white flex justify-between items-center shrink-0">
                 <div className="flex items-center space-x-3"><FileInput className="w-7 h-7"/><h3 className="text-lg font-black uppercase tracking-tight text-white">Emisión de Factura Electrónica</h3></div>
                 <button onClick={() => {setShowInvoiceModal(false); setInvoiceStep('form');}} className="text-white hover:rotate-90 transition-transform"><X className="w-6 h-6"/></button>
              </div>

              <div className="p-8 bg-white overflow-y-auto flex-1">
                 {invoiceStep === 'form' ? (
                   <form className="space-y-6" onSubmit={e => { e.preventDefault(); setInvoiceStep('preview'); }}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                         <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">DNI / RUC del Cliente</label>
                            <div className="relative">
                               <input type="text" name="recipientRuc" placeholder="20XXXXXXXXX" required maxLength={11} className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 pr-12 rounded-xl text-sm font-mono font-bold text-gray-900 outline-none focus:border-brand-600 focus:bg-white" value={invoiceForm.recipientRuc} onChange={e => setInvoiceForm({...invoiceForm, recipientRuc: e.target.value})} />
                               <button type="button" onClick={handleSearchInvoiceDoc} disabled={isSearchingRuc} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand-100 text-brand-700 rounded-lg hover:bg-brand-200 disabled:opacity-50 transition">
                                 {isSearchingRuc ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
                               </button>
                            </div>
                         </div>
                         <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Razón Social</label>
                            <input type="text" name="recipientName" placeholder="EMPRESA S.A.C." required className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-brand-600 focus:bg-white uppercase" value={invoiceForm.recipientName} onChange={e => setInvoiceForm({...invoiceForm, recipientName: e.target.value})} />
                         </div>
                         <div className="sm:col-span-2">
                            <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Dirección del Cliente (Opcional)</label>
                            <input type="text" name="recipientAddress" placeholder="Av. Los Pinos 123..." className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-brand-600 focus:bg-white uppercase" value={invoiceForm.recipientAddress} onChange={e => setInvoiceForm({...invoiceForm, recipientAddress: e.target.value})} />
                         </div>
                         <div className="sm:col-span-2">
                            <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Descripción del Ítem</label>
                            <textarea name="description" placeholder="Servicios de consultoría..." required className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm font-bold text-gray-900 h-24 outline-none focus:border-brand-600 focus:bg-white" value={invoiceForm.description} onChange={e => setInvoiceForm({...invoiceForm, description: e.target.value})}></textarea>
                         </div>
                         <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Serie</label>
                            <input type="text" name="serie" placeholder="F001" required maxLength={4} className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-brand-600 focus:bg-white uppercase" value={invoiceForm.serie} onChange={e => setInvoiceForm({...invoiceForm, serie: e.target.value})} />
                         </div>
                         <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Moneda</label>
                            <select className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-brand-600 focus:bg-white" value={invoiceForm.currency} onChange={e => setInvoiceForm({...invoiceForm, currency: e.target.value})}>
                              <option value="PEN">Soles (S/)</option>
                              <option value="USD">Dólares ($)</option>
                            </select>
                         </div>
                         <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Monto Total (Inc. IGV)</label>
                            <input type="number" name="amount" placeholder="0.00" required className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm font-black text-gray-900 outline-none focus:border-brand-600 focus:bg-white" value={invoiceForm.amount} onChange={e => setInvoiceForm({...invoiceForm, amount: e.target.value})} />
                         </div>
                         <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block ml-1">Fecha</label>
                            <input type="date" name="date" required className="w-full bg-gray-50 border-2 border-gray-200 p-3.5 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-brand-600 focus:bg-white" value={invoiceForm.date} onChange={e => setInvoiceForm({...invoiceForm, date: e.target.value})} />
                         </div>

                         <div className="sm:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-2xl border-2 border-gray-100">
                            <div>
                               <label className="text-[9px] font-black text-gray-400 uppercase mb-2 block ml-1">Tipo de Transacción</label>
                               <div className="flex gap-2">
                                  <button type="button" onClick={() => setInvoiceForm({...invoiceForm, paymentType: 'CONTADO'})} className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-black transition-all ${invoiceForm.paymentType === 'CONTADO' ? 'bg-brand-700 text-white shadow-md' : 'bg-white text-gray-400 border border-gray-200'}`}>AL CONTADO</button>
                                  <button type="button" onClick={() => setInvoiceForm({...invoiceForm, paymentType: 'CREDITO'})} className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-black transition-all ${invoiceForm.paymentType === 'CREDITO' ? 'bg-brand-700 text-white shadow-md' : 'bg-white text-gray-400 border border-gray-200'}`}>AL CRÉDITO</button>
                               </div>
                            </div>
                            <div>
                               <label className="text-[9px] font-black text-gray-400 uppercase mb-2 block ml-1">Opciones Avanzadas</label>
                               <div className="flex flex-wrap gap-2">
                                  <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 cursor-pointer">
                                     <input type="checkbox" checked={invoiceForm.hasDetraction} onChange={e => setInvoiceForm({...invoiceForm, hasDetraction: e.target.checked})} className="w-3 h-3 accent-brand-700" />
                                     <span className="text-[9px] font-black text-gray-600 uppercase">Detracción</span>
                                  </label>
                                  <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 cursor-pointer">
                                     <input type="checkbox" checked={invoiceForm.isExport} onChange={e => setInvoiceForm({...invoiceForm, isExport: e.target.checked})} className="w-3 h-3 accent-brand-700" />
                                     <span className="text-[9px] font-black text-gray-600 uppercase">Exportación</span>
                                  </label>
                                  <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 cursor-pointer">
                                     <input type="checkbox" checked={invoiceForm.hasEstablishment} onChange={e => setInvoiceForm({...invoiceForm, hasEstablishment: e.target.checked})} className="w-3 h-3 accent-brand-700" />
                                     <span className="text-[9px] font-black text-gray-600 uppercase">Establecimiento</span>
                                  </label>
                               </div>
                            </div>
                         </div>
                         
                         {invoiceForm.hasDetraction && (
                           <div className="sm:col-span-2 grid grid-cols-2 gap-4 p-4 bg-amber-50 rounded-2xl border-2 border-amber-100 animate-pulse-subtle">
                              <div>
                                 <label className="text-[9px] font-black text-amber-700 uppercase mb-1 block ml-1">Bien/Servicio Detracción</label>
                                 <select className="w-full bg-white border border-amber-200 p-2 rounded-lg text-xs font-bold text-gray-900" value={invoiceForm.detractionCode} onChange={e => setInvoiceForm({...invoiceForm, detractionCode: e.target.value})}>
                                    <option value="001">Azúcar y melaza de caña</option>
                                    <option value="022">Otros servicios empresariales</option>
                                    <option value="037">Demás servicios gravados con IGV</option>
                                 </select>
                              </div>
                              <div>
                                 <label className="text-[9px] font-black text-amber-700 uppercase mb-1 block ml-1">Tasa %</label>
                                 <input type="number" className="w-full bg-white border border-amber-200 p-2 rounded-lg text-xs font-bold text-gray-900" value={invoiceForm.detractionPercent} onChange={e => setInvoiceForm({...invoiceForm, detractionPercent: parseFloat(e.target.value)})} />
                              </div>
                           </div>
                         )}
                      </div>
                      <button type="submit" className="w-full py-4 bg-brand-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-900 shadow-xl flex items-center justify-center transition-all"><Eye className="w-4 h-4 mr-2" /> Previsualizar Factura</button>
                   </form>
                 ) : invoiceStep === 'preview' ? (
                   <div className="space-y-6">
                      <div className="border-4 border-brand-50 bg-white p-8 rounded-[1.5rem] shadow-inner">
                         <h4 className="text-brand-700 font-black text-xs uppercase mb-6 tracking-widest border-b border-brand-100 pb-2">Vista Previa de Factura</h4>
                         <div className="space-y-4 text-xs font-bold text-gray-700">
                            <p className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-400 uppercase text-[9px]">Serie:</span><span className="font-black text-gray-900">{invoiceForm.serie}</span></p>
                            <p className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-400 uppercase text-[9px]">Cliente:</span><span className="font-black text-gray-900">{invoiceForm.recipientName}</span></p>
                            <p className="flex flex-col space-y-1"><span className="text-gray-400 uppercase text-[9px]">Detalle:</span><span className="italic text-gray-600 leading-tight">"{invoiceForm.description}"</span></p>
                            <div className="ml-auto w-full max-w-[200px] space-y-2 pt-6 border-t-2 border-brand-700 text-right">
                               <p className="text-gray-400 uppercase text-[9px]">Subtotal: {invoiceForm.currency === 'PEN' ? 'S/' : '$'} {(parseFloat(invoiceForm.amount) / 1.18).toFixed(2)}</p>
                               <p className="text-gray-400 uppercase text-[9px]">IGV (18%): {invoiceForm.currency === 'PEN' ? 'S/' : '$'} {(parseFloat(invoiceForm.amount) - (parseFloat(invoiceForm.amount) / 1.18)).toFixed(2)}</p>
                               <p className="text-brand-900 font-black uppercase text-[10px]">Total {invoiceForm.currency === 'PEN' ? 'S/' : '$'} <span className="text-brand-600 text-lg">{parseFloat(invoiceForm.amount).toFixed(2)}</span></p>
                            </div>
                         </div>
                      </div>
                      {syncError && (
                         <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 font-bold text-xs">
                           <AlertTriangle className="w-5 h-5 mb-1 inline-block mr-2" />
                           {syncError}
                         </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-3">
                         <button type="button" onClick={() => setInvoiceStep('form')} className="flex-1 py-4 border-2 border-brand-100 text-brand-700 rounded-2xl font-black uppercase text-[10px] hover:bg-brand-50 transition">Editar Datos</button>
                         <button type="button" onClick={handleInvoiceOfficialSync} className="flex-1 py-4 bg-brand-700 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl flex items-center justify-center hover:bg-brand-900 transition"><Globe className="w-3.5 h-3.5 mr-2"/> Emitir Oficialmente</button>
                      </div>
                   </div>
                 ) : (
                   <div className="text-center py-12 space-y-6 bg-white">
                      {isSyncing ? (
                        <>
                          <Loader2 className="w-16 h-16 text-brand-700 animate-spin mx-auto"/>
                          <div className="space-y-2">
                             <p className="text-sm font-black uppercase tracking-widest text-brand-900">Comunicando con SUNAT...</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner"><CheckCircle2 className="w-10 h-10"/></div>
                          <div className="space-y-2">
                             <h4 className="text-xl font-black text-green-900 uppercase">¡Factura Emitida!</h4>
                             <p className="text-xs text-gray-500 font-bold max-w-xs mx-auto">El comprobante ha sido enviado y aceptado por SUNAT.</p>
                          </div>
                          <button onClick={() => emitTaxDocument('FACTURA', true)} className="w-full py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl mt-6 hover:bg-green-700 transition">Regresar al Dashboard</button>
                        </>
                      )}
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* PREVISUALIZACIÓN DE DOCUMENTO ARCHIVADO */}
      {previewDoc && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-4 overflow-y-auto">
           <div className="bg-white rounded-[2rem] w-full max-w-2xl h-fit overflow-hidden flex flex-col shadow-2xl relative">
              <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                 <h3 className="text-sm font-black uppercase tracking-widest text-gray-800 italic">{previewDoc.name}</h3>
                 <button onClick={() => setPreviewDoc(null)} className="p-2 bg-white rounded-full hover:bg-gray-100 transition shadow-sm"><X className="w-6 h-6 text-gray-400"/></button>
              </div>
              <div className="p-10 flex-1 bg-white">
                 <div className="border-4 border-gray-100 p-8 rounded-3xl space-y-8 relative overflow-hidden bg-white">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none rotate-12">
                       <ShieldCheck className="w-40 h-40" />
                    </div>
                    <div className="flex justify-between border-b-2 border-brand-500 pb-4 relative z-10">
                       <h1 className="text-xl font-black text-brand-600 uppercase italic">Control Tributario</h1>
                       <div className="text-right"><p className="text-[10px] font-black uppercase text-gray-400 leading-none">RUC Emisor</p><p className="text-sm font-mono font-black text-gray-800">{currentUser.ruc}</p></div>
                    </div>
                     <div className="space-y-6 relative z-10 font-bold text-gray-700">
                        <div className="grid grid-cols-2 gap-8 text-xs">
                           <div><p className="text-gray-400 font-bold uppercase text-[9px] mb-1">Periodo Declarado:</p><p className="font-black text-gray-800 uppercase text-sm">{previewDoc.periodMonth} {previewDoc.periodYear}</p></div>
                           <div><p className="text-gray-400 font-bold uppercase text-[9px] mb-1">Fecha de Registro:</p><p className="font-black text-gray-800 uppercase text-sm">{previewDoc.uploadDate}</p></div>
                        </div>

                        {previewDoc.metadata && (
                           <div className="p-6 bg-brand-50/50 rounded-2xl border-2 border-brand-100 space-y-4">
                              <div className="border-b border-brand-100 pb-2 flex justify-between items-center">
                                 <p className="text-[10px] font-black text-brand-700 uppercase">Detalle del Comprobante</p>
                                 <span className="text-[9px] font-black text-gray-400">{previewDoc.metadata.recipientRuc}</span>
                              </div>
                              <div className="space-y-2">
                                 <p className="text-xs font-black text-gray-900 uppercase">{previewDoc.metadata.recipientName}</p>
                                 <p className="text-[10px] text-gray-600 italic">"{previewDoc.metadata.description}"</p>
                              </div>
                              <div className="pt-4 border-t border-brand-100 flex justify-between items-end">
                                 <div>
                                    {previewDoc.metadata.retention > 0 && <p className="text-[9px] text-red-500 font-bold">Retención: S/ {previewDoc.metadata.retention.toFixed(2)}</p>}
                                    <p className="text-[9px] text-gray-400 font-bold uppercase">Monto Total</p>
                                 </div>
                                 <p className="text-xl font-black text-brand-700">S/ {previewDoc.metadata.amount.toFixed(2)}</p>
                              </div>
                           </div>
                        )}

                        <div className="p-8 bg-gray-50 rounded-2xl border border-gray-100 text-center space-y-4">
                           <p className="text-xs text-gray-500 italic leading-relaxed">
                              Este documento certifica su cumplimiento tributario archivado en la plataforma de FinanzaFacil.
                           </p>
                           {previewDoc.sunatHash && (
                             <div className="pt-4 border-t border-gray-200">
                                <p className="text-[8px] text-gray-400 uppercase font-black tracking-widest">Firma Digital (CPE):</p>
                                <p className="text-[9px] font-mono font-bold text-brand-600 break-all">{previewDoc.sunatHash}</p>
                             </div>
                           )}
                        </div>
                     </div>
                     <div className="p-6 border-t flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 justify-center bg-gray-50">
                  {previewDoc.pdfUrl && (
                    <a href={previewDoc.pdfUrl} target="_blank" rel="noopener noreferrer" className="px-10 py-4 bg-brand-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-brand-700 transition flex items-center justify-center">
                      <Download className="w-4 h-4 mr-2"/> Descargar PDF
                    </a>
                  )}
                  {(previewDoc.xmlUrl || previewDoc.xmlContent) && (
                    <button 
                      onClick={() => downloadFile(previewDoc.xmlContent || '', `${previewDoc.name}.xml`, 'text/xml')}
                      className="px-6 py-4 bg-white border-2 border-brand-100 text-brand-600 rounded-2xl font-black text-[10px] uppercase hover:bg-brand-50 transition flex items-center justify-center"
                    >
                      <DownloadCloud className="w-4 h-4 mr-2"/> XML
                    </button>
                  )}
                  {(previewDoc.cdrUrl || previewDoc.cdrBase64) && (
                    <button 
                      onClick={() => downloadFile(previewDoc.cdrBase64 || '', `R-${previewDoc.name}.zip`, 'application/zip', true)}
                      className="px-6 py-4 bg-white border-2 border-green-100 text-green-600 rounded-2xl font-black text-[10px] uppercase hover:bg-green-50 transition flex items-center justify-center"
                    >
                      <DownloadCloud className="w-4 h-4 mr-2"/> CDR (Respuesta)
                    </button>
                  )}
                  <button onClick={() => setPreviewDoc(null)} className="px-10 py-4 bg-white border-2 border-gray-200 text-gray-600 rounded-2xl font-black text-[10px] uppercase hover:bg-gray-100 transition">Cerrar</button>
               </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
