import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { UserRole, Expense, TaxDocument, SubscriptionStatus, AdminNotification, Company, PendingInvoice } from '../types';
import { buildPdtCsv } from '../utils/pdtFormatter';
import { consultaService } from '../services/consultaService';
import { Payment } from './Payment';
import { InvoiceWizard } from '../components/InvoiceWizard';
import NoteWizard from '../components/NoteWizard';
import { FileUploadZone } from '../components/FileUploadZone';
import { parseUploadName, derivePeriod, readFileAsBase64 } from '../utils/uploadName';
import {
  User as UserIcon, Users, ArrowLeft, ImageIcon, X, ShieldCheck, FileText,
  Tag, Clock, Hash, DollarSign, Lock, Upload, Trash2, FileUp, PlusCircle,
  Calendar, UserPlus, Building, MapPin, CreditCard, Download, FileSpreadsheet,
   Eye, Search, Loader2, AlertTriangle, CheckCircle2, BarChart3, ReceiptText,
   TrendingUp, TrendingDown, Printer, Filter, CalendarDays, Sparkles, History,
   FileInput, RefreshCw, FolderTree
 } from 'lucide-react';
import { FileTreeModal } from '../components/FileTreeModal';

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
const YEARS = [2023, 2024, 2025, 2026, 2027];

