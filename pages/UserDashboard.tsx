import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Expense, TaxDocument, PendingInvoice, UserRole, SubscriptionStatus, User as UserType, Company } from '../types';
import { Plus, Camera, Loader2, DollarSign, Search, Calendar, Tag, Image as ImageIcon, X, Clock, PieChart as PieChartIcon, BarChart as BarChartIcon, Upload, RefreshCw, Sparkles, Save, Hash, FileText, User, ShieldCheck, Lock, Eye, Download, ChevronDown, FileSpreadsheet, History, DownloadCloud, ExternalLink, PlusCircle, MessageCircleMore, Headphones, TrendingUp, TrendingDown, CalendarDays, CalendarRange, FileInput, ReceiptText, Printer, CheckCircle2, ArrowLeft, Globe, AlertTriangle, ExternalLink as ExtIcon, ShoppingBag, Briefcase, Users, HelpCircle, ChevronLeft, ChevronRight, Building, UserPlus, UserMinus, Trash2, Trash, Edit2, Smartphone, Folder, Send, FolderTree, BellRing, Truck, Receipt, CreditCard, Zap } from 'lucide-react';
import { PaymentAlertsManager } from '../components/PaymentAlertsManager';
import { PersonalExpensesManager } from '../components/PersonalExpensesManager';
import { NonSunatExpensesModal } from '../components/NonSunatExpensesModal';
import { LiquidacionCompraWizard } from '../components/LiquidacionCompraWizard';
import { GuiaRemisionWizard } from '../components/GuiaRemisionWizard';
import { GuiaTransportistaWizard } from '../components/GuiaTransportistaWizard';
import { TicketVentaWizard } from '../components/TicketVentaWizard';
import { ProformaWizard } from '../components/ProformaWizard';
import { OrdenPagoWizard } from '../components/OrdenPagoWizard';
import { NotaVentaWizard } from '../components/NotaVentaWizard';
import { SireModule } from '../components/SireModule';
import { FileTreeModal } from '../components/FileTreeModal';
import { analyzeReceiptOCR } from '../services/ocrService';
import { formatImageUrl } from '../utils/imageUtils';
import { fileToBase64 } from '../services/geminiService';
import { FileUploadZone } from '../components/FileUploadZone';
import { MONTHS, parseUploadName, derivePeriod, readFileAsBase64 } from '../utils/uploadName';
import { analyzeImageQuality, QualityReport } from '../services/imageQuality';
import { ImageQualityAlert } from '../components/ImageQualityAlert';
import { sunatService } from '../services/sunatService';
import { consultaService } from '../services/consultaService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { SunatSettings } from '../components/SunatSettings';
import { InvoiceWizard } from '../components/InvoiceWizard';
import NoteWizard from '../components/NoteWizard';
import { Payment } from '../pages/Payment';
import { InvoicePreview, InvoicePreviewData } from '../components/InvoicePreview';
import { generarPdfDesdeElemento, descargarBlob } from '../services/pdfService';
import { enviarComprobanteWhatsApp, construirMensajeComprobante, esCelularValido, EnvioWhatsAppResult, generarLinkSoportePago } from '../utils/whatsapp';

