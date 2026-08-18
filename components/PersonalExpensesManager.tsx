import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { PersonalExpense, PersonalExpenseCategory } from '../types';
import { 
  Lock, Plus, Edit2, Trash2, Search, X, Calendar, DollarSign, Upload, Image as ImageIcon,
  ShoppingBag, Home, Building, HeartPulse, GraduationCap, Utensils, Car, Tag, Eye, PieChart, ShieldCheck
} from 'lucide-react';
import { fileToBase64, compressImageFile } from '../services/geminiService';
import { formatImageUrl } from '../utils/imageUtils';

interface PersonalExpensesManagerProps {
  userId: string;
}

const CONCEPT_CONFIG: Record<PersonalExpenseCategory, { label: string; icon: any; color: string; bg: string }> = {
  ALIMENTACION: { label: 'Alimentación / Supermercado', icon: ShoppingBag, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  SERVICIOS_HOGAR: { label: 'Servicios del Hogar (Luz/Agua)', icon: Home, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  VIVIENDA: { label: 'Vivienda / Alquiler / Mantenimiento', icon: Building, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  SALUD: { label: 'Salud / Farmacia / Seguros', icon: HeartPulse, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
  EDUCACION: { label: 'Educación / Colegios / Cursos', icon: GraduationCap, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  ENTRETENIMIENTO: { label: 'Entretenimiento / Restaurantes', icon: Utensils, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  TRANSPORTE: { label: 'Transporte / Combustible', icon: Car, color: 'text-cyan-600', bg: 'bg-cyan-50 border-cyan-200' },
  OTROS_PERSONALES: { label: 'Otros Gastos Personales', icon: Tag, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
};

export const PersonalExpensesManager: React.FC<PersonalExpensesManagerProps> = ({ userId }) => {
  const { personalExpenses, addPersonalExpense, updatePersonalExpense, deletePersonalExpense } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConcept, setSelectedConcept] = useState<string>('TODOS');
  
  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<PersonalExpense | null>(null);

  const [formData, setFormData] = useState({
    concept: 'ALIMENTACION' as PersonalExpenseCategory,
    description: '',
    amount: '',
    currency: 'PEN',
    date: new Date().toISOString().split('T')[0],
    merchantName: '',
    notes: '',
    voucherUrl: '',
  });

  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete & Image preview modals
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Filter user expenses
  const userExpenses = useMemo(() => {
    return personalExpenses.filter(e => e.userId === userId);
  }, [personalExpenses, userId]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return userExpenses.filter(expense => {
      const matchesSearch = expense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            expense.merchantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            expense.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            CONCEPT_CONFIG[expense.concept]?.label.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (selectedConcept !== 'TODOS' && expense.concept !== selectedConcept) {
        return false;
      }

      return true;
    });
  }, [userExpenses, searchQuery, selectedConcept]);

  // Metrics
  const stats = useMemo(() => {
    let totalPen = 0;
    let totalUsd = 0;
    const conceptTotals: Record<string, number> = {};

    userExpenses.forEach(exp => {
      if (exp.currency === 'USD') {
        totalUsd += exp.amount;
      } else {
        totalPen += exp.amount;
      }

      conceptTotals[exp.concept] = (conceptTotals[exp.concept] || 0) + exp.amount;
    });

    let topConceptKey = 'NINGUNO';
    let maxVal = 0;
    Object.entries(conceptTotals).forEach(([k, v]) => {
      if (v > maxVal) {
        maxVal = v;
        topConceptKey = k;
      }
    });

    const topConceptLabel = topConceptKey !== 'NINGUNO' ? (CONCEPT_CONFIG[topConceptKey as PersonalExpenseCategory]?.label || topConceptKey) : 'Sin gastos registrados';

    return { totalPen, totalUsd, count: userExpenses.length, topConceptLabel };
  }, [userExpenses]);

  // Handle File Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsCompressing(true);
      const b64 = await compressImageFile(file);
      setFormData(p => ({ ...p, voucherUrl: b64 }));
    } catch (err) {
      console.error('Error al cargar imagen:', err);
    } finally {
      setIsCompressing(false);
    }
  };

  // Open Create
  const handleOpenCreate = () => {
    setEditingExpense(null);
    setFormData({
      concept: 'ALIMENTACION',
      description: '',
      amount: '',
      currency: 'PEN',
      date: new Date().toISOString().split('T')[0],
      merchantName: '',
      notes: '',
      voucherUrl: '',
    });
    setShowFormModal(true);
  };

  // Open Edit
  const handleOpenEdit = (expense: PersonalExpense) => {
    setEditingExpense(expense);
    setFormData({
      concept: expense.concept,
      description: expense.description,
      amount: expense.amount.toString(),
      currency: expense.currency,
      date: expense.date,
      merchantName: expense.merchantName || '',
      notes: expense.notes || '',
      voucherUrl: expense.voucherUrl || '',
    });
    setShowFormModal(true);
  };

  // Submit Form
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim() || !formData.amount || parseFloat(formData.amount) <= 0) return;

    if (editingExpense) {
      updatePersonalExpense(editingExpense.id, {
        concept: formData.concept,
        description: formData.description.trim(),
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        date: formData.date,
        merchantName: formData.merchantName.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        voucherUrl: formData.voucherUrl || undefined,
      });
    } else {
      const newExpense: PersonalExpense = {
        id: `pexp-${Date.now()}`,
        userId,
        concept: formData.concept,
        description: formData.description.trim(),
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        date: formData.date,
        merchantName: formData.merchantName.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        voucherUrl: formData.voucherUrl || undefined,
        createdAt: new Date().toISOString(),
      };
      addPersonalExpense(newExpense);
    }

    setShowFormModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border-2 border-brand-100 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">Mis Gastos Personales</h2>
              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-600" /> 100% Privado
              </span>
            </div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
              Control financiero personal (No deducibles de la empresa ni compartidos con el contador)
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" /> Registrar Gasto Personal
        </button>
      </div>

      {/* Security Privacy Info Banner */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-xs font-bold opacity-90">
            Tus gastos personales están protegidos. No afectan la contabilidad ni las declaraciones fiscales SUNAT de tu empresa.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Total Mes (Soles)</span>
          <p className="text-xl font-black text-gray-900 mt-2">S/ {stats.totalPen.toFixed(2)}</p>
          <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Presupuesto en S/</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Total Mes (Dólares)</span>
          <p className="text-xl font-black text-gray-900 mt-2">$ {stats.totalUsd.toFixed(2)}</p>
          <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Presupuesto en USD</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-purple-100 bg-purple-50/20 shadow-xs">
          <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest block">Mayor Concepto</span>
          <p className="text-xs font-black text-purple-900 truncate mt-2 uppercase">{stats.topConceptLabel}</p>
          <p className="text-[9px] font-bold text-purple-400 uppercase mt-1">Categoría dominante</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Registros Totales</span>
          <p className="text-xl font-black text-gray-900 mt-2">{stats.count}</p>
          <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Comprobantes guardados</p>
        </div>
      </div>

      {/* Controls: Search & Category Filter */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por descripción o negocio..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 pl-10 pr-4 py-2 rounded-xl text-xs font-medium focus:border-brand-500 outline-none"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setSelectedConcept('TODOS')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap ${
              selectedConcept === 'TODOS'
                ? 'bg-white text-brand-600 shadow-xs border border-gray-200'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Todos
          </button>
          {Object.keys(CONCEPT_CONFIG).map(catKey => (
            <button
              key={catKey}
              onClick={() => setSelectedConcept(catKey)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap ${
                selectedConcept === catKey
                  ? 'bg-white text-brand-600 shadow-xs border border-gray-200'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {CONCEPT_CONFIG[catKey as PersonalExpenseCategory]?.label.split('/')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses Grid */}
      {filteredExpenses.length === 0 ? (
        <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center mx-auto mb-3">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">No hay gastos personales registrados</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto font-medium">
            Lleva el control de tus compras en el supermercado, salud, transporte o recibos del hogar sin mezclarlo con tu empresa.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 px-4 py-2.5 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-xl text-xs font-black uppercase tracking-wider transition inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Registrar primer gasto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExpenses.map(expense => {
            const cat = CONCEPT_CONFIG[expense.concept] || CONCEPT_CONFIG.OTROS_PERSONALES;
            const Icon = cat.icon;

            return (
              <div key={expense.id} className="bg-white rounded-3xl border-2 border-gray-100 p-5 flex flex-col justify-between shadow-xs transition-all hover:shadow-md">
                <div>
                  {/* Category Header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className={`p-2.5 rounded-2xl border ${cat.bg} ${cat.color} flex items-center gap-2`}>
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-wider">{cat.label}</span>
                    </div>

                    {expense.voucherUrl && (
                      <button
                        onClick={() => setPreviewImageUrl(expense.voucherUrl || null)}
                        className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition flex items-center gap-1 text-[9px] font-bold"
                        title="Ver Comprobante"
                      >
                        <Eye className="w-3.5 h-3.5" /> Recibo
                      </button>
                    )}
                  </div>

                  {/* Description & Merchant */}
                  <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight line-clamp-1">{expense.description}</h4>
                  {expense.merchantName && (
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                      {expense.merchantName}
                    </p>
                  )}

                  {/* Amount & Date */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase block">Monto Gasto</span>
                      <span className="text-lg font-black text-gray-900">{expense.currency === 'USD' ? '$' : 'S/'} {expense.amount.toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-gray-400 uppercase block">Fecha</span>
                      <span className="text-[10px] font-black text-gray-700">{expense.date}</span>
                    </div>
                  </div>

                  {expense.notes && (
                    <p className="text-[10px] text-gray-500 italic line-clamp-2 mt-2 bg-gray-50/60 p-2 rounded-xl">
                      "{expense.notes}"
                    </p>
                  )}
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleOpenEdit(expense)}
                    className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition"
                    title="Editar gasto"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeletingId(expense.id)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                    title="Eliminar gasto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl space-y-6 relative border-2 border-brand-100 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowFormModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">
                  {editingExpense ? 'Editar Gasto Personal' : 'Registrar Gasto Personal'}
                </h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                  Gastos privados (Supermercado, recibos del hogar, salud, etc.)
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                  Concepto / Categoría *
                </label>
                <select
                  value={formData.concept}
                  onChange={e => setFormData(p => ({ ...p, concept: e.target.value as PersonalExpenseCategory }))}
                  className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 focus:border-brand-500 outline-none"
                >
                  {Object.entries(CONCEPT_CONFIG).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                  Descripción del Gasto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Compras del mes Supermercado Wong"
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 focus:border-brand-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                    Monto *
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.currency}
                      onChange={e => setFormData(p => ({ ...p, currency: e.target.value }))}
                      className="bg-gray-50 border-2 border-gray-100 p-3 rounded-2xl text-xs font-black text-gray-900 outline-none"
                    >
                      <option value="PEN">S/</option>
                      <option value="USD">$</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="250.00"
                      value={formData.amount}
                      onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                      className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 focus:border-brand-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                    Fecha del Gasto *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
                    className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 focus:border-brand-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                  Establecimiento / Comercio (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Wong, Inkafarma, Enel, Movistar..."
                  value={formData.merchantName}
                  onChange={e => setFormData(p => ({ ...p, merchantName: e.target.value }))}
                  className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 focus:border-brand-500 outline-none"
                />
              </div>

              {/* Voucher Image Upload */}
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                  Foto / Comprobante del Gasto (Opcional)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {formData.voucherUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-gray-200 h-32 bg-gray-100 group">
                    <img src={formatImageUrl(formData.voucherUrl)} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-white text-gray-900 rounded-xl text-[10px] font-black uppercase"
                      >
                        Cambiar
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, voucherUrl: '' }))}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCompressing}
                    className="w-full p-4 border-2 border-dashed border-gray-300 rounded-2xl text-center hover:border-brand-500 transition bg-gray-50 hover:bg-white"
                  >
                    <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                    <span className="text-xs font-bold text-gray-600 block">
                      {isCompressing ? 'Procesando imagen...' : 'Subir foto de boleta, recibo o voucher'}
                    </span>
                  </button>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                  Notas Privadas (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles o comentarios personales..."
                  value={formData.notes}
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                  className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-medium text-gray-900 focus:border-brand-500 outline-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-5 py-3 text-xs font-black uppercase text-gray-500 hover:bg-gray-100 rounded-2xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition shadow-md"
                >
                  {editingExpense ? 'Guardar Cambios' : 'Registrar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW IMAGE MODAL */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fade-in">
          <div className="relative max-w-3xl w-full max-h-[85vh] bg-white rounded-3xl overflow-hidden p-2 shadow-2xl flex flex-col">
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-4 right-4 z-10 bg-black/60 text-white p-2 rounded-full hover:bg-black transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={formatImageUrl(previewImageUrl)} className="w-full h-full object-contain rounded-2xl" />
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-5 border-2 border-red-100 shadow-2xl">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">¿Eliminar este Gasto Personal?</h3>
              <p className="text-xs text-gray-400 mt-1">Esta acción no se puede deshacer.</p>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2.5 text-xs font-black uppercase text-gray-500 hover:bg-gray-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  deletePersonalExpense(deletingId);
                  setDeletingId(null);
                }}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-md"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
