import React, { useState, useRef, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { UserRole, Expense, TaxDocument, SubscriptionStatus } from '../types';
import { buildPdtCsv } from '../utils/pdtFormatter';
import {
  User as UserIcon, Users, ArrowLeft, ImageIcon, X, ShieldCheck, FileText,
  Tag, Clock, Hash, DollarSign, Lock, Upload, Trash2, FileUp, PlusCircle,
  Calendar, UserPlus, Building, MapPin, CreditCard, Download, FileSpreadsheet,
  Eye, Search, Loader2, AlertTriangle, CheckCircle2, BarChart3, ReceiptText,
  TrendingUp, TrendingDown, Printer, Filter
} from 'lucide-react';

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
const YEARS = [2023, 2024, 2025, 2026, 2027];

export const AccountantDashboard: React.FC = () => {
  const { users, currentUser, expenses, taxDocuments, addTaxDocument, deleteTaxDocument, registerUser, generatePassword } = useStore();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'clientes' | 'reporte' | 'pdt' | 'subir'>('clientes');
  const [searchClient, setSearchClient] = useState('');

  // Filtros mes/año para movimientos
  const [movFilterMonth, setMovFilterMonth] = useState(MONTHS[new Date().getMonth()]);
  const [movFilterYear, setMovFilterYear] = useState(new Date().getFullYear());

  // Reporte Mensual state
  const [repClientId, setRepClientId] = useState<string>('');
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
  const [generatedPassword, setGeneratedPassword] = useState('');

  // Document Upload State
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadClientId, setUploadClientId] = useState('');
  const [docName, setDocName] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const myClients = useMemo(() =>
    users.filter(u => u.role === UserRole.USER && u.assignedAccountantId === currentUser?.id),
    [users, currentUser]
  );

  const filteredClients = useMemo(() => {
    if (!searchClient) return myClients;
    const q = searchClient.toLowerCase();
    return myClients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.ruc && c.ruc.includes(q)) ||
      (c.businessName && c.businessName.toLowerCase().includes(q))
    );
  }, [myClients, searchClient]);

  // ─── Clientes: obtener resumen del mes actual ───
  const getClientMonthStats = (clientId: string) => {
    const now = new Date();
    const monthExpenses = expenses.filter(e =>
      e.userId === clientId && !e.isPrivate &&
      e.date.startsWith(now.toISOString().slice(0, 7))
    );
    const docs = taxDocuments.filter(d =>
      d.userId === clientId &&
      d.uploadDate?.startsWith(now.toISOString().slice(0, 7))
    );
    return {
      totalGastos: monthExpenses.reduce((s, e) => s + e.amount, 0),
      cantDocs: docs.length,
      cantGastos: monthExpenses.length,
      ultimoMovimiento: monthExpenses.length > 0
        ? monthExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
        : null
    };
  };

  // ─── Handle Create Client ───
  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const pwd = generatedPassword || generatePassword();
    const newUser = {
      id: Date.now().toString(),
      name: newClientData.name,
      email: newClientData.email,
      role: UserRole.USER,
      password: pwd,
      mustChangePassword: true,
      subscriptionStatus: SubscriptionStatus.PENDING,
      assignedAccountantId: currentUser.id,
      ruc: newClientData.ruc,
      dni: newClientData.dni,
      businessName: newClientData.businessName,
      taxAddress: newClientData.taxAddress
    };
    registerUser(newUser);
    fetch('http://localhost:5555/api/send-welcome-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newUser.email, name: newUser.name, password: pwd })
    }).catch(() => {});
    setNewClientData({ name: '', email: '', ruc: '', dni: '', businessName: '', taxAddress: '' });
    setGeneratedPassword('');
    setShowCreateClientModal(false);
  };

  // ─── Handle Doc Upload ───
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && currentUser) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const newDoc: TaxDocument = {
          id: Date.now().toString(),
          userId: uploadClientId || selectedClientId || '',
          accountantId: currentUser.id,
          name: docName || file.name,
          fileUrl: base64,
          mimeType: file.type,
          uploadDate: new Date().toISOString().split('T')[0],
          periodMonth: selectedMonth,
          periodYear: selectedYear
        };
        addTaxDocument(newDoc);
        setDocName('');
        setPreviewFile(null);
        setIsUploadingDoc(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => setPreviewFile(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setPreviewFile(null);
      }
      // Store file for later upload
      const dt = new DataTransfer();
      dt.items.add(file);
      if (docInputRef.current) docInputRef.current.files = dt.files;
    }
  };

  // ─── Export helpers ───
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
        <button onClick={() => { setGeneratedPassword(generatePassword()); setShowCreateClientModal(true); }}
          className="bg-brand-600 text-white px-5 py-3 rounded-xl hover:bg-brand-700 transition flex items-center font-bold text-sm shadow-lg shadow-brand-100">
          <UserPlus className="w-4 h-4 mr-2" /> Nuevo Cliente
        </button>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Buscar por nombre o RUC..." value={searchClient}
          onChange={e => setSearchClient(e.target.value)}
          className="w-full bg-white border-2 border-gray-200 p-3.5 pl-12 rounded-xl text-sm font-bold outline-none focus:border-brand-600" />
      </div>
      {filteredClients.length === 0 ? (
        <div className="py-20 text-center text-gray-400">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="font-black uppercase text-sm">No hay clientes asignados</p>
          <p className="text-xs mt-1">Crea un nuevo cliente con el botón superior</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredClients.map(client => {
            const stats = getClientMonthStats(client.id);
            return (
              <div key={client.id} onClick={() => { setSelectedClientId(client.id); setActiveTab('clientes'); }}
                className="bg-white rounded-2xl border-2 border-gray-100 p-5 hover:border-brand-400 hover:shadow-lg transition-all cursor-pointer group">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-brand-50 rounded-xl group-hover:bg-brand-100 transition">
                    <UserIcon className="w-6 h-6 text-brand-600" />
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${client.subscriptionStatus === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {client.subscriptionStatus === 'ACTIVE' ? 'Activo' : 'Pendiente'}
                  </span>
                </div>
                <h3 className="font-black text-gray-900 text-sm uppercase truncate">{client.name}</h3>
                {client.businessName && <p className="text-[10px] text-gray-500 font-bold truncate">{client.businessName}</p>}
                <p className="text-[10px] text-gray-400 font-mono mt-1">RUC: {client.ruc || '—'}</p>
                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-lg font-black text-brand-600">S/ {stats.totalGastos.toFixed(2)}</p>
                    <p className="text-[8px] text-gray-400 font-black uppercase">Gastos Mes</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-gray-700">{stats.cantDocs}</p>
                    <p className="text-[8px] text-gray-400 font-black uppercase">Documentos</p>
                  </div>
                </div>
                {stats.ultimoMovimiento && (
                  <p className="text-[8px] text-gray-400 mt-3 text-center">Último: {stats.ultimoMovimiento}</p>
                )}
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
      .filter(e => e.userId === selectedClientId && !e.isPrivate &&
        e.date.startsWith(`${movFilterYear}-${String(MONTHS.indexOf(movFilterMonth) + 1).padStart(2, '0')}`))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const clientDocs = taxDocuments
      .filter(d => d.userId === selectedClientId)
      .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());

    const totals = filteredExpenses.reduce((acc, exp) => {
      const sub = exp.subtotal || (exp.amount / 1.18);
      const igv = exp.igv || (exp.amount - sub);
      return { subtotal: acc.subtotal + sub, igv: acc.igv + igv, total: acc.total + exp.amount };
    }, { subtotal: 0, igv: 0, total: 0 });

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <button onClick={() => setSelectedClientId(null)} className="p-2 hover:bg-gray-100 rounded-full transition">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{client.name}</h2>
              <p className="text-gray-500 text-sm">RUC: <span className="font-mono">{client.ruc || 'No registrado'}</span> | {client.businessName || 'Persona Natural'}</p>
            </div>
          </div>
          <button onClick={() => exportToExcel(client.name, filteredExpenses)}
            className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition flex items-center font-bold text-sm shadow-lg shadow-green-100">
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Excel
          </button>
        </div>

        {/* Filtros mes/año */}
        <div className="flex gap-3 items-center">
          <Filter className="w-4 h-4 text-gray-400" />
          <select className="bg-white border-2 border-gray-200 p-2 rounded-lg text-xs font-bold outline-none"
            value={movFilterMonth} onChange={e => setMovFilterMonth(e.target.value)}>
            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="bg-white border-2 border-gray-200 p-2 rounded-lg text-xs font-bold outline-none"
            value={movFilterYear} onChange={e => setMovFilterYear(Number(e.target.value))}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
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

            {/* Documentos Tributarios */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="font-black text-gray-700 flex items-center text-xs uppercase tracking-widest">
                  <FileText className="w-4 h-4 mr-2 text-blue-600" />
                  Documentos Tributarios ({clientDocs.length})
                </h3>
              </div>
              {clientDocs.length === 0 ? (
                <div className="py-8 text-center text-gray-400 italic text-sm">Sin documentos registrados.</div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {clientDocs.map(doc => (
                    <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <ReceiptText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 uppercase">{doc.name}</p>
                          <p className="text-[9px] text-gray-400">{doc.periodMonth} {doc.periodYear} · {doc.uploadDate}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.sunatStatus && (
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${doc.sunatStatus === 'ACEPTADO' || doc.sunatStatus === 'SENT' ? 'bg-green-100 text-green-700' : doc.sunatStatus === 'INTERNO' ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {doc.sunatStatus}
                          </span>
                        )}
                        <button onClick={() => deleteTaxDocument(doc.id)}
                          className="p-1 text-red-400 hover:text-red-600 transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Panel totales */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 h-fit space-y-4">
            <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Totales del Período</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-xs text-gray-500 font-bold">Subtotal</span>
                <span className="text-sm font-black text-gray-800">S/ {totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-xs text-gray-500 font-bold">IGV (18%)</span>
                <span className="text-sm font-black text-gray-800">S/ {totals.igv.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-sm font-black text-gray-800">Total</span>
                <span className="text-lg font-black text-brand-600">S/ {totals.total.toFixed(2)}</span>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-100">
              <p className="text-[9px] text-gray-400 font-bold uppercase">Cantidad Gastos</p>
              <p className="text-xl font-black text-gray-800">{filteredExpenses.length}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── View: Reporte Mensual ───
  const renderReporte = () => {
    const expensesByClient = repClientId
      ? expenses.filter(e => e.userId === repClientId && !e.isPrivate &&
          e.date.startsWith(`${repYear}-${String(MONTHS.indexOf(repMonth) + 1).padStart(2, '0')}`))
      : [];

    const incomeDocs = repClientId
      ? taxDocuments.filter(d => d.userId === repClientId &&
          d.uploadDate?.startsWith(`${repYear}-${String(MONTHS.indexOf(repMonth) + 1).padStart(2, '0')}`))
      : [];

    const totalGastos = expensesByClient.reduce((s, e) => s + e.amount, 0);
    const totalIngresos = incomeDocs.reduce((s, d) => {
      const monto = d.metadata?.amount || 0;
      return s + monto;
    }, 0);

    const byCategory = expensesByClient.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {});

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-black text-gray-800">Reporte Mensual</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Cliente</label>
            <select className="bg-white border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none min-w-[200px]"
              value={repClientId} onChange={e => setRepClientId(e.target.value)}>
              <option value="">Seleccionar cliente</option>
              {myClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Mes</label>
            <select className="bg-white border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none"
              value={repMonth} onChange={e => setRepMonth(e.target.value)}>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Año</label>
            <select className="bg-white border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none"
              value={repYear} onChange={e => setRepYear(Number(e.target.value))}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {!repClientId ? (
          <div className="py-20 text-center text-gray-400">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="font-black uppercase text-sm">Selecciona un cliente</p>
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
                  {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, monto]) => (
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
                      <span className="font-black">S/ {(d.metadata?.amount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botones de exportación */}
            <div className="lg:col-span-2 flex gap-3">
              <button onClick={() => downloadPdfReport(
                myClients.find(c => c.id === repClientId)?.name || '',
                repMonth, repYear, expensesByClient, totalGastos
              )}
                className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-black text-xs uppercase hover:bg-brand-700 transition flex items-center justify-center shadow-lg">
                <Printer className="w-4 h-4 mr-2" /> Reporte PDF
              </button>
              <button onClick={() => exportToExcel(myClients.find(c => c.id === repClientId)?.name || '', expensesByClient)}
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
      ? taxDocuments.filter(d => d.userId === pdtClientId &&
          d.uploadDate?.startsWith(yearMonth))
      : [];

    const totalCompras = compras.reduce((s, e) => s + e.amount, 0);
    const totalVentas = ventas.reduce((s, d) => s + (d.metadata?.amount || 0), 0);
    const igvCompras = compras.reduce((s, e) => s + (e.igv || (e.amount - (e.subtotal || e.amount / 1.18))), 0);
    const igvVentas = totalVentas - (totalVentas / 1.18);
    const igvPagar = igvVentas - igvCompras;

    const handleExportPdt = () => {
      const clientName = myClients.find(c => c.id === pdtClientId)?.name || 'cliente';
      const incomeRows = ventas.map(d => ({
        name: d.name, amount: d.metadata?.amount || 0,
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
                        const monto = d.metadata?.amount || 0;
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
    const targetClientId = uploadClientId || selectedClientId;
    const client = users.find(u => u.id === targetClientId);

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-2xl font-black text-gray-800">Subir Documento Tributario</h2>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
          {!targetClientId && (
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Cliente</label>
              <select className="w-full bg-white border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600"
                value={uploadClientId} onChange={e => setUploadClientId(e.target.value)}>
                <option value="">Seleccionar cliente</option>
                {myClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {client && (
            <div className="p-3 bg-brand-50 rounded-xl flex items-center gap-3">
              <UserIcon className="w-5 h-5 text-brand-600" />
              <span className="text-sm font-black text-brand-800 uppercase">{client.name}</span>
            </div>
          )}
          <div>
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Nombre del Documento</label>
            <input type="text" placeholder="Ej: Factura F001-00000001" value={docName}
              onChange={e => setDocName(e.target.value)}
              className="w-full bg-white border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600" />
          </div>
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
            <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Archivo (PDF, XML, imagen)</label>
            <div onClick={() => docInputRef.current?.click()}
              className="border-4 border-dashed border-gray-200 rounded-2xl p-10 text-center cursor-pointer hover:border-brand-400 transition">
              {previewFile ? (
                <div className="space-y-3">
                  <img src={previewFile} className="max-h-40 mx-auto rounded-xl shadow-sm" alt="Preview" />
                  <p className="text-xs text-gray-500 font-bold">Click para cambiar archivo</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="w-12 h-12 text-gray-300 mx-auto" />
                  <p className="text-sm font-black text-gray-500">Click para seleccionar archivo</p>
                  <p className="text-[10px] text-gray-400">PDF, XML, JPG, PNG</p>
                </div>
              )}
              <input type="file" ref={docInputRef} className="hidden"
                accept=".pdf,.xml,.jpg,.jpeg,.png" onChange={handleFileSelect} />
            </div>
          </div>
          <button onClick={() => {
            if (!targetClientId) return alert('Selecciona un cliente');
            if (!docInputRef.current?.files?.length) return alert('Selecciona un archivo');
            setIsUploadingDoc(true);
            handleDocUpload({ target: { files: docInputRef.current.files } } as any);
          }} disabled={!targetClientId || isUploadingDoc}
            className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-700 transition flex items-center justify-center disabled:opacity-50 shadow-lg">
            {isUploadingDoc ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Subiendo...</> : <><Upload className="w-4 h-4 mr-2" /> Subir Documento</>}
          </button>
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
                <input value={newClientData.ruc} onChange={e => setNewClientData(p => ({ ...p, ruc: e.target.value }))}
                  className="w-full bg-gray-50 border-2 border-gray-200 p-3 rounded-xl text-sm font-mono font-bold outline-none focus:border-brand-600" placeholder="20123456789" maxLength={11} />
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
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase mb-1 block">Contraseña Generada</label>
              <input type="password" readOnly value={generatedPassword} className="w-full bg-gray-50 border-2 border-gray-200 p-3 rounded-xl text-sm font-mono text-gray-500 cursor-not-allowed outline-none" placeholder="Se generará automáticamente" />
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
    switch (activeTab) {
      case 'reporte': return renderReporte();
      case 'pdt': return renderPdt();
      case 'subir': return renderSubirArchivo();
      default: return selectedClientId ? renderMovimientos() : renderClientes();
    }
  };

  const tabs = [
    { key: 'clientes' as const, label: 'Clientes', icon: Users },
    { key: 'reporte' as const, label: 'Reporte Mensual', icon: BarChart3 },
    { key: 'pdt' as const, label: 'PDT 621', icon: FileText },
    { key: 'subir' as const, label: 'Subir Archivo', icon: Upload },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1 flex gap-1 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = (tab.key === 'clientes' && activeTab === 'clientes' && !selectedClientId) ||
            (tab.key === 'clientes' && activeTab === 'clientes' && selectedClientId) ||
            (tab.key === activeTab);
          return (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); if (tab.key !== 'clientes') setSelectedClientId(null); }}
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
    </div>
  );
};