export const UserDashboard: React.FC = () => {
  const { currentUser, currentSubUser, isSubUser, companies, selectedCompanyId, selectedCompany, selectCompany, addCompany, updateCompany, deleteCompany, assignAccountant, expenses, taxDocuments, addExpense, addTaxDocument, deleteTaxDocument, sunatGlobalConfig, pendingInvoices, removePendingInvoice, updatePendingInvoiceStatus, users, registerUser, updateUser, generatePassword, subscriptionHistory, addSubUser, deleteSubUser, resetUserPassword, packages, paymentAlerts } = useStore();
  const myCompanies = useMemo(() => companies.filter(c => c.ownerUserId === currentUser?.id), [companies, currentUser]);
  const isPersonaNaturalUser = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.PERSONA_NATURAL) return true;
    if (currentUser.email?.toLowerCase().includes('natural') || currentUser.name?.toLowerCase().includes('natural')) return true;
    if (myCompanies.some(c => c.isPersonaNatural)) return true;
    return false;
  }, [currentUser, myCompanies]);
  const isPersonaNaturalActive = isPersonaNaturalUser || (selectedCompany ? !!selectedCompany.isPersonaNatural : true);

  const activePackage = useMemo(() => {
    if (!currentUser) return null;
    const today = new Date().toISOString().split('T')[0];
    if (currentUser.subscriptionStatus === SubscriptionStatus.ACTIVE && currentUser.subscriptionEndDate && currentUser.subscriptionEndDate >= today) {
      const rec = subscriptionHistory.find(r => r.userId === currentUser.id && r.status === 'PAID' && r.endDate >= today);
      if (rec) {
        const found = packages.find(p => p.name === rec.packageName);
        if (found) return found;
      }
    }
    return packages.find(p => p.isFree || p.id === 'pkg-free-client') || null;
  }, [currentUser, subscriptionHistory, packages]);

  const getLimitVal = (limitsObj: Record<string, Record<string, number>> | undefined, limitKey: string): number | null => {
    if (!limitsObj || !limitsObj[limitKey] || !currentUser) return null;
    const roleKey = (currentUser.role === UserRole.PERSONA_NATURAL || currentUser.role === UserRole.EMPRESARIO) ? UserRole.USER : currentUser.role;
    const val = limitsObj[limitKey][currentUser.role] ?? limitsObj[limitKey][roleKey] ?? limitsObj[limitKey][UserRole.USER];
    return val !== undefined && val !== null ? val : null;
  };

  const companyLimit = useMemo(() => getLimitVal(activePackage?.limits, 'maxCompanies'), [activePackage, currentUser]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const myAlerts = useMemo(() => {
    return paymentAlerts.filter(a => a.userId === currentUser?.id && (!selectedCompanyId || !a.companyId || a.companyId === selectedCompanyId));
  }, [paymentAlerts, currentUser, selectedCompanyId]);
  const overdueAlertsCount = useMemo(() => {
    return myAlerts.filter(a => a.status !== 'PAGADO' && a.dueDate < todayStr).length;
  }, [myAlerts, todayStr]);
  const upcomingAlertsCount = useMemo(() => {
    return myAlerts.filter(a => {
      if (a.status === 'PAGADO') return false;
      if (a.dueDate < todayStr) return false;
      const diffTime = new Date(a.dueDate).getTime() - new Date(todayStr).getTime();
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 7;
    }).length;
  }, [myAlerts, todayStr]);

  const mySubUsers = useMemo(() => users.filter(u => u.parentId === currentUser?.id), [users, currentUser]);

  const handleResetPassword = async (user: UserType) => {
    if (!confirm(`¿Restablecer la contraseña de "${user.name}"? Se le enviará una nueva por email y deberá cambiarla al iniciar sesión.`)) return;
    const newPassword = await resetUserPassword(user.id);
    if (!newPassword) {
      alert('No se pudo restablecer la contraseña. Inténtalo nuevamente.');
    }
  };

  const isAtCompanyLimit = companyLimit !== null && myCompanies.length >= companyLimit;
  const subUserLimit = useMemo(() => getLimitVal(activePackage?.limits, 'maxSubUsers'), [activePackage, currentUser]);

  const isAtSubUserLimit = subUserLimit !== null && mySubUsers.length >= subUserLimit;
  const accountantLimit = useMemo(() => getLimitVal(activePackage?.limits, 'maxAccountants'), [activePackage, currentUser]);

  const managedCompaniesPerAccountantLimit = useMemo(() => getLimitVal(activePackage?.limits, 'maxManagedCompaniesPerAccountant'), [activePackage, currentUser]);

  const myAccountants = useMemo(() => {
    return new Set(myCompanies.map(c => c.assignedAccountantId).filter(Boolean));
  }, [myCompanies]);

  const isAtAccountantLimit = accountantLimit !== null && myAccountants.size >= accountantLimit;
  const createdAccountantsLimit = useMemo(() => getLimitVal(activePackage?.limits, 'maxCreatedAccountants'), [activePackage, currentUser]);

  const myCreatedAccountants = useMemo(() => users.filter(u => u.parentId === currentUser?.id && (u.role === UserRole.ACCOUNTANT || u.role === UserRole.CONTADOR)), [users, currentUser]);
  const isAtCreatedAccountantsLimit = createdAccountantsLimit !== null && myCreatedAccountants.length >= createdAccountantsLimit;

  const taxDocLimit = useMemo(() => getLimitVal(activePackage?.limits, 'maxTaxDocuments'), [activePackage, currentUser]);

  const myTaxDocuments = useMemo(() => taxDocuments.filter(d => d.userId === currentUser?.id), [taxDocuments, currentUser]);
  const isAtTaxDocLimit = taxDocLimit !== null && myTaxDocuments.length >= taxDocLimit;
  const [isUploading, setIsUploading] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'settings' | 'history'>('dashboard');
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [ocrRawText, setOcrRawText] = useState('');
  const pendingFileRef = useRef<{ base64: string; mime: string } | null>(null);
  const [docFilter, setDocFilter] = useState<'all' | 'rh' | 'factura' | 'nc' | 'nd' | 'pdt' | 'contador' | 'interno'>('all');
  const [userMainTab, setUserMainTab] = useState<'comprobantes' | 'contador' | 'empresario'>('comprobantes');
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showPersonalExpensesModal, setShowPersonalExpensesModal] = useState(false);
  const [showNonSunatModal, setShowNonSunatModal] = useState(false);
  const [showLiquidacionModal, setShowLiquidacionModal] = useState(false);
  const [showGuiaModal, setShowGuiaModal] = useState(false);
  const [showGuiaTransportistaModal, setShowGuiaTransportistaModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showProformaModal, setShowProformaModal] = useState(false);
  const [showOrdenPagoModal, setShowOrdenPagoModal] = useState(false);
  const [showNotaVentaModal, setShowNotaVentaModal] = useState(false);
  const [showSireModal, setShowSireModal] = useState(false);
  const [userSubTab, setUserSubTab] = useState<'all' | 'factura' | 'boleta' | 'nc' | 'nd' | 'rh'>('all');
  const [previewDoc, setPreviewDoc] = useState<TaxDocument | null>(null);
  const waPdfRef = useRef<HTMLDivElement>(null);
  const [waSending, setWaSending] = useState(false);
  const [waNote, setWaNote] = useState<EnvioWhatsAppResult | null>(null);
  const [showSendToAccountant, setShowSendToAccountant] = useState(false);
  const [showFileTreeModal, setShowFileTreeModal] = useState(false);
  const [isTransmittingSunat, setIsTransmittingSunat] = useState(false);

  const transmitirNotaVentaASunat = async (doc: TaxDocument) => {
    if (!doc || !selectedCompanyId) return;
    setIsTransmittingSunat(true);
    try {
      const recipientRuc = doc.metadata?.recipientRuc || (doc as any).customerRuc || '00000000';
      const targetSerie = recipientRuc.length === 11 ? 'F001' : 'B001';

      const userCredentials = {
        ruc: selectedCompany?.ruc || sunatGlobalConfig?.demo_ruc || '20601090001',
        user: selectedCompany?.sunatUser || sunatGlobalConfig?.demo_user || 'MODDATOS',
        pass: selectedCompany?.sunatPass || sunatGlobalConfig?.demo_pass || 'moddatos',
        env: sunatGlobalConfig?.environment || 'sandbox',
        emitterName: selectedCompany?.name || 'MI EMPRESA S.A.C.',
      };

      const payload = {
        recipientRuc,
        recipientName: doc.metadata?.recipientName || (doc as any).customerName || 'CLIENTE',
        date: doc.uploadDate || new Date().toISOString().split('T')[0],
        items: doc.metadata?.items || [{ description: doc.metadata?.description || 'Nota de Venta', quantity: 1, unitPrice: doc.metadata?.amount || (doc as any).total || 0, subtotal: doc.metadata?.amount || (doc as any).total || 0 }],
        total: doc.metadata?.amount || (doc as any).total || 0,
        currency: 'PEN',
        paymentType: 'contado',
      };

      const res = await sunatService.emitirFactura(
        payload,
        'LOCAL_TOKEN',
        'http://localhost:3001/api',
        userCredentials,
        targetSerie
      );

      if (res.success) {
        const nextNum = Math.floor(Math.random() * 100000);
        const sunatDocId = `${targetSerie}-${String(nextNum).padStart(6, '0')}`;

        const sunatDoc: any = {
          id: sunatDocId,
          type: targetSerie === 'F001' ? 'factura' : 'boleta',
          documentType: targetSerie === 'F001' ? 'factura' : 'boleta',
          serie: targetSerie,
          correlative: nextNum,
          issueDate: doc.uploadDate || new Date().toISOString().split('T')[0],
          customerRuc: recipientRuc,
          customerName: doc.metadata?.recipientName || (doc as any).customerName || 'CLIENTE',
          total: doc.metadata?.amount || (doc as any).total || 0,
          status: 'emitido',
          sunatStatus: 'ACEPTADO',
          xmlContent: res.xmlContent,
          cdrBase64: res.cdrBase64,
          pdfUrl: res.pdfUrl,
          createdAt: new Date().toISOString(),
          metadata: {
            recipientName: doc.metadata?.recipientName || (doc as any).customerName || 'CLIENTE',
            recipientRuc: recipientRuc,
            recipientPhone: doc.metadata?.recipientPhone,
            description: `Convertido de ${doc.name}`,
            amount: doc.metadata?.amount || (doc as any).total || 0,
            netAmount: doc.metadata?.amount || (doc as any).total || 0,
            retention: 0,
            date: doc.uploadDate || new Date().toISOString().split('T')[0],
          },
        };

        addTaxDocument(sunatDoc);
        alert(`¡Comprobante ${sunatDocId} transmitido y ACEPTADO por SUNAT exitosamente!`);
        setPreviewDoc(null);
      } else {
        alert('Error SUNAT: ' + (res.error || 'No se pudo emitir'));
      }
    } catch (err: any) {
      alert(err.message || 'Error transmitiendo a SUNAT');
    } finally {
      setIsTransmittingSunat(false);
    }
  };
  const [sendCompanyId, setSendCompanyId] = useState('');
  const [sendMonth, setSendMonth] = useState(MONTHS[new Date().getMonth()]);
  const [sendYear, setSendYear] = useState(new Date().getFullYear());
  const [sendFiles, setSendFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ done: 0, total: 0 });
  const [retrying, setRetrying] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showCreateAccountant, setShowCreateAccountant] = useState(false);

  const [movementsPage, setMovementsPage] = useState(1);
  const [movementsPerPage, setMovementsPerPage] = useState(10);

  const [accForm, setAccForm] = useState({ name: '', email: '', phone: '' });
  const [creatingAcc, setCreatingAcc] = useState(false);
  const [accCreated, setAccCreated] = useState(false);

  // --- COMPANY CREATION / EDIT ---
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState({ name: '', ruc: '', businessName: '', taxAddress: '' });

  const accountants = useMemo(() => users.filter(u => u.role === UserRole.ACCOUNTANT || u.role === UserRole.CONTADOR), [users]);

  // --- SUB-USER MANAGEMENT ---
  const [showCreateSubUser, setShowCreateSubUser] = useState(false);
  const [subUserForm, setSubUserForm] = useState({ name: '', email: '' });
  const [subUserCreated, setSubUserCreated] = useState(false);

  const MAX_RETRY_ATTEMPTS = 5;

  const retryPendingInvoice = async (inv: PendingInvoice) => {
    if ((inv.attemptCount || 0) >= MAX_RETRY_ATTEMPTS) return;
    if (isAtTaxDocLimit) {
      alert(`Has alcanzado el límite de comprobantes (${taxDocLimit}) de tu plan. Actualiza tu plan para emitir más comprobantes.`);
      return;
    }
    setRetrying(inv.id);
    updatePendingInvoiceStatus(inv.id, 'ENVIANDO');
    try {
      const isNCND = inv.documentType === 'nota_credito' || inv.documentType === 'nota_debito';
      const endpoint = isNCND ? '/emitir-nota' : '/emitir-factura';
      const company = companies.find(c => c.id === inv.companyId) || selectedCompany;
      const credentials = {
        ruc: company?.ruc,
        user: company?.solUser,
        pass: company?.solPass,
        certBase64: company?.certBase64,
        certPass: company?.certPass,
        env: company?.sunatEnv || 'SANDBOX'
      };
      const body = isNCND ? {
        noteType: inv.documentType,
        noteData: inv.payload,
        credentials: inv.payload.credentials || credentials
      } : inv.payload;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (result.success) {
        removePendingInvoice(inv.id);
        const paddedCorr = typeof inv.correlative === 'number' ? String(inv.correlative).padStart(8, '0') : '00000001';
        const isNCND = inv.documentType === 'nota_credito' || inv.documentType === 'nota_debito';
        const isLiq = inv.documentType === 'liquidacion_compra';
        const isGuiaRem = inv.documentType === 'guia_remision';
        const isGuiaTransp = inv.documentType === 'guia_transportista';

        let docName = `${inv.serie}-${paddedCorr}`;
        if (inv.documentType === 'nota_credito') docName = `N. Crédito ${inv.serie}-${paddedCorr}`;
        else if (inv.documentType === 'nota_debito') docName = `N. Débito ${inv.serie}-${paddedCorr}`;
        else if (isLiq) docName = `Liquidación de Compra ${inv.serie}-${paddedCorr} - ${inv.customerName || ''}`;
        else if (isGuiaRem) docName = `Guía de Remisión ${inv.serie}-${paddedCorr} - ${inv.customerName || ''}`;
        else if (isGuiaTransp) docName = `Guía Transportista ${inv.serie}-${paddedCorr} - ${inv.customerName || ''}`;

        const resolvedDocType: TaxDocument['documentType'] = isNCND || isLiq || isGuiaRem || isGuiaTransp
          ? inv.documentType
          : (inv.documentType === 'boleta' ? 'boleta' : 'factura');

        addTaxDocument({
          id: inv.id,
          userId: inv.userId,
          companyId: inv.companyId || selectedCompanyId || '',
          accountId: '',
          name: docName,
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
          sunatHash: Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join(''),
          documentType: resolvedDocType,
          originalDocumentId: inv.originalDocumentId,
          metadata: {
            recipientName: inv.customerName,
            recipientRuc: inv.customerDocNumber,
            recipientPhone: inv.customerPhone,
            amount: inv.amount,
            netAmount: inv.amount,
            date: inv.createdAt || new Date().toISOString().split('T')[0]
          }
        });
      } else {
        updatePendingInvoiceStatus(inv.id, 'PENDIENTE', result.error || 'Error del servidor SUNAT');
      }
    } catch (err: any) {
      updatePendingInvoiceStatus(inv.id, 'PENDIENTE', 'Error de conexión: ' + (err.message || 'Desconocido'));
    } finally { setRetrying(null); }
  };

  const retryAllPending = async () => {
    const pending = pendingInvoices.filter(p => p.status === 'PENDIENTE' && (!selectedCompanyId || p.companyId === selectedCompanyId) && (p.attemptCount || 0) < MAX_RETRY_ATTEMPTS);
    for (const inv of pending) {
      await retryPendingInvoice(inv);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (editingCompany) {
      updateCompany(editingCompany.id, {
        name: companyForm.name,
        ruc: companyForm.ruc,
        businessName: companyForm.businessName,
        taxAddress: companyForm.taxAddress,
      });
    } else {
      const newCompany = {
        id: `comp-${Date.now()}`,
        ownerUserId: currentUser.id,
        name: companyForm.name,
        ruc: companyForm.ruc,
        businessName: companyForm.businessName,
        taxAddress: companyForm.taxAddress,
        isPersonaNatural: currentUser.role === UserRole.PERSONA_NATURAL || isPersonaNaturalUser,
      };
      addCompany(newCompany);
      selectCompany(newCompany.id);
    }
    setCompanyForm({ name: '', ruc: '', businessName: '', taxAddress: '' });
    setEditingCompany(null);
    setShowCreateCompany(false);
  };

  const handleSearchCompanyRuc = async () => {
    const ruc = companyForm.ruc.replace(/\D/g, '');
    if (ruc.length !== 11) { alert('El RUC debe tener 11 dígitos'); return; }
    setIsSearchingRuc(true);
    try {
      const res = await consultaService.consultarRUC(ruc);
      if (res.success && res.razonSocial) {
        setCompanyForm(p => ({ ...p, businessName: res.razonSocial || '', taxAddress: res.address || '' }));
      } else {
        alert(res.error || 'No se encontró el RUC');
      }
    } catch {
      alert('Error al consultar RUC');
    } finally {
      setIsSearchingRuc(false);
    }
  };

  const handleOpenEditCompany = (company: Company) => {
    setEditingCompany(company);
    setCompanyForm({
      name: company.name,
      ruc: company.ruc || '',
      businessName: company.businessName || '',
      taxAddress: company.taxAddress || '',
    });
    setShowCreateCompany(true);
  };

  const handleOpenCreateCompany = () => {
    setEditingCompany(null);
    setCompanyForm({ name: '', ruc: '', businessName: '', taxAddress: '' });
    setShowCreateCompany(true);
  };

  const handleDeleteCompany = (company: Company) => {
    if (confirm(`¿Eliminar esta empresa?\n\n"${company.name}" (${company.ruc || 'sin RUC'})\n\nSe perderán las configuraciones SUNAT asociadas y se desvincularán sus comprobantes y gastos. Esta acción no se puede deshacer.`)) {
      deleteCompany(company.id);
    }
  };

  const handleCreateSubUser = async () => {
    if (isAtSubUserLimit) {
      alert(String.fromCharCode(72,97,115,32,97,108,99,104,97,110,122,97,100,111,32,101,108,32,108,237,109,105,116,101,32,100,101,32,115,117,98,32,117,115,117,97,114,105,111,115,32,40) + subUserLimit + String.fromCharCode(41,32,100,101,32,116,117,32,112,108,97,110,46))
      return;
    }
    if (!currentUser || !subUserForm.name.trim() || !subUserForm.email.trim()) return;
    const pwd = generatePassword();
    const newSubUser: UserType = {
      id: `sub-${Date.now()}`,
      name: subUserForm.name.trim(),
      email: subUserForm.email.trim(),
      role: UserRole.SUB_USER,
      password: pwd,
      mustChangePassword: true,
      parentId: currentUser.id,
    };
    try {
      await addSubUser(newSubUser);
      fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newSubUser.email, name: newSubUser.name, password: pwd })
      }).catch(() => {});
      setSubUserCreated(true);
    } catch (err: any) {
      alert("Error al crear sub-usuario: " + (err.message || "Error de conexión"));
    }
  };


  const handleCreateAccountant = async () => {
    if (!selectedCompany) {
      alert("Debes crear o seleccionar una empresa antes de crear un contador.");
      return;
    }
    if (isAtCreatedAccountantsLimit) {
      alert(String.fromCharCode(72,97,115,32,97,108,99,104,97,110,122,97,100,111,32,101,108,32,108,237,109,105,116,101,32,100,101,32,99,111,110,116,97,100,111,114,101,115,32,97,32,99,114,101,97,114,32,40) + createdAccountantsLimit + String.fromCharCode(41,32,100,101,32,116,117,32,112,108,97,110,46));
      return;
    }
    if (!accForm.name.trim() || !accForm.email.trim()) return;
    setCreatingAcc(true);
    const pwd = generatePassword();
    const newUser = {
      id: Date.now().toString(),
      name: accForm.name.trim(),
      email: accForm.email.trim(),
      phone: accForm.phone.trim(),
      role: UserRole.ACCOUNTANT,
      password: pwd,
      mustChangePassword: true,
      parentId: currentUser.id
    };
    try {
      await registerUser(newUser);
      if (selectedCompany) {
        assignAccountant(selectedCompany.id, newUser.id);
      }
      fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newUser.email, name: newUser.name, password: pwd })
      }).catch(() => {});
      setAccCreated(true);
    } catch (err: any) {
      alert("No se pudo guardar el contador en la base de datos: " + (err.message || "Error al conectar con la base de datos"));
    } finally {
      setCreatingAcc(false);
    }
  };

  // El reintento automático ahora vive en el servidor (server/retry-worker.js).
  // Aquí solo se conservan los reintentos manuales (botones Reintentar / Reintentar Todo).

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
  const [showNcModal, setShowNcModal] = useState(false);
  const [showNdModal, setShowNdModal] = useState(false);
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

  const myExpenses = useMemo(() => expenses.filter(e => e.userId === currentUser?.id && (!selectedCompanyId || e.companyId === selectedCompanyId)), [expenses, currentUser, selectedCompanyId]);

  const userCompanyDocs = useMemo(() => taxDocuments.filter(d => {
    if (selectedCompanyId && d.companyId !== selectedCompanyId) return false;
    if (!selectedCompanyId && d.userId !== currentUser?.id) return false;
    return true;
  }), [taxDocuments, selectedCompanyId, currentUser?.id]);

  const isComprobanteDePagoUser = (d: TaxDocument) => {
    if (['factura', 'boleta', 'nota_credito', 'nota_debito', 'rh'].includes(d.documentType || '')) return true;
    const name = (d.name || '').toUpperCase();
    const id = (d.id || '').toUpperCase();
    if (id.startsWith('F') || id.startsWith('B') || id.startsWith('NC-') || id.startsWith('ND-') || id.startsWith('RH-')) return true;
    if (name.startsWith('FACTURA') || name.startsWith('BOLETA') || name.startsWith('N. CRÉDITO') || name.startsWith('N. DÉBITO') || name.startsWith('RECIBO')) return true;
    return false;
  };

  const getDocAmountUser = (d: TaxDocument): number => {
    let amt = 0;
    if (d.metadata) {
      if (typeof d.metadata === 'object' && d.metadata.amount !== undefined) {
        amt = Number(d.metadata.amount) || 0;
      } else if (typeof d.metadata === 'string') {
        try {
          const p = JSON.parse(d.metadata);
          if (p.amount !== undefined) amt = Number(p.amount) || 0;
        } catch {}
      }
    } else if (d.xmlContent) {
      const match = d.xmlContent.match(/<cbc:PayableAmount[^>]*>([^<]+)<\/cbc:PayableAmount>/) ||
                    d.xmlContent.match(/<cbc:TaxInclusiveAmount[^>]*>([^<]+)<\/cbc:TaxInclusiveAmount>/);
      if (match) amt = parseFloat(match[1]) || 0;
    }

    if (d.documentType === 'nota_credito' || d.name?.toLowerCase().includes('crédito') || d.name?.toLowerCase().includes('credito')) {
      return -Math.abs(amt);
    }
    return amt;
  };

  const allMovements = useMemo(() => {
    const ingList = userCompanyDocs.filter(d => d.sunatStatus !== 'BORRADO' && isComprobanteDePagoUser(d)).map(d => {
      const amt = getDocAmountUser(d);
      return {
        id: `ing-${d.id}`,
        type: 'INGRESO' as const,
        amount: amt,
        description: `${d.name}${d.metadata?.recipientName ? ' - ' + d.metadata.recipientName : ''}`,
        date: d.uploadDate || (d.metadata?.date) || new Date().toISOString().split('T')[0],
        doc: d,
        isPrivate: false
      };
    });

    const egList = myExpenses.map(e => {
      return {
        id: `eg-${e.id}`,
        type: 'EGRESO' as const,
        amount: e.amount,
        currency: e.currency || 'PEN',
        category: e.category,
        description: e.description,
        date: e.date,
        exp: e,
        isPrivate: !!e.isPrivate
      };
    });

    return [...ingList, ...egList].sort((a, b) => {
      const diff = new Date(b.date || '').getTime() - new Date(a.date || '').getTime();
      return diff !== 0 ? diff : b.id.localeCompare(a.id);
    });
  }, [userCompanyDocs, myExpenses]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthName = (MONTHS[now.getMonth()] || '').toLowerCase();

    const monthExpenses = myExpenses.filter(e => {
      const [y, m] = e.date.split('-').map(Number);
      return y === now.getFullYear() && m - 1 === now.getMonth();
    });

    const monthDocs = userCompanyDocs.filter(d =>
      d.sunatStatus !== 'BORRADO' && isComprobanteDePagoUser(d) &&
      (d.uploadDate?.startsWith(currentMonthStr) || (d.periodYear === now.getFullYear() && d.periodMonth?.toLowerCase() === currentMonthName))
    );

    const monthVentas = monthDocs.reduce((sum, d) => sum + getDocAmountUser(d), 0);
    const monthGastos = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

    const dailyData = Array.from({length: 7}, (_, i) => {
      const d = new Date(); d.setDate(now.getDate() - (6 - i));
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { 
        name: d.toLocaleDateString('es-ES', { weekday: 'short' }), 
        ventas: monthDocs.filter(doc => (doc.uploadDate || doc.metadata?.date) === dStr).reduce((sum, doc) => sum + getDocAmountUser(doc), 0),
        gastos: myExpenses.filter(e => e.date === dStr).reduce((sum, e) => sum + e.amount, 0) 
      };
    });

    return { monthVentas, monthGastos, monthTotal: monthGastos, dailyData };
  }, [myExpenses, userCompanyDocs]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const base64 = await fileToBase64(file);
      setPreviewInternal(base64);
      setAiError('');
      setQualityReport(null);

      const report = await analyzeImageQuality(base64, file.type);
      if (report.overallOk) {
        handleAnalyze(base64, file.type);
      } else {
        pendingFileRef.current = { base64, mime: file.type };
        setQualityReport(report);
      }
    }
  };

  const handleRetryQuality = () => {
    setQualityReport(null);
    setPreviewInternal(null);
    pendingFileRef.current = null;
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const handleContinueQuality = () => {
    if (pendingFileRef.current) {
      handleAnalyze(pendingFileRef.current.base64, pendingFileRef.current.mime);
    }
    setQualityReport(null);
    pendingFileRef.current = null;
  };

  const handleDismissQuality = () => {
    setQualityReport(null);
    pendingFileRef.current = null;
  };

  const handleAnalyze = async (base64: string, mime: string) => {
    setAnalyzing(true);
    setAiError('');
    setOcrRawText('');
    try {
      const data = await analyzeReceiptOCR(base64, mime);
      if (data.rawText) setOcrRawText(data.rawText);
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
      companyId: selectedCompanyId || '',
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
    const activeApiUrl = selectedCompany?.sunatApiUrl || sunatGlobalConfig.sunatApiUrl || '';
    const useLocalEngine = !activeApiUrl || activeApiUrl.includes('localhost') || activeApiUrl.startsWith('/');
    const activeToken = selectedCompany?.sunatToken || sunatGlobalConfig.sunatToken;
    
    // RH: el emisor es el empleado (RUC personal + credenciales SOL propias)
    const solUser = currentUser?.solUser || '';
    const solPass = currentUser?.solPass || '';
    const rucEmisor = currentUser?.ruc || '';
    if (!rucEmisor || !solUser || !solPass) {
      setSyncError("Credenciales SOL del empleado (RUC, usuario y contraseña) no configuradas. Configúralas en tu perfil para emitir Recibos por Honorarios.");
      return;
    }
    if (!useLocalEngine && !activeToken) {
      setSyncError("Token de Acceso APISUNAT no configurado. Obtén tu token en app.apisunat.pe.");
      return;
    }
    setReceiptStep('sync');
    setIsSyncing(true);
    setSunatStatusMsg('Iniciando comunicación con SUNAT...');
    
    try {
      let response;
      if (useLocalEngine) {
        // Motor local: usa scraper Playwright del Portal Web SOL
        const scraperPayload = {
          ruc: rucEmisor,
          solUser,
          solPass,
          docType: receiptForm.recipientRuc?.length === 8 ? 'DNI' : 'RUC',
          docNumber: receiptForm.recipientRuc,
          nameOrRazon: receiptForm.recipientName,
          concepto: receiptForm.description,
          moneda: 'SOLES',
          montoNeto: receiptForm.amount,
          retencion: receiptForm.applyRetention ? 'si' : 'no',
          tipoRenta: '4',
          headless: false,
          stopBeforeEmit: true,
        };
        response = await sunatService.emitirReciboHonorariosScraper(
          scraperPayload,
          (activeApiUrl || 'http://localhost:5555')
        );
      } else {
        // API externa (APISUNAT)
        response = await sunatService.emitirReciboHonorarios(
          receiptForm,
          activeToken,
          activeApiUrl,
          {
            ruc: selectedCompany?.ruc,
            user: selectedCompany?.solUser,
            pass: selectedCompany?.solPass,
            certBase64: selectedCompany?.certBase64,
            certPass: selectedCompany?.certPass,
            emitterName: selectedCompany?.businessName,
            env: selectedCompany?.sunatEnv || 'SANDBOX'
          }
        );
      }

      
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
    const activeToken = selectedCompany?.sunatToken || sunatGlobalConfig.sunatToken;

    if (!selectedCompany?.solUser || !selectedCompany?.solPass) {
      setSyncError("Credenciales SOL (usuario y contraseña) no configuradas en la empresa seleccionada.");
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
        selectedCompany?.sunatApiUrl || sunatGlobalConfig.sunatApiUrl || '',
        {
          ruc: selectedCompany?.ruc,
          user: selectedCompany?.solUser,
          pass: selectedCompany?.solPass,
          certBase64: selectedCompany?.certBase64,
          certPass: selectedCompany?.certPass,
          emitterName: selectedCompany?.businessName,
          env: selectedCompany?.sunatEnv || 'SANDBOX'
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
      companyId: selectedCompanyId || '',
      accountantId: selectedCompany?.assignedAccountantId || '',
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

    if (isAtTaxDocLimit) {
      setSyncError(`Has alcanzado el límite de comprobantes (${taxDocLimit}) de tu plan. Actualiza tu plan para emitir más comprobantes.`);
      return;
    }

    addTaxDocument(newDoc);

    if (type === 'RH') {
      setShowReceiptModal(false);
      setReceiptStep('form');
    } else {
      setShowInvoiceModal(false);
    }
  };

  const handleInvoiceEmitted = (result: { id: string; name: string; sunatStatus: string; xmlContent?: string; cdrBase64?: string; amount?: number; customerName?: string; customerRuc?: string; customerPhone?: string; documentType?: TaxDocument['documentType']; originalDocumentId?: string }) => {
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

    const activeAccId = selectedCompany?.assignedAccountantId || '';

    const isInternal = result.sunatStatus === 'INTERNO';
    const newDoc: TaxDocument = {
      id: result.id,
      userId: currentUser.id,
      companyId: selectedCompanyId || '',
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
      documentType: result.documentType,
      originalDocumentId: result.originalDocumentId,
      metadata: { amount: result.amount, recipientName: result.customerName, recipientPhone: result.customerPhone, recipientRuc: result.customerRuc || '', description: '', retention: 0, netAmount: result.amount || 0, date: '' }
    };
 
    if (isAtTaxDocLimit) {
      alert(`Has alcanzado el límite de comprobantes (${taxDocLimit}) de tu plan. Actualiza tu plan para emitir más comprobantes.`);
      return;
    }
 
    addTaxDocument(newDoc);
  };

  const [isGeneratingPreviewPdf, setIsGeneratingPreviewPdf] = useState(false);

  const previewWhatsAppData = useMemo((): InvoicePreviewData | null => {
    if (!previewDoc) return null;
    return {
      documentType: previewDoc.documentType || 'factura',
      serieNumero: previewDoc.name,
      issueDate: previewDoc.uploadDate,
      emitterName: selectedCompany?.name || selectedCompany?.businessName || currentUser?.name || 'MI EMPRESA S.A.C.',
      emitterRuc: selectedCompany?.ruc || currentUser?.ruc || '20000000001',
      emitterAddress: selectedCompany?.taxAddress || 'LIMA, PERÚ',
      customerName: previewDoc.metadata?.recipientName || 'CLIENTE GENERAL',
      customerDocNumber: previewDoc.metadata?.recipientRuc || '00000000',
      customerDocTypeLabel: (previewDoc.metadata?.recipientRuc?.length === 8) ? 'DNI' : 'RUC',
      customerPhone: previewDoc.metadata?.recipientPhone,
      items: previewDoc.metadata?.description ? [
        {
          description: previewDoc.metadata.description,
          quantity: 1,
          unitPrice: previewDoc.metadata.amount || 0,
          total: previewDoc.metadata.amount || 0
        }
      ] : [
        {
          description: previewDoc.name || 'Servicios / Bienes',
          quantity: 1,
          unitPrice: previewDoc.metadata?.amount || 0,
          total: previewDoc.metadata?.amount || 0
        }
      ],
      total: previewDoc.metadata?.amount || 0,
      currency: 'PEN'
    };
  }, [previewDoc, selectedCompany, currentUser]);

  const handleDownloadPreviewPdf = async () => {
    if (!previewDoc) return;

    // Si el documento ya cuenta con URL de PDF directa
    if (previewDoc.pdfUrl) {
      window.open(previewDoc.pdfUrl, '_blank');
      return;
    }

    // Si el fileUrl es un PDF en Base64
    if (previewDoc.fileUrl && (previewDoc.mimeType?.includes('pdf') || previewDoc.fileUrl.startsWith('data:application/pdf') || previewDoc.fileUrl.endsWith('.pdf'))) {
      downloadFile(previewDoc.fileUrl, `${previewDoc.name}.pdf`, 'application/pdf', true);
      return;
    }

    // Generar PDF desde la plantilla HTML de InvoicePreview
    const el = waPdfRef.current;
    if (!el) {
      alert('Vista previa no disponible para generar PDF');
      return;
    }

    setIsGeneratingPreviewPdf(true);
    try {
      const filename = `${previewDoc.name || 'comprobante'}.pdf`;
      const pdfBlob = await generarPdfDesdeElemento(el, { filename });
      descargarBlob(pdfBlob, filename);
    } catch (err: any) {
      console.error('Error al generar PDF:', err);
      alert('No se pudo generar el PDF del comprobante');
    } finally {
      setIsGeneratingPreviewPdf(false);
    }
  };

  const enviarWhatsAppPreview = async () => {
    if (!previewDoc) return;
    const phone = previewDoc.metadata?.recipientPhone;
    if (!phone || !esCelularValido(phone)) return;
    setWaSending(true);
    setWaNote(null);
    try {
      const el = waPdfRef.current;
      if (!el) throw new Error('Vista no disponible');
      const pdfBlob = await generarPdfDesdeElemento(el, { filename: `${previewDoc.name}.pdf` });
      const texto = construirMensajeComprobante({
        tipo: previewDoc.documentType || 'factura',
        serieNumero: previewDoc.name,
        cliente: previewDoc.metadata?.recipientName || '',
        monto: previewDoc.metadata?.amount || 0
      });
      const resultado = await enviarComprobanteWhatsApp({
        phone,
        text: texto,
        pdfBlob,
        pdfFilename: `${previewDoc.name}.pdf`,
        xmlContent: previewDoc.xmlContent,
        xmlFilename: previewDoc.xmlContent ? `${previewDoc.name}.xml` : undefined
      });
      setWaNote(resultado.status === 'cancelled' ? null : resultado);
    } catch {
      setWaNote({ status: 'error' });
    } finally {
      setWaSending(false);
    }
  };

  const openSendModal = () => {
    setSendCompanyId(selectedCompany?.id || (myCompanies.length === 1 ? myCompanies[0].id : ''));
    setSendMonth(MONTHS[new Date().getMonth()]);
    setSendYear(new Date().getFullYear());
    setSendFiles([]);
    setSendProgress({ done: 0, total: 0 });
    setShowSendToAccountant(true);
  };

  const handleSendToAccountant = async () => {
    try {
      if (!sendFiles.length || !currentUser) return;
      const company = companies.find(c => c.id === sendCompanyId);
      if (!company) { alert('Selecciona una empresa'); return; }
      const accountantId = company.assignedAccountantId;
      if (!accountantId) { alert('Esta empresa no tiene un contador asignado.'); return; }
      const accountant = users.find(u => u.id === accountantId);
      setSendProgress({ done: 0, total: sendFiles.length });
      setIsSending(true);
      const sentNames: string[] = [];
      const failedNames: string[] = [];
      for (let i = 0; i < sendFiles.length; i++) {
        const file = sendFiles[i];
        try {
          const base64 = await readFileAsBase64(file);
          const { folderPath, name } = parseUploadName(file.name);
          const subFolder = folderPath.split('/')[1] || '';
          const period = derivePeriod(subFolder) || { month: sendMonth, year: sendYear };
          const newDoc: TaxDocument = {
            id: `send-${Date.now()}-${i}`,
            userId: currentUser.id,
            companyId: company.id,
            accountantId,
            name,
            folderPath: folderPath || undefined,
            fileUrl: base64,
            mimeType: file.type,
            uploadDate: new Date().toISOString().split('T')[0],
            periodMonth: period.month,
            periodYear: period.year,
            uploadedBy: 'USER'
          };
          addTaxDocument(newDoc);
          sentNames.push(name);
        } catch (innerErr) {
          console.error('Error al enviar archivo:', file.name, innerErr);
          failedNames.push(file.name);
        }
        setSendProgress({ done: i + 1, total: sendFiles.length });
      }
      setIsSending(false);
      setSendFiles([]);
      setSendProgress({ done: 0, total: 0 });
      if (failedNames.length === 0) {
        alert(`Se enviaron ${sentNames.length} archivo(s) a tu contador${accountant ? ` (${accountant.name})` : ''}.`);
      } else if (sentNames.length > 0) {
        alert(`${sentNames.length} enviados a tu contador. Fallaron: ${failedNames.join(', ')}`);
      } else {
        alert('No se pudo enviar ningún archivo.');
      }
    } catch (err) {
      console.error('Error al enviar archivos:', err);
      alert('Error inesperado al enviar los archivos.');
      setIsSending(false);
    }
  };

  if (!currentUser) return null;

  const filteredDocs = userCompanyDocs.filter(d => {
    const isComp = isComprobanteDePagoUser(d);
    if (userMainTab === 'comprobantes') {
      if (!isComp) return false;
      if (userSubTab === 'all') return true;
      if (userSubTab === 'factura') return d.documentType === 'factura' || d.id.startsWith('F') || d.id.startsWith('FACTURA-');
      if (userSubTab === 'boleta') return d.documentType === 'boleta' || d.id.startsWith('B') || d.id.startsWith('BOLETA-');
      if (userSubTab === 'nc') return d.documentType === 'nota_credito' || d.id.startsWith('NC-');
      if (userSubTab === 'nd') return d.documentType === 'nota_debito' || d.id.startsWith('ND-');
      if (userSubTab === 'rh') return d.documentType === 'rh' || d.id.startsWith('RH-');
      return true;
    }
    if (userMainTab === 'contador') {
      return d.uploadedBy === 'ACCOUNTANT' && !isComp;
    }
    if (userMainTab === 'empresario') {
      return d.uploadedBy !== 'ACCOUNTANT' && !isComp;
    }
    return true;
  });

  const docGroups = (() => {
    const map = new Map<string, TaxDocument[]>();
    for (const doc of filteredDocs) {
      const key = doc.folderPath || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(doc);
    }
    return Array.from(map.entries())
      .map(([folder, docs]) => ({ folder, docs }))
      .sort((a, b) => {
        if (a.folder === '') return 1;
        if (b.folder === '') return -1;
        return a.folder.localeCompare(b.folder);
      });
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER PRINCIPAL - ESTILO WEB .DOCX (#0B192C / SLATE) */}
      <header className="bg-[#0B192C] text-white p-6 md:p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="absolute -top-16 -left-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black rounded-full uppercase tracking-widest">Empresa Activa</span>
            {isSubUser && <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-black rounded-full uppercase">Solo Lectura</span>}
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">Hola, {currentUser.name}</h2>
          <p className="text-xs text-slate-300 font-medium">Gestiona tus finanzas empresariales y tributarias con SUNAT.</p>
          
{myCompanies.length > 0 && (
             <div className="flex items-center gap-2 pt-2">
               <Briefcase className="w-4 h-4 text-amber-400" />
               <select
                 value={selectedCompanyId || ''}
                 onChange={(e) => selectCompany(e.target.value || null)}
                 className="bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-xl text-xs font-black text-white outline-none focus:border-amber-400 transition"
               >
                 {myCompanies.map(c => (
                   <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}{c.ruc ? ` (${c.ruc})` : ''}</option>
                 ))}
               </select>
               {!isPersonaNaturalUser && !isAtCompanyLimit && (
                 <button onClick={handleOpenCreateCompany} className="p-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-xl transition border border-amber-500/30" title="Nueva empresa">
                   <Plus className="w-4 h-4" />
                 </button>
               )}
             </div>
           )}
           {myCompanies.length === 0 && !isPersonaNaturalUser && !isAtCompanyLimit && (
             <button onClick={handleOpenCreateCompany} className="mt-2 bg-amber-500 hover:bg-amber-600 text-slate-950 px-5 py-2.5 rounded-xl transition flex items-center font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-500/20 active:scale-95">
               <Building className="w-4 h-4 mr-2" /> Crear Mi Empresa
             </button>
           )}
           {isAtCompanyLimit && (
             <p className="mt-2 text-[10px] text-amber-400/80 font-medium">
               Has alcanzado el límite de empresas de tu plan ({companyLimit})
             </p>
           )}
        </div>

        {/* BLOQUES DE ACCIÓN RÁPIDA (INGRESOS & EGRESOS) */}
        <div className="relative z-10 flex flex-col sm:flex-row flex-wrap gap-3 w-full lg:w-auto items-stretch sm:items-center">
          {!isSubUser && (
            <>
              {/* Bloque Ingresos */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white/5 border border-white/10 backdrop-blur-md p-2 rounded-2xl">
                 <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 font-black text-[9px] uppercase tracking-widest flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 mr-1" /> INGRESOS
                 </div>
                 <div className="flex flex-wrap gap-1.5">
                     <button onClick={() => { if (isAtTaxDocLimit) { alert(`Has alcanzado el límite de comprobantes (${taxDocLimit}) de tu plan.`); return; } setShowInvoiceModal(true); }} className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-2 rounded-xl transition flex items-center justify-center font-black text-[9px] uppercase tracking-wider active:scale-95 shadow-md shadow-amber-500/20">
                       <FileInput className="w-3.5 h-3.5 mr-1" /> FACTURA
                     </button>
                      {isPersonaNaturalActive && (
                        <button onClick={() => { if (isAtTaxDocLimit) { alert(`Has alcanzado el límite de comprobantes (${taxDocLimit}) de tu plan.`); return; } setShowReceiptModal(true); }} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl transition flex items-center justify-center font-black text-[9px] uppercase tracking-wider active:scale-95 shadow-md">
                          <ReceiptText className="w-3.5 h-3.5 mr-1" /> RECIBO RH
                        </button>
                      )}
                     <button onClick={() => { if (isAtTaxDocLimit) { alert(`Has alcanzado el límite de comprobantes (${taxDocLimit}) de tu plan.`); return; } setShowNcModal(true); }} className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl transition flex items-center justify-center font-black text-[9px] uppercase tracking-wider active:scale-95">
                       <FileText className="w-3 h-3 mr-1" /> NC
                     </button>
                       <button onClick={() => { if (isAtTaxDocLimit) { alert(`Has alcanzado el límite de comprobantes (${taxDocLimit}) de tu plan.`); return; } setShowNdModal(true); }} className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-xl transition flex items-center justify-center font-black text-[9px] uppercase tracking-wider active:scale-95">
                         <FileText className="w-3 h-3 mr-1" /> ND
                       </button>
                        <button onClick={() => { if (isAtTaxDocLimit) { alert(`Has alcanzado el límite de comprobantes (${taxDocLimit}) de tu plan.`); return; } setShowLiquidacionModal(true); }} className="flex-1 sm:flex-none bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-xl transition flex items-center justify-center font-black text-[9px] uppercase tracking-wider active:scale-95 shadow-md" title="Liquidación de Compra Electrónica (Serie E001 - SUNAT 04)">
                          <FileText className="w-3 h-3 mr-1" /> LIQUIDACIÓN E001
                        </button>
                         <button onClick={() => { if (isAtTaxDocLimit) { alert(`Has alcanzado el límite de comprobantes (${taxDocLimit}) de tu plan.`); return; } setShowGuiaModal(true); }} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl transition flex items-center justify-center font-black text-[9px] uppercase tracking-wider active:scale-95 shadow-md" title="Guía de Remisión Electrónica Remitente (Serie T001 - SUNAT 09)">
                           <Truck className="w-3.5 h-3.5 mr-1" /> GUÍA REMITENTE T001
                         </button>
                          <button onClick={() => { if (isAtTaxDocLimit) { alert(`Has alcanzado el límite de comprobantes (${taxDocLimit}) de tu plan.`); return; } setShowGuiaTransportistaModal(true); }} className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl transition flex items-center justify-center font-black text-[9px] uppercase tracking-wider active:scale-95 shadow-md" title="Guía de Remisión Electrónica Transportista (Serie V001 - SUNAT 31)">
                            <Truck className="w-3.5 h-3.5 mr-1" /> GUÍA TRANSPORTISTA V001
                          </button>
                           <button onClick={() => setShowTicketModal(true)} className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-2 rounded-xl transition flex items-center justify-center font-black text-[9px] uppercase tracking-wider active:scale-95 shadow-md shadow-amber-500/20" title="Ticket de Venta / Nota Interna (No SUNAT)">
                             <Receipt className="w-3.5 h-3.5 mr-1" /> TICKET VENTA (NO SUNAT)
                           </button>
                            <button onClick={() => setShowProformaModal(true)} className="flex-1 sm:flex-none bg-sky-500 hover:bg-sky-600 text-slate-950 px-3 py-2 rounded-xl transition flex items-center justify-center font-black text-[9px] uppercase tracking-wider active:scale-95 shadow-md shadow-sky-500/20" title="Proforma / Cotización Comercial (No SUNAT)">
                              <FileText className="w-3.5 h-3.5 mr-1" /> PROFORMA / COTIZACIÓN
                            </button>
                             <button onClick={() => setShowOrdenPagoModal(true)} className="flex-1 sm:flex-none bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-xl transition flex items-center justify-center font-black text-[9px] uppercase tracking-wider active:scale-95 shadow-md shadow-violet-600/20" title="Orden de Pago / Solicitud de Cobro Interna (No SUNAT)">
                               <CreditCard className="w-3.5 h-3.5 mr-1" /> ORDEN DE PAGO
                             </button>
                              <button onClick={() => setShowNotaVentaModal(true)} className="flex-1 sm:flex-none bg-teal-500 hover:bg-teal-600 text-slate-950 px-3 py-2 rounded-xl transition flex items-center justify-center font-black text-[9px] uppercase tracking-wider active:scale-95 shadow-md shadow-teal-500/20" title="Nota de Venta Interna (No SUNAT)">
                                <FileText className="w-3.5 h-3.5 mr-1" /> NOTA DE VENTA
                              </button>
                              <button onClick={() => setShowSireModal(true)} className="flex-1 sm:flex-none bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded-xl transition flex items-center justify-center font-black text-[9px] uppercase tracking-wider active:scale-95 shadow-md shadow-indigo-500/20" title="SIRE — Registro de Ventas (RVIE) y Registro de Compras (RCE) Electrónicos">
                                <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> SIRE (RVIE / RCE)
                              </button>
                  </div>
               </div>

               {/* Bloque Egresos No SUNAT */}
               <div className="flex items-center gap-2 bg-white/5 border border-white/10 backdrop-blur-md p-2 rounded-2xl">
                  <button
                    onClick={() => setShowNonSunatModal(true)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-3.5 py-2 rounded-xl transition flex items-center justify-center font-black text-[9px] uppercase tracking-wider active:scale-95 shadow-md shadow-emerald-500/20 gap-1"
                    title="Egresos sin Comprobante SUNAT (Meta Ads, Hostinger, AWS, etc.)"
                  >
                    <Globe className="w-3.5 h-3.5" /> EGRESOS NO SUNAT
                  </button>
               </div>
            </>
          )}

          <div className="flex items-center gap-2">
            {!isSubUser && (
              <button 
                onClick={() => setActiveView(activeView === 'dashboard' ? 'settings' : 'dashboard')} 
                className={`p-2.5 rounded-xl transition flex items-center justify-center active:scale-95 ${activeView === 'settings' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}`}
                title="Ajustes SUNAT y Empresa"
              >
                <ShieldCheck className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={() => setActiveView(activeView === 'history' ? 'dashboard' : 'history')} 
              className={`p-2.5 rounded-xl transition flex items-center justify-center active:scale-95 ${activeView === 'history' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}`}
              title="Historial de Suscripciones"
            >
              <History className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowPersonalExpensesModal(true)}
              className="px-3 py-2.5 rounded-xl transition flex items-center justify-center active:scale-95 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/40 text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
              title="Mis Gastos Personales (Privado)"
            >
              <ShoppingBag className="w-4 h-4 text-purple-400" />
              <span className="hidden sm:inline">Gastos Personales</span>
            </button>
            <button 
              onClick={() => setShowAlertsModal(true)} 
              className={`relative p-2.5 rounded-xl transition flex items-center justify-center active:scale-95 border ${
                overdueAlertsCount > 0 
                  ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border-red-500/40' 
                  : upcomingAlertsCount > 0 
                  ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border-amber-500/40' 
                  : 'bg-white/10 text-white hover:bg-white/20 border-white/10'
              }`}
              title={
                overdueAlertsCount > 0 
                  ? `${overdueAlertsCount} Pagos Vencidos - Revisa tus Alertas` 
                  : upcomingAlertsCount > 0 
                  ? `${upcomingAlertsCount} Pagos Próximos a Vencer - Revisa tus Alertas` 
                  : 'Alertas & Recordatorios de Pago'
              }
            >
              <BellRing className={`w-5 h-5 ${overdueAlertsCount > 0 ? 'text-red-400 animate-pulse' : upcomingAlertsCount > 0 ? 'text-amber-400 animate-pulse' : 'text-amber-400'}`} />
              {overdueAlertsCount > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-black rounded-full shadow-md animate-bounce">
                  {overdueAlertsCount}
                </span>
              ) : upcomingAlertsCount > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-amber-500 text-slate-950 text-[9px] font-black rounded-full shadow-md animate-bounce">
                  {upcomingAlertsCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </header>

      {/* BANNER ALERTA SOL SI NO TIENE CREDENCIALES CONFIGURADAS (solo para Persona Natural) */}
      {currentUser && isPersonaNaturalActive && (!currentUser.solUser || !currentUser.solPass) && (
        <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl flex items-center animate-pulse">
          <AlertTriangle className="w-5 h-5 text-amber-600 mr-3 shrink-0" />
          <div>
            <p className="text-xs font-black text-amber-900 uppercase tracking-tighter">Recibos por Honorarios Pendiente</p>
            <p className="text-[10px] text-amber-700 font-bold uppercase">Configura tu RUC, usuario y clave SOL en tu perfil para emitir Recibos por Honorarios.</p>
          </div>
        </div>
      )}

      {activeView === 'settings' ? (
        <div className="animate-fade-in-up space-y-6">
           <button onClick={() => setActiveView('dashboard')} className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-800 transition">
             <ArrowLeft className="w-4 h-4" /> Volver al Dashboard
           </button>

            {selectedCompany && (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-brand-50 rounded-2xl text-brand-600"><Building className="w-5 h-5"/></div>
                    <div>
                      <h3 className="font-black text-gray-900 text-sm uppercase tracking-tighter">{selectedCompany.name}</h3>
                      <p className="text-[10px] text-gray-400 font-bold">RUC: {selectedCompany.ruc || 'No registrado'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleOpenEditCompany(selectedCompany)} className="p-2.5 text-brand-600 hover:bg-brand-50 rounded-xl transition" title="Editar empresa">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCompany(selectedCompany)}
                      disabled={isPersonaNaturalUser}
                      title={isPersonaNaturalUser ? 'Como Persona Natural no puedes eliminar tu única empresa' : 'Eliminar empresa'}
                      className={`p-2.5 rounded-xl transition ${isPersonaNaturalUser ? 'text-gray-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-100">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Contador Asignado</label>
                  {isSubUser ? (
                    <p className="text-sm font-black text-gray-800">
                      {accountants.find(a => a.id === selectedCompany.assignedAccountantId)?.name || 'Sin contador asignado'}
                    </p>
                  ) : accountants.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No hay contadores disponibles. Puedes crear uno desde el botón "Crear Contador".</p>
                  ) : (
                    <div className="flex items-center gap-3">
                      <select
                        value={selectedCompany.assignedAccountantId || ''}
                        onChange={e => {
                          const target = e.target.value || '';
                          if (isAtAccountantLimit) { alert('Has alcanzado el límite de contadores (' + accountantLimit + ') de tu plan.'); return; }
                          if (target && managedCompaniesPerAccountantLimit !== null) {
                            const assignedCount = myCompanies.filter(c => c.assignedAccountantId === target && c.id !== selectedCompany.id).length;
                            if (assignedCount >= managedCompaniesPerAccountantLimit) {
                              alert('Este contador ya gestiona el límite de empresas (' + managedCompaniesPerAccountantLimit + ') de tu plan.');
                              return;
                            }
                          }
                          assignAccountant(selectedCompany.id, target);
                        }}
                        className="flex-1 bg-white border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600"
                      >
                        <option value="">Sin contador asignado</option>
                        {accountants.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                       {currentUser.subscriptionStatus === SubscriptionStatus.ACTIVE && (
                        <button onClick={() => setShowCreateAccountant(true)} className="p-3 bg-brand-50 text-brand-600 rounded-xl hover:bg-brand-100 transition" title="Crear nuevo contador">
                          <UserPlus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

           {/* SUB-USUARIOS */}
           {!isSubUser && (
             <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="p-3 bg-blue-50 rounded-2xl text-blue-600"><Users className="w-5 h-5"/></div>
                   <div>
                     <h3 className="font-black text-gray-900 text-sm uppercase tracking-tighter">Sub Usuarios</h3>
                     <p className="text-[10px] text-gray-400 font-bold">Cuentas de solo lectura y descarga</p>
                   </div>
                 </div>
                 <button onClick={() => { if (isAtSubUserLimit) { alert('Has alcanzado el límite de sub usuarios (' + subUserLimit + ') de tu plan.'); return; } setSubUserCreated(false); setSubUserForm({ name: '', email: '' }); setShowCreateSubUser(true); }}
                   className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition flex items-center font-black text-[10px] uppercase tracking-widest shadow-sm active:scale-95">
                   <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Nuevo Sub Usuario
                 </button>
               </div>
               {mySubUsers.length === 0 ? (
                 <p className="text-xs text-gray-400 italic py-4">No hay sub usuarios creados. Los sub usuarios pueden ver y descargar archivos pero no pueden modificar datos.</p>
               ) : (
                 <div className="space-y-2">
                   {mySubUsers.map(sub => (
                     <div key={sub.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                       <div className="flex items-center gap-3">
                         <div className="p-2 bg-blue-100 rounded-lg"><User className="w-4 h-4 text-blue-600"/></div>
                         <div>
                           <p className="text-xs font-black text-gray-900 uppercase">{sub.name}</p>
                           <p className="text-[9px] text-gray-400 font-bold">{sub.email}</p>
                         </div>
                       </div>
                        <div className="flex items-center gap-1">
                          {!isSubUser && (
                            <button onClick={() => handleResetPassword(sub)}
                              className="p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                              title="Restablecer contraseña">
                              <Lock className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => { if(confirm('¿Eliminar este sub usuario?')) deleteSubUser(sub.id); }}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
           )}

            {!isSubUser && <SunatSettings />}
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
                  <div key={rec.id} className="px-4 py-3.5 rounded-2xl border border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-brand-50 shrink-0"><FileText className="w-4 h-4 text-brand-600"/></div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-gray-900 truncate uppercase">{rec.packageName}</p>
                        <p className="text-[8px] font-bold text-gray-400 uppercase mt-0.5">
                          {rec.date} · S/ {rec.amount.toFixed(2)}
                          {rec.startDate && rec.endDate && ` · ${rec.startDate} → ${rec.endDate}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                      <span className={`text-[8px] px-2.5 py-1 rounded-full font-black uppercase shrink-0 ${rec.status === 'PAID' ? 'bg-green-100 text-green-700' : rec.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {rec.status === 'PAID' ? 'Pagado' : rec.status === 'PENDING' ? 'Pendiente' : 'Rechazado'}
                      </span>
                      {rec.status === 'CANCELLED' && (
                        <button
                          onClick={() => window.open(generarLinkSoportePago({ packageName: rec.packageName, amount: rec.amount, userName: currentUser?.name, userEmail: currentUser?.email, supportPhone: sunatGlobalConfig.supportPhone }), '_blank')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-[9px] font-black uppercase tracking-wider transition flex items-center gap-1 shadow-xs"
                          title="Contactar a soporte por WhatsApp para solucionar el pago"
                        >
                          <Headphones className="w-3 h-3" /> Resolver con Soporte
                        </button>
                      )}
                    </div>
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
              Registrar Gasto con OCR
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
                    <img src={formatImageUrl(previewInternal)} className="w-full h-full object-contain" alt="Preview" />
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

                {ocrRawText && (
                  <details className="bg-gray-50 border-2 border-gray-100 rounded-2xl overflow-hidden">
                    <summary className="px-4 py-2.5 cursor-pointer text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-gray-700 select-none">
                      Texto OCR extraído
                    </summary>
                    <pre className="px-4 pb-3 text-[10px] text-gray-600 font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto leading-relaxed">{ocrRawText}</pre>
                  </details>
                )}

                {qualityReport && (
                  <ImageQualityAlert
                    report={qualityReport}
                    onRetry={handleRetryQuality}
                    onContinue={handleContinueQuality}
                    onDismiss={handleDismissQuality}
                  />
                )}

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
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-brand-600">S/</span>
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

      {/* DASHBOARD STATS (ESTILO WEB .DOCX) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col justify-between">
           <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Resumen del Mes</p>
             <div className="flex items-baseline justify-between mt-2 gap-2">
               <div>
                 <p className="text-[9px] font-black text-green-600 uppercase">Ventas del Mes</p>
                 <h4 className="text-2xl font-black text-green-600">S/ {stats.monthVentas.toFixed(2)}</h4>
               </div>
               <div className="text-right">
                 <p className="text-[9px] font-black text-slate-400 uppercase">Gastos del Mes</p>
                 <h5 className="text-lg font-extrabold text-slate-600">S/ {stats.monthGastos.toFixed(2)}</h5>
               </div>
             </div>
           </div>
           <div className="h-10 mt-4">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={stats.dailyData}>
                 <Bar dataKey="ventas" fill="#10B981" radius={[4,4,0,0]} />
                 <Bar dataKey="gastos" fill="#F59E0B" radius={[4,4,0,0]} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
        
        <div className="bg-gradient-to-br from-[#0B192C] via-slate-900 to-[#0B192C] p-6 md:p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden group border border-slate-800">
           <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none group-hover:scale-125 transition-transform"><ShieldCheck className="w-24 h-24 text-amber-500" /></div>
           <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Estatus SUNAT</p>
           <div className="flex items-center space-x-2">
              <h4 className="text-2xl font-black text-white">Normal</h4>
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
           </div>
           <p className="text-[9px] mt-2 text-slate-300 font-bold uppercase tracking-wider">Sin observaciones pendientes</p>
        </div>
        
        {/* BOTÓN DE SOPORTE - WHATSAPP / CONTADOR */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col justify-between relative group">
          {(() => {
            const myAccountant = selectedCompany?.assignedAccountantId ? users.find(u => u.id === selectedCompany.assignedAccountantId && (u.role === UserRole.ACCOUNTANT || u.role === UserRole.CONTADOR)) : null;
            
            if (myAccountant) {
              const otherAccountants = myCreatedAccountants.filter(a => a.id !== myAccountant.id);
              return (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tu Contador</p>
                    {selectedCompany && !isSubUser && (
                      <div className="flex items-center gap-1.5">
                        {myAccountant.parentId === currentUser.id && (
                          <button
                            onClick={() => handleResetPassword(myAccountant)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl text-[9px] font-black uppercase transition flex items-center gap-1 border border-amber-200"
                            title="Restablecer contraseña de este contador"
                          >
                            <Lock className="w-3 h-3" /> Cambiar Contraseña
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm(`¿Quitar / desvincular a "${myAccountant.name}" de esta empresa?`)) {
                              assignAccountant(selectedCompany.id, '');
                            }
                          }}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[9px] font-black uppercase transition flex items-center gap-1 border border-red-200"
                          title="Quitar contador de esta empresa"
                        >
                          <UserMinus className="w-3 h-3" /> Quitar Contador
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-3 mt-3">
                    <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-600 border border-amber-500/20"><User className="w-6 h-6"/></div>
                    <div>
                      <p className="text-xs font-black text-slate-900 uppercase leading-tight">{myAccountant.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{myAccountant.email}</p>
                    </div>
                  </div>

                  {!isSubUser && otherAccountants.length > 0 && selectedCompany && (
                    <div className="mt-3">
                      <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Cambiar por otro contador:</label>
                      <select
                        value=""
                        onChange={e => {
                          const targetId = e.target.value;
                          if (!targetId) return;
                          assignAccountant(selectedCompany.id, targetId);
                        }}
                        className="w-full bg-slate-50 border-2 border-slate-200 p-2 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-brand-600"
                      >
                        <option value="">-- Cambiar contador --</option>
                        {otherAccountants.map(a => (
                          <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                        ))}
                      </select>
                    </div>
                  )}

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
                        className={`mt-3 w-full py-2.5 rounded-2xl text-[10px] font-black uppercase transition flex items-center justify-center gap-2 ${
                          hasPhone
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20 cursor-pointer active:scale-95'
                            : 'bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <MessageCircleMore className="w-4 h-4" />
                        {hasPhone ? 'WhatsApp' : 'Sin WhatsApp'}
                      </button>
                    );
                  })()}
                </>
              );
            }

            if (!selectedCompany) {
              return (
                <>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contador</p>
                  <div className="flex items-center space-x-3 mt-3">
                    <div className="p-3 bg-amber-50 rounded-2xl text-amber-500"><Building className="w-6 h-6"/></div>
                    <div>
                      <p className="text-xs font-black text-slate-800 uppercase leading-tight">Sin empresa activa</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Crea tu empresa primero</p>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[9px] font-bold text-amber-800 text-center">
                    Debes crear primero una empresa arriba para poder asignar o crear un contador.
                  </div>
                </>
              );
            }

            return (
              <>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contador</p>
                <div className="flex items-center space-x-3 mt-2">
                  <div className="p-3 bg-slate-100 rounded-2xl text-slate-400"><User className="w-6 h-6"/></div>
                  <div>
                    <p className="text-xs font-black text-slate-800 uppercase leading-tight">Sin contador asignado</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{isSubUser ? 'El titular debe asignar uno' : 'Selecciona o crea uno'}</p>
                  </div>
                </div>

                {isSubUser ? (
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[9px] font-bold text-slate-500 text-center">
                    Solo el titular de la cuenta puede asignar, cambiar o quitar contadores.
                  </div>
                ) : (
                <div className="mt-3 space-y-2">
                  {myCreatedAccountants.length > 0 && (
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Asignar de mis contadores creados:</label>
                      <select
                        value=""
                        onChange={e => {
                          const targetId = e.target.value;
                          if (!targetId) return;
                          if (isAtAccountantLimit) {
                            alert('Has alcanzado el límite de contadores (' + accountantLimit + ') de tu plan.');
                            return;
                          }
                          if (managedCompaniesPerAccountantLimit !== null) {
                            const assignedCount = myCompanies.filter(c => c.assignedAccountantId === targetId && c.id !== selectedCompany.id).length;
                            if (assignedCount >= managedCompaniesPerAccountantLimit) {
                              alert('Este contador ya gestiona el límite de empresas (' + managedCompaniesPerAccountantLimit + ') de tu plan.');
                              return;
                            }
                          }
                          assignAccountant(selectedCompany.id, targetId);
                        }}
                        className="w-full bg-slate-50 border-2 border-slate-200 p-2.5 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-brand-600"
                      >
                        <option value="">-- Seleccionar contador --</option>
                        {myCreatedAccountants.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {currentUser.subscriptionStatus === SubscriptionStatus.ACTIVE ? (
                    <button
                      onClick={() => {
                        setAccForm({ name: '', email: '', phone: '' });
                        setAccCreated(false);
                        setShowCreateAccountant(true);
                      }}
                      className="w-full py-2.5 bg-[#0B192C] text-white rounded-xl text-[10px] font-black uppercase hover:bg-slate-800 transition flex items-center justify-center gap-2 shadow-md"
                    >
                      <Plus className="w-4 h-4" /> Crear Nuevo Contador
                    </button>
                  ) : (
                    <p className="text-[9px] text-slate-400 font-bold uppercase text-center py-1">
                      Activa tu suscripción para crear contadores
                    </p>
                  )}
                </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* SUSCRIPCIÓN */}
      {currentUser && (() => {
        const hasOwnSubscription = currentUser.subscriptionStatus === SubscriptionStatus.ACTIVE;
        const accountantId = myCompanies.find(c => c.assignedAccountantId)?.assignedAccountantId;
        const accountant = accountantId ? users.find(u => u.id === accountantId) : null;
        const hasInherited = !hasOwnSubscription && accountant?.subscriptionStatus === SubscriptionStatus.ACTIVE;

        return (
          <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20"><CalendarDays className="w-6 h-6"/></div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Suscripción</p>
                <p className="text-sm font-black text-slate-900">
                  {hasOwnSubscription ? (
                    <>Activa hasta el {currentUser.subscriptionEndDate ? new Date(currentUser.subscriptionEndDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</>
                  ) : hasInherited ? (
                    <><span className="text-blue-600">Activa</span> <span className="text-[10px] text-slate-400">(vía contador: {accountant?.name})</span></>
                  ) : currentUser.parentId ? (
                    <span className="text-blue-600">Gestionada por tu contador</span>
                  ) : currentUser.subscriptionStatus === SubscriptionStatus.EXPIRED ? (
                    <span className="text-red-600">Vencida</span>
                  ) : (
                    <span className="text-amber-600">Pendiente de pago</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              {!isSubUser && !currentUser.parentId && (
                <button onClick={() => setShowPayment(true)} className="flex-1 md:flex-none px-5 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-2xl text-[10px] font-black uppercase transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" /> {hasOwnSubscription ? 'Renovar' : 'Comprar Plan'}
                </button>
              )}
              <button onClick={() => setActiveView('history')} className="flex-1 md:flex-none px-5 py-3 bg-slate-100 text-slate-700 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 transition flex items-center justify-center gap-2">
                <History className="w-4 h-4" /> Historial
              </button>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MOVIMIENTOS RECIENTES (ESTILO WEB .DOCX) */}
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-slate-900 flex items-center text-sm uppercase tracking-tight">
                <Clock className="w-5 h-5 mr-2 text-amber-500" /> Historial de Movimientos
              </h3>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                Total: {allMovements.length}
              </span>
            </div>

            <div className="space-y-3">
              {(() => {
                const total = allMovements.length;
                const totalPages = Math.ceil(total / movementsPerPage) || 1;
                const currentPage = Math.min(movementsPage, totalPages);
                const start = (currentPage - 1) * movementsPerPage;
                const end = Math.min(start + movementsPerPage, total);
                const pageItems = allMovements.slice(start, end);

                if (pageItems.length === 0) {
                  return <div className="py-20 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">No hay movimientos registrados.</div>;
                }

                return pageItems.map(item => {
                  const isIngreso = item.type === 'INGRESO';
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (item.doc) setPreviewDoc(item.doc);
                      }}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition cursor-pointer group ${
                        isIngreso
                          ? 'bg-green-50/40 border-green-100 hover:border-green-300 hover:bg-green-50/70'
                          : item.isPrivate
                          ? 'bg-slate-50 border-slate-200/60 border-dashed'
                          : 'bg-slate-50/50 border-slate-100 hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-center space-x-4 min-w-0 flex-1">
                        <div className={`p-2.5 rounded-xl shrink-0 ${
                          isIngreso ? 'bg-green-100 text-green-700 border border-green-200' : item.isPrivate ? 'bg-slate-200 text-slate-500' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        }`}>
                          {isIngreso ? <TrendingUp className="w-4 h-4"/> : item.isPrivate ? <Lock className="w-4 h-4"/> : <TrendingDown className="w-4 h-4"/>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-slate-900 text-xs uppercase truncate">{item.description}</p>
                          <div className="flex items-center space-x-2 mt-0.5 flex-wrap gap-y-1">
                            <p className="text-[9px] text-slate-400 font-bold uppercase">{item.date}</p>
                            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${
                              isIngreso ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {isIngreso ? 'Venta / Ingreso' : 'Compra / Egreso'}
                            </span>
                            {item.category && (
                              <span className="text-[8px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                {item.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className={`font-black text-xs shrink-0 pl-2 ${isIngreso ? 'text-green-700 font-extrabold' : 'text-slate-900'}`}>
                        {isIngreso ? `+ S/ ${item.amount.toFixed(2)}` : `${item.currency === 'USD' ? '$' : 'S/'} ${item.amount.toFixed(2)}`}
                      </p>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* CONTROLES DE PAGINACIÓN DE MOVIMIENTOS */}
          {allMovements.length > 0 && (() => {
            const total = allMovements.length;
            const totalPages = Math.ceil(total / movementsPerPage) || 1;
            const currentPage = Math.min(movementsPage, totalPages);
            const start = (currentPage - 1) * movementsPerPage + 1;
            const end = Math.min(currentPage * movementsPerPage, total);

            return (
              <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                  <span>Mostrando {start} - {end} de {total}</span>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-400">Filas:</span>
                    <select
                      value={movementsPerPage}
                      onChange={(e) => {
                        setMovementsPerPage(Number(e.target.value));
                        setMovementsPage(1);
                      }}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:border-amber-500 shadow-sm"
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
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition shadow-sm flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setMovementsPage(p)}
                      className={`w-8 h-8 rounded-xl text-xs font-black transition ${
                        currentPage === p
                          ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setMovementsPage(p => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition shadow-sm flex items-center gap-1"
                  >
                    Siguiente <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* PENDIENTES POR ENVIAR A SUNAT */}
        {currentUser && pendingInvoices.filter(p => (!selectedCompanyId || p.companyId === selectedCompanyId) && p.status !== 'ACEPTADO').length > 0 && (
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
              {pendingInvoices.filter(p => (!selectedCompanyId || p.companyId === selectedCompanyId) && p.status !== 'ACEPTADO').map(inv => (
                <div key={inv.id} className="px-3 py-3 rounded-xl border border-amber-100 bg-amber-50/30 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white border border-amber-200 shrink-0"><Clock className="w-4 h-4 text-amber-600"/></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[7px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                        inv.documentType === 'factura' || inv.serie?.startsWith('F') ? 'bg-blue-100 text-blue-700' :
                        inv.documentType === 'boleta' || inv.serie?.startsWith('B') ? 'bg-emerald-100 text-emerald-700' :
                        inv.documentType === 'nota_credito' ? 'bg-rose-100 text-rose-700' :
                        inv.documentType === 'nota_debito' ? 'bg-orange-100 text-orange-700' :
                        inv.documentType === 'liquidacion_compra' || inv.serie?.startsWith('E') ? 'bg-purple-100 text-purple-700' :
                        inv.documentType === 'guia_remision' || inv.serie?.startsWith('T') ? 'bg-teal-100 text-teal-700' :
                        inv.documentType === 'guia_transportista' || inv.serie?.startsWith('V') ? 'bg-indigo-100 text-indigo-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {inv.documentType === 'factura' ? 'FACTURA' :
                         inv.documentType === 'boleta' ? 'BOLETA' :
                         inv.documentType === 'nota_credito' ? 'N. CRÉDITO' :
                         inv.documentType === 'nota_debito' ? 'N. DÉBITO' :
                         inv.documentType === 'liquidacion_compra' ? 'LIQ. COMPRA' :
                         inv.documentType === 'guia_remision' ? 'GUÍA REMIT.' :
                         inv.documentType === 'guia_transportista' ? 'GUÍA TRANSP.' :
                         'DOC'}
                      </span>
                      <p className="text-[11px] font-black text-gray-900 truncate uppercase tracking-tighter leading-none">{inv.serie}-{String(inv.correlative).padStart(8, '0')}</p>
                    </div>
                    <p className="text-[8px] font-bold text-gray-400 uppercase mt-0.5">{inv.customerName} {inv.amount > 0 ? `· S/ ${inv.amount.toFixed(2)}` : ''}</p>
                    {inv.customerPhone && (
                      <p className="text-[7px] font-bold text-amber-700 flex items-center gap-1 mt-0.5">
                        <Smartphone className="w-3 h-3" /> {inv.customerPhone}
                      </p>
                    )}
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
               <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="font-black text-gray-800 flex items-center text-xs uppercase tracking-widest"><FileText className="w-5 h-5 mr-2 text-brand-600" /> Mi Buzón Tributario</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setShowNonSunatModal(true)}
                    className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition flex items-center gap-1.5 shadow-xs active:scale-95">
                    <Globe className="w-3.5 h-3.5 text-emerald-600" /> Egresos No SUNAT
                  </button>
                  <button onClick={() => setShowPersonalExpensesModal(true)}
                    className="bg-purple-50 text-purple-800 border border-purple-200 px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-purple-100 transition flex items-center gap-1.5 shadow-xs active:scale-95">
                    <ShoppingBag className="w-3.5 h-3.5 text-purple-600" /> Gastos Personales
                  </button>
                  <button onClick={() => setShowAlertsModal(true)}
                    className={`border px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition flex items-center gap-1.5 shadow-xs active:scale-95 ${
                      overdueAlertsCount > 0 
                        ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' 
                        : upcomingAlertsCount > 0 
                        ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' 
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}>
                    <BellRing className={`w-3.5 h-3.5 ${overdueAlertsCount > 0 ? 'text-red-600 animate-pulse' : upcomingAlertsCount > 0 ? 'text-amber-600 animate-pulse' : 'text-gray-500'}`} /> Alertas de Pago
                    {overdueAlertsCount > 0 ? (
                      <span className="bg-red-600 text-white px-1.5 py-0.2 rounded-full text-[8px] font-black">{overdueAlertsCount} Vencidas</span>
                    ) : upcomingAlertsCount > 0 ? (
                      <span className="bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded-full text-[8px] font-black">{upcomingAlertsCount} Próximas</span>
                    ) : null}
                  </button>
                  <button onClick={() => setShowFileTreeModal(true)}
                    className="bg-brand-50 text-brand-700 border border-brand-200 px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-brand-100 transition flex items-center gap-1.5 shadow-sm active:scale-95">
                    <FolderTree className="w-3.5 h-3.5 text-brand-600" /> Árbol de Documentos
                  </button>
                  <button onClick={openSendModal}
                    className="bg-brand-600 text-white px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-brand-700 transition flex items-center gap-1.5 shadow-sm active:scale-95">
                    <Send className="w-3.5 h-3.5" /> Enviar a tu Contador
                  </button>
                </div>
              </div>
                {/* Pestañas Principales para Empresario / Persona Natural */}
                {(() => {
                  const comprobantesCount = userCompanyDocs.filter(d => isComprobanteDePagoUser(d)).length;
                  const contadorCount = userCompanyDocs.filter(d => d.uploadedBy === 'ACCOUNTANT' && !isComprobanteDePagoUser(d)).length;
                  const empresarioCount = userCompanyDocs.filter(d => d.uploadedBy !== 'ACCOUNTANT' && !isComprobanteDePagoUser(d)).length;

                  return (
                    <div className="space-y-3">
                      {overdueAlertsCount > 0 ? (
                        <div className="bg-red-600 text-white px-5 py-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md animate-fade-in">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 shrink-0 text-white" />
                            <div>
                              <p className="text-xs font-black uppercase tracking-tight">¡Atención! Tienes {overdueAlertsCount} {overdueAlertsCount === 1 ? 'pago vencido' : 'pagos vencidos'} pendientes</p>
                              <p className="text-[11px] opacity-90 font-medium">Revisa tus recibos de servicios o cuotas bancarias para evitar mora o cortes de servicio.</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setShowAlertsModal(true)}
                            className="px-4 py-2 bg-white text-red-700 hover:bg-red-50 rounded-xl text-[10px] font-black uppercase tracking-wider transition shrink-0 shadow-xs flex items-center gap-1.5"
                          >
                            <BellRing className="w-3.5 h-3.5 text-red-600" /> Ver Alertas de Pago
                          </button>
                        </div>
                      ) : upcomingAlertsCount > 0 ? (
                        <div className="bg-amber-500 text-slate-950 px-5 py-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md animate-fade-in border border-amber-600">
                          <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 shrink-0 text-slate-950" />
                            <div>
                              <p className="text-xs font-black uppercase tracking-tight">¡Recordatorio de Pago! Tienes {upcomingAlertsCount} {upcomingAlertsCount === 1 ? 'pago' : 'pagos'} por vencer en los próximos días</p>
                              <p className="text-[11px] font-medium opacity-90">Organiza tus pagos de luz, agua, préstamos o servicios antes de su fecha límite.</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setShowAlertsModal(true)}
                            className="px-4 py-2 bg-slate-950 text-amber-400 hover:bg-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider transition shrink-0 shadow-xs flex items-center gap-1.5"
                          >
                            <BellRing className="w-3.5 h-3.5 text-amber-400" /> Ver Alertas de Pago
                          </button>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-3 bg-gray-100 p-1.5 rounded-2xl gap-1">
                        <button
                          onClick={() => setUserMainTab('comprobantes')}
                          className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1 ${
                            userMainTab === 'comprobantes'
                              ? 'bg-white text-brand-600 shadow-sm border border-gray-200'
                              : 'text-gray-500 hover:text-gray-800'
                          }`}
                        >
                          Comprobantes de Pago <span className="text-[9px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-black">{comprobantesCount}</span>
                        </button>
                        <button
                          onClick={() => setUserMainTab('contador')}
                          className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1 ${
                            userMainTab === 'contador'
                              ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                              : 'text-gray-500 hover:text-gray-800'
                          }`}
                        >
                          Archivos del Contador <span className="text-[9px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-black">{contadorCount}</span>
                        </button>
                        <button
                          onClick={() => setUserMainTab('empresario')}
                          className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1 ${
                            userMainTab === 'empresario'
                              ? 'bg-white text-purple-600 shadow-sm border border-gray-200'
                              : 'text-gray-500 hover:text-gray-800'
                          }`}
                        >
                          Mis Archivos <span className="text-[9px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-black">{empresarioCount}</span>
                        </button>
                      </div>

                      {userMainTab === 'comprobantes' && (
                        <div className="flex bg-gray-50 p-1 rounded-xl gap-1 overflow-x-auto">
                          {[
                            { id: 'all', label: 'Todos' },
                            { id: 'factura', label: 'Facturas' },
                            { id: 'boleta', label: 'Boletas' },
                            { id: 'nc', label: 'N. Crédito' },
                            { id: 'nd', label: 'N. Débito' },
                            ...(isPersonaNaturalActive ? [{ id: 'rh', label: 'RH' }] : [])
                          ].map(sub => (
                            <button
                              key={sub.id}
                              onClick={() => setUserSubTab(sub.id as any)}
                              className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase transition-all whitespace-nowrap ${
                                userSubTab === sub.id
                                  ? 'bg-brand-600 text-white shadow-sm'
                                  : 'text-gray-400 hover:text-gray-700 bg-white border border-gray-200'
                              }`}
                            >
                              {sub.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
           </div>
             <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                {filteredDocs.length === 0 && <div className="py-10 text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest">Buzón Vacío</div>}
                {docGroups.map(group => (
                  <div key={group.folder || '__root__'} className="space-y-2">
                    <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400 px-1">
                      <Folder className="w-3 h-3 text-brand-500" /> {group.folder ? group.folder : 'Sin carpeta'}
                      <span className="text-gray-300">· {group.docs.length}</span>
                    </p>
                    {group.docs.slice().reverse().map(doc => (
                      <div key={doc.id} onClick={() => setPreviewDoc(doc)} className={`px-3 py-2.5 rounded-xl border flex items-center gap-3 transition cursor-pointer group ${doc.uploadedBy === 'ACCOUNTANT' ? 'bg-blue-50/40 border-blue-100 hover:border-blue-300 hover:bg-blue-50/60' : 'bg-gray-50/50 border-gray-100 hover:border-brand-300 hover:bg-brand-50/40'}`}>
                         <div className={`p-2 rounded-lg shadow-sm border group-hover:scale-110 transition-transform shrink-0 ${doc.uploadedBy === 'ACCOUNTANT' ? 'bg-white border-blue-100' : 'bg-white border-gray-100'}`}>{doc.uploadedBy === 'ACCOUNTANT' ? <User className="w-4 h-4 text-blue-700"/> : doc.id.startsWith('RH-') ? <ReceiptText className="w-4 h-4 text-blue-700"/> : <FileText className="w-4 h-4 text-brand-600"/>}</div>
                         <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-black text-gray-900 truncate uppercase tracking-tighter leading-none">{doc.name}</p>
                            <p className="text-[8px] font-bold text-gray-400 uppercase mt-0.5">{doc.uploadedBy === 'ACCOUNTANT' ? 'De tu contador' : doc.id.startsWith('RH-') ? 'C. Electrónico' : (doc.id.startsWith('FACTURA-') || doc.id.startsWith('F') || doc.id.startsWith('B')) ? 'Comprobante Electrónico' : 'Declaración Mensual'} · {doc.periodMonth} {doc.periodYear}</p>
                         </div>
                          {doc.uploadedBy === 'ACCOUNTANT' ? <span className="text-[8px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase flex items-center shrink-0"><User className="w-2.5 h-2.5 mr-1"/> CONT</span> : doc.sunatStatus === 'SENT' || (doc.sunatStatus as any) === 'ACEPTADO' ? <span className="text-[8px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black uppercase flex items-center shrink-0"><CheckCircle2 className="w-2.5 h-2.5 mr-1"/> OK</span> : doc.sunatStatus === 'INTERNO' ? <span className="text-[8px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-black uppercase flex items-center shrink-0"><FileText className="w-2.5 h-2.5 mr-1"/> Interno</span> : doc.sunatStatus === 'PENDING' ? <span className="text-[8px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-black uppercase flex items-center shrink-0"><Clock className="w-2.5 h-2.5 mr-1"/> Pendiente</span> : doc.sunatStatus === 'REJECTED' ? <span className="text-[8px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black uppercase flex items-center shrink-0"><X className="w-2.5 h-2.5 mr-1"/> Rechazado</span> : <span className="text-[8px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-black uppercase flex items-center shrink-0"><FileText className="w-2.5 h-2.5 mr-1"/> Archivado</span>}
                          {!isSubUser && (
                            <button onClick={(e) => { e.stopPropagation(); if(confirm('¿Eliminar este documento?')) deleteTaxDocument(doc.id); }}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0 opacity-0 group-hover:opacity-100">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                       </div>
                    ))}
                  </div>
                ))}
            </div>
        </div>
      </div>
    </>
  )}

  {/* PREVISUALIZACIÓN DE DOCUMENTO ARCHIVADO */}
  {previewDoc && (
    <>
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
                   <div className="text-right"><p className="text-[10px] font-black uppercase text-gray-400 leading-none">RUC Emisor</p><p className="text-sm font-mono font-black text-gray-800">{selectedCompany?.ruc}</p></div>
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
                  <div className="p-6 border-t flex flex-wrap gap-3 justify-center items-center bg-gray-50">
               {/* Descarga de archivo subido por el contador (fileUrl es Base64) */}
               {previewDoc.uploadedBy === 'ACCOUNTANT' && previewDoc.fileUrl && (
                 <button
                   onClick={() => downloadFile(previewDoc.fileUrl, previewDoc.name, previewDoc.mimeType || 'application/octet-stream', true)}
                   className="px-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-blue-700 transition flex items-center justify-center cursor-pointer"
                 >
                   <Download className="w-4 h-4 mr-2"/> Descargar Archivo
                 </button>
               )}

               {/* Botón Descargar PDF siempre disponible para cualquier comprobante */}
               <button
                 onClick={handleDownloadPreviewPdf}
                 disabled={isGeneratingPreviewPdf}
                 className="px-6 py-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-rose-500/20 transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                 title="Descargar representación impresa en formato PDF"
               >
                 {isGeneratingPreviewPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                 <span>{isGeneratingPreviewPdf ? 'Generando PDF...' : 'Descargar PDF'}</span>
               </button>

               {(previewDoc.xmlUrl || previewDoc.xmlContent) && (
                 <button 
                   onClick={() => downloadFile(previewDoc.xmlContent || '', `${previewDoc.name}.xml`, 'text/xml')}
                   className="px-6 py-4 bg-white border-2 border-brand-200 text-brand-700 rounded-2xl font-black text-[10px] uppercase hover:bg-brand-50 transition flex items-center justify-center cursor-pointer"
                 >
                   <DownloadCloud className="w-4 h-4 mr-2"/> XML
                 </button>
               )}
               {(previewDoc.cdrUrl || previewDoc.cdrBase64) && (
                 <button 
                   onClick={() => downloadFile(previewDoc.cdrBase64 || '', `R-${previewDoc.name}.zip`, 'application/zip', true)}
                   className="px-6 py-4 bg-white border-2 border-emerald-200 text-emerald-700 rounded-2xl font-black text-[10px] uppercase hover:bg-emerald-50 transition flex items-center justify-center cursor-pointer"
                 >
                   <DownloadCloud className="w-4 h-4 mr-2"/> CDR (Respuesta)
                 </button>
               )}
               {previewDoc.metadata?.recipientPhone && esCelularValido(previewDoc.metadata.recipientPhone) && (
                 <button onClick={enviarWhatsAppPreview} disabled={waSending}
                   className="px-6 py-4 bg-[#25D366] text-white rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-[#1fb858] transition flex items-center justify-center disabled:opacity-60 cursor-pointer">
                   {waSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                   {waSending ? 'Generando...' : 'Enviar por WhatsApp'}
                 </button>
               )}
               {previewDoc.sunatStatus === 'INTERNO' && (
                 <button
                   onClick={() => transmitirNotaVentaASunat(previewDoc)}
                   disabled={isTransmittingSunat}
                   className="px-6 py-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 rounded-2xl font-black text-[10px] uppercase shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                   title="Emitir automáticamente como Factura o Boleta oficial SUNAT"
                 >
                   {isTransmittingSunat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-current" />}
                   ⚡ CLIENTE PAGÓ — TRANSMITIR A SUNAT
                 </button>
               )}
               <button onClick={() => setPreviewDoc(null)} className="px-8 py-4 bg-white border-2 border-gray-200 text-gray-600 rounded-2xl font-black text-[10px] uppercase hover:bg-gray-100 transition cursor-pointer">Cerrar</button>
            </div>
           {waNote && (
             <div className="px-6 pb-6 -mt-2 bg-gray-50 text-center space-y-2">
               {waNote.status === 'error' ? (
                 <p className="text-[11px] font-bold text-red-500">No se pudo generar el comprobante. Inténtalo de nuevo.</p>
               ) : waNote.status === 'shared' ? (
                 <p className="text-[11px] font-bold text-emerald-600">Comprobante enviado. Completa el envío en WhatsApp.</p>
               ) : waNote.status === 'fallback' && waNote.waUrl ? (
                 <>
                   <p className="text-[11px] font-bold text-amber-600">Archivos descargados. Abre WhatsApp y adjúntalos en el chat:</p>
                   <a href={waNote.waUrl} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#25D366]/10 text-[#128C7E] border-2 border-[#25D366] rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-[#25D366]/20 transition">
                     <Send className="w-4 h-4" /> Abrir WhatsApp
                   </a>
                 </>
               ) : null}
             </div>
           )}
              </div>
            </div>
         </div>
      </div>

       {previewWhatsAppData && (
         <div ref={waPdfRef} style={{ position: 'absolute', left: 0, top: 0, width: '800px', zIndex: -9999, opacity: 0.01, pointerEvents: 'none', background: '#ffffff' }}>
           <InvoicePreview data={previewWhatsAppData} />
         </div>
       )}
    </>
  )}

  {showInvoiceModal && (
    <InvoiceWizard
      isOpen={showInvoiceModal}
      onClose={() => setShowInvoiceModal(false)}
      onEmitted={handleInvoiceEmitted}
      defaultSendToSunat={true}
    />
  )}

  {showNcModal && (
    <NoteWizard
      isOpen={showNcModal}
      onClose={() => setShowNcModal(false)}
      onEmitted={(doc) => handleInvoiceEmitted({ id: doc.id, name: doc.name, sunatStatus: doc.sunatStatus || 'SENT', xmlContent: doc.xmlContent, cdrBase64: doc.cdrBase64, amount: doc.metadata?.amount, customerName: doc.metadata?.recipientName, customerRuc: doc.metadata?.recipientRuc, documentType: doc.documentType, originalDocumentId: doc.originalDocumentId })}
      initialType="nota_credito"
    />
  )}

  {showNdModal && (
    <NoteWizard
      isOpen={showNdModal}
      onClose={() => setShowNdModal(false)}
      onEmitted={(doc) => handleInvoiceEmitted({ id: doc.id, name: doc.name, sunatStatus: doc.sunatStatus || 'SENT', xmlContent: doc.xmlContent, cdrBase64: doc.cdrBase64, amount: doc.metadata?.amount, customerName: doc.metadata?.recipientName, customerRuc: doc.metadata?.recipientRuc, documentType: doc.documentType, originalDocumentId: doc.originalDocumentId })}
      initialType="nota_debito"
    />
  )}

  {/* MODAL CREAR SUB USUARIO */}
  {showCreateSubUser && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
      <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl relative">
        <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Users className="w-6 h-6"/>
            <h3 className="text-base font-black uppercase tracking-wide">Crear Sub Usuario</h3>
          </div>
          <button onClick={() => setShowCreateSubUser(false)} className="text-white hover:rotate-90 transition"><X className="w-5 h-5"/></button>
        </div>
        {subUserCreated ? (
          <div className="p-6 text-center space-y-4">
            <div className="p-4 bg-green-100 rounded-full w-fit mx-auto"><CheckCircle2 className="w-10 h-10 text-green-600"/></div>
            <p className="font-black text-gray-800 text-lg">{subUserForm.name}</p>
            <p className="text-xs text-gray-500">{subUserForm.email}</p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left">
              <p className="text-[9px] font-black text-amber-700 uppercase">Permisos</p>
              <p className="text-[10px] text-gray-600">Solo lectura y descarga de archivos. No puede crear ni modificar datos.</p>
            </div>
            <p className="text-[10px] text-gray-400 font-bold">Se ha enviado un correo de bienvenida con las credenciales.</p>
            <button onClick={() => setShowCreateSubUser(false)}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition shadow-sm">
              Cerrar
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-[9px] font-black text-blue-700 uppercase">Permisos del sub usuario</p>
              <p className="text-[10px] text-gray-600">Solo podrá ver datos, documentos y descargar archivos. No podrá crear, editar ni eliminar nada.</p>
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Nombre</label>
              <input type="text" placeholder="Ej: Asistente Contable"
                className="w-full border-2 border-gray-200 p-3 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-blue-600"
                value={subUserForm.name} onChange={e => setSubUserForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Correo Electrónico</label>
              <input type="email" placeholder="correo@ejemplo.com"
                className="w-full border-2 border-gray-200 p-3 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-blue-600"
                value={subUserForm.email} onChange={e => setSubUserForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <button onClick={handleCreateSubUser} disabled={!subUserForm.name.trim() || !subUserForm.email.trim()}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-sm hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
              <UserPlus className="w-4 h-4" /> Crear Sub Usuario
            </button>
          </div>
        )}
      </div>
    </div>
  )}

  {/* MODAL CREAR / EDITAR EMPRESA */}
  {showCreateCompany && (!isPersonaNaturalUser || editingCompany) && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
      <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl relative">
        <div className="p-6 bg-brand-600 text-white flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Building className="w-6 h-6"/>
            <h3 className="text-base font-black uppercase tracking-wide">{editingCompany ? 'Editar Empresa' : 'Crear Mi Empresa'}</h3>
          </div>
          <button onClick={() => { setShowCreateCompany(false); setEditingCompany(null); }} className="text-white hover:rotate-90 transition"><X className="w-5 h-5"/></button>
        </div>
        <form onSubmit={handleCreateCompany} className="p-6 space-y-4">
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Nombre de la Empresa</label>
            <input required type="text" placeholder="Ej: Mi Empresa S.A.C."
              className="w-full border-2 border-gray-200 p-3 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-brand-600"
              value={companyForm.name} onChange={e => setCompanyForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">RUC</label>
            <div className="relative">
              <input type="text" maxLength={11} placeholder="20123456789 (opcional)"
                className="w-full border-2 border-gray-200 p-3 pr-12 rounded-xl text-sm font-mono font-bold text-gray-900 outline-none focus:border-brand-600"
                value={companyForm.ruc} onChange={e => setCompanyForm(p => ({ ...p, ruc: e.target.value }))} />
              <button type="button" onClick={handleSearchCompanyRuc} disabled={isSearchingRuc || companyForm.ruc.replace(/\D/g, '').length !== 11}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand-100 text-brand-700 rounded-lg hover:bg-brand-200 disabled:opacity-50 transition">
                {isSearchingRuc ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
              </button>
            </div>
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Razón Social</label>
            <input type="text" placeholder="EMPRESA S.A.C."
              className="w-full border-2 border-gray-200 p-3 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-brand-600 uppercase"
              value={companyForm.businessName} onChange={e => setCompanyForm(p => ({ ...p, businessName: e.target.value }))} />
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Dirección Fiscal</label>
            <input type="text" placeholder="Av. Principal 123"
              className="w-full border-2 border-gray-200 p-3 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-brand-600 uppercase"
              value={companyForm.taxAddress} onChange={e => setCompanyForm(p => ({ ...p, taxAddress: e.target.value }))} />
          </div>
          <button type="submit"
            className="w-full py-3 bg-brand-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-brand-700 transition shadow-sm flex items-center justify-center gap-2">
            <Building className="w-4 h-4" /> {editingCompany ? 'Guardar Cambios' : 'Crear Empresa'}
          </button>
        </form>
      </div>
    </div>
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
            <button onClick={handleCreateAccountant} disabled={creatingAcc || isAtCreatedAccountantsLimit || !accForm.name.trim() || !accForm.email.trim()}
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

  {showPayment && !isSubUser && !currentUser.parentId && (
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

  {/* ENVIAR ARCHIVOS A TU CONTADOR */}
  {showSendToAccountant && (
    <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-black uppercase tracking-tight text-gray-800 flex items-center"><Send className="w-5 h-5 mr-2 text-brand-600" /> Enviar Archivos a tu Contador</h3>
          <button onClick={() => setShowSendToAccountant(false)} className="p-2 bg-white rounded-full hover:bg-gray-100 transition shadow-sm shrink-0"><X className="w-6 h-6 text-gray-400"/></button>
        </div>
        <div className="p-6 overflow-y-auto bg-white space-y-5">
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Empresa</label>
            <select className="w-full bg-white border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600"
              value={sendCompanyId} onChange={e => setSendCompanyId(e.target.value)}>
              <option value="">Seleccionar empresa</option>
              {myCompanies.map(c => <option key={c.id} value={c.id}>{c.name}{c.ruc ? ` (${c.ruc})` : ''}</option>)}
            </select>
            {sendCompanyId && (
              <div className="mt-2 p-3 bg-amber-50 rounded-xl flex items-center gap-2 border border-amber-100">
                <User className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-xs font-black text-amber-800 uppercase truncate">
                  {companies.find(c => c.id === sendCompanyId)?.assignedAccountantId
                    ? `Contador: ${users.find(u => u.id === companies.find(c => c.id === sendCompanyId)?.assignedAccountantId)?.name || 'Asignado'}`
                    : 'Sin contador asignado'}
                </p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Mes</label>
              <select className="w-full bg-white border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600"
                value={sendMonth} onChange={e => setSendMonth(e.target.value)}>
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Año</label>
              <select className="w-full bg-white border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600"
                value={sendYear} onChange={e => setSendYear(Number(e.target.value))}>
                {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Archivos (PDF, XML, imagen)</label>
            <FileUploadZone files={sendFiles} onFilesChange={setSendFiles} />
          </div>
          <button onClick={handleSendToAccountant} disabled={!sendCompanyId || isSending}
            className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-700 transition flex items-center justify-center disabled:opacity-50 shadow-lg">
            {isSending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando {sendProgress.done} de {sendProgress.total}...</> : <><Send className="w-4 h-4 mr-2" /> Enviar al Contador</>}
          </button>
        </div>
      </div>
    </div>
  )}

  {/* MODAL ÁRBOL DE DOCUMENTOS / ARCHIVOS */}
  <FileTreeModal
    isOpen={showFileTreeModal}
    onClose={() => setShowFileTreeModal(false)}
    documents={myTaxDocuments.filter(d => d.sunatStatus !== 'BORRADO')}
    onAddDocument={(doc) => addTaxDocument(doc)}
    onDeleteDocument={(id) => deleteTaxDocument(id)}
    onPreviewDocument={(doc) => setPreviewDoc(doc)}
    companyId={selectedCompanyId || ''}
    userId={currentUser?.id || ''}
    accountantId={selectedCompany?.assignedAccountantId || ''}
    isSubUser={isSubUser}
    allowDelete={!isSubUser}
    userRole={currentUser?.role}
  />

  {/* POP-UP MODAL ALERTAS DE PAGO */}
  {showAlertsModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 md:p-6 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-[2.5rem] max-w-5xl w-full p-6 md:p-8 shadow-2xl relative border-2 border-brand-100 max-h-[90vh] overflow-y-auto space-y-6">
        <button
          onClick={() => setShowAlertsModal(false)}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 p-2.5 rounded-full hover:bg-gray-100 transition z-10"
          title="Cerrar Ventana"
        >
          <X className="w-6 h-6" />
        </button>

        <PaymentAlertsManager userId={currentUser.id} companyId={selectedCompanyId} />
      </div>
    </div>
  )}

  {/* POP-UP MODAL GASTOS PERSONALES */}
  {showPersonalExpensesModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 md:p-6 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-[2.5rem] max-w-5xl w-full p-6 md:p-8 shadow-2xl relative border-2 border-brand-100 max-h-[90vh] overflow-y-auto space-y-6">
        <button
          onClick={() => setShowPersonalExpensesModal(false)}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 p-2.5 rounded-full hover:bg-gray-100 transition z-10"
          title="Cerrar Ventana"
        >
          <X className="w-6 h-6" />
        </button>

        <PersonalExpensesManager userId={currentUser.id} />
      </div>
    </div>
  )}

  {/* POP-UP MODAL EGRESOS NO SUNAT */}
  <NonSunatExpensesModal
    isOpen={showNonSunatModal}
    onClose={() => setShowNonSunatModal(false)}
    userId={currentUser.id}
    companyId={selectedCompanyId}
  />

  {/* MODAL LIQUIDACIÓN DE COMPRA ELECTRÓNICA E001 (SUNAT 04) */}
  <LiquidacionCompraWizard
    isOpen={showLiquidacionModal}
    onClose={() => setShowLiquidacionModal(false)}
  />

  {/* MODAL GUÍA DE REMISIÓN ELECTRÓNICA REMITENTE T001 (SUNAT 09) */}
  <GuiaRemisionWizard
    isOpen={showGuiaModal}
    onClose={() => setShowGuiaModal(false)}
  />

  {/* MODAL GUÍA DE REMISIÓN ELECTRÓNICA TRANSPORTISTA V001 (SUNAT 31) */}
  <GuiaTransportistaWizard
    isOpen={showGuiaTransportistaModal}
    onClose={() => setShowGuiaTransportistaModal(false)}
  />

  {/* MODAL TICKET DE VENTA INTERNO (NO SUNAT) */}
  <TicketVentaWizard
    isOpen={showTicketModal}
    onClose={() => setShowTicketModal(false)}
  />

  {/* MODAL PROFORMA / COTIZACIÓN COMERCIAL (NO SUNAT) */}
  <ProformaWizard
    isOpen={showProformaModal}
    onClose={() => setShowProformaModal(false)}
    onOpenInvoiceWizard={(prefillData) => {
      setShowInvoiceModal(true);
    }}
  />

  {/* MODAL ORDEN DE PAGO / SOLICITUD DE COBRO (NO SUNAT) */}
  <OrdenPagoWizard
    isOpen={showOrdenPagoModal}
    onClose={() => setShowOrdenPagoModal(false)}
    onOpenInvoiceWizard={(prefillData) => {
      setShowInvoiceModal(true);
    }}
  />

  {/* MODAL NOTA DE VENTA INTERNA (NO SUNAT) */}
  <NotaVentaWizard
    isOpen={showNotaVentaModal}
    onClose={() => setShowNotaVentaModal(false)}
    onOpenInvoiceWizard={(prefillData) => {
      setShowInvoiceModal(true);
    }}
  />

  {/* MODAL SIRE — REGISTROS ELECTRÓNICOS (RVIE / RCE) */}
  <SireModule
    isOpen={showSireModal}
    onClose={() => setShowSireModal(false)}
  />

</div>
  );
};