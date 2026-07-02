
import React, { useState, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { UserRole, Expense, TaxDocument, SubscriptionStatus } from '../types';
import { User as UserIcon, Users, ArrowLeft, ImageIcon, X, ShieldCheck, FileText, Tag, Clock, Hash, DollarSign, Lock, Upload, Trash2, FileUp, PlusCircle, Calendar, UserPlus, Building, MapPin, CreditCard, Download, FileSpreadsheet, Eye } from 'lucide-react';

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const YEARS = [2023, 2024, 2025, 2026];

export const AccountantDashboard: React.FC = () => {
  const { users, currentUser, expenses, taxDocuments, addTaxDocument, deleteTaxDocument, registerUser } = useStore();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  
  // New Client Form State
  const [newClientData, setNewClientData] = useState({
    name: '',
    email: '',
    ruc: '',
    dni: '',
    businessName: '',
    taxAddress: ''
  });

  // Document Upload State
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docName, setDocName] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const docInputRef = useRef<HTMLInputElement>(null);

  const myClients = users.filter(u => u.role === UserRole.USER && u.assignedAccountantId === currentUser?.id);

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    registerUser({
      id: Date.now().toString(),
      name: newClientData.name,
      email: newClientData.email,
      role: UserRole.USER,
      password: '123',
      subscriptionStatus: SubscriptionStatus.PENDING,
      assignedAccountantId: currentUser.id,
      ruc: newClientData.ruc,
      dni: newClientData.dni,
      businessName: newClientData.businessName,
      taxAddress: newClientData.taxAddress
    });

    setNewClientData({ name: '', email: '', ruc: '', dni: '', businessName: '', taxAddress: '' });
    setShowCreateClientModal(false);
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && selectedClientId && currentUser) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        const newDoc: TaxDocument = {
          id: Date.now().toString(),
          userId: selectedClientId,
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
        setIsUploadingDoc(false);
      };
      reader.readAsDataURL(file);
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

  if (selectedClientId) {
    const client = users.find(u => u.id === selectedClientId);
    // FILTRO CRÍTICO: El contador solo ve gastos que NO son privados
    const clientExpenses = expenses
      .filter(e => e.userId === selectedClientId && !e.isPrivate)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const clientDocs = taxDocuments.filter(d => d.userId === selectedClientId);

    if (!client) return <div>Cliente no encontrado</div>;

    const totals = clientExpenses.reduce((acc, exp) => {
      const sub = exp.subtotal || (exp.amount / 1.18);
      const igv = exp.igv || (exp.amount - sub);
      return {
        subtotal: acc.subtotal + sub,
        igv: acc.igv + igv,
        total: acc.total + exp.amount
      };
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
          <button 
            onClick={() => exportToExcel(client.name, clientExpenses)}
            className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition flex items-center font-bold text-sm shadow-lg shadow-green-100"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar a Excel
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                 <h3 className="font-black text-gray-700 flex items-center text-xs uppercase tracking-widest">
                   <ShieldCheck className="w-4 h-4 mr-2 text-brand-600" /> 
                   Registro de Compras Declarables
                 </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200">
                      <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-500 border-r">Fecha</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-500 border-r">Emisor</th>
                      <th className="px-4 py-3 text-[10px] font-black uppercase text-gray-500 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {clientExpenses.map(exp => (
                      <tr key={exp.id} onClick={() => setSelectedExpense(exp)} className="hover:bg-brand-50 transition cursor-pointer group">
                        <td className="px-4 py-3 text-xs font-mono border-r">{exp.date}</td>
                        <td className="px-4 py-3 border-r text-xs font-bold uppercase">{exp.description}</td>
                        <td className="px-4 py-3 text-sm font-black text-brand-700 text-right">S/ {exp.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {clientExpenses.length === 0 && (
                <div className="py-12 text-center text-gray-400 italic text-sm">
                  No hay gastos declarables.
                </div>
              )}
            </div>
          </div>
          {/* Resto del dashboard... */}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Listado de clientes... */}
    </div>
  );
};
