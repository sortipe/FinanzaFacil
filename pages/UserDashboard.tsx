import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Expense, TaxDocument, PendingInvoice, UserRole, SubscriptionStatus } from '../types';
import { Plus, Camera, Loader2, DollarSign, Search, Calendar, Tag, Image as ImageIcon, X, Clock, PieChart as PieChartIcon, BarChart as BarChartIcon, Upload, RefreshCw, Sparkles, Save, Hash, FileText, User, ShieldCheck, Lock, Eye, EyeOff, Download, ChevronDown, FileSpreadsheet, History, DownloadCloud, ExternalLink, PlusCircle, MessageCircleMore, Headphones, TrendingUp, TrendingDown, CalendarDays, CalendarRange, FileInput, ReceiptText, Printer, CheckCircle2, ArrowLeft, Globe, AlertTriangle, ExternalLink as ExtIcon, ShoppingBag, Briefcase, Users, HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { analyzeReceipt, fileToBase64 } from '../services/geminiService';
import { sunatService } from '../services/sunatService';
import { consultaService } from '../services/consultaService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { SunatSettings } from '../components/SunatSettings';
import { InvoiceWizard } from '../components/InvoiceWizard';
import { Payment } from '../pages/Payment';

export const UserDashboard: React.FC = () => {
  const { currentUser, expenses, taxDocuments, addExpense, addTaxDocument, sunatGlobalConfig, pendingInvoices, removePendingInvoice, updatePendingInvoiceStatus, users, registerUser, updateUser, generatePassword, subscriptionHistory } = useStore();
  const [isUploading, setIsUploading] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'settings' | 'history'>('dashboard');
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [docFilter, setDocFilter] = useState<'all' | 'rh' | 'factura' | 'pdt' | 'contador'>('all');
  const [previewDoc, setPreviewDoc] = useState<TaxDocument | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showCreateAccountant, setShowCreateAccountant] = useState(false);

  const [movementsPage, setMovementsPage] = useState(1);
  const [movementsPerPage, setMovementsPerPage] = useState(10);

  const [accForm, setAccForm] = useState({ name: '', email: '', phone: '' });
  const [accPwd, setAccPwd] = useState('');
  const [creatingAcc, setCreatingAcc] = useState(false);
  const [accCreated, setAccCreated] = useState(false);
  const [showAccPwd, setShowAccPwd] = useState(false);

  const retryPendingInvoice = async (inv: PendingInvoice) => {
    setRetrying(inv.id);
    updatePendingInvoiceStatus(inv.id, 'ENVIANDO');
    try {
      const response = await fetch('/emitir-factura', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inv.payload)
      });
      const result = await response.json();
      if (result.success) {
        updatePendingInvoiceStatus(inv.id, 'ACEPTADO');
        const paddedCorr = typeof inv.correlative === 'number' ? String(inv.correlative).padStart(8, '0') : '00000001';
        addTaxDocument({
          id: inv.id,
          userId: inv.userId,
          accountantId: '',
          name: `${inv.documentType === 'factura' ? 'F' : 'B'}${inv.serie}-${paddedCorr}`,
          fileUrl: '',
          pdfUrl: '',
          xmlUrl: result.xmlContent ? URL.createObjectURL(new Blob([result.xmlContent], { type: 'text/xml' })) : '',
          cdrUrl: result.cdrBase64 ? URL.createObjectURL(new Blob([Uint8Array.from(atob(result.cdrBase64), c => c.charCodeAt(0))], { type: 'application/zip' })) : '',
          xmlContent: result.xmlContent,
          cdrBase64: result.cdrBase64,
          mimeType: 'application/xml',
          uploadDate: new Date().toISOString().split('T')[0],
          periodMonth: new Date().toLocaleDateString('es-ES', { month: 'long' }),
          periodYear: new Date().getFullYear(),
          sunatStatus: 'SENT',
          sunatHash: Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join('')
        });
        addExpense({
          id: `exp-${inv.id}-${Date.now()}`,
          userId: inv.userId,
          amount: inv.amount,
          currency: 'PEN',
          description: inv.customerName ? `${inv.id} - ${inv.customerName}` : inv.id,
          date: new Date().toISOString().split('T')[0],
          category: 'Facturación Electrónica',
          invoiceNumber: inv.id,
          isPrivate: false
        });      } else {
        updatePendingInvoiceStatus(inv.id, 'PENDIENTE', result.error || 'Error del servidor SUNAT');
      }
    } catch (err: any) {
      updatePendingInvoiceStatus(inv.id, 'PENDIENTE', 'Error de conexión: ' + (err.message || 'Desconocido'));
    } finally { setRetrying(null); }
  };

  const retryAllPending = async () => {
    const pending = pendingInvoices.filter(p => p.userId === currentUser?.id && p.status === 'PENDIENTE');
    for (const inv of pending) {
      await retryPendingInvoice(inv);
    }
  };


  const handleCreateAccountant = async () => {
    if (!accForm.name.trim() || !accForm.email.trim()) return;
    setCreatingAcc(true);
    const pwd = accPwd || generatePassword();
    const newUser = {
      id: Date.now().toString(),
      name: accForm.name.trim(),
      email: accForm.email.trim(),
      phone: accForm.phone.trim(),
      role: UserRole.ACCOUNTANT,
      password: pwd,
      mustChangePassword: true
    };
    try {
      await registerUser(newUser);
      if (currentUser) {
        await updateUser(currentUser.id, { assignedAccountantId: newUser.id });
      }
      fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newUser.email, name: newUser.name, password: pwd })
      }).catch(() => {});
      setAccPwd(pwd);
      setAccCreated(true);
    } catch (err: any) {
      alert("No se pudo guardar el contador en la base de datos: " + (err.message || "Error al conectar con la base de datos"));
    } finally {
      setCreatingAcc(false);
    }
  };

  const pendingRef = useRef(pendingInvoices);
  pendingRef.current = pendingInvoices;

  useEffect(() => {
    const interval = setInterval(() => {
      const pendings = pendingRef.current.filter(p => p.userId === currentUser?.id && p.status === 'PENDIENTE' && p.attemptCount < 5);
      if (pendings.length > 0) {
        pendings.forEach(inv => retryPendingInvoice(inv));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);
  
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
      setAiError('');
      handleAnalyze(base64, file.type);
    }
  };

  const handleAnalyze = async (base64: string, mime: string) => {
    setAnalyzing(true);
    setAiError('');
    try {
      const data = await analyzeReceipt(base64, mime);
      setAmount(data.total.toString());
      setDescription(data.merchant);
      setDate(data.date);
      setCategory(data.category);
      if (data.ruc) setRuc(data.ruc);
      if (data.invoiceNumber) setInvoiceNumber(data.invoiceNumber);
    } catch (err: any) {
      setAiError(err.message || 'Error al analizar el recibo. Puedes llenar los datos manualmente.');
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
    
    if (!currentUser?.solUser || !currentUser?.solPass) {
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
        currentUser?.sunatApiUrl || sunatGlobalConfig.sunatApiUrl || '',
        {
          ruc: currentUser?.ruc,
          user: currentUser?.solUser,
          pass: currentUser?.solPass,
          certBase64: currentUser?.certBase64,
          certPass: currentUser?.certPass,
          emitterName: currentUser?.businessName,
          env: 'PRODUCTION'
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

    if (!currentUser?.solUser || !currentUser?.solPass) {
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
        currentUser?.sunatApiUrl || sunatGlobalConfig.sunatApiUrl || '',
        {
          ruc: currentUser?.ruc,
          user: currentUser?.solUser,
          pass: currentUser?.solPass,
          certBase64: currentUser?.certBase64,
          certPass: currentUser?.certPass,
          emitterName: currentUser?.businessName,
          env: 'PRODUCTION'
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
      accountantId: (users.find(u => u.id === currentUser.id)?.assignedAccountantId) || currentUser.assignedAccountantId || '',
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
    }
  };

  const handleInvoiceEmitted = (result: { id: string; name: string; sunatStatus: string; xmlContent?: string; cdrBase64?: string; amount?: number; customerName?: string }) => {
    if (!currentUser) return;

    let xmlUrl = '';
    if (result.xmlContent) {
      try {
        xmlUrl = URL.createObjectURL(new Blob([result.xmlContent], { type: 'text/xml' }));
      } catch {}
    }

    let cdrUrl = '';
    if (result.cdrBase64) {
      try {
        const binary = atob(result.cdrBase64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
        cdrUrl = URL.createObjectURL(new Blob([array], { type: 'application/zip' }));
      } catch {}
    }

    const activeAccId = (users.find(u => u.id === currentUser.id)?.assignedAccountantId) || currentUser.assignedAccountantId || '';

    const isInternal = result.sunatStatus === 'INTERNO';
    const newDoc: TaxDocument = {
      id: result.id,
      userId: currentUser.id,
      accountantId: activeAccId,
      name: result.name,
      fileUrl: '',
      pdfUrl: '',
      xmlUrl: xmlUrl,
      cdrUrl: cdrUrl,
      xmlContent: result.xmlContent,
      cdrBase64: result.cdrBase64,
      mimeType: 'application/xml',
      uploadDate: new Date().toISOString().split('T')[0],
      periodMonth: new Date().toLocaleDateString('es-ES', { month: 'long' }),
      periodYear: new Date().getFullYear(),
      sunatStatus: isInternal ? 'INTERNO' : (result.sunatStatus === 'ACEPTADO' || result.sunatStatus === 'SENT') ? 'SENT' : 'PENDING',
      sunatHash: (result.sunatStatus === 'ACEPTADO' || result.sunatStatus === 'SENT') ? Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join('') : undefined,
      metadata: { amount: result.amount, customerName: result.customerName }
    };

    addTaxDocument(newDoc);

    if (result.amount) {
      addExpense({
        id: `exp-${result.id}-${Date.now()}`,
        userId: currentUser.id,
        amount: result.amount,
        currency: 'PEN',
        description: `${result.name}${result.customerName ? ' - ' + result.customerName : ''}`,
        date: new Date().toISOString().split('T')[0],
        category: 'Facturación Electrónica',
        invoiceNumber: result.id,
        isPrivate: isInternal
      });
    }
  };

  if (!currentUser) return null;
  const filteredDocs = taxDocuments.filter(d => {
    if (d.userId !== currentUser.id) return false;
    if (docFilter === 'all') return true;
    if (docFilter === 'contador') return d.uploadedBy === 'ACCOUNTANT';
    if (docFilter === 'rh') return d.id.startsWith('RH-');
    if (docFilter === 'factura') return d.id.startsWith('FACTURA-') || d.id.startsWith('F') || d.id.startsWith('B');
    // pdt: ni RH ni FACTURA ni F ni B
    return !d.id.startsWith('RH-') && !d.id.startsWith('FACTURA-') && !d.id.startsWith('F') && !d.id.startsWith('B');
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Hola, {currentUser.name}</h2>
          <p className="text-gray-500 text-sm font-medium tracking-tight">Gestiona tus finanzas personales y tributarias</p>
        </div>
        
        {(!currentUser.solUser && !currentUser.user || !currentUser.solPass && !currentUser.pass) && (
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
          <button 
            onClick={() => setActiveView(activeView === 'history' ? 'dashboard' : 'history')} 
            className={`p-3 rounded-2xl transition shadow-lg flex items-center justify-center active:scale-95 ${activeView === 'history' ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-100'}`}
          >
            <History className="w-5 h-5" />
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
      ) : activeView === 'history' ? (
        <div className="animate-fade-in-up">
          <button onClick={() => setActiveView('dashboard')} className="mb-6 flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-800 transition">
            <ArrowLeft className="w-4 h-4" /> Volver al Dashboard
          </button>
          <div className="bg-white rounded-3xl border border-brand-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-black text-gray-800 flex items-center text-xs uppercase tracking-widest"><History className="w-5 h-5 mr-2 text-brand-600" /> Historial de Suscripciones</h3>
            </div>
            <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
              {subscriptionHistory.filter(s => s.userId === currentUser?.id).length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest">Sin registros</div>
              ) : (
                subscriptionHistory.filter(s => s.userId === currentUser?.id).map(rec => (
                  <div key={rec.id} className="px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/50 flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-brand-50"><FileText className="w-4 h-4 text-brand-600"/></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black text-gray-900 truncate uppercase">{rec.packageName}</p>
                      <p className="text-[8px] font-bold text-gray-400 uppercase mt-0.5">
                        {rec.date} · S/ {rec.amount.toFixed(2)}
                        {rec.startDate && rec.endDate && ` · ${rec.startDate} → ${rec.endDate}`}
                      </p>
                    </div>
                    <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase shrink-0 ${rec.status === 'PAID' ? 'bg-green-100 text-green-700' : rec.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {rec.status === 'PAID' ? 'Pagado' : rec.status === 'PENDING' ? 'Pendiente' : 'Cancelado'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
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

                {aiError && (
                  <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-xs font-black text-amber-800 uppercase">Error al escanear</p>
                      <p className="text-[10px] text-amber-700 font-bold mt-0.5">{aiError}</p>
                    </div>
                    <button type="button" onClick={() => setAiError('')} className="ml-auto p-1 text-amber-400 hover:text-amber-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

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
        
        {/* BOTÓN DE SOPORTE - WHATSAPP / CONTADOR */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between relative group">
          {(() => {
            const activeUser = users.find(u => u.id === currentUser?.id) || currentUser;
            const myAccountant = activeUser?.assignedAccountantId ? users.find(u => u.id === activeUser.assignedAccountantId && u.role === UserRole.ACCOUNTANT) : null;
            return myAccountant ? (
              <>
                <div className="absolute top-4 right-4 text-green-500"><MessageCircleMore className="w-6 h-6"/></div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tu Contador</p>
                <div className="flex items-center space-x-3 mt-4">
                  <div className="p-3 bg-brand-50 rounded-2xl text-brand-600"><User className="w-6 h-6"/></div>
                  <div>
                    <p className="text-xs font-black text-gray-800 uppercase leading-tight">{myAccountant.name}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{myAccountant.email}</p>
                  </div>
                </div>
                {(() => {
                  const hasPhone = !!(myAccountant.phone && myAccountant.phone.trim());
                  return (
                    <button
                      disabled={!hasPhone}
                      onClick={() => {
                        if (!hasPhone) return;
                        const cleanPhone = myAccountant.phone!.replace(/[^0-9]/g, '');
                        window.open(`https://wa.me/${cleanPhone.startsWith('51') ? cleanPhone : '51' + cleanPhone}`, '_blank');
                      }}
                      title={hasPhone ? 'Contactar por WhatsApp' : 'El contador no ha registrado un teléfono'}
                      className={`mt-4 w-full py-2 rounded-xl text-[10px] font-black uppercase transition flex items-center justify-center gap-2 ${
                        hasPhone
                          ? 'bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer shadow-sm active:scale-95'
                          : 'bg-gray-100 text-gray-400 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <MessageCircleMore className="w-4 h-4" />
                      {hasPhone ? 'WhatsApp' : 'Sin WhatsApp'}
                    </button>
                  );
                })()}
              </>
            ) : (
              <>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Contador</p>
                <div className="flex items-center space-x-3 mt-4">
                  <div className="p-3 bg-gray-100 rounded-2xl text-gray-400"><User className="w-6 h-6"/></div>
                  <div>
                    <p className="text-xs font-black text-gray-800 uppercase leading-tight">Sin contador asignado</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Crea uno ahora</p>
                  </div>
                </div>
                <button onClick={() => { setAccForm({ name: '', email: '', phone: '' }); setAccPwd(generatePassword()); setAccCreated(false); setShowCreateAccountant(true); }}
                  className="mt-4 w-full py-2 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-brand-700 transition flex items-center justify-center gap-2 shadow-sm">
                  <Plus className="w-4 h-4" /> Crear Contador
                </button>
              </>
            );
          })()}
        </div>
      </div>

      {/* SUSCRIPCIÓN */}
      {currentUser && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-brand-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-brand-50"><CalendarDays className="w-6 h-6 text-brand-600"/></div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Suscripción</p>
              <p className="text-sm font-black text-gray-900">
                {currentUser.subscriptionStatus === SubscriptionStatus.ACTIVE ? (
                  <>Activa hasta el {currentUser.subscriptionEndDate ? new Date(currentUser.subscriptionEndDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</>
                ) : currentUser.subscriptionStatus === SubscriptionStatus.EXPIRED ? (
                  <span className="text-red-600">Vencida</span>
                ) : (
                  <span className="text-amber-600">Pendiente de pago</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowPayment(true)} className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-brand-700 transition shadow-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> {currentUser.subscriptionStatus === SubscriptionStatus.ACTIVE ? 'Renovar' : 'Comprar Plan'}
            </button>
            <button onClick={() => setActiveView('history')} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-[10px] font-black uppercase hover:bg-gray-200 transition flex items-center gap-2">
              <History className="w-4 h-4" /> Historial
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MOVIMIENTOS RECIENTES */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-gray-800 flex items-center text-sm uppercase tracking-tighter">
                <Clock className="w-5 h-5 mr-2 text-brand-500" /> Historial de Movimientos
              </h3>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                Total: {myExpenses.length}
              </span>
            </div>

            <div className="space-y-3">
              {(() => {
                const reversed = myExpenses.slice().reverse();
                const total = reversed.length;
                const totalPages = Math.ceil(total / movementsPerPage) || 1;
                const currentPage = Math.min(movementsPage, totalPages);
                const start = (currentPage - 1) * movementsPerPage;
                const end = Math.min(start + movementsPerPage, total);
                const pageItems = reversed.slice(start, end);

                if (pageItems.length === 0) {
                  return <div className="py-20 text-center text-gray-400 text-xs italic">No hay movimientos registrados.</div>;
                }

                return pageItems.map(exp => (
                  <div key={exp.id} className={`flex items-center justify-between p-4 rounded-2xl border transition ${exp.isPrivate ? 'bg-gray-50 border-gray-100 border-dashed' : 'bg-white border-gray-50 hover:border-brand-100'}`}>
                    <div className="flex items-center space-x-4">
                      <div className={`p-2.5 rounded-xl ${exp.isPrivate ? 'bg-gray-200 text-gray-400' : 'bg-brand-50 text-brand-600'}`}>
                        {exp.isPrivate ? <Lock className="w-4 h-4"/> : <Users className="w-4 h-4"/>}
                      </div>
                      <div>
                        <p className="font-black text-gray-900 text-sm uppercase truncate max-w-[200px]">{exp.description}</p>
                        <div className="flex items-center space-x-2">
                           <p className="text-[9px] text-gray-400 font-bold uppercase">{exp.date}</p>
                           {exp.isPrivate && <span className="text-[8px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-1.5 py-0.5 rounded">Personal</span>}
                        </div>
                      </div>
                    </div>
                    <p className={`font-black ${exp.isPrivate ? 'text-gray-500' : 'text-gray-900'}`}>S/ {exp.amount.toFixed(2)}</p>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* CONTROLES DE PAGINACIÓN DE MOVIMIENTOS */}
          {myExpenses.length > 0 && (() => {
            const total = myExpenses.length;
            const totalPages = Math.ceil(total / movementsPerPage) || 1;
            const currentPage = Math.min(movementsPage, totalPages);
            const start = (currentPage - 1) * movementsPerPage + 1;
            const end = Math.min(currentPage * movementsPerPage, total);

            return (
              <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
                  <span>Mostrando {start} - {end} de {total}</span>
                  <span className="text-gray-300">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase text-gray-400">Filas:</span>
                    <select
                      value={movementsPerPage}
                      onChange={(e) => {
                        setMovementsPerPage(Number(e.target.value));
                        setMovementsPage(1);
                      }}
                      className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold text-gray-700 outline-none focus:border-brand-500 shadow-sm"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setMovementsPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-black text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition shadow-sm flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setMovementsPage(p)}
                      className={`w-8 h-8 rounded-xl text-xs font-black transition ${
                        currentPage === p
                          ? 'bg-brand-600 text-white shadow-md'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setMovementsPage(p => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-black text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition shadow-sm flex items-center gap-1"
                  >
                    Siguiente <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* PENDIENTES POR ENVIAR A SUNAT */}
        {currentUser && pendingInvoices.filter(p => p.userId === currentUser.id && p.status !== 'ACEPTADO').length > 0 && (
          <div className="bg-white rounded-3xl border-2 border-amber-200 shadow-sm overflow-hidden flex flex-col h-fit">
            <div className="p-5 border-b border-amber-100 bg-amber-50/50">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-gray-800 flex items-center text-xs uppercase tracking-widest"><Clock className="w-5 h-5 mr-2 text-amber-600" /> Pendientes SUNAT</h3>
                <button type="button" onClick={retryAllPending}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-amber-700 transition shadow-sm">
                  <RefreshCw className="w-3 h-3" /> Reintentar Todo
                </button>
              </div>
            </div>
            <div className="p-4 space-y-2 max-h-[320px] overflow-y-auto">
              {pendingInvoices.filter(p => p.userId === currentUser.id && p.status !== 'ACEPTADO').map(inv => (
                <div key={inv.id} className="px-3 py-3 rounded-xl border border-amber-100 bg-amber-50/30 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white border border-amber-200 shrink-0"><Clock className="w-4 h-4 text-amber-600"/></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black text-gray-900 truncate uppercase tracking-tighter leading-none">{inv.serie}-{String(inv.correlative).padStart(8, '0')}</p>
                    <p className="text-[8px] font-bold text-gray-400 uppercase mt-0.5">{inv.customerName} · S/ {inv.amount.toFixed(2)}</p>
                    {inv.lastError && <p className="text-[7px] font-bold text-red-400 mt-0.5 truncate">{inv.lastError}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {inv.status === 'ENVIANDO' ? (
                      <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                    ) : (
                      <>
                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase ${inv.status === 'PENDIENTE' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{inv.status}</span>
                        <button type="button" onClick={() => retryPendingInvoice(inv)} disabled={retrying === inv.id}
                          className="p-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50">
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BUZÓN TRIBUTARIO (PDT Y RH POR MES) */}
        <div className="bg-white rounded-3xl border border-brand-100 shadow-sm overflow-hidden flex flex-col h-fit">
           <div className="p-6 border-b">
              <h3 className="font-black text-gray-800 mb-4 flex items-center text-xs uppercase tracking-widest"><FileText className="w-5 h-5 mr-2 text-brand-600" /> Mi Buzón Tributario</h3>
               <div className="flex bg-gray-50 p-1 rounded-xl">
                   {['all', 'rh', 'factura', 'pdt', 'contador'].map(f => (
                     <button key={f} onClick={() => setDocFilter(f as any)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${docFilter === f ? 'bg-white text-brand-600 shadow-sm border border-brand-100' : 'text-gray-400'}`}>
                       {f === 'all' ? 'Todo' : f === 'rh' ? 'RH' : f === 'factura' ? 'Factura' : f === 'pdt' ? 'PDT' : 'Contador'}
                     </button>
                   ))}
               </div>
           </div>
            <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
               {filteredDocs.length === 0 && <div className="py-10 text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest">Buzón Vacío</div>}
                {filteredDocs.slice().reverse().map(doc => (
                  <div key={doc.id} onClick={() => setPreviewDoc(doc)} className={`px-3 py-2.5 rounded-xl border flex items-center gap-3 transition cursor-pointer group ${doc.uploadedBy === 'ACCOUNTANT' ? 'bg-blue-50/40 border-blue-100 hover:border-blue-300 hover:bg-blue-50/60' : 'bg-gray-50/50 border-gray-100 hover:border-brand-300 hover:bg-brand-50/40'}`}>
                     <div className={`p-2 rounded-lg shadow-sm border group-hover:scale-110 transition-transform shrink-0 ${doc.uploadedBy === 'ACCOUNTANT' ? 'bg-white border-blue-100' : 'bg-white border-gray-100'}`}>{doc.uploadedBy === 'ACCOUNTANT' ? <User className="w-4 h-4 text-blue-700"/> : doc.id.startsWith('RH-') ? <ReceiptText className="w-4 h-4 text-blue-700"/> : <FileText className="w-4 h-4 text-brand-600"/>}</div>
                     <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black text-gray-900 truncate uppercase tracking-tighter leading-none">{doc.name}</p>
                        <p className="text-[8px] font-bold text-gray-400 uppercase mt-0.5">{doc.uploadedBy === 'ACCOUNTANT' ? 'De tu contador' : doc.id.startsWith('RH-') ? 'C. Electrónico' : (doc.id.startsWith('FACTURA-') || doc.id.startsWith('F') || doc.id.startsWith('B')) ? 'Comprobante Electrónico' : 'Declaración Mensual'} · {doc.periodMonth} {doc.periodYear}</p>
                     </div>
                     {doc.uploadedBy === 'ACCOUNTANT' ? <span className="text-[8px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase flex items-center shrink-0"><User className="w-2.5 h-2.5 mr-1"/> CONT</span> : doc.sunatStatus === 'SENT' ? <span className="text-[8px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black uppercase flex items-center shrink-0"><CheckCircle2 className="w-2.5 h-2.5 mr-1"/> OK</span> : <span className="text-[8px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-black uppercase shrink-0">Enviado</span>}
                  </div>
                ))}
            </div>
        </div>
      </div>
    </>
  )}

  {/* PREVISUALIZACIÓN DE DOCUMENTO ARCHIVADO */}
  {previewDoc && (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-4 overflow-y-auto">
       <div className="bg-white rounded-[2rem] w-full max-w-2xl h-fit overflow-hidden flex flex-col shadow-2xl relative">
           <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3 min-w-0">
                 <h3 className="text-sm font-black uppercase tracking-widest text-gray-800 italic truncate">{previewDoc.name}</h3>
                 {previewDoc.uploadedBy === 'ACCOUNTANT' && (
                    <span className="shrink-0 text-[9px] bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-black uppercase flex items-center"><User className="w-3 h-3 mr-1"/> Enviado por tu contador</span>
                 )}
              </div>
              <button onClick={() => setPreviewDoc(null)} className="p-2 bg-white rounded-full hover:bg-gray-100 transition shadow-sm shrink-0"><X className="w-6 h-6 text-gray-400"/></button>
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
              {/* Descarga de archivo subido por el contador (fileUrl es Base64) */}
              {previewDoc.uploadedBy === 'ACCOUNTANT' && previewDoc.fileUrl && (
                <button
                  onClick={() => downloadFile(previewDoc.fileUrl, previewDoc.name, previewDoc.mimeType || 'application/octet-stream', true)}
                  className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-blue-700 transition flex items-center justify-center"
                >
                  <Download className="w-4 h-4 mr-2"/> Descargar Archivo
                </button>
              )}
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

  {showInvoiceModal && (
    <InvoiceWizard
      isOpen={showInvoiceModal}
      onClose={() => setShowInvoiceModal(false)}
      onEmitted={handleInvoiceEmitted}
    />
  )}

  {/* MODAL CREAR CONTADOR */}
  {showCreateAccountant && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
      <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl relative">
        <div className="p-6 bg-brand-600 text-white flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <User className="w-6 h-6"/>
            <h3 className="text-base font-black uppercase tracking-wide">Crear Cuenta de Contador</h3>
          </div>
          <button onClick={() => setShowCreateAccountant(false)} className="text-white hover:rotate-90 transition"><X className="w-5 h-5"/></button>
        </div>
        {accCreated ? (
          <div className="p-6 text-center space-y-4">
            <div className="p-4 bg-green-100 rounded-full w-fit mx-auto"><CheckCircle2 className="w-10 h-10 text-green-600"/></div>
            <p className="font-black text-gray-800 text-lg">{accForm.name}</p>
            <p className="text-xs text-gray-500">{accForm.email}</p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left space-y-1">
              <p className="text-[10px] font-black text-amber-700 uppercase">Contraseña generada</p>
              <p className="text-sm font-mono font-black text-gray-800 select-all">{accPwd}</p>
            </div>
            <p className="text-[10px] text-gray-400 font-bold">Se ha enviado un correo de bienvenida con las credenciales.</p>
            <button onClick={() => setShowCreateAccountant(false)}
              className="w-full py-3 bg-brand-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-brand-700 transition shadow-sm">
              Cerrar
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Nombre del Contador</label>
              <input type="text" placeholder="Ej: Carlos Contreras"
                className="w-full border-2 border-gray-200 p-3 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-brand-600"
                value={accForm.name} onChange={e => setAccForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Correo Electrónico</label>
              <input type="email" placeholder="correo@ejemplo.com"
                className="w-full border-2 border-gray-200 p-3 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-brand-600"
                value={accForm.email} onChange={e => setAccForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Teléfono / WhatsApp (Opcional)</label>
              <input type="text" placeholder="Ej: 987654321"
                className="w-full border-2 border-gray-200 p-3 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-brand-600"
                value={accForm.phone} onChange={e => setAccForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[8px] font-black text-gray-400 uppercase">Contraseña</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 relative">
                  <input type={showAccPwd ? 'text' : 'password'} readOnly
                    className="w-full bg-white border border-gray-200 p-2 rounded-lg text-xs font-mono font-bold text-gray-800 pr-8"
                    value={accPwd} />
                  <button type="button" onClick={() => setShowAccPwd(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showAccPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button onClick={() => setAccPwd(generatePassword())} className="p-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition shrink-0" title="Generar nueva">
                  <RefreshCw className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
            <button onClick={handleCreateAccountant} disabled={creatingAcc || !accForm.name.trim() || !accForm.email.trim()}
              className="w-full py-3 bg-brand-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-sm hover:bg-brand-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
              {creatingAcc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creatingAcc ? 'Creando...' : 'Crear Contador'}
            </button>
          </div>
        )}
      </div>
    </div>
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
                      <Loader2 className="w-16 h-16 text-blue-700 animate-spin mx-auto" />
                      <p className="font-black text-gray-800 text-sm uppercase tracking-wider">{sunatStatusMsg}</p>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                      <p className="font-black text-gray-800 text-lg uppercase">¡Recibo por Honorarios Emitido!</p>
                      <button onClick={() => { setShowReceiptModal(false); setReceiptStep('form'); }} className="px-8 py-3 bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-widest">Cerrar</button>
                    </>
                  )}
               </div>
             )}
          </div>
       </div>
    </div>
  )}

  {showPayment && (
    <div className="fixed inset-0 z-[120] bg-white overflow-y-auto">
      <div className="sticky top-0 z-10 bg-white border-b p-4 flex justify-between items-center shadow-sm">
        <h2 className="font-black text-sm uppercase tracking-widest text-gray-800">Planes de Suscripción</h2>
        <button onClick={() => setShowPayment(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition"><X className="w-5 h-5 text-gray-500"/></button>
      </div>
      <div className="max-w-4xl mx-auto pb-12">
        <Payment />
      </div>
    </div>
  )}
</div>
  );
};
