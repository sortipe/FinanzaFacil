import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { PaymentAlert, PaymentAlertCategory, PaymentAlertFrequency, PaymentAlertStatus } from '../types';
import { 
  Bell, BellRing, Plus, Edit2, Trash2, CheckCircle2, Clock, AlertTriangle, 
  Zap, Droplets, Wifi, Landmark, Home, CreditCard, FileText, Search, X, Calendar, DollarSign
} from 'lucide-react';

interface PaymentAlertsManagerProps {
  userId: string;
  companyId?: string | null;
}

const CATEGORY_CONFIG: Record<PaymentAlertCategory, { label: string; icon: any; color: string; bg: string }> = {
  LUZ: { label: 'Luz / Energía', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  AGUA: { label: 'Agua / Alcantarillado', icon: Droplets, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  INTERNET: { label: 'Internet / Teléfono', icon: Wifi, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  PRESTAMO: { label: 'Préstamo Bancario', icon: Landmark, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  ALQUILER: { label: 'Alquiler de Local / Vivienda', icon: Home, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  TARJETA: { label: 'Tarjeta de Crédito', icon: CreditCard, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
  IMPUESTOS: { label: 'Impuestos / Arbitrios', icon: FileText, color: 'text-cyan-600', bg: 'bg-cyan-50 border-cyan-200' },
  OTRO: { label: 'Otro Pago Recurrente', icon: Bell, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
};

const FREQUENCY_LABELS: Record<PaymentAlertFrequency, string> = {
  MENSUAL: 'Mensual',
  QUINCENAL: 'Quincenal',
  ANUAL: 'Anual',
  UNICO: 'Único',
};

export const PaymentAlertsManager: React.FC<PaymentAlertsManagerProps> = ({ userId, companyId }) => {
  const { paymentAlerts, addPaymentAlert, updatePaymentAlert, deletePaymentAlert, markPaymentAlertPaid } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'TODAS' | 'PENDIENTES' | 'PROXIMAS' | 'VENCIDAS' | 'PAGADAS'>('TODAS');
  
  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState<PaymentAlert | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    category: 'LUZ' as PaymentAlertCategory,
    amount: '',
    currency: 'PEN',
    dueDate: new Date().toISOString().split('T')[0],
    frequency: 'MENSUAL' as PaymentAlertFrequency,
    reminderDaysBefore: '3',
    notes: '',
  });

  // Mark as paid modal
  const [payingAlert, setPayingAlert] = useState<PaymentAlert | null>(null);
  const [recordAsExpense, setRecordAsExpense] = useState(true);

  // Delete modal
  const [deletingAlertId, setDeletingAlertId] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  // User/Company filtered alerts
  const userAlerts = useMemo(() => {
    return paymentAlerts.filter(a => a.userId === userId && (!companyId || !a.companyId || a.companyId === companyId));
  }, [paymentAlerts, userId, companyId]);

  // Alert statuses calculation helper
  const getAlertComputedStatus = (alert: PaymentAlert) => {
    if (alert.status === 'PAGADO') return 'PAGADO';
    if (alert.dueDate < today) return 'VENCIDO';
    return 'PENDIENTE';
  };

  // Helper for days remaining
  const getDaysRemaining = (dueDate: string) => {
    const diffTime = new Date(dueDate).getTime() - new Date(today).getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Filtered list
  const filteredAlerts = useMemo(() => {
    return userAlerts.filter(alert => {
      const matchesSearch = alert.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            alert.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            CATEGORY_CONFIG[alert.category]?.label.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      const computedStatus = getAlertComputedStatus(alert);
      const days = getDaysRemaining(alert.dueDate);

      if (activeFilter === 'PENDIENTES') return computedStatus === 'PENDIENTE';
      if (activeFilter === 'VENCIDAS') return computedStatus === 'VENCIDO';
      if (activeFilter === 'PROXIMAS') return computedStatus === 'PENDIENTE' && days >= 0 && days <= 7;
      if (activeFilter === 'PAGADAS') return computedStatus === 'PAGADO';

      return true;
    });
  }, [userAlerts, searchQuery, activeFilter, today]);

  // Statistics
  const stats = useMemo(() => {
    let overdueCount = 0;
    let upcomingCount = 0;
    let paidCount = 0;
    let pendingAmountPen = 0;

    userAlerts.forEach(alert => {
      const computed = getAlertComputedStatus(alert);
      const days = getDaysRemaining(alert.dueDate);

      if (computed === 'VENCIDO') overdueCount++;
      else if (computed === 'PAGADO') paidCount++;
      else if (computed === 'PENDIENTE') {
        if (days >= 0 && days <= 7) upcomingCount++;
        if (alert.currency === 'PEN') pendingAmountPen += alert.amount;
      }
    });

    return { overdueCount, upcomingCount, paidCount, pendingAmountPen };
  }, [userAlerts, today]);

  // Open Form for Create
  const handleOpenCreate = () => {
    setEditingAlert(null);
    setFormData({
      title: '',
      category: 'LUZ',
      amount: '',
      currency: 'PEN',
      dueDate: new Date().toISOString().split('T')[0],
      frequency: 'MENSUAL',
      reminderDaysBefore: '3',
      notes: '',
    });
    setShowFormModal(true);
  };

  // Open Form for Edit
  const handleOpenEdit = (alert: PaymentAlert) => {
    setEditingAlert(alert);
    setFormData({
      title: alert.title,
      category: alert.category,
      amount: alert.amount.toString(),
      currency: alert.currency,
      dueDate: alert.dueDate,
      frequency: alert.frequency,
      reminderDaysBefore: alert.reminderDaysBefore.toString(),
      notes: alert.notes || '',
    });
    setShowFormModal(true);
  };

  // Save Alert
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.amount || parseFloat(formData.amount) <= 0) return;

    if (editingAlert) {
      updatePaymentAlert(editingAlert.id, {
        title: formData.title.trim(),
        category: formData.category,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        dueDate: formData.dueDate,
        frequency: formData.frequency,
        reminderDaysBefore: parseInt(formData.reminderDaysBefore) || 3,
        notes: formData.notes.trim() || undefined,
      });
    } else {
      const newAlert: PaymentAlert = {
        id: `alt-${Date.now()}`,
        userId,
        companyId: companyId || undefined,
        title: formData.title.trim(),
        category: formData.category,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        dueDate: formData.dueDate,
        frequency: formData.frequency,
        reminderDaysBefore: parseInt(formData.reminderDaysBefore) || 3,
        status: 'PENDIENTE',
        notes: formData.notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      addPaymentAlert(newAlert);
    }

    setShowFormModal(false);
  };

  // Confirm Mark Paid
  const handleConfirmPay = () => {
    if (!payingAlert) return;
    markPaymentAlertPaid(payingAlert.id, recordAsExpense);
    setPayingAlert(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border-2 border-brand-100 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
            <BellRing className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">Alertas & Recordatorios de Pago</h2>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
              Gestión de pagos recurrentes: Luz, Agua, Préstamos, Alquiler y Servicios
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" /> Agregar Alerta
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pendiente por Pagar</span>
            <DollarSign className="w-4 h-4 text-brand-600" />
          </div>
          <p className="text-xl font-black text-gray-900 mt-2">S/ {stats.pendingAmountPen.toFixed(2)}</p>
          <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Compromisos del mes</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-red-100 bg-red-50/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Vencidas</span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-xl font-black text-red-700 mt-2">{stats.overdueCount}</p>
          <p className="text-[9px] font-bold text-red-400 uppercase mt-1">Requieren atención urgente</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-100 bg-amber-50/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Próximas (7 días)</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl font-black text-amber-700 mt-2">{stats.upcomingCount}</p>
          <p className="text-[9px] font-bold text-amber-400 uppercase mt-1">Por vencer pronto</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Pagadas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-emerald-700 mt-2">{stats.paidCount}</p>
          <p className="text-[9px] font-bold text-emerald-400 uppercase mt-1">Al día este periodo</p>
        </div>
      </div>

      {/* Controls: Search & Tabs */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar alerta por título..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 pl-10 pr-4 py-2 rounded-xl text-xs font-medium focus:border-brand-500 outline-none"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
          {(['TODAS', 'PENDIENTES', 'PROXIMAS', 'VENCIDAS', 'PAGADAS'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap ${
                activeFilter === tab
                  ? 'bg-white text-brand-600 shadow-xs border border-gray-200'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab === 'TODAS' ? 'Todas' : tab === 'PENDIENTES' ? 'Pendientes' : tab === 'PROXIMAS' ? 'Próximas (7d)' : tab === 'VENCIDAS' ? 'Vencidas' : 'Pagadas'}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Grid / List */}
      {filteredAlerts.length === 0 ? (
        <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-3">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">No se encontraron alertas de pago</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto font-medium">
            Agrega alertas para recordar tus recibos de luz, agua, préstamos bancarios o alquileres antes de la fecha de vencimiento.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 px-4 py-2.5 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-xl text-xs font-black uppercase tracking-wider transition inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Crear primera alerta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAlerts.map(alert => {
            const cat = CATEGORY_CONFIG[alert.category] || CATEGORY_CONFIG.OTRO;
            const Icon = cat.icon;
            const computedStatus = getAlertComputedStatus(alert);
            const days = getDaysRemaining(alert.dueDate);

            let statusBadge = null;
            if (computedStatus === 'PAGADO') {
              statusBadge = <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2.5 py-1 rounded-full uppercase">Pagado</span>;
            } else if (computedStatus === 'VENCIDO') {
              statusBadge = <span className="bg-red-100 text-red-800 text-[9px] font-black px-2.5 py-1 rounded-full uppercase flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Vencido</span>;
            } else if (days >= 0 && days <= 7) {
              statusBadge = <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-2.5 py-1 rounded-full uppercase flex items-center gap-1"><Clock className="w-3 h-3"/> Vence en {days === 0 ? 'hoy' : `${days} d`}</span>;
            } else {
              statusBadge = <span className="bg-blue-100 text-blue-800 text-[9px] font-black px-2.5 py-1 rounded-full uppercase">Pendiente</span>;
            }

            return (
              <div key={alert.id} className={`bg-white rounded-3xl border-2 p-5 flex flex-col justify-between shadow-xs transition-all hover:shadow-md ${computedStatus === 'VENCIDO' ? 'border-red-200 bg-red-50/10' : 'border-gray-100'}`}>
                <div>
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className={`p-2.5 rounded-2xl border ${cat.bg} ${cat.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    {statusBadge}
                  </div>

                  {/* Title & Category */}
                  <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight line-clamp-1">{alert.title}</h4>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">{cat.label}</p>

                  {/* Amount & Frequency */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase block">Monto a pagar</span>
                      <span className="text-lg font-black text-gray-900">{alert.currency === 'USD' ? '$' : 'S/'} {alert.amount.toFixed(2)}</span>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-white border border-gray-200 px-2.5 py-1 rounded-lg text-gray-600">
                      {FREQUENCY_LABELS[alert.frequency]}
                    </span>
                  </div>

                  {/* Due Date & Reminder info */}
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center text-[10px] font-bold text-gray-500 uppercase gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>Vence: <strong className="text-gray-800">{alert.dueDate}</strong></span>
                    </div>
                    {alert.notes && (
                      <p className="text-[10px] text-gray-500 italic line-clamp-2 mt-1 bg-gray-50/60 p-2 rounded-xl">
                        "{alert.notes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(alert)}
                      className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition"
                      title="Editar alerta"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingAlertId(alert.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                      title="Eliminar alerta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {computedStatus !== 'PAGADO' ? (
                    <button
                      onClick={() => {
                        setPayingAlert(alert);
                        setRecordAsExpense(true);
                      }}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition shadow-xs flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Marcar Pagado
                    </button>
                  ) : (
                    <span className="text-[9px] font-bold text-emerald-600 uppercase flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Pagado {alert.lastPaidDate ? `(${alert.lastPaidDate})` : ''}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl space-y-6 relative border-2 border-brand-100">
            <button
              onClick={() => setShowFormModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl">
                <BellRing className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">
                  {editingAlert ? 'Editar Alerta de Pago' : 'Nueva Alerta de Pago'}
                </h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                  Configura tus pagos recurrentes de servicios, préstamos o servicios
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                  Título de la Alerta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Recibo de Luz - Enel Oficina"
                  value={formData.title}
                  onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                  className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 focus:border-brand-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                    Categoría *
                  </label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData(p => ({ ...p, category: e.target.value as PaymentAlertCategory }))}
                    className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 focus:border-brand-500 outline-none"
                  >
                    {Object.entries(CATEGORY_CONFIG).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                    Frecuencia *
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={e => setFormData(p => ({ ...p, frequency: e.target.value as PaymentAlertFrequency }))}
                    className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 focus:border-brand-500 outline-none"
                  >
                    <option value="MENSUAL">Mensual</option>
                    <option value="QUINCENAL">Quincenal</option>
                    <option value="ANUAL">Anual</option>
                    <option value="UNICO">Pago Único</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                    Monto Aproximado / Recibo *
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
                      placeholder="150.00"
                      value={formData.amount}
                      onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                      className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 focus:border-brand-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                    Fecha de Vencimiento *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={e => setFormData(p => ({ ...p, dueDate: e.target.value }))}
                    className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 focus:border-brand-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                  Recordar días antes de la fecha
                </label>
                <select
                  value={formData.reminderDaysBefore}
                  onChange={e => setFormData(p => ({ ...p, reminderDaysBefore: e.target.value }))}
                  className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 focus:border-brand-500 outline-none"
                >
                  <option value="1">1 día antes</option>
                  <option value="3">3 días antes</option>
                  <option value="5">5 días antes</option>
                  <option value="7">7 días antes</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                  Notas / Detalles Adicionales (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="N° de Suministro, Cuenta de Abono o instrucciones de pago..."
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
                  {editingAlert ? 'Guardar Cambios' : 'Crear Alerta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MARK AS PAID MODAL */}
      {payingAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl space-y-6 text-center border-2 border-emerald-100">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">Confirmar Registro de Pago</h3>
              <p className="text-xs text-gray-500 mt-1 font-medium">
                ¿Confirmas que realizaste el pago de <strong className="text-gray-900">{payingAlert.title}</strong> por <strong className="text-emerald-700">{payingAlert.currency === 'USD' ? '$' : 'S/'} {payingAlert.amount.toFixed(2)}</strong>?
              </p>
            </div>

            <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 text-left">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recordAsExpense}
                  onChange={e => setRecordAsExpense(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="text-xs font-bold text-emerald-900">
                  Registrar automáticamente como Gasto en mi control financiero
                </span>
              </label>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setPayingAlert(null)}
                className="px-5 py-3 text-xs font-black uppercase text-gray-500 hover:bg-gray-100 rounded-2xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPay}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition shadow-md"
              >
                Sí, Registrar Pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingAlertId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-5 border-2 border-red-100 shadow-2xl">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">¿Eliminar esta Alerta?</h3>
              <p className="text-xs text-gray-400 mt-1">Esta acción no se puede deshacer.</p>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeletingAlertId(null)}
                className="px-4 py-2.5 text-xs font-black uppercase text-gray-500 hover:bg-gray-100 rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  deletePaymentAlert(deletingAlertId);
                  setDeletingAlertId(null);
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