export const AccountantDashboard: React.FC = () => {
  const { users, currentUser, companies, selectCompany, expenses, taxDocuments, addTaxDocument, addExpense, deleteTaxDocument, registerUser, generatePassword, addNotification, addCompany, pendingInvoices, updatePendingInvoiceStatus, removePendingInvoice, packages, subscriptionHistory, resetUserPassword } = useStore();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [showFileTreeModal, setShowFileTreeModal] = useState(false);
  const [acctMainTab, setAcctMainTab] = useState<'comprobantes' | 'contador' | 'empresario'>('comprobantes');
  const [acctSubTab, setAcctSubTab] = useState<'all' | 'factura' | 'boleta' | 'nc' | 'nd'>('all');
  const [activeTab, setActiveTab] = useState<'clientes'>('clientes');
  const [clientView, setClientView] = useState<'movimientos' | 'reporte' | 'subir' | 'facturacion'>('movimientos');
  const [showPayment, setShowPayment] = useState(false);
  const [searchClient, setSearchClient] = useState('');

  // Filtros mes/año para movimientos
  const [movFilterMonth, setMovFilterMonth] = useState(MONTHS[new Date().getMonth()]);
  const [movFilterYear, setMovFilterYear] = useState(new Date().getFullYear());

  // Reporte Mensual state
  const [repCompanyId, setRepCompanyId] = useState<string>('');
  const [repMonth, setRepMonth] = useState(MONTHS[new Date().getMonth()]);
  const [repYear, setRepYear] = useState(new Date().getFullYear());

  // PDT state
  const [pdtClientId, setPdtClientId] = useState<string>('');
  const [pdtMonth, setPdtMonth] = useState(MONTHS[new Date().getMonth()]);
  const [pdtYear, setPdtYear] = useState(new Date().getFullYear());

  // New Client Form State
  const [newClientData, setNewClientData] = useState({
    name: '', email: '', ruc: '', dni: '', businessName: '', taxAddress: ''
  });

  // Document Upload State
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadCompanyId, setUploadCompanyId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [previewDoc, setPreviewDoc] = useState<TaxDocument | null>(null);

  // --- Company creation for existing client ---
  const [showCreateCompanyForClient, setShowCreateCompanyForClient] = useState<string | null>(null);
  const [companyForClientForm, setCompanyForClientForm] = useState({ name: '', ruc: '', businessName: '', taxAddress: '' });
  const [isSearchingRuc, setIsSearchingRuc] = useState(false);

  // --- Facturación (emisión de comprobantes por el contador) ---
  const [showInvoiceModal, setShowInvoiceModal] = useState<{ type: 'factura' | 'boleta' } | null>(null);
  const [showNcModal, setShowNcModal] = useState(false);
  const [showNdModal, setShowNdModal] = useState(false);
  const [retryingInvoice, setRetryingInvoice] = useState<string | null>(null);

  const myCompanies = useMemo(() =>
    companies.filter(c => c.assignedAccountantId === currentUser?.id),
    [companies, currentUser]
  );

  const myClients = useMemo(() => {
    const clientIds = new Set(myCompanies.map(c => c.ownerUserId));
    return users.filter(u => u.role === UserRole.USER && clientIds.has(u.id));
  }, [users, myCompanies]);

  const accountantActivePackage = useMemo(() => {
    if (!currentUser) return null;
    const today = new Date().toISOString().split('T')[0];
    if (currentUser.subscriptionStatus === SubscriptionStatus.ACTIVE && currentUser.subscriptionEndDate && currentUser.subscriptionEndDate >= today) {
      const rec = subscriptionHistory.find(r => r.userId === currentUser.id && r.status === 'PAID' && r.endDate >= today);
      if (rec) {
        const found = packages.find(p => p.name === rec.packageName);
        if (found) return found;
      }
    }
    return packages.find(p => p.isFree || p.id === 'pkg-free-accountant') || null;
  }, [currentUser, subscriptionHistory, packages]);

  const getAcctLimitVal = (limitsObj: Record<string, Record<string, number>> | undefined, limitKey: string, role?: string): number | null => {
    const targetRole = role || currentUser?.role;
    if (!limitsObj || !limitsObj[limitKey] || !targetRole) return null;
    const roleKey = (targetRole === UserRole.PERSONA_NATURAL || targetRole === UserRole.EMPRESARIO) ? UserRole.USER : targetRole;
    const val = limitsObj[limitKey][targetRole] ?? limitsObj[limitKey][roleKey] ?? limitsObj[limitKey][UserRole.ACCOUNTANT] ?? limitsObj[limitKey][UserRole.USER];
    return val !== undefined && val !== null ? val : null;
  };

  const managedCompaniesLimit = useMemo(() => getAcctLimitVal(accountantActivePackage?.limits, 'maxManagedCompanies'), [accountantActivePackage, currentUser]);

  const isAtManagedCompaniesLimit = managedCompaniesLimit !== null && myCompanies.length >= managedCompaniesLimit;

  const createdClientsLimit = useMemo(() => getAcctLimitVal(accountantActivePackage?.limits, 'maxCreatedClients'), [accountantActivePackage, currentUser]);

  const myCreatedClients = useMemo(
    () => users.filter(u => u.parentId === currentUser?.id && u.role === UserRole.USER),
    [users, currentUser]
  );
  const isAtCreatedClientsLimit = createdClientsLimit !== null && myCreatedClients.length >= createdClientsLimit;

  const handleResetPassword = async (id: string, name: string) => {
    if (!confirm(`¿Restablecer la contraseña de "${name}"? Se le enviará una nueva por email y deberá cambiarla al iniciar sesión.`)) return;
    const newPassword = await resetUserPassword(id);
    if (!newPassword) alert('No se pudo restablecer la contraseña. Inténtalo nuevamente.');
  };

  const accountantTaxDocLimit = useMemo(() => getAcctLimitVal(accountantActivePackage?.limits, 'maxTaxDocuments'), [accountantActivePackage, currentUser]);

  const myAccountantTaxDocs = useMemo(() => taxDocuments.filter(d => d.accountantId === currentUser?.id), [taxDocuments, currentUser]);
  const isAtAccountantTaxDocLimit = accountantTaxDocLimit !== null && myAccountantTaxDocs.length >= accountantTaxDocLimit;

  const clientOwner = useMemo(() => {
    if (!selectedClientId) return null;
    const clientCompany = myCompanies.find(c => c.ownerUserId === selectedClientId) || companies.find(c => c.ownerUserId === selectedClientId);
    return clientCompany ? users.find(u => u.id === clientCompany.ownerUserId) : null;
  }, [selectedClientId, myCompanies, companies, users]);

  const clientActivePackage = useMemo(() => {
    if (!clientOwner) return null;
    const today = new Date().toISOString().split('T')[0];
    if (clientOwner.subscriptionStatus === SubscriptionStatus.ACTIVE && clientOwner.subscriptionEndDate && clientOwner.subscriptionEndDate >= today) {
      const rec = subscriptionHistory.find(r => r.userId === clientOwner.id && r.status === 'PAID' && r.endDate >= today);
      if (rec) {
        const found = packages.find(p => p.name === rec.packageName);
        if (found) return found;
      }
    }
    return packages.find(p => p.isFree || p.id === 'pkg-free-client') || null;
  }, [clientOwner, subscriptionHistory, packages]);

  const clientTaxDocLimit = useMemo(() => getAcctLimitVal(clientActivePackage?.limits, 'maxTaxDocuments', clientOwner?.role), [clientActivePackage, clientOwner]);

  const clientTaxDocuments = useMemo(() => taxDocuments.filter(d => d.userId === selectedClientId), [taxDocuments, selectedClientId]);
  const isAtClientTaxDocLimit = clientTaxDocLimit !== null && clientTaxDocuments.length >= clientTaxDocLimit;

  // maxTaxDocumentsPerAccountant: comprobantes emitidos por un contador CREADO POR este cliente (empresario)
  const isCreatedAccountantOfClient = currentUser?.parentId === clientOwner?.id;
  const clientCreatedAcctDocLimit = useMemo(() => getAcctLimitVal(clientActivePackage?.limits, 'maxTaxDocumentsPerAccountant', clientOwner?.role), [clientActivePackage, clientOwner]);
  const createdAcctDocs = useMemo(() => taxDocuments.filter(d => d.accountantId === currentUser?.id && d.userId === clientOwner?.id), [taxDocuments, currentUser, clientOwner]);
  const isAtCreatedAcctDocLimit = isCreatedAccountantOfClient
    ? clientCreatedAcctDocLimit !== null && createdAcctDocs.length >= clientCreatedAcctDocLimit
    : false;

  const filteredCompanies = useMemo(() => {
    const base = myCompanies;
    if (!searchClient) return base;
    const q = searchClient.toLowerCase();
    return base.filter(c => {
      const owner = users.find(u => u.id === c.ownerUserId);
      return (c.name && c.name.toLowerCase().includes(q)) ||
        (c.ruc && c.ruc.includes(q)) ||
        (c.businessName && c.businessName.toLowerCase().includes(q)) ||
        (owner?.name && owner.name.toLowerCase().includes(q));
    });
  }, [myCompanies, users, searchClient]);

  const handleCreateCompanyForClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCreateCompanyForClient || !currentUser) return;
    const newCompany = {
      id: `comp-${Date.now()}`,
      ownerUserId: showCreateCompanyForClient,
      name: companyForClientForm.name,
      ruc: companyForClientForm.ruc,
      businessName: companyForClientForm.businessName,
      taxAddress: companyForClientForm.taxAddress,
      assignedAccountantId: currentUser.id,
    };
    const selClient = users.find(u => u.id === showCreateCompanyForClient);
    const isCreatedClientOfAcct = selClient?.parentId === currentUser?.id;
    if (isCreatedClientOfAcct && accountantActivePackage?.limits?.maxCompaniesPerCreatedClient && accountantActivePackage.limits.maxCompaniesPerCreatedClient[currentUser.role] != null) {
      const createdClientLimit = accountantActivePackage.limits.maxCompaniesPerCreatedClient[currentUser.role];
      const createdClientCompanyCount = companies.filter(c => c.ownerUserId === showCreateCompanyForClient).length;
      if (createdClientCompanyCount >= createdClientLimit) {
        alert(`Este cliente ha alcanzado el límite de empresas (${createdClientLimit}) definido en tu plan.`);
        return;
      }
    }
    addCompany(newCompany);
    selectCompany(newCompany.id);
    setCompanyForClientForm({ name: '', ruc: '', businessName: '', taxAddress: '' });
    setShowCreateCompanyForClient(null);
  };

  const handleSearchClientRuc = async () => {
    const ruc = newClientData.ruc.replace(/\D/g, '');
    if (ruc.length !== 11) { alert('El RUC debe tener 11 dígitos'); return; }
    setIsSearchingRuc(true);
    try {
      const res = await consultaService.consultarRUC(ruc);
      if (res.success && res.razonSocial) {
        setNewClientData(p => ({ ...p, businessName: res.razonSocial || '', taxAddress: res.address || '' }));
      } else {
        alert(res.error || 'No se encontró el RUC');
      }
    } catch {
      alert('Error al consultar RUC');
    } finally {
      setIsSearchingRuc(false);
    }
  };

  // ─── Facturación: empresa cliente activa ───
  const clientCompany = selectedClientId ? myCompanies.find(c => c.ownerUserId === selectedClientId) : null;
  const clientUser = selectedClientId ? users.find(u => u.id === selectedClientId) : null;

  // ─── Facturación: handler de comprobantes emitidos por el contador ───
  const handleAccountantInvoiceEmitted = (result: { id: string; name: string; sunatStatus: string; xmlContent?: string; cdrBase64?: string; amount?: number; customerName?: string; customerRuc?: string; documentType?: TaxDocument['documentType']; originalDocumentId?: string }) => {
    if (!clientCompany || !currentUser) return;

    if (isAtClientTaxDocLimit) {
      alert(`Tu cliente ha alcanzado el límite de comprobantes (${clientTaxDocLimit}) de su plan.`);
      return;
    }

    if (isAtAccountantTaxDocLimit) {
      alert(`Has alcanzado tu límite de comprobantes (${accountantTaxDocLimit}) de tu plan.`);
      return;
    }
    if (isAtCreatedAcctDocLimit) {
      alert(`Tu cliente ha alcanzado el límite de comprobantes por contador creado (${clientCreatedAcctDocLimit}) de su plan.`);
      return;
    }

    let xmlUrl = '';
    if (result.xmlContent) {
      try { xmlUrl = URL.createObjectURL(new Blob([result.xmlContent], { type: 'text/xml' })); } catch {}
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

    const isInternal = result.sunatStatus === 'INTERNO';
    const newDoc: TaxDocument = {
      id: result.id,
      userId: clientCompany.ownerUserId,
      companyId: clientCompany.id,
      accountantId: currentUser.id,
      name: result.name,
      fileUrl: '',
      pdfUrl: '',
      xmlUrl,
      cdrUrl,
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
      metadata: { amount: result.amount, recipientName: result.customerName, recipientRuc: result.customerRuc || '', description: '', retention: 0, netAmount: result.amount || 0, date: '' }
    };
    addTaxDocument(newDoc);

    if (clientUser) {
      addNotification({
        id: `notif-${Date.now()}`,
        userId: clientUser.id,
        message: `Tu contador emitió: ${result.name}`,
        date: new Date().toLocaleString('es-ES'),
        isRead: false,
        type: 'ACCOUNTANT_DOC'
      });
    }
  };

  // ─── Facturación: reintentos de facturas pendientes (duplicado desde UserDashboard) ───
  const getMaxRetryAttempts = () => 5;

  const retryPendingInvoice = async (inv: PendingInvoice) => {
    if ((inv.attemptCount || 0) >= getMaxRetryAttempts()) return;
    setRetryingInvoice(inv.id);
    updatePendingInvoiceStatus(inv.id, 'ENVIANDO');
    try {
      const isNCND = inv.documentType === 'nota_credito' || inv.documentType === 'nota_debito';
      const endpoint = isNCND ? '/emitir-nota' : '/emitir-factura';
      const company = companies.find(c => c.id === inv.companyId) || clientCompany || undefined;
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
        const docName = isNCND ? `${inv.documentType === 'nota_credito' ? 'N. Crédito' : 'N. Débito'} ${inv.serie}-${paddedCorr}` : `${inv.serie}-${paddedCorr}`;
        const newDoc: TaxDocument = {
          id: inv.id,
          userId: inv.userId,
          companyId: inv.companyId || clientCompany?.id || '',
          accountantId: currentUser?.id || '',
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
          documentType: isNCND ? inv.documentType : undefined,
          originalDocumentId: inv.originalDocumentId,
          uploadedBy: 'ACCOUNTANT'
        };
        addTaxDocument(newDoc);
        if (clientUser) {
          addNotification({
            id: `notif-${Date.now()}`,
            userId: clientUser.id,
            message: `Se reintentó y aceptó: ${inv.id}`,
            date: new Date().toLocaleString('es-ES'),
            isRead: false,
            type: 'ACCOUNTANT_DOC'
          });
        }
      } else {
        updatePendingInvoiceStatus(inv.id, 'PENDIENTE', result.error || 'Error del servidor SUNAT');
      }
    } catch (err: any) {
      updatePendingInvoiceStatus(inv.id, 'PENDIENTE', 'Error de conexión: ' + (err.message || 'Desconocido'));
    } finally { setRetryingInvoice(null); }
  };

  const retryAllPending = async () => {
    if (isAtClientTaxDocLimit) {
      alert(`Tu cliente ha alcanzado el límite de comprobantes (${clientTaxDocLimit}) de su plan.`);
      return;
    }

    if (isAtAccountantTaxDocLimit) {
      alert(`Has alcanzado tu límite de comprobantes (${accountantTaxDocLimit}) de tu plan.`);
      return;
    }
    if (isAtCreatedAcctDocLimit) {
      alert(`Tu cliente ha alcanzado el límite de comprobantes por contador creado (${clientCreatedAcctDocLimit}) de su plan.`);
      return;
    }
    const companyIds = myCompanies.map(c => c.id);
    const pending = pendingInvoices.filter(p =>
      (p.status === 'PENDIENTE' || p.status === 'RECHAZADO') &&
      (p.attemptCount || 0) < getMaxRetryAttempts() &&
      p.companyId && companyIds.includes(p.companyId)
    );
    for (const inv of pending) {
      await retryPendingInvoice(inv);
    }
  };

  // Auto-reintento cada 30s de pendientes de empresas del contador
  useEffect(() => {
    const companyIds = myCompanies.map(c => c.id);
    const pending = pendingInvoices.filter(p =>
      (p.status === 'PENDIENTE') && (p.attemptCount || 0) < getMaxRetryAttempts() &&
      p.companyId && companyIds.includes(p.companyId)
    );
    if (pending.length === 0) return;
    const timer = setTimeout(() => {
      pending.forEach(inv => {
        if (inv.id !== retryingInvoice) retryPendingInvoice(inv);
      });
    }, 30000);
    return () => clearTimeout(timer);
  }, [pendingInvoices, myCompanies]);

  // ─── Clientes: obtener resumen del mes actual ───
  const getCompanyMonthStats = (companyId: string) => {
    const now = new Date();
    const monthStr = now.toISOString().slice(0, 7);
    const monthExpenses = expenses.filter(e =>
      e.companyId === companyId && !e.isPrivate &&
      e.date.startsWith(monthStr)
    );
    const company = myCompanies.find(c => c.id === companyId);
    const docs = taxDocuments.filter(d =>
      d.userId === company?.ownerUserId && d.companyId === companyId && d.sunatStatus !== 'INTERNO' && d.sunatStatus !== 'BORRADO' &&
      (d.uploadDate?.startsWith(monthStr) || (d.periodYear === now.getFullYear() && d.periodMonth.toLowerCase() === MONTHS[now.getMonth()].toLowerCase()))
    );

    const totalVentas = docs.reduce((s, d) => s + getDocAmount(d), 0);
    const totalGastos = monthExpenses.reduce((s, e) => s + e.amount, 0);

    return {
      totalVentas,
      totalGastos,
      cantDocs: docs.length,
      cantGastos: monthExpenses.length,
      ultimoMovimiento: monthExpenses.length > 0
        ? monthExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
        : null
    };
  };

  // ─── Handle Create Client ───
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (isAtCreatedClientsLimit) {
      alert(String.fromCharCode(72,97,115,32,97,108,99,104,97,110,122,97,100,111,32,101,108,32,108,237,109,105,116,101,32,100,101,32,99,108,105,101,110,116,101,115,32,97,32,99,114,101,97,114,32,40) + createdClientsLimit + String.fromCharCode(41,32,100,101,32,116,117,32,112,108,97,110,46));
      return;
    }
    const pwd = generatePassword();
    const newUserId = Date.now().toString();
    const newUser = {
      id: newUserId,
      name: newClientData.name,
      email: newClientData.email,
      role: UserRole.USER,
      password: pwd,
      mustChangePassword: true,
      subscriptionStatus: SubscriptionStatus.PENDING,
      parentId: currentUser.id
    };
    const newCompany: Company = {
      id: `comp-${newUserId}`,
      ownerUserId: newUserId,
      name: newClientData.businessName || newClientData.name,
      ruc: newClientData.ruc,
      dni: newClientData.dni,
      businessName: newClientData.businessName,
      taxAddress: newClientData.taxAddress,
      assignedAccountantId: currentUser.id,
    };
    try {
      await registerUser(newUser);
      addCompany(newCompany);
      fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newUser.email, name: newUser.name, password: pwd })
      }).catch(() => {});
      setNewClientData({ name: '', email: '', ruc: '', dni: '', businessName: '', taxAddress: '' });
      setShowCreateClientModal(false);
    } catch (err: any) {
      alert("Error al registrar cliente en la base de datos: " + (err.message || "Error de conexión"));
    }
  };

  // ─── Handle Doc Upload (multi-file) ───
  const handleDocUpload = async () => {
    try {
      if (!selectedFiles.length || !currentUser) return;
      const targetCompanyId = uploadCompanyId || (selectedClientId
        ? myCompanies.find(c => c.ownerUserId === selectedClientId)?.id || ''
        : '');
      const company = myCompanies.find(c => c.id === targetCompanyId);
      if (!company) { alert('Selecciona una empresa'); return; }

      setUploadProgress({ done: 0, total: selectedFiles.length });
      setIsUploadingDoc(true);
      const uploadedNames: string[] = [];
      const failedNames: string[] = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        try {
          const base64 = await readFileAsBase64(file);
          const { folderPath, name } = parseUploadName(file.name);
          const subFolder = folderPath.split('/')[1] || '';
          const period = derivePeriod(subFolder) || { month: selectedMonth, year: selectedYear };
          const newDoc: TaxDocument = {
            id: `${Date.now()}-${i}`,
            userId: company.ownerUserId,
            companyId: company.id,
            accountantId: currentUser.id,
            name,
            folderPath: folderPath || undefined,
            fileUrl: base64,
            mimeType: file.type,
            uploadDate: new Date().toISOString().split('T')[0],
            periodMonth: period.month,
            periodYear: period.year,
            uploadedBy: 'ACCOUNTANT'
          };
          addTaxDocument(newDoc);
          addNotification({
            id: `notif-${Date.now()}-${i}`,
            userId: company.ownerUserId,
            message: `Tu contador te envió: ${name}${folderPath ? ` (${folderPath})` : ''}`,
            date: new Date().toLocaleString('es-ES'),
            isRead: false,
            type: 'ACCOUNTANT_DOC'
          });
          uploadedNames.push(name);
        } catch (innerErr) {
          console.error('Error al procesar archivo:', file.name, innerErr);
          failedNames.push(file.name);
        }
        setUploadProgress({ done: i + 1, total: selectedFiles.length });
      }

      setIsUploadingDoc(false);
      setSelectedFiles([]);
      setUploadProgress({ done: 0, total: 0 });

      if (failedNames.length === 0) {
        alert(`Se subieron ${uploadedNames.length} documento(s) correctamente.`);
      } else if (uploadedNames.length > 0) {
        alert(`${uploadedNames.length} subidos. Fallaron: ${failedNames.join(', ')}`);
      } else {
        alert('No se pudo subir ningún documento.');
      }
    } catch (err) {
      console.error('Error en handleDocUpload:', err);
      alert('Error inesperado al subir los documentos.');
      setIsUploadingDoc(false);
    }
  };

  // ─── Export helpers ───
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
      console.error('Error al descargar:', err);
      alert('No se pudo descargar el archivo.');
    }
  };

  const exportToExcel = (clientName: string, clientExpenses: Expense[]) => {
    const headers = ["Fecha", "RUC Emisor", "Razón Social", "Descripción", "Subtotal", "IGV", "Total"];
    const rows = clientExpenses.map(exp => {
      const total = exp.amount;
      const subtotal = exp.subtotal || (total / 1.18);
      const igv = exp.igv || (total - subtotal);
      return [
        exp.date,
        exp.ruc || '',
        exp.description.replace(/,/g, ' '),
        exp.category,
        subtotal.toFixed(2),
        igv.toFixed(2),
        total.toFixed(2)
      ];
    });
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Gastos_${clientName.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPdfReport = (clientName: string, month: string, year: number, expensesList: Expense[], totalGastos: number) => {
    const html = `
      <html><head><meta charset="utf-8"><title>Reporte ${clientName}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
        h1 { color: #1a1a2e; border-bottom: 3px solid #fb8c00; padding-bottom: 10px; }
        h2 { color: #fb8c00; font-size: 16px; margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
        th { background: #1a1a2e; color: white; padding: 8px 12px; text-align: left; }
        td { padding: 6px 12px; border-bottom: 1px solid #eee; }
        .total { font-weight: bold; font-size: 18px; margin-top: 20px; text-align: right; }
        .footer { margin-top: 40px; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
      </style></head><body>
      <h1>Reporte Mensual de Gastos</h1>
      <p><strong>Cliente:</strong> ${clientName} | <strong>Período:</strong> ${month} ${year}</p>
      <p><strong>Total Gastos:</strong> S/ ${totalGastos.toFixed(2)}</p>
      <p><strong>Cantidad de Movimientos:</strong> ${expensesList.length}</p>
      <table><tr><th>Fecha</th><th>Descripción</th><th>Subtotal</th><th>IGV</th><th>Total</th></tr>
      ${expensesList.map(e => {
        const sub = e.subtotal || (e.amount / 1.18);
        const igv = e.igv || (e.amount - sub);
        return `<tr><td>${e.date}</td><td>${e.description}</td><td>S/ ${sub.toFixed(2)}</td><td>S/ ${igv.toFixed(2)}</td><td>S/ ${e.amount.toFixed(2)}</td></tr>`;
      }).join('')}
      </table>
      <div class="total">Total General: S/ ${totalGastos.toFixed(2)}</div>
      <div class="footer">Generado por FinanzaFacil - ${new Date().toLocaleString()}</div>
      </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url);
    if (w) {
      w.onload = () => { w.print(); };
    }
  };

  // ─── View: Clientes ───
  const renderClientes = () => (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-gray-800">Mis Clientes</h2>
        {currentUser.subscriptionStatus === SubscriptionStatus.ACTIVE && !isAtManagedCompaniesLimit && !isAtCreatedClientsLimit && (
          <button onClick={() => setShowCreateClientModal(true)}
            className="bg-brand-600 text-white px-5 py-3 rounded-xl hover:bg-brand-700 transition flex items-center font-bold text-sm shadow-lg shadow-brand-100">
            <UserPlus className="w-4 h-4 mr-2" /> Nuevo Cliente
          </button>
        )}
        {isAtManagedCompaniesLimit && (
          <p className="text-sm text-amber-600 font-medium">
            Has alcanzado el límite de empresas a gestionar ({managedCompaniesLimit}) de tu plan
          </p>
        )}
        {isAtCreatedClientsLimit && (
          <p className="text-sm text-amber-600 font-medium">
            Has alcanzado el límite de clientes a crear ({createdClientsLimit}) de tu plan
          </p>
        )}
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Buscar por nombre o RUC..." value={searchClient}
          onChange={e => setSearchClient(e.target.value)}
          className="w-full bg-white border-2 border-gray-200 p-3.5 pl-12 rounded-xl text-sm font-bold outline-none focus:border-brand-600" />
      </div>
      {filteredCompanies.length === 0 ? (
        <div className="py-20 text-center text-gray-400">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="font-black uppercase text-sm">No hay empresas asignadas</p>
          <p className="text-xs mt-1">Crea un nuevo cliente con el botón superior</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCompanies.map(company => {
            const stats = getCompanyMonthStats(company.id);
            const owner = users.find(u => u.id === company.ownerUserId);
            return (
              <div key={company.id}
                className="bg-white rounded-2xl border-2 border-gray-100 p-5 hover:border-brand-400 hover:shadow-lg transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-brand-50 rounded-xl group-hover:bg-brand-100 transition">
                    <Building className="w-6 h-6 text-brand-600" />
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${owner?.subscriptionStatus === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {owner?.subscriptionStatus === 'ACTIVE' ? 'Activo' : 'Pendiente'}
                  </span>
                </div>
                <h3 className="font-black text-gray-900 text-sm uppercase truncate">{company.businessName || company.name}</h3>
                <p className="text-[10px] text-gray-500 font-bold truncate">{owner?.name || 'Sin dueño'}</p>
                <p className="text-[10px] text-gray-400 font-mono mt-1">RUC: {company.ruc || '—'}</p>
                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-base font-black text-green-600">S/ {(stats.totalVentas || 0).toFixed(2)}</p>
                    <p className="text-[8px] text-gray-400 font-black uppercase">Ventas Mes</p>
                  </div>
                  <div>
                    <p className="text-base font-black text-brand-600">S/ {(stats.totalGastos || 0).toFixed(2)}</p>
                    <p className="text-[8px] text-gray-400 font-black uppercase">Gastos Mes</p>
                  </div>
                  <div>
                    <p className="text-base font-black text-gray-700">{stats.cantDocs}</p>
                    <p className="text-[8px] text-gray-400 font-black uppercase">Documentos</p>
                  </div>
                </div>
                {stats.ultimoMovimiento && (
                  <p className="text-[8px] text-gray-400 mt-3 text-center">Último: {stats.ultimoMovimiento}</p>
                )}
                {owner && owner.parentId === currentUser.id && (
                  <button onClick={() => handleResetPassword(owner.id, owner.name)}
                    className="mt-3 w-full py-2 bg-amber-50 text-amber-600 rounded-xl font-black text-[10px] uppercase hover:bg-amber-100 transition border border-amber-200 flex items-center justify-center">
                    <Lock className="w-3.5 h-3.5 mr-1.5" /> Cambiar Contraseña
                  </button>
                )}
                <button onClick={() => { setSelectedClientId(company.ownerUserId); setClientView('movimientos'); }}
                  className="mt-4 w-full py-2.5 bg-gray-50 text-gray-600 rounded-xl font-black text-[10px] uppercase hover:bg-brand-50 hover:text-brand-600 transition border border-gray-200">
                  Ver Movimientos
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ─── View: Movimientos (detalle de cliente) ───
  const renderMovimientos = () => {
    if (!selectedClientId) return null;
    const client = users.find(u => u.id === selectedClientId);
    if (!client) return <div className="py-10 text-center text-gray-400">Cliente no encontrado</div>;

    const filteredExpenses = expenses
      .filter(e => {
        if (e.userId !== selectedClientId || e.isPrivate) return false;
        if (clientCompany?.id && e.companyId !== clientCompany.id) return false;
        if (['Facturación Electrónica', 'Ventas', 'Ingresos'].includes(e.category)) return false;
        const matchingDoc = taxDocuments.find(d => d.id === e.invoiceNumber);
        if (matchingDoc && matchingDoc.sunatStatus === 'INTERNO') return false;
        return e.date.startsWith(`${movFilterYear}-${String(MONTHS.indexOf(movFilterMonth) + 1).padStart(2, '0')}`);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const clientDocs = taxDocuments
      .filter(d => (d.userId === selectedClientId || (clientCompany?.id && d.companyId === clientCompany.id)) && d.sunatStatus !== 'INTERNO' &&
        (d.uploadDate?.startsWith(`${movFilterYear}-${String(MONTHS.indexOf(movFilterMonth) + 1).padStart(2, '0')}`) ||
         (d.periodYear === movFilterYear && d.periodMonth.toLowerCase() === movFilterMonth.toLowerCase())))
      .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());

    const totals = filteredExpenses.reduce((acc, exp) => {
      const sub = exp.subtotal || (exp.amount / 1.18);
      const igv = exp.igv || (exp.amount - sub);
      return { subtotal: acc.subtotal + sub, igv: acc.igv + igv, total: acc.total + exp.amount };
    }, { subtotal: 0, igv: 0, total: 0 });

    const totalVentasEmitidas = clientDocs.reduce((acc, doc) => acc + getDocAmount(doc), 0);

    return (
      <div className="space-y-6">
        {/* Filtros mes/año + Exportar */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-3 items-center">
            <Filter className="w-4 h-4 text-gray-400" />
            <select className="bg-white border-2 border-gray-200 p-2 rounded-lg text-xs font-bold outline-none"
              value={movFilterMonth} onChange={e => { setMovFilterMonth(e.target.value); setRepMonth(e.target.value); }}>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className="bg-white border-2 border-gray-200 p-2 rounded-lg text-xs font-bold outline-none"
              value={movFilterYear} onChange={e => { const y = Number(e.target.value); setMovFilterYear(y); setRepYear(y); }}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={() => exportToExcel(client.name, filteredExpenses)}
            className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition flex items-center font-bold text-sm shadow-lg shadow-green-100">
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Excel
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                <h3 className="font-black text-gray-700 flex items-center text-xs uppercase tracking-widest">
                  <ShieldCheck className="w-4 h-4 mr-2 text-brand-600" />
                  Registro de Compras Declarables ({filteredExpenses.length})
                </h3>
              </div>
              {filteredExpenses.length === 0 ? (
                <div className="py-12 text-center text-gray-400 italic text-sm">No hay gastos en este período.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200">
                        <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-500 border-r">Fecha</th>
                        <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-500 border-r">Emisor</th>
                        <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-500 border-r">Categoría</th>
                        <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-500 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredExpenses.map(exp => (
                        <tr key={exp.id} onClick={() => setSelectedExpense(exp)}
                          className="hover:bg-brand-50 transition cursor-pointer group">
                          <td className="px-4 py-3 text-xs font-mono border-r">{exp.date}</td>
                          <td className="px-4 py-3 border-r text-xs font-bold uppercase">{exp.description}</td>
                          <td className="px-4 py-3 border-r text-[10px] text-gray-500 font-bold">{exp.category}</td>
                          <td className="px-4 py-3 text-sm font-black text-brand-700 text-right">S/ {exp.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Documentos Tributarios con Pestañas Principales */}
            {(() => {
              const isComprobanteDePago = (d: TaxDocument) => {
                if (['factura', 'boleta', 'nota_credito', 'nota_debito', 'rh'].includes(d.documentType || '')) return true;
                const name = (d.name || '').toUpperCase();
                const id = (d.id || '').toUpperCase();
                if (id.startsWith('F') || id.startsWith('B') || id.startsWith('NC-') || id.startsWith('ND-') || id.startsWith('RH-')) return true;
                if (name.startsWith('FACTURA') || name.startsWith('BOLETA') || name.startsWith('N. CRÉDITO') || name.startsWith('N. DÉBITO') || name.startsWith('RECIBO')) return true;
                return false;
              };

              const comprobantesDocs = clientDocs.filter(d => isComprobanteDePago(d));
              const contadorDocs = clientDocs.filter(d => d.uploadedBy === 'ACCOUNTANT' && !isComprobanteDePago(d));
              const empresarioDocs = clientDocs.filter(d => (d.uploadedBy === 'USER' || d.uploadedBy !== 'ACCOUNTANT') && !isComprobanteDePago(d));

              let currentList: TaxDocument[] = [];
              if (acctMainTab === 'comprobantes') {
                currentList = comprobantesDocs.filter(d => {
                  if (acctSubTab === 'all') return true;
                  if (acctSubTab === 'factura') return d.documentType === 'factura' || d.name.startsWith('F') || d.id.startsWith('F');
                  if (acctSubTab === 'boleta') return d.documentType === 'boleta' || d.name.startsWith('B') || d.id.startsWith('B');
                  if (acctSubTab === 'nc') return d.documentType === 'nota_credito' || d.id.startsWith('NC-');
                  if (acctSubTab === 'nd') return d.documentType === 'nota_debito' || d.id.startsWith('ND-');
                  return true;
                });
              } else if (acctMainTab === 'contador') {
                currentList = contadorDocs;
              } else {
                currentList = empresarioDocs;
              }

              return (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-4 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-black text-gray-700 flex items-center text-xs uppercase tracking-widest">
                      <FileText className="w-4 h-4 mr-2 text-blue-600" />
                      Documentos y Comprobantes ({clientDocs.length})
                    </h3>
                    <button
                      onClick={() => setShowFileTreeModal(true)}
                      className="bg-brand-600 text-white px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 transition flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <FolderTree className="w-3.5 h-3.5" /> Árbol de Documentos
                    </button>
                  </div>

                  {/* Pestañas Principales */}
                  <div className="grid grid-cols-3 bg-gray-100 p-1.5 border-b border-gray-200 gap-1">
                    <button
                      onClick={() => setAcctMainTab('comprobantes')}
                      className={`py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
                        acctMainTab === 'comprobantes'
                          ? 'bg-white text-brand-600 shadow-sm border border-gray-200'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Comprobantes de Pago <span className="text-[10px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-black">{comprobantesDocs.length}</span>
                    </button>
                    <button
                      onClick={() => setAcctMainTab('contador')}
                      className={`py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
                        acctMainTab === 'contador'
                          ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Archivos del Contador <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-black">{contadorDocs.length}</span>
                    </button>
                    <button
                      onClick={() => setAcctMainTab('empresario')}
                      className={`py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
                        acctMainTab === 'empresario'
                          ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Archivos del Empresario <span className="text-[10px] bg-gray-200 text-gray-800 px-2 py-0.5 rounded-full font-black">{empresarioDocs.length}</span>
                    </button>
                  </div>

                  {/* Sub-pestañas para Comprobantes de Pago */}
                  {acctMainTab === 'comprobantes' && (
                    <div className="flex bg-gray-50 p-1.5 overflow-x-auto border-b border-gray-200 gap-1">
                      {[
                        { id: 'all', label: 'Todos Comprobantes', count: comprobantesDocs.length },
                        { id: 'factura', label: 'Facturas', count: comprobantesDocs.filter(d => d.documentType === 'factura' || d.name.startsWith('F') || d.id.startsWith('F')).length },
                        { id: 'boleta', label: 'Boletas', count: comprobantesDocs.filter(d => d.documentType === 'boleta' || d.name.startsWith('B') || d.id.startsWith('B')).length },
                        { id: 'nc', label: 'Notas de Crédito', count: comprobantesDocs.filter(d => d.documentType === 'nota_credito' || d.id.startsWith('NC-')).length },
                        { id: 'nd', label: 'Notas de Débito', count: comprobantesDocs.filter(d => d.documentType === 'nota_debito' || d.id.startsWith('ND-')).length },
                      ].map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => setAcctSubTab(sub.id as any)}
                          className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all whitespace-nowrap ${
                            acctSubTab === sub.id
                              ? 'bg-brand-600 text-white shadow-sm'
                              : 'bg-white text-gray-500 hover:text-gray-800 border border-gray-200'
                          }`}
                        >
                          {sub.label} ({sub.count})
                        </button>
                      ))}
                    </div>
                  )}

                  {currentList.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 italic text-sm">Sin documentos en esta sección.</div>
                  ) : (
                    <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                      {currentList.map(doc => (
                        <div key={doc.id} onClick={() => setPreviewDoc(doc)} className="p-3.5 flex items-center justify-between hover:bg-brand-50/50 cursor-pointer transition">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-2 rounded-lg ${doc.uploadedBy === 'ACCOUNTANT' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-brand-600'}`}>
                              {doc.uploadedBy === 'ACCOUNTANT' ? <UserIcon className="w-4 h-4"/> : <ReceiptText className="w-4 h-4"/>}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-gray-900 uppercase truncate">{doc.name}</p>
                                {doc.uploadedBy === 'ACCOUNTANT' && (
                                  <span className="text-[8px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase shrink-0">CONTADOR</span>
                                )}
                              </div>
                              <p className="text-[9px] text-gray-400">{doc.folderPath ? `${doc.folderPath} · ` : ''}{doc.periodMonth} {doc.periodYear} · {doc.uploadDate}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {doc.metadata?.amount && (
                              <span className="text-xs font-black text-gray-800">S/ {doc.metadata.amount.toFixed(2)}</span>
                            )}
                            {doc.sunatStatus && (
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${(doc.sunatStatus as any) === 'ACEPTADO' || doc.sunatStatus === 'SENT' ? 'bg-green-100 text-green-700' : doc.sunatStatus === 'INTERNO' ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {doc.sunatStatus}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Panel totales */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 h-fit space-y-4">
            <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Totales del Período</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-xs text-gray-500 font-bold">Subtotal Compras</span>
                <span className="text-sm font-black text-gray-800">S/ {totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-xs text-gray-500 font-bold">IGV Compras (18%)</span>
                <span className="text-sm font-black text-gray-800">S/ {totals.igv.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-sm font-black text-gray-800">Total Compras</span>
                <span className="text-lg font-black text-brand-600">S/ {totals.total.toFixed(2)}</span>
              </div>
              <div className="pt-2 flex justify-between items-center">
                <span className="text-xs text-gray-600 font-bold">Total Ventas Emitidas</span>
                <span className="text-base font-black text-green-600">S/ {totalVentasEmitidas.toFixed(2)}</span>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-2 text-center">
              <div>
                <p className="text-[9px] text-gray-400 font-bold uppercase">Cant. Compras</p>
                <p className="text-xl font-black text-gray-800">{filteredExpenses.length}</p>
              </div>
              <div>
                <p className="text-[9px] text-gray-400 font-bold uppercase">Cant. Ventas</p>
                <p className="text-xl font-black text-gray-800">{clientDocs.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Modal: Previsualización de Documento ───
  const renderDocPreviewModal = () => {
    if (!previewDoc) return null;
    const client = users.find(u => u.id === previewDoc.userId);
    const docCompany = myCompanies.find(c => c.ownerUserId === previewDoc.userId);
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-4 overflow-y-auto" onClick={() => setPreviewDoc(null)}>
        <div className="bg-white rounded-[2rem] w-full max-w-2xl h-fit overflow-hidden flex flex-col shadow-2xl relative" onClick={e => e.stopPropagation()}>
          <div className="p-6 border-b flex justify-between items-center bg-gray-50">
            <div className="flex items-center gap-3 min-w-0">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-800 italic truncate">{previewDoc.name}</h3>
              {previewDoc.uploadedBy === 'ACCOUNTANT' && (
                <span className="shrink-0 text-[9px] bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-black uppercase flex items-center"><UserIcon className="w-3 h-3 mr-1"/> Enviado por contador</span>
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
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-gray-400 leading-none">RUC Cliente</p>
                  <p className="text-sm font-mono font-black text-gray-800">{docCompany?.ruc || '—'}</p>
                </div>
              </div>
              <div className="space-y-6 relative z-10 font-bold text-gray-700">
                <div className="grid grid-cols-2 gap-8 text-xs">
                  <div><p className="text-gray-400 font-bold uppercase text-[9px] mb-1">Periodo:</p><p className="font-black text-gray-800 uppercase text-sm">{previewDoc.periodMonth} {previewDoc.periodYear}</p></div>
                  <div><p className="text-gray-400 font-bold uppercase text-[9px] mb-1">Subido:</p><p className="font-black text-gray-800 uppercase text-sm">{previewDoc.uploadDate}</p></div>
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
                {previewDoc.fileUrl && (
                  <div className="p-8 bg-gray-50 rounded-2xl border border-gray-100 text-center">
                    <p className="text-xs text-gray-500 italic mb-4">Archivo adjunto disponible para descargar</p>
                  </div>
                )}
                {previewDoc.sunatHash && (
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-[8px] text-gray-400 uppercase font-black tracking-widest">Firma Digital (CPE):</p>
                    <p className="text-[9px] font-mono font-bold text-brand-600 break-all">{previewDoc.sunatHash}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          {previewDoc.fileUrl && (
            <div className="p-6 border-t flex justify-center bg-gray-50">
              <button
                onClick={() => downloadFile(previewDoc.fileUrl, previewDoc.name, previewDoc.mimeType || 'application/octet-stream', true)}
                className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-blue-700 transition flex items-center justify-center"
              >
                <Download className="w-4 h-4 mr-2"/> Descargar Archivo
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── View: Reporte Mensual ───
  const getDocAmount = (d: TaxDocument): number => {
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
    } else {
      const matchExp = expenses.find(e => e.invoiceNumber === d.id || e.id.includes(d.id));
      if (matchExp) amt = matchExp.amount;
    }

    if (d.documentType === 'nota_credito' || d.name?.toLowerCase().includes('crédito') || d.name?.toLowerCase().includes('credito')) {
      return -Math.abs(amt);
    }
    return amt;
  };

  const renderReporte = () => {
    const activeRepCompanyId = selectedClientId
      ? (myCompanies.find(c => c.ownerUserId === selectedClientId)?.id || repCompanyId)
      : repCompanyId;

    const expensesByClient = activeRepCompanyId
      ? expenses.filter(e => {
          if (e.companyId !== activeRepCompanyId || e.isPrivate) return false;
          if (['Facturación Electrónica', 'Ventas', 'Ingresos'].includes(e.category)) return false;
          const matchingDoc = taxDocuments.find(d => d.id === e.invoiceNumber);
          if (matchingDoc && matchingDoc.sunatStatus === 'INTERNO') return false;
          return e.date.startsWith(`${repYear}-${String(MONTHS.indexOf(repMonth) + 1).padStart(2, '0')}`);
        })
      : [];

    const incomeDocs = activeRepCompanyId
      ? taxDocuments.filter(d => d.companyId === activeRepCompanyId && d.sunatStatus !== 'INTERNO' &&
          (d.uploadDate?.startsWith(`${repYear}-${String(MONTHS.indexOf(repMonth) + 1).padStart(2, '0')}`) ||
           (d.periodYear === repYear && d.periodMonth.toLowerCase() === repMonth.toLowerCase())))
      : [];

    const totalGastos: number = expensesByClient.reduce<number>((s, e) => s + Number(e.amount), 0);
    const totalIngresos: number = incomeDocs.reduce<number>((s, d) => s + getDocAmount(d), 0);

    const byCategory = expensesByClient.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
      return acc;
    }, {});

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-black text-gray-800">Reporte Mensual</h2>
        <div className="flex flex-wrap gap-3 items-end">
          {!selectedClientId && (
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Empresa</label>
              <select className="bg-white border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none min-w-[200px]"
                value={repCompanyId} onChange={e => setRepCompanyId(e.target.value)}>
                <option value="">Seleccionar empresa</option>
                {myCompanies.map(c => <option key={c.id} value={c.id}>{c.name}{c.ruc ? ` (${c.ruc})` : ''}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Mes</label>
            <select className="bg-white border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none"
              value={repMonth} onChange={e => { setRepMonth(e.target.value); setMovFilterMonth(e.target.value); }}>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Año</label>
            <select className="bg-white border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none"
              value={repYear} onChange={e => { const y = Number(e.target.value); setRepYear(y); setMovFilterYear(y); }}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {!activeRepCompanyId ? (
          <div className="py-20 text-center text-gray-400">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="font-black uppercase text-sm">Selecciona una empresa</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gastos */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-black text-gray-700 text-xs uppercase tracking-widest mb-4 flex items-center">
                <TrendingDown className="w-4 h-4 mr-2 text-red-500" /> Gastos del Mes
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Total Gastos</span><span className="font-black">S/ {totalGastos.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Cantidad</span><span className="font-black">{expensesByClient.length}</span></div>
              </div>
              {Object.keys(byCategory).length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 uppercase mb-2">Por Categoría</p>
                  {Object.entries(byCategory).sort((a: [string, number], b: [string, number]) => b[1] - a[1]).map(([cat, monto]: [string, number]) => (
                    <div key={cat} className="flex justify-between text-[11px] py-1">
                      <span className="text-gray-600 font-bold">{cat}</span>
                      <span className="font-black">S/ {monto.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ingresos */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-black text-gray-700 text-xs uppercase tracking-widest mb-4 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-green-500" /> Comprobantes Emitidos
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Total Ingresos</span><span className="font-black">S/ {totalIngresos.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Documentos</span><span className="font-black">{incomeDocs.length}</span></div>
              </div>
              {incomeDocs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 max-h-48 overflow-y-auto">
                  {incomeDocs.map(d => (
                    <div key={d.id} className="flex justify-between text-[11px] py-1 border-b border-gray-50">
                      <span className="text-gray-600 font-bold uppercase">{d.name}</span>
                      <span className="font-black">S/ {getDocAmount(d).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botones de exportación */}
            <div className="lg:col-span-2 flex gap-3">
              <button onClick={() => downloadPdfReport(
                myCompanies.find(c => c.id === activeRepCompanyId)?.name || '',
                repMonth, repYear, expensesByClient, totalGastos
              )}
                className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-black text-xs uppercase hover:bg-brand-700 transition flex items-center justify-center shadow-lg">
                <Printer className="w-4 h-4 mr-2" /> Reporte PDF
              </button>
              <button onClick={() => exportToExcel(myCompanies.find(c => c.id === activeRepCompanyId)?.name || '', expensesByClient)}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-black text-xs uppercase hover:bg-green-700 transition flex items-center justify-center shadow-lg">
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Excel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── View: PDT 621 ───
  const renderPdt = () => {
    const yearMonth = `${pdtYear}-${String(MONTHS.indexOf(pdtMonth) + 1).padStart(2, '0')}`;
    const periodoLabel = `${pdtMonth} ${pdtYear}`;

    const compras = pdtClientId
      ? expenses.filter(e => e.userId === pdtClientId && !e.isPrivate &&
          e.date.startsWith(yearMonth))
      : [];

    const ventas = pdtClientId
      ? taxDocuments.filter(d => d.userId === pdtClientId && d.sunatStatus !== 'INTERNO' &&
          d.uploadDate?.startsWith(yearMonth))
      : [];

    const totalCompras = compras.reduce((s, e) => s + e.amount, 0);
    const totalVentas = ventas.reduce((s, d) => s + getDocAmount(d), 0);
    const igvCompras = compras.reduce((s, e) => s + (e.igv || (e.amount - (e.subtotal || e.amount / 1.18))), 0);
    const igvVentas = totalVentas - (totalVentas / 1.18);
    const igvPagar = igvVentas - igvCompras;

    const handleExportPdt = () => {
      const clientName = myClients.find(c => c.id === pdtClientId)?.name || 'cliente';
      const incomeRows = ventas.map(d => ({
        name: d.name, amount: getDocAmount(d),
        date: d.uploadDate || '', ruc: d.metadata?.recipientRuc || ''
      }));
      const csv = buildPdtCsv(compras, incomeRows, periodoLabel);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `PDT621_${clientName}_${periodoLabel.replace(/\s/g, '')}.csv`;
      link.click();
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-black text-gray-800">PDT 621 — IGV / Renta Mensual</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Cliente</label>
            <select className="bg-white border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none min-w-[200px]"
              value={pdtClientId} onChange={e => setPdtClientId(e.target.value)}>
              <option value="">Seleccionar cliente</option>
              {myClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Mes</label>
            <select className="bg-white border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none"
              value={pdtMonth} onChange={e => setPdtMonth(e.target.value)}>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Año</label>
            <select className="bg-white border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none"
              value={pdtYear} onChange={e => setPdtYear(Number(e.target.value))}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {!pdtClientId ? (
          <div className="py-20 text-center text-gray-400">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="font-black uppercase text-sm">Selecciona un cliente</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Registro de Compras */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-red-50 border-b border-red-100">
                <h3 className="font-black text-red-700 text-xs uppercase tracking-widest flex items-center">
                  <TrendingDown className="w-4 h-4 mr-2" /> Registro de Compras ({compras.length})
                </h3>
              </div>
              {compras.length === 0 ? (
                <div className="py-8 text-center text-gray-400 italic text-sm">Sin compras registradas.</div>
              ) : (
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="bg-gray-100 text-[9px] font-black uppercase text-gray-500">
                      <th className="px-3 py-2">RUC</th><th className="px-3 py-2">Proveedor</th>
                      <th className="px-3 py-2 text-right">Base</th><th className="px-3 py-2 text-right">IGV</th><th className="px-3 py-2 text-right">Total</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {compras.map(e => {
                        const sub = e.subtotal || (e.amount / 1.18);
                        const igv = e.igv || (e.amount - sub);
                        return <tr key={e.id}>
                          <td className="px-3 py-2 font-mono">{e.ruc || '—'}</td>
                          <td className="px-3 py-2 font-bold uppercase truncate max-w-[120px]">{e.description}</td>
                          <td className="px-3 py-2 text-right font-mono">{sub.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono">{igv.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-black">{e.amount.toFixed(2)}</td>
                        </tr>;
                      })}
                    </tbody>
                    <tfoot><tr className="bg-gray-50 font-black text-xs">
                      <td colSpan={2} className="px-3 py-2 text-gray-500">Totales</td>
                      <td className="px-3 py-2 text-right">{compras.reduce((s, e) => s + (e.subtotal || e.amount / 1.18), 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{igvCompras.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-brand-700">{totalCompras.toFixed(2)}</td>
                    </tr></tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Registro de Ventas */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-green-50 border-b border-green-100">
                <h3 className="font-black text-green-700 text-xs uppercase tracking-widest flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2" /> Registro de Ventas ({ventas.length})
                </h3>
              </div>
              {ventas.length === 0 ? (
                <div className="py-8 text-center text-gray-400 italic text-sm">Sin ventas registradas.</div>
              ) : (
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="bg-gray-100 text-[9px] font-black uppercase text-gray-500">
                      <th className="px-3 py-2">Comprobante</th><th className="px-3 py-2 text-right">Base</th>
                      <th className="px-3 py-2 text-right">IGV</th><th className="px-3 py-2 text-right">Total</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {ventas.map(d => {
                        const monto = getDocAmount(d);
                        const sub = monto / 1.18;
                        const igv = monto - sub;
                        return <tr key={d.id}>
                          <td className="px-3 py-2 font-bold uppercase">{d.name}</td>
                          <td className="px-3 py-2 text-right font-mono">{sub.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono">{igv.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-black">{monto.toFixed(2)}</td>
                        </tr>;
                      })}
                    </tbody>
                    <tfoot><tr className="bg-gray-50 font-black text-xs">
                      <td className="px-3 py-2 text-gray-500">Totales</td>
                      <td className="px-3 py-2 text-right">{(totalVentas / 1.18).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{igvVentas.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-green-700">{totalVentas.toFixed(2)}</td>
                    </tr></tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Resumen IGV */}
            <div className="lg:col-span-2 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white">
              <h3 className="font-black text-xs uppercase tracking-widest mb-4 opacity-70">Resumen IGV — {periodoLabel}</h3>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-[9px] uppercase font-black opacity-50">IGV Compras</p>
                  <p className="text-2xl font-black text-red-400">S/ {igvCompras.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase font-black opacity-50">IGV Ventas</p>
                  <p className="text-2xl font-black text-green-400">S/ {igvVentas.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase font-black opacity-50">{igvPagar >= 0 ? 'IGV a Pagar' : 'Saldo a Favor'}</p>
                  <p className={`text-2xl font-black ${igvPagar >= 0 ? 'text-amber-400' : 'text-blue-400'}`}>
                    S/ {Math.abs(igvPagar).toFixed(2)}
                  </p>
                </div>
              </div>
              <button onClick={handleExportPdt}
                className="mt-6 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition flex items-center">
                <Download className="w-4 h-4 mr-2" /> Exportar PDT 621 (CSV)
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── View: Subir Archivo ───
  const renderSubirArchivo = () => {
    const selectedCompanyFromClient = selectedClientId
      ? myCompanies.find(c => c.ownerUserId === selectedClientId)?.id || ''
      : '';
    const targetCompanyId = uploadCompanyId || selectedCompanyFromClient;
    const targetCompany = myCompanies.find(c => c.id === targetCompanyId);

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-2xl font-black text-gray-800">Subir Documento Tributario</h2>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
          {!selectedCompanyFromClient && (
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Empresa</label>
              <select className="w-full bg-white border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600"
                value={uploadCompanyId} onChange={e => setUploadCompanyId(e.target.value)}>
                <option value="">Seleccionar empresa</option>
                {myCompanies.map(c => <option key={c.id} value={c.id}>{c.name}{c.ruc ? ` (${c.ruc})` : ''}</option>)}
              </select>
            </div>
          )}
          {targetCompany && (
            <div className="p-3 bg-brand-50 rounded-xl flex items-center gap-3">
              <Building className="w-5 h-5 text-brand-600" />
              <span className="text-sm font-black text-brand-800 uppercase">{targetCompany.name}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Mes</label>
              <select className="w-full bg-white border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none"
                value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Año</label>
              <select className="w-full bg-white border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none"
                value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Archivos (PDF, XML, imagen)</label>
            <FileUploadZone files={selectedFiles} onFilesChange={setSelectedFiles} />
          </div>
          <button onClick={() => {
            if (!targetCompanyId) return alert('Selecciona una empresa');
            if (!selectedFiles.length) return alert('Selecciona al menos un archivo');
            handleDocUpload();
          }} disabled={!targetCompanyId || isUploadingDoc}
            className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-700 transition flex items-center justify-center disabled:opacity-50 shadow-lg">
            {isUploadingDoc ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Subiendo {uploadProgress.done} de {uploadProgress.total}...</> : <><Upload className="w-4 h-4 mr-2" /> Subir Documentos</>}
          </button>
        </div>
      </div>
    );
  };

   // ─── View: Facturación del cliente (emisión por el contador) ───
   const clientDocs = useMemo(() => {
    if (!clientCompany) return [];
    return taxDocuments
      .filter(d => (d.userId === clientCompany.ownerUserId || d.accountantId === currentUser?.id) && d.companyId === clientCompany.id)
      .sort((a, b) => new Date(b.uploadDate || '').getTime() - new Date(a.uploadDate || '').getTime());
   }, [clientCompany, taxDocuments]);

   const companyPendingInvoices = useMemo(() => {
    if (!clientCompany) return [];
    return pendingInvoices.filter(p => p.companyId === clientCompany.id && (p.status === 'PENDIENTE' || p.status === 'ENVIANDO' || p.status === 'RECHAZADO'));
   }, [clientCompany, pendingInvoices]);

    const formatDocType = (t?: string) => {
     switch (t) {
       case 'factura': return 'Factura';
       case 'boleta': return 'Boleta';
       case 'nota_credito': return 'Nota de Crédito';
       case 'nota_debito': return 'Nota de Débito';
       default: return t || 'Documento';
     }
    };

    // ─── Paginación del histórico de comprobantes de la empresa (facturación) ───
    const DOC_PAGE_SIZE = 10;
    const [docPage, setDocPage] = useState(1);
    const docPageCount = useMemo(() => Math.max(1, Math.ceil(clientDocs.length / DOC_PAGE_SIZE)), [clientDocs]);
    const paginatedDocs = useMemo(() => {
      const start = (docPage - 1) * DOC_PAGE_SIZE;
      return clientDocs.slice(start, start + DOC_PAGE_SIZE);
    }, [clientDocs, docPage]);
    useEffect(() => { setDocPage(1); }, [clientCompany?.id]);

    const renderFacturacion = () => {
    if (!clientCompany) return null;
    const hasCredentials = !!(clientCompany.ruc && clientCompany.solUser && clientCompany.certBase64 && clientCompany.certPass);
    const canEmit = !!currentUser;

      return (
       <div className="space-y-6">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <h3 className="text-lg font-black text-gray-800 uppercase">Emisión de Comprobantes</h3>
            {!hasCredentials && (
             <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase">Sin credenciales SUNAT — solo interno</span>
            )}
          </div>

          {isAtCreatedAcctDocLimit && isCreatedAccountantOfClient && (
            <p className="text-sm text-amber-600 font-medium">
              Has alcanzado el límite de comprobantes por contador creado ({clientCreatedAcctDocLimit}) de tu plan del cliente
            </p>
          )}

           {canEmit && (
           <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
             {!!(clientCompany?.isPersonaNatural || clientUser?.role === UserRole.PERSONA_NATURAL) && (
               <button onClick={() => {
                 if (isAtClientTaxDocLimit) { alert(`Tu cliente ha alcanzado el límite de comprobantes (${clientTaxDocLimit}) de su plan.`); return; }
                 if (isAtAccountantTaxDocLimit) { alert(`Has alcanzado tu límite de comprobantes (${accountantTaxDocLimit}) de tu plan.`); return; }
                 if (isAtCreatedAcctDocLimit) { alert(`Tu cliente ha alcanzado el límite de comprobantes por contador creado (${clientCreatedAcctDocLimit}) de su plan.`); return; }
                 setShowInvoiceModal({ type: 'factura' }); // Or RH modal
               }}
                 className="py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-blue-700 transition shadow-lg flex items-center justify-center gap-2">
                 <ReceiptText className="w-4 h-4 text-white" /> RECIBO RH
               </button>
             )}
             <button onClick={() => { if (isAtClientTaxDocLimit) { alert(`Tu cliente ha alcanzado el límite de comprobantes (${clientTaxDocLimit}) de su plan.`); return; }

    if (isAtAccountantTaxDocLimit) {
      alert(`Has alcanzado tu límite de comprobantes (${accountantTaxDocLimit}) de tu plan.`);
      return;
    }
    if (isAtCreatedAcctDocLimit) {
      alert(`Tu cliente ha alcanzado el límite de comprobantes por contador creado (${clientCreatedAcctDocLimit}) de su plan.`);
      return;
    } setShowInvoiceModal({ type: 'factura' }); }}
               className="py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-800 transition shadow-lg flex items-center justify-center gap-2">
               <FileInput className="w-4 h-4 text-amber-400" /> FACTURA
             </button>
             <button onClick={() => { if (isAtClientTaxDocLimit) { alert(`Tu cliente ha alcanzado el límite de comprobantes (${clientTaxDocLimit}) de su plan.`); return; }

    if (isAtAccountantTaxDocLimit) {
      alert(`Has alcanzado tu límite de comprobantes (${accountantTaxDocLimit}) de tu plan.`);
      return;
    }
    if (isAtCreatedAcctDocLimit) {
      alert(`Tu cliente ha alcanzado el límite de comprobantes por contador creado (${clientCreatedAcctDocLimit}) de su plan.`);
      return;
    } setShowInvoiceModal({ type: 'boleta' }); }}
               className="py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-800 transition shadow-lg flex items-center justify-center gap-2">
               <FileInput className="w-4 h-4 text-amber-400" /> BOLETA
             </button>
             <button onClick={() => { if (isAtClientTaxDocLimit) { alert(`Tu cliente ha alcanzado el límite de comprobantes (${clientTaxDocLimit}) de su plan.`); return; }

    if (isAtAccountantTaxDocLimit) {
      alert(`Has alcanzado tu límite de comprobantes (${accountantTaxDocLimit}) de tu plan.`);
      return;
    }
    if (isAtCreatedAcctDocLimit) {
      alert(`Tu cliente ha alcanzado el límite de comprobantes por contador creado (${clientCreatedAcctDocLimit}) de su plan.`);
      return;
    } setShowNcModal(true); }}
               disabled={!hasCredentials}
               title={hasCredentials ? '' : 'Necesita credenciales SUNAT de la empresa'}
               className="py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-800 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
               <FileInput className="w-4 h-4 text-amber-400" /> NC
             </button>
             <button onClick={() => { if (isAtClientTaxDocLimit) { alert(`Tu cliente ha alcanzado el límite de comprobantes (${clientTaxDocLimit}) de su plan.`); return; }

    if (isAtAccountantTaxDocLimit) {
      alert(`Has alcanzado tu límite de comprobantes (${accountantTaxDocLimit}) de tu plan.`);
      return;
    }
    if (isAtCreatedAcctDocLimit) {
      alert(`Tu cliente ha alcanzado el límite de comprobantes por contador creado (${clientCreatedAcctDocLimit}) de su plan.`);
      return;
    } setShowNdModal(true); }}
               disabled={!hasCredentials}
               title={hasCredentials ? '' : 'Necesita credenciales SUNAT de la empresa'}
               className="py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-800 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
               <FileInput className="w-4 h-4 text-amber-400" /> ND
             </button>
           </div>
          )}

         {/* Pendientes de SUNAT */}
         {companyPendingInvoices.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-black text-xs uppercase text-red-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Pendientes / Fallidos</h4>
              <button onClick={retryAllPending}
                className="px-3 py-1.5 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-amber-700 transition flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Reintentar Todo
              </button>
            </div>
            <div className="space-y-2">
              {companyPendingInvoices.map(inv => (
                <div key={inv.id} className="p-3 bg-gray-50 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="font-black text-sm text-gray-800 uppercase">{inv.documentType === 'factura' ? 'FACTURA' : inv.documentType === 'boleta' ? 'BOLETA' : inv.documentType}</p>
                    <p className="text-xs text-gray-500 font-bold">{formatDocType(inv.documentType)} {inv.serie}-{typeof inv.correlative === 'number' ? String(inv.correlative).padStart(8, '0') : ''}</p>
                    {inv.lastError && <p className="text-[10px] text-red-600 truncate max-w-md">{inv.lastError}</p>}
                  </div>
                  <button onClick={() => retryPendingInvoice(inv)} disabled={retryingInvoice === inv.id || (inv.attemptCount || 0) >= getMaxRetryAttempts()}
                    className="px-3 py-1.5 bg-brand-700 text-white rounded-xl text-[10px] font-black uppercase hover:bg-brand-800 disabled:opacity-50 transition flex items-center gap-1">
                    {retryingInvoice === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Reintentar
                  </button>
                </div>
              ))}
            </div>
          </div>
         )}

         {/* Histórico de comprobantes de la empresa */}
         <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
           <div className="p-4 border-b flex justify-between items-center">
             <h4 className="font-black text-xs uppercase text-gray-500">Comprobantes de {clientCompany.name}</h4>
           </div>
           {clientDocs.length === 0 ? (
            <div className="py-16 text-center text-gray-400 italic">No hay comprobantes aún.</div>
           ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2 text-[10px] font-black uppercase text-gray-500">Documento</th>
                    <th className="px-4 py-2 text-[10px] font-black uppercase text-gray-500">Tipo</th>
                    <th className="px-4 py-2 text-[10px] font-black uppercase text-gray-500">Estado</th>
                    <th className="px-4 py-2 text-[10px] font-black uppercase text-gray-500">Monto</th>
                    <th className="px-4 py-2 text-[10px] font-black uppercase text-gray-500">Fecha</th>
                  </tr>
                </thead>
                 <tbody className="divide-y divide-gray-200">
                   {paginatedDocs.map(doc => (
                     <tr key={doc.id} onClick={() => setPreviewDoc(doc)} className="hover:bg-brand-50 cursor-pointer transition group">
                      <td className="px-4 py-2"><span className="font-black text-gray-800 text-xs uppercase">{doc.name}</span></td>
                      <td className="px-4 py-2 text-[11px] text-gray-500 font-bold">{formatDocType(doc.documentType)}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          doc.sunatStatus === 'SENT' || doc.sunatStatus === 'ACEPTADO' ? 'bg-green-100 text-green-700' : doc.sunatStatus === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>{doc.sunatStatus === 'SENT' || doc.sunatStatus === 'ACEPTADO' ? 'Aceptado' : doc.sunatStatus === 'REJECTED' ? 'Rechazado' : 'Pendiente'}</span>
                      </td>
                      <td className="px-4 py-2 text-[11px] font-black text-gray-700">{doc.metadata?.amount ? `S/ ${doc.metadata.amount.toFixed(2)}` : '—'}</td>
                      <td className="px-4 py-2 text-[11px] text-gray-500 font-mono">{doc.uploadDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
            {clientDocs.length > 1 && (
             <div className="p-4 border-t border-gray-200 flex items-center justify-between">
               <span className="text-[11px] text-gray-500">Página {docPage} de {docPageCount} · {clientDocs.length} comprobantes</span>
               <div className="flex items-center gap-1">
                 <button type="button" onClick={() => setDocPage(p => Math.max(1, p - 1))} disabled={docPage === 1}
                   className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-xl text-[10px] font-black uppercase hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition">Anterior</button>
                 <button type="button" onClick={() => setDocPage(p => Math.min(docPageCount, p + 1))} disabled={docPage === docPageCount}
                   className="px-3 py-1.5 bg-brand-700 text-white rounded-xl text-[10px] font-black uppercase hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed transition">Siguiente</button>
               </div>
             </div>
            )}
          </div>
      </div>
    );
   };

  // ─── Modal: Detalle de Gasto ───
  const renderExpenseModal = () => {
    if (!selectedExpense) return null;
    const exp = selectedExpense;
    const subtotal = exp.subtotal || (exp.amount / 1.18);
    const igv = exp.igv || (exp.amount - subtotal);
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={() => setSelectedExpense(null)}>
        <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="p-6 bg-brand-700 text-white flex justify-between items-center">
            <h3 className="font-black uppercase text-sm tracking-widest">Detalle del Gasto</h3>
            <button onClick={() => setSelectedExpense(null)} className="hover:rotate-90 transition"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between border-b border-gray-100 pb-2"><span className="text-[10px] font-black text-gray-400 uppercase">Fecha</span><span className="text-sm font-bold">{exp.date}</span></div>
              <div className="flex justify-between border-b border-gray-100 pb-2"><span className="text-[10px] font-black text-gray-400 uppercase">Comercio</span><span className="text-sm font-bold uppercase text-right max-w-[200px]">{exp.description}</span></div>
              <div className="flex justify-between border-b border-gray-100 pb-2"><span className="text-[10px] font-black text-gray-400 uppercase">Categoría</span><span className="text-sm font-bold">{exp.category}</span></div>
              {exp.ruc && <div className="flex justify-between border-b border-gray-100 pb-2"><span className="text-[10px] font-black text-gray-400 uppercase">RUC</span><span className="text-sm font-mono font-bold">{exp.ruc}</span></div>}
              {exp.invoiceNumber && <div className="flex justify-between border-b border-gray-100 pb-2"><span className="text-[10px] font-black text-gray-400 uppercase">Comprobante</span><span className="text-sm font-bold">{exp.invoiceNumber}</span></div>}
            </div>
            <div className="bg-gray-50 p-4 rounded-xl space-y-2">
              <div className="flex justify-between text-xs"><span className="text-gray-500">Subtotal</span><span className="font-bold">S/ {subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">IGV (18%)</span><span className="font-bold">S/ {igv.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-2 mt-2"><span className="font-black text-gray-800">Total</span><span className="font-black text-brand-700">S/ {exp.amount.toFixed(2)}</span></div>
            </div>
            {exp.isPrivate && (
              <div className="p-3 bg-amber-50 rounded-xl flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                <span className="text-[10px] font-black text-amber-700 uppercase">Gasto Privado — Solo visible para el cliente</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Modal: Crear Cliente ───
  const renderCreateClientModal = () => {
    if (!showCreateClientModal) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowCreateClientModal(false)}>
        <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="p-6 bg-brand-700 text-white flex justify-between items-center">
            <h3 className="font-black uppercase text-sm tracking-widest flex items-center"><UserPlus className="w-5 h-5 mr-2" /> Nuevo Cliente</h3>
            <button onClick={() => setShowCreateClientModal(false)} className="hover:rotate-90 transition"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleCreateClient} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">Nombre Completo</label>
                <input required value={newClientData.name} onChange={e => setNewClientData(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-gray-50 border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600" placeholder="Juan Pérez" />
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">Email</label>
                <input type="email" required value={newClientData.email} onChange={e => setNewClientData(p => ({ ...p, email: e.target.value }))}
                  className="w-full bg-gray-50 border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600" placeholder="cliente@email.com" />
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">RUC</label>
                <div className="relative">
                  <input value={newClientData.ruc} onChange={e => setNewClientData(p => ({ ...p, ruc: e.target.value }))}
                    className="w-full bg-gray-50 border-2 border-gray-200 p-3 pr-12 rounded-xl text-sm font-mono font-bold outline-none focus:border-brand-600" placeholder="20123456789" maxLength={11} />
                  <button type="button" onClick={handleSearchClientRuc} disabled={isSearchingRuc}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-brand-100 text-brand-700 rounded-lg hover:bg-brand-200 disabled:opacity-50 transition">
                    {isSearchingRuc ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">DNI</label>
                <input value={newClientData.dni} onChange={e => setNewClientData(p => ({ ...p, dni: e.target.value }))}
                  className="w-full bg-gray-50 border-2 border-gray-200 p-3 rounded-xl text-sm font-mono font-bold outline-none focus:border-brand-600" placeholder="12345678" maxLength={8} />
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">Razón Social</label>
                <input value={newClientData.businessName} onChange={e => setNewClientData(p => ({ ...p, businessName: e.target.value }))}
                  className="w-full bg-gray-50 border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600 uppercase" placeholder="EMPRESA S.A.C." />
              </div>
              <div className="col-span-2">
                <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">Dirección Fiscal</label>
                <input value={newClientData.taxAddress} onChange={e => setNewClientData(p => ({ ...p, taxAddress: e.target.value }))}
                  className="w-full bg-gray-50 border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600 uppercase" placeholder="Av. Principal 123" />
              </div>
            </div>
            <button type="submit" className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-700 transition shadow-lg">
              <UserPlus className="w-4 h-4 mr-2 inline" /> Crear Cliente
            </button>
          </form>
        </div>
      </div>
    );
  };

  // ─── Render principal según activeTab ───
  const renderContent = () => {
    if (selectedClientId) return renderClientDetail();
    return renderClientes();
  };

  const clientSubTabs = [
    { key: 'movimientos' as const, label: 'Movimientos', icon: ReceiptText },
    { key: 'reporte' as const, label: 'Reporte Mensual', icon: BarChart3 },
    { key: 'subir' as const, label: 'Subir Archivo', icon: Upload },
    { key: 'facturacion' as const, label: 'Facturación', icon: FileText },
  ];

  // ─── View: Detalle de Cliente (con sub-tabs internos) ───
  const renderClientDetail = () => {
    const client = users.find(u => u.id === selectedClientId);
    if (!client) return <div className="py-10 text-center text-gray-400">Cliente no encontrado</div>;
    const clientCompany = myCompanies.find(c => c.ownerUserId === client.id);

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Cabecera del cliente con botón volver */}
        <div className="flex items-center space-x-4">
          <button onClick={() => { setSelectedClientId(null); setClientView('movimientos'); }} className="p-2 hover:bg-gray-100 rounded-full transition">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{client.name}</h2>
            <p className="text-gray-500 text-sm">RUC: <span className="font-mono">{clientCompany?.ruc || 'No registrado'}</span> | {clientCompany?.businessName || 'Persona Natural'}</p>
          </div>
        </div>

        {/* Sub-tabs internos del cliente */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1 flex gap-1 overflow-x-auto">
          {clientSubTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = clientView === tab.key;
            return (
              <button key={tab.key} onClick={() => setClientView(tab.key)}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  isActive ? 'bg-brand-700 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'
                }`}>
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {clientView === 'movimientos' && renderMovimientos()}
        {clientView === 'reporte' && renderReporte()}
        {clientView === 'subir' && renderSubirArchivo()}
        {clientView === 'facturacion' && renderFacturacion()}

        {/* Wizards de emisión (factura/boleta + notas) */}
        {clientCompany && showInvoiceModal && (
          <InvoiceWizard
            key={showInvoiceModal.type}
            isOpen={true}
            onClose={() => setShowInvoiceModal(null)}
            initialType={showInvoiceModal.type}
            company={clientCompany}
            accountantId={currentUser?.id}
            defaultSendToSunat={true}
            onEmitted={handleAccountantInvoiceEmitted}
          />
        )}
        {clientCompany && showNcModal && (
          <NoteWizard
            isOpen={true}
            onClose={() => setShowNcModal(false)}
            initialType="nota_credito"
            company={clientCompany}
            accountantId={currentUser?.id}
            onEmitted={(doc) => handleAccountantInvoiceEmitted({
              id: doc.id, name: doc.name, sunatStatus: doc.sunatStatus || '',
              xmlContent: doc.xmlContent, cdrBase64: doc.cdrBase64,
              amount: doc.metadata?.amount, customerName: doc.metadata?.recipientName, customerRuc: doc.metadata?.recipientRuc,
              documentType: doc.documentType, originalDocumentId: doc.originalDocumentId
            })}
          />
        )}
        {clientCompany && showNdModal && (
          <NoteWizard
            isOpen={true}
            onClose={() => setShowNdModal(false)}
            initialType="nota_debito"
            company={clientCompany}
            accountantId={currentUser?.id}
            onEmitted={(doc) => handleAccountantInvoiceEmitted({
              id: doc.id, name: doc.name, sunatStatus: doc.sunatStatus || '',
              xmlContent: doc.xmlContent, cdrBase64: doc.cdrBase64,
              amount: doc.metadata?.amount, customerName: doc.metadata?.recipientName, customerRuc: doc.metadata?.recipientRuc,
              documentType: doc.documentType, originalDocumentId: doc.originalDocumentId
            })}
          />
        )}
      </div>
    );
  };

  const tabs = [
    { key: 'clientes' as const, label: 'Clientes', icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* SUSCRIPCIÓN */}
      {currentUser && (() => {
        const hasOwnSubscription = currentUser.subscriptionStatus === SubscriptionStatus.ACTIVE;
        const assignedCompanies = companies.filter(c => c.assignedAccountantId === currentUser.id);
        const ownerWithSub = assignedCompanies.find(c => {
          const owner = users.find(u => u.id === c.ownerUserId && u.role === UserRole.USER);
          return owner?.subscriptionStatus === SubscriptionStatus.ACTIVE;
        });
        const owner = ownerWithSub ? users.find(u => u.id === ownerWithSub.ownerUserId) : null;
        const hasInherited = !hasOwnSubscription && !!owner;

        return (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-brand-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-brand-50"><CalendarDays className="w-6 h-6 text-brand-600"/></div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Suscripción</p>
                <p className="text-sm font-black text-gray-900">
                  {hasOwnSubscription ? (
                    <>Activa hasta el {currentUser.subscriptionEndDate ? new Date(currentUser.subscriptionEndDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</>
                  ) : hasInherited ? (
                    <><span className="text-blue-600">Activa</span> <span className="text-[10px] text-gray-400">(vía cliente: {owner?.name})</span></>
                  ) : currentUser.parentId ? (
                    <span className="text-blue-600">Asignada por tu cliente</span>
                  ) : currentUser.subscriptionStatus === SubscriptionStatus.EXPIRED ? (
                    <span className="text-red-600">Vencida</span>
                  ) : (
                    <span className="text-amber-600">Pendiente de pago</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!currentUser.parentId && (
                <button onClick={() => setShowPayment(true)} className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-brand-700 transition shadow-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> {hasOwnSubscription ? 'Renovar' : 'Comprar Plan'}
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1 flex gap-1 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = !selectedClientId;
          return (
            <button key={tab.key} onClick={() => { setSelectedClientId(null); setClientView('movimientos'); }}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                isActive ? 'bg-brand-700 text-white shadow-md' : 'text-gray-400 hover:bg-gray-50'
              }`}>
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {renderContent()}
      {renderExpenseModal()}
      {renderCreateClientModal()}
      {renderDocPreviewModal()}

      {/* MODAL CREAR EMPRESA PARA CLIENTE */}
      {showCreateCompanyForClient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowCreateCompanyForClient(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 bg-brand-700 text-white flex justify-between items-center">
              <h3 className="font-black uppercase text-sm tracking-widest flex items-center"><Building className="w-5 h-5 mr-2" /> Crear Empresa</h3>
              <button onClick={() => setShowCreateCompanyForClient(null)} className="hover:rotate-90 transition"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateCompanyForClient} className="p-6 space-y-4">
              <div>
                <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">Nombre de la Empresa</label>
                <input required value={companyForClientForm.name} onChange={e => setCompanyForClientForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-gray-50 border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600" placeholder="Mi Empresa S.A.C." />
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">RUC</label>
                <input value={companyForClientForm.ruc} onChange={e => setCompanyForClientForm(p => ({ ...p, ruc: e.target.value }))}
                  className="w-full bg-gray-50 border-2 border-gray-200 p-3 rounded-xl text-sm font-mono font-bold outline-none focus:border-brand-600" placeholder="20123456789" maxLength={11} />
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">Razón Social</label>
                <input value={companyForClientForm.businessName} onChange={e => setCompanyForClientForm(p => ({ ...p, businessName: e.target.value }))}
                  className="w-full bg-gray-50 border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600 uppercase" placeholder="EMPRESA S.A.C." />
              </div>
              <div>
                <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">Dirección Fiscal</label>
                <input value={companyForClientForm.taxAddress} onChange={e => setCompanyForClientForm(p => ({ ...p, taxAddress: e.target.value }))}
                  className="w-full bg-gray-50 border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600 uppercase" placeholder="Av. Principal 123" />
              </div>
              <button type="submit" className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-700 transition shadow-lg">
                <Building className="w-4 h-4 mr-2 inline" /> Crear Empresa
              </button>
             </form>
          </div>
        </div>
      )}

      {showPayment && !currentUser.parentId && (
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

      {/* MODAL ÁRBOL DE DOCUMENTOS PARA EL CONTADOR */}
      <FileTreeModal
        isOpen={showFileTreeModal}
        onClose={() => setShowFileTreeModal(false)}
        documents={selectedClientId ? taxDocuments.filter(d => (d.userId === selectedClientId || (d.companyId && myCompanies.some(c => c.id === d.companyId && c.ownerUserId === selectedClientId))) && d.sunatStatus !== 'BORRADO') : taxDocuments.filter(d => d.sunatStatus !== 'BORRADO')}
        onAddDocument={(doc) => addTaxDocument(doc)}
        onPreviewDocument={(doc) => setPreviewDoc(doc)}
        companyId={selectedClientId ? (myCompanies.find(c => c.ownerUserId === selectedClientId)?.id || '') : ''}
        userId={selectedClientId || currentUser?.id || ''}
        accountantId={currentUser?.id || ''}
        allowDelete={false}
        userRole={currentUser?.role}
      />
    </div>
  );
};
