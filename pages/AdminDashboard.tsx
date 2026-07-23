import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { UserRole, SubscriptionStatus, User, SubscriptionRecord } from '../types';
// Fixed: Aliased User as UserIcon from lucide-react to avoid name collision with User type
import { User as UserIcon, Users, Trash2, Edit2, Shield, CreditCard, Save, History, X, PlusCircle, UserPlus, Check, Bell, Info, QrCode, Upload, Building, MapPin, Hash, Settings, Package, DollarSign, Smartphone, Globe, ExternalLink, Book, CheckCircle2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { fileToBase64 } from '../services/geminiService';

export const AdminDashboard: React.FC = () => {
  const { 
    users, 
    registerUser, 
    updateUser, 
    deleteUser, 
    packages, 
    updatePackage, 
    paymentMethods, 
    updatePaymentMethod, 
    subscriptionHistory, 
    addSubscriptionRecord,
    updateSubscriptionRecord,
    addNotification,
    notifications,
    markNotificationAsRead,
    sunatGlobalConfig,
    updateSunatGlobalConfig,
    complaints,
    updateComplaintStatus,
    generatePassword,
    refreshData
  } = useStore();

  useEffect(() => {
    refreshData();
    const interval = setInterval(() => {
      refreshData();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const [activeTab, setActiveTab] = useState<'users' | 'subscriptions' | 'settings' | 'complaints'>('users');
  const [subFilter, setSubFilter] = useState<'all' | SubscriptionStatus>('all');
  const [showNotifications, setShowNotifications] = useState(false);
  const [previewVoucherRec, setPreviewVoucherRec] = useState<SubscriptionRecord | null>(null);

  // --- PAGINATION STATES FOR USERS & PAYMENTS TABLE ---
  const [usersPage, setUsersPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(10);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsPerPage, setPaymentsPerPage] = useState(10);

  // --- SETTINGS STATES ---
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');
  
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
  const [tempDetails, setTempDetails] = useState<string>('');
  const [tempQrImage, setTempQrImage] = useState<string | undefined>(undefined);
  const qrFileInputRef = useRef<HTMLInputElement>(null);

  // --- HISTORY STATES ---
  const [viewHistoryUser, setViewHistoryUser] = useState<User | null>(null);
  const [showAddRecordForm, setShowAddRecordForm] = useState(false);
  const [newRecordPackage, setNewRecordPackage] = useState('');
  const [newRecordAmount, setNewRecordAmount] = useState('');
  const [newRecordDate, setNewRecordDate] = useState(new Date().toISOString().split('T')[0]);
  const [newRecordPaymentDetails, setNewRecordPaymentDetails] = useState('');
  const [newRecordStatus, setNewRecordStatus] = useState<'PAID' | 'PENDING' | 'CANCELLED'>('PAID');

  // --- USER MANAGEMENT STATES ---
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null); 
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    role: UserRole.USER,
    subscriptionStatus: SubscriptionStatus.PENDING,
    assignedAccountantId: '',
    ruc: '',
    taxAddress: '',
    solUser: '',
    solPass: ''
  });
  const [generatedPassword, setGeneratedPassword] = useState('');

  const handleEditPackage = (pkg: any) => {
    setEditingPackageId(pkg.id);
    setTempPrice(pkg.price.toString());
  };

  const savePackage = (id: string) => {
    updatePackage(id, { price: parseFloat(tempPrice) });
    setEditingPackageId(null);
  };

  const handleEditMethod = (method: any) => {
    setEditingMethodId(method.id);
    setTempDetails(method.details);
    setTempQrImage(method.qrImage);
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const base64 = await fileToBase64(e.target.files[0]);
        setTempQrImage(base64);
      } catch (err) {
        console.error("Error uploading QR", err);
      }
    }
  };

  const saveMethod = (id: string) => {
    updatePaymentMethod(id, { 
      details: tempDetails,
      qrImage: tempQrImage
    });
    setEditingMethodId(null);
    setTempQrImage(undefined);
  };

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (viewHistoryUser) {
      const newRecord: SubscriptionRecord = {
        id: Date.now().toString(),
        userId: viewHistoryUser.id,
        packageName: newRecordPackage,
        amount: parseFloat(newRecordAmount),
        date: newRecordDate,
        status: newRecordStatus,
        paymentDetails: newRecordPaymentDetails
      };
      addSubscriptionRecord(newRecord);
      setShowAddRecordForm(false);
      setNewRecordPackage('');
      setNewRecordAmount('');
      setNewRecordPaymentDetails('');
      setNewRecordStatus('PAID');
    }
  };

  const handleOpenCreateUser = () => {
    setEditingUser(null);
    const pwd = generatePassword();
    setGeneratedPassword(pwd);
    setUserFormData({
      name: '', email: '', role: UserRole.USER, subscriptionStatus: SubscriptionStatus.PENDING,
      assignedAccountantId: '', ruc: '', dni: '', businessName: '', taxAddress: '',
      solUser: '', solPass: ''
    });
    setShowUserModal(true);
  };

  const handleOpenEditUser = (user: User) => {
    setEditingUser(user);
    setGeneratedPassword('');
    setUserFormData({
      name: user.name, email: user.email, role: user.role,
      subscriptionStatus: user.subscriptionStatus || SubscriptionStatus.PENDING,
      assignedAccountantId: user.assignedAccountantId || '',
      ruc: user.ruc || '', dni: user.dni || '', businessName: user.businessName || '',
      taxAddress: user.taxAddress || '',
      solUser: user.solUser || '',
      solPass: user.solPass || ''
    });
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateUser(editingUser.id, userFormData);
      } else {
        const pwd = generatedPassword || generatePassword();
        const newUser = {
          id: Date.now().toString(),
          ...userFormData,
          password: pwd,
          mustChangePassword: true
        };
        await registerUser(newUser);
        fetch('/api/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: newUser.email, name: newUser.name, password: pwd })
        }).catch(() => {});
      }
      setShowUserModal(false);
    } catch (err: any) {
      alert("Error al guardar usuario en la base de datos: " + (err.message || "Error desconocido"));
    }
  };

  const accountants = users.filter(u => u.role === UserRole.ACCOUNTANT);
  const getAccountantName = (id?: string) => {
    if (!id) return '—';
    const acc = accountants.find(a => a.id === id);
    return acc ? acc.name : '—';
  };
  const unreadCount = notifications.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Panel de Control Admin</h2>
           <p className="text-gray-500 text-sm font-bold">Gestión global de la plataforma</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
             onClick={refreshData}
             className="px-4 py-3 bg-white border-2 border-gray-100 rounded-2xl hover:bg-gray-50 hover:scale-105 active:scale-95 transition shadow-sm text-xs font-black uppercase tracking-wider text-gray-600 flex items-center gap-1.5"
             title="Actualizar datos del servidor"
          >
             <Loader2 className="w-4 h-4 text-brand-600 animate-spin-slow" /> Refrescar
          </button>
          <div className="relative">
            <button 
               onClick={() => setShowNotifications(!showNotifications)}
               className="p-3 bg-white border-2 border-gray-100 rounded-2xl hover:bg-gray-50 transition shadow-sm relative"
            >
               <Bell className="w-6 h-6 text-gray-600" />
               {unreadCount > 0 && (
                 <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white ring-2 ring-white">
                   {unreadCount}
                 </span>
               )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border-2 border-gray-100 overflow-hidden z-50 animate-fade-in-up">
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                   <h3 className="font-black text-xs uppercase tracking-widest text-gray-700">Notificaciones</h3>
                   <button onClick={() => setShowNotifications(false)}><X className="w-4 h-4 text-gray-400"/></button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                   {notifications.length > 0 ? notifications.map(note => (
                     <div key={note.id} className="p-4 border-b border-gray-50 hover:bg-brand-50 flex items-start space-x-3">
                        <div className="p-2 bg-brand-100 rounded-xl"><Info className="w-4 h-4 text-brand-600" /></div>
                        <div className="flex-1 min-w-0">
                           <p className="text-xs text-gray-800 font-bold leading-tight">{note.message}</p>
                           <p className="text-[10px] text-gray-400 mt-1 uppercase font-black">{note.date}</p>
                        </div>
                        <button onClick={() => markNotificationAsRead(note.id)} className="text-gray-300 hover:text-green-600"><Check className="w-4 h-4" /></button>
                     </div>
                   )) : <p className="p-8 text-center text-xs text-gray-400 italic">Todo al día</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* TABS CON DISEÑO MEJORADO */}
      <div className="flex bg-white p-1.5 rounded-2xl border-2 border-gray-100 w-full max-w-xl shadow-sm">
        <button onClick={() => setActiveTab('users')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center ${activeTab === 'users' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>
          <Users className="w-4 h-4 mr-2" /> Usuarios
        </button>
        <button onClick={() => setActiveTab('subscriptions')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center relative ${activeTab === 'subscriptions' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>
          <CreditCard className="w-4 h-4 mr-2" /> Pagos
          {subscriptionHistory.filter(h => h.status === 'PENDING').length > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[9px] bg-amber-500 text-white font-black animate-pulse">
              {subscriptionHistory.filter(h => h.status === 'PENDING').length}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center ${activeTab === 'settings' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>
          <Settings className="w-4 h-4 mr-2" /> Configuración
        </button>
        <button onClick={() => setActiveTab('complaints')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center ${activeTab === 'complaints' ? 'bg-brand-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>
          <Book className="w-4 h-4 mr-2" /> Reclamos
        </button>
      </div>

      {activeTab === 'users' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex bg-gray-50 p-1 rounded-xl">
              {[{ key: 'all', label: 'Todos' }, { key: SubscriptionStatus.ACTIVE, label: 'Activos' }, { key: SubscriptionStatus.EXPIRED, label: 'Vencidos' }, { key: SubscriptionStatus.PENDING, label: 'Pendientes' }].map(f => (
                <button key={f.key} onClick={() => setSubFilter(f.key as any)}
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${subFilter === f.key ? 'bg-white text-brand-600 shadow-sm border border-brand-100' : 'text-gray-400'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <button onClick={handleOpenCreateUser} className="bg-brand-600 text-white px-6 py-3 rounded-2xl hover:bg-brand-700 transition flex items-center font-black text-xs uppercase tracking-widest shadow-xl active:scale-95">
              <UserPlus className="w-4 h-4 mr-2" /> Nuevo Registro
            </button>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Identidad</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Rol / Perfil</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Contador</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest">Estado Suscripción</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    const filtered = users.filter(u => subFilter === 'all' || u.subscriptionStatus === subFilter);
                    const total = filtered.length;
                    const totalPages = Math.ceil(total / usersPerPage) || 1;
                    const currentPage = Math.min(usersPage, totalPages);
                    const start = (currentPage - 1) * usersPerPage;
                    const end = Math.min(start + usersPerPage, total);
                    const pageItems = filtered.slice(start, end);

                    if (pageItems.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-gray-400 text-xs font-bold italic">
                            No se encontraron usuarios.
                          </td>
                        </tr>
                      );
                    }

                    return pageItems.map(user => (
                      <tr key={user.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden border">
                               {user.profilePicture ? <img src={`data:image/jpeg;base64,${user.profilePicture}`} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-gray-400" />}
                            </div>
                            <div>
                              <p className="font-black text-gray-900 text-sm uppercase tracking-tighter leading-none mb-1">{user.name}</p>
                              <p className="text-[10px] text-gray-400 font-bold">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${user.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-700' : user.role === UserRole.ACCOUNTANT ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-gray-600">
                            {user.role === UserRole.USER ? getAccountantName(user.assignedAccountantId) : '—'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {user.role === UserRole.USER && (
                            <div className="flex items-center space-x-2">
                              <span className={`w-2 h-2 rounded-full ${user.subscriptionStatus === SubscriptionStatus.ACTIVE ? 'bg-green-500' : user.subscriptionStatus === SubscriptionStatus.EXPIRED ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                              <span className="text-[10px] font-black uppercase text-gray-600">{user.subscriptionStatus}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button onClick={() => handleOpenEditUser(user)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                            {user.role === UserRole.USER && <button onClick={() => setViewHistoryUser(user)} className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition"><History className="w-4 h-4" /></button>}
                            {user.id !== 'u1' && <button onClick={() => { if(confirm('¿Eliminar definitivamente?')) deleteUser(user.id) }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>}
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            {/* CONTROLES DE PAGINACIÓN */}
            {(() => {
              const filtered = users.filter(u => subFilter === 'all' || u.subscriptionStatus === subFilter);
              const total = filtered.length;
              const totalPages = Math.ceil(total / usersPerPage) || 1;
              const currentPage = Math.min(usersPage, totalPages);
              const start = total > 0 ? (currentPage - 1) * usersPerPage + 1 : 0;
              const end = Math.min(currentPage * usersPerPage, total);

              return (
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
                    <span>Mostrando {start} - {end} de {total} usuarios</span>
                    <span className="text-gray-300">|</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase text-gray-400">Filas por página:</span>
                      <select
                        value={usersPerPage}
                        onChange={(e) => {
                          setUsersPerPage(Number(e.target.value));
                          setUsersPage(1);
                        }}
                        className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-700 outline-none focus:border-brand-500 shadow-sm"
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
                      onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-black text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition shadow-sm flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" /> Anterior
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setUsersPage(p)}
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
                      onClick={() => setUsersPage(p => Math.min(totalPages, p + 1))}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-black text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition shadow-sm flex items-center gap-1"
                    >
                      Siguiente <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : activeTab === 'subscriptions' ? (
        <div className="space-y-6 animate-fade-in-up">
          <div className="bg-white rounded-[2.5rem] shadow-sm border-2 border-gray-100 overflow-hidden">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-brand-100 rounded-2xl text-brand-600"><CreditCard className="w-6 h-6"/></div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-800">Validación de Pagos y Suscripciones</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Revisa y aprueba las solicitudes de compra de planes de usuarios</p>
                </div>
              </div>
              <div className="px-4 py-2 bg-white rounded-xl border border-gray-200 shadow-sm flex gap-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pendientes: <span className="text-amber-600 font-black ml-1">{subscriptionHistory.filter(h => h.status === 'PENDING').length}</span></p>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Histórico: <span className="text-brand-600 font-black ml-1">{subscriptionHistory.length}</span></p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white border-b-2 border-gray-50">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">Usuario</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">Plan Solicitado</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">Monto / Método</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">Voucher</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">Fecha</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">Estado</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(() => {
                    const total = subscriptionHistory.length;
                    const totalPages = Math.ceil(total / paymentsPerPage) || 1;
                    const currentPage = Math.min(paymentsPage, totalPages);
                    const start = (currentPage - 1) * paymentsPerPage;
                    const end = Math.min(start + paymentsPerPage, total);
                    const pageItems = subscriptionHistory.slice(start, end);

                    if (pageItems.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-xs text-gray-400 italic">No hay registros de solicitudes de pago.</td>
                        </tr>
                      );
                    }

                    return pageItems.map(rec => {
                      const reqUser = users.find(u => u.id === rec.userId);
                      const isPending = rec.status === 'PENDING';
                      return (
                        <tr key={rec.id} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="px-8 py-6">
                            <p className="text-sm font-black text-gray-900 leading-none uppercase">{reqUser?.name || 'Usuario desconocido'}</p>
                            <p className="text-[10px] text-gray-400 font-bold mt-1">{reqUser?.email || rec.userId}</p>
                          </td>
                          <td className="px-8 py-6">
                            <span className="px-3 py-1 bg-brand-50 text-brand-700 rounded-lg text-xs font-black uppercase">
                              {rec.packageName}
                            </span>
                          </td>
                          <td className="px-8 py-6">
                            <p className="text-sm font-black text-gray-900">S/ {rec.amount.toFixed(2)}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">{rec.paymentDetails || 'Yape / Plin'}</p>
                          </td>
                          <td className="px-8 py-6">
                            {rec.voucherImage ? (
                              <button
                                onClick={() => setPreviewVoucherRec(rec)}
                                className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-[10px] font-black uppercase hover:bg-blue-100 transition flex items-center gap-1.5 shadow-sm"
                              >
                                <QrCode className="w-3.5 h-3.5" /> Ver Voucher
                              </button>
                            ) : (
                              <span className="text-[10px] text-gray-400 font-bold italic">Sin adjunto</span>
                            )}
                          </td>
                          <td className="px-8 py-6 text-xs font-mono font-bold text-gray-600">
                            {rec.date}
                          </td>
                          <td className="px-8 py-6">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                              rec.status === 'PAID' ? 'bg-green-100 text-green-700' :
                              rec.status === 'PENDING' ? 'bg-amber-100 text-amber-700 animate-pulse' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {rec.status === 'PAID' ? 'Aprobado' : rec.status === 'PENDING' ? 'Pendiente' : 'Rechazado'}
                            </span>
                          </td>
                          <td className="px-8 py-6 text-right">
                            {isPending ? (
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => {
                                    if (!reqUser) return;
                                    const pkg = packages.find(p => p.name === rec.packageName);
                                    const durationMonths = pkg ? pkg.durationMonths : 1;
                                    
                                    let baseStartDate = new Date();
                                    const hasActiveSub = reqUser.subscriptionStatus === SubscriptionStatus.ACTIVE && reqUser.subscriptionEndDate && new Date(reqUser.subscriptionEndDate) > new Date();
                                    if (hasActiveSub && reqUser.subscriptionEndDate) {
                                      baseStartDate = new Date(reqUser.subscriptionEndDate);
                                    }

                                    const endDate = new Date(baseStartDate);
                                    endDate.setMonth(endDate.getMonth() + durationMonths);

                                    const startStr = baseStartDate.toISOString().split('T')[0];
                                    const endStr = endDate.toISOString().split('T')[0];

                                    const userStartStr = (hasActiveSub && reqUser.subscriptionStartDate) ? reqUser.subscriptionStartDate : startStr;

                                    updateUser(reqUser.id, {
                                      subscriptionStatus: SubscriptionStatus.ACTIVE,
                                      subscriptionStartDate: userStartStr,
                                      subscriptionEndDate: endStr
                                    });
                                    updateSubscriptionRecord(rec.id, {
                                      status: 'PAID',
                                      startDate: startStr,
                                      endDate: endStr
                                    });
                                    addNotification({
                                      id: Date.now().toString(),
                                      userId: reqUser.id,
                                      message: hasActiveSub
                                        ? `¡Tu renovación al ${rec.packageName} fue APROBADA! Tu suscripción se ha extendido hasta el ${new Date(endStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}.`
                                        : `¡Tu suscripción al ${rec.packageName} fue APROBADA! Tu plan está activo hasta el ${new Date(endStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
                                      date: new Date().toLocaleDateString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                                      isRead: false,
                                      type: 'SUBSCRIPTION'
                                    });
                                  }}
                                  className="px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-green-700 transition shadow-md flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" /> Aprobar
                                </button>
                                <button
                                  onClick={() => {
                                    if (!reqUser) return;
                                    const hasActiveSub = reqUser.subscriptionStatus === SubscriptionStatus.ACTIVE && reqUser.subscriptionEndDate && new Date(reqUser.subscriptionEndDate) > new Date();
                                    if (!hasActiveSub) {
                                      updateUser(reqUser.id, { subscriptionStatus: SubscriptionStatus.EXPIRED });
                                    }
                                    updateSubscriptionRecord(rec.id, { status: 'CANCELLED' });
                                    addNotification({
                                      id: Date.now().toString(),
                                      userId: reqUser.id,
                                      message: `Tu solicitud de pago para el ${rec.packageName} fue rechazada por el administrador.`,
                                      date: new Date().toLocaleDateString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                                      isRead: false,
                                      type: 'SUBSCRIPTION'
                                    });
                                  }}
                                  className="px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-red-700 transition shadow-md flex items-center gap-1"
                                >
                                  <X className="w-3.5 h-3.5" /> Rechazar
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-gray-400 italic">Procesado</span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* CONTROLES DE PAGINACIÓN DE PAGOS */}
            {(() => {
              const total = subscriptionHistory.length;
              const totalPages = Math.ceil(total / paymentsPerPage) || 1;
              const currentPage = Math.min(paymentsPage, totalPages);
              const start = total > 0 ? (currentPage - 1) * paymentsPerPage + 1 : 0;
              const end = Math.min(currentPage * paymentsPerPage, total);

              return (
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
                    <span>Mostrando {start} - {end} de {total} registros de pago</span>
                    <span className="text-gray-300">|</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase text-gray-400">Filas por página:</span>
                      <select
                        value={paymentsPerPage}
                        onChange={(e) => {
                          setPaymentsPerPage(Number(e.target.value));
                          setPaymentsPage(1);
                        }}
                        className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-700 outline-none focus:border-brand-500 shadow-sm"
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
                      onClick={() => setPaymentsPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-black text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition shadow-sm flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" /> Anterior
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setPaymentsPage(p)}
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
                      onClick={() => setPaymentsPage(p => Math.min(totalPages, p + 1))}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-black text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition shadow-sm flex items-center gap-1"
                    >
                      Siguiente <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : activeTab === 'complaints' ? (
        <div className="space-y-6 animate-fade-in-up">
           <div className="bg-white rounded-[2.5rem] shadow-sm border-2 border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                 <div className="flex items-center space-x-3">
                    <div className="p-3 bg-brand-100 rounded-2xl text-brand-600"><Book className="w-6 h-6"/></div>
                    <div>
                       <h3 className="text-sm font-black uppercase tracking-widest text-gray-800">Libro de Reclamaciones</h3>
                       <p className="text-[10px] text-gray-400 font-bold uppercase">Gestión de quejas y reclamos de usuarios</p>
                    </div>
                 </div>
                 <div className="px-4 py-2 bg-white rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Registros: <span className="text-brand-600 ml-1">{complaints.length}</span></p>
                 </div>
              </div>

              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-white border-b-2 border-gray-50">
                       <tr>
                          <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">Fecha / Hora</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">Usuario</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">Tipo</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">Descripción / Detalle</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest">Estado</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase text-gray-400 tracking-widest text-right">Acción</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                       {complaints.length > 0 ? [...complaints].reverse().map(comp => (
                          <tr key={comp.id} className="hover:bg-gray-50/50 transition-colors group">
                             <td className="px-8 py-6">
                                <p className="text-sm font-black text-gray-900 leading-none">{comp.date}</p>
                                <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase">{comp.time}</p>
                             </td>
                             <td className="px-8 py-6">
                                <p className="text-sm font-black text-brand-900 uppercase tracking-tighter leading-none mb-1">{comp.userName}</p>
                                <p className="text-[10px] text-gray-400 font-bold">{comp.userEmail}</p>
                             </td>
                             <td className="px-8 py-6">
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${comp.type === 'RECLAMO' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}`}>
                                   {comp.type}
                                </span>
                              </td>
                              <td className="px-8 py-6 max-w-md">
                                 <p className="text-xs font-black text-gray-800 uppercase leading-tight mb-1">{comp.description}</p>
                                 <p className="text-[11px] text-gray-500 font-medium italic line-clamp-2 group-hover:line-clamp-none transition-all">"{comp.detail}"</p>
                              </td>
                              <td className="px-8 py-6">
                                 <div className={`flex items-center space-x-2 text-[10px] font-black uppercase ${comp.status === 'ATENDIDO' ? 'text-green-600' : 'text-amber-500 animate-pulse'}`}>
                                    {comp.status === 'ATENDIDO' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    <span>{comp.status}</span>
                                 </div>
                              </td>
                              <td className="px-8 py-6 text-right">
                                 {comp.status === 'PENDIENTE' && (
                                    <button 
                                       onClick={() => updateComplaintStatus(comp.id, 'ATENDIDO')}
                                       className="px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-700 shadow-lg transition active:scale-95"
                                    >
                                       Atender
                                    </button>
                                 )}
                              </td>
                           </tr>
                        )) : (
                           <tr>
                              <td colSpan={6} className="px-8 py-12 text-center">
                                 <div className="flex flex-col items-center space-y-3 opacity-30">
                                    <Book className="w-12 h-12 text-gray-400" />
                                    <p className="text-sm font-black uppercase tracking-widest text-gray-400 italic">No hay reclamos registrados</p>
                                 </div>
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>
       ) : (
        /* CONFIGURACIÓN DE PAGOS Y PLANES - FONDOS CLAROS Y TEXTO NEGRO */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in-up">
           {/* GESTIÓN DE PLANES */}
           <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm space-y-6">
              <div className="flex items-center space-x-3 mb-2">
                 <div className="p-3 bg-brand-50 rounded-2xl text-brand-600"><Package className="w-6 h-6"/></div>
                 <h3 className="text-sm font-black uppercase tracking-widest text-gray-800">Suscripciones Disponibles</h3>
              </div>
              
              <div className="space-y-4">
                 {packages.map(pkg => (
                   <div key={pkg.id} className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-between group">
                      <div>
                         <p className="text-xs font-black text-gray-900 uppercase tracking-tighter mb-1">{pkg.name}</p>
                         {editingPackageId === pkg.id ? (
                            <div className="flex items-center space-x-2 mt-2">
                               <div className="relative">
                                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                  <input 
                                    type="number" 
                                    className="bg-white border-2 border-brand-200 rounded-xl p-2 pl-8 text-sm font-black text-gray-900 w-24 outline-none focus:border-brand-500" 
                                    value={tempPrice} 
                                    onChange={e => setTempPrice(e.target.value)} 
                                  />
                               </div>
                               <button onClick={() => savePackage(pkg.id)} className="p-2 bg-green-500 text-white rounded-xl shadow-lg"><Check className="w-4 h-4"/></button>
                            </div>
                         ) : (
                            <p className="text-xl font-black text-brand-700">S/ {pkg.price.toFixed(2)} <span className="text-[10px] text-gray-400">/ mes</span></p>
                         )}
                      </div>
                      <button onClick={() => handleEditPackage(pkg)} className="p-3 bg-white border border-gray-200 text-gray-400 rounded-2xl hover:text-brand-600 hover:border-brand-200 shadow-sm transition opacity-0 group-hover:opacity-100">
                         <Edit2 className="w-4 h-4" />
                      </button>
                   </div>
                 ))}
              </div>
           </div>

           {/* MÉTODOS DE PAGO Y QR */}
           <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm space-y-6">
              <div className="flex items-center space-x-3 mb-2">
                 <div className="p-3 bg-green-50 rounded-2xl text-green-600"><Smartphone className="w-6 h-6"/></div>
                 <h3 className="text-sm font-black uppercase tracking-widest text-gray-800">Recaudación (QR Yape/Plin)</h3>
              </div>

              <div className="space-y-4">
                 {paymentMethods.map(method => (
                   <div key={method.id} className="p-6 bg-gray-50 rounded-3xl border border-gray-100 space-y-4">
                      <div className="flex justify-between items-start">
                         <div className="flex items-center space-x-4">
                            <div className="p-3 bg-white rounded-2xl border shadow-sm">
                               {method.qrImage ? <QrCode className="w-6 h-6 text-brand-600"/> : <Smartphone className="w-6 h-6 text-gray-400"/>}
                            </div>
                            <div>
                               <p className="text-xs font-black text-gray-900 uppercase tracking-tighter">{method.name}</p>
                               <p className="text-[10px] font-bold text-gray-400 mt-0.5">{method.details}</p>
                            </div>
                         </div>
                         <button onClick={() => handleEditMethod(method)} className="p-2 text-gray-400 hover:text-brand-600"><Edit2 className="w-4 h-4"/></button>
                      </div>

                      {editingMethodId === method.id && (
                        <div className="bg-white p-6 rounded-2xl border-2 border-brand-100 space-y-4 animate-fade-in">
                           <div>
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Detalles de Transferencia</label>
                              <input 
                                type="text" 
                                className="w-full border-2 border-gray-100 p-3 rounded-xl text-xs font-bold text-gray-900 bg-white outline-none focus:border-brand-500" 
                                value={tempDetails} 
                                onChange={e => setTempDetails(e.target.value)} 
                              />
                           </div>
                           <div>
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Código QR (Imagen)</label>
                              <div className="flex items-center space-x-4">
                                 {tempQrImage && <img src={`data:image/jpeg;base64,${tempQrImage}`} className="w-16 h-16 rounded-lg object-contain border bg-white" />}
                                 <button onClick={() => qrFileInputRef.current?.click()} className="flex-1 py-3 border-2 border-dashed rounded-xl text-[10px] font-black uppercase text-gray-400 hover:border-brand-500 hover:text-brand-600 transition">Cambiar QR</button>
                                 <input type="file" ref={qrFileInputRef} className="hidden" accept="image/*" onChange={handleQrUpload} />
                              </div>
                           </div>
                           <button onClick={() => saveMethod(method.id)} className="w-full py-3 bg-brand-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg">Actualizar Método</button>
                        </div>
                      )}

                      {method.qrImage && !editingMethodId && (
                         <div className="mt-2 flex justify-center p-4 bg-white rounded-2xl border border-dashed border-gray-200">
                            <img src={`data:image/jpeg;base64,${method.qrImage}`} className="w-32 h-32 object-contain" alt="QR Code" />
                         </div>
                      )}
                   </div>
                 ))}
              </div>
           </div>

            {/* CONFIGURACIÓN GLOBAL SUNAT */}
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-brand-100 shadow-sm space-y-6 lg:col-span-2">
               <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                     <div className="p-3 bg-brand-50 rounded-2xl text-brand-600"><Globe className="w-6 h-6"/></div>
                     <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-800">API Global SUNAT (Privado)</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Configuración maestra para toda la plataforma</p>
                     </div>
                  </div>
                  <a 
                    href="https://apisunat.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-[10px] font-black uppercase text-brand-600 hover:text-brand-800 transition"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Documentación Oficial</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-brand-50/30 rounded-3xl border-2 border-brand-50">
                  <div className="md:col-span-2">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Token Maestro APISUNAT.pe</label>
                     <input 
                        type="password" 
                        className="w-full bg-white border-2 border-brand-100 p-4 rounded-2xl text-sm font-mono focus:border-brand-500 outline-none shadow-sm"
                        placeholder="Bearer Token..."
                        value={sunatGlobalConfig.sunatToken}
                        onChange={e => updateSunatGlobalConfig({ sunatToken: e.target.value })}
                     />
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Entorno por Defecto</label>
                     <select 
                        className="w-full bg-white border-2 border-brand-100 p-4 rounded-2xl text-sm font-black text-gray-900 outline-none"
                        value={sunatGlobalConfig.sunatApiUrl}
                        onChange={e => updateSunatGlobalConfig({ sunatApiUrl: e.target.value })}
                     >
                        <option value="https://sandbox.apisunat.pe/api/v3">Pruebas (Sandbox)</option>
                        <option value="https://api.apisunat.com/api/v3">Real (Producción)</option>
                     </select>
                  </div>
                  <div className="flex items-end">
                     <p className="text-[9px] text-gray-400 font-black uppercase leading-tight italic">
                        * Este token maestro se aplicará automáticamente a todos los usuarios para la emisión de comprobantes.
                     </p>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* MODAL USUARIOS CON FONDOS CLAROS */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="text-lg font-black uppercase tracking-tight text-gray-800">{editingUser ? 'Editar Registro' : 'Nuevo Registro'}</h3>
              <button onClick={() => setShowUserModal(false)}><X className="w-6 h-6 text-gray-400"/></button>
            </div>
            
            <form onSubmit={handleSaveUser} className="p-8 space-y-6 overflow-y-auto bg-white text-gray-900">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Nombre Completo</label>
                    <input type="text" required className="w-full border-2 border-gray-100 p-3.5 rounded-2xl text-sm font-bold text-gray-900 bg-white focus:border-brand-500 outline-none" value={userFormData.name} onChange={e => setUserFormData({...userFormData, name: e.target.value})} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Email de Acceso</label>
                    <input type="email" required className="w-full border-2 border-gray-100 p-3.5 rounded-2xl text-sm font-bold text-gray-900 bg-white focus:border-brand-500 outline-none" value={userFormData.email} onChange={e => setUserFormData({...userFormData, email: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Rol</label>
                    <select className="w-full border-2 border-gray-100 p-3.5 rounded-2xl text-sm font-black text-gray-900 bg-white" value={userFormData.role} onChange={e => setUserFormData({...userFormData, role: e.target.value as UserRole})}>
                      <option value={UserRole.USER}>Usuario Final</option>
                      <option value={UserRole.ACCOUNTANT}>Contador Profesional</option>
                      <option value={UserRole.ADMIN}>Administrador Sistema</option>
                    </select>
                  </div>
                  {userFormData.role === UserRole.USER && (
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Estado</label>
                      <select className="w-full border-2 border-gray-100 p-3.5 rounded-2xl text-sm font-black text-gray-900 bg-white" value={userFormData.subscriptionStatus} onChange={e => setUserFormData({...userFormData, subscriptionStatus: e.target.value as SubscriptionStatus})}>
                        <option value={SubscriptionStatus.ACTIVE}>Activo</option>
                        <option value={SubscriptionStatus.PENDING}>Pendiente</option>
                        <option value={SubscriptionStatus.EXPIRED}>Expirado</option>
                      </select>
                    </div>
                  )}
               </div>

                {userFormData.role === UserRole.USER && (
                  <div className="pt-6 border-t space-y-6">
                    <h4 className="text-[10px] font-black text-brand-600 uppercase tracking-widest flex items-center">
                      <Shield className="w-4 h-4 mr-2"/> Credenciales SUNAT
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Usuario SOL</label>
                        <input type="text" placeholder="MODDATOS" className="w-full border-2 border-gray-100 p-3.5 rounded-2xl text-sm font-bold text-gray-900 bg-white focus:border-brand-500 outline-none uppercase" value={userFormData.solUser} onChange={e => setUserFormData({...userFormData, solUser: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Clave SOL</label>
                        <input type="password" placeholder="********" className="w-full border-2 border-gray-100 p-3.5 rounded-2xl text-sm font-bold text-gray-900 bg-white focus:border-brand-500 outline-none" value={userFormData.solPass} onChange={e => setUserFormData({...userFormData, solPass: e.target.value})} />
                      </div>
                      {!editingUser && (
                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Contraseña Generada</label>
                          <input type="password" readOnly value={generatedPassword} className="w-full border-2 border-gray-200 p-3.5 rounded-2xl text-sm font-mono text-gray-500 bg-gray-50 cursor-not-allowed outline-none" placeholder="Se generará automáticamente" />
                        </div>
                      )}
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Contador Asignado</label>
                        <select className="w-full border-2 border-gray-100 p-3.5 rounded-2xl text-sm font-black text-gray-900 bg-white" value={userFormData.assignedAccountantId} onChange={e => setUserFormData({...userFormData, assignedAccountantId: e.target.value})}>
                          <option value="">Sin contador</option>
                          {accountants.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

               <div className="pt-6 border-t flex space-x-3">
                  <button type="button" onClick={() => setShowUserModal(false)} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-xs">Cancelar</button>
                  <button type="submit" className="flex-1 py-4 bg-brand-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-brand-100">Guardar Cambios</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* HISTORIAL MODAL */}
      {viewHistoryUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl h-fit overflow-hidden animate-fade-in-up flex flex-col">
            <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
              <div><h3 className="text-lg font-black uppercase tracking-tight">Historial de Pagos</h3><p className="text-[10px] text-gray-400 font-bold uppercase">{viewHistoryUser.name}</p></div>
              <button onClick={() => setViewHistoryUser(null)}><X className="w-6 h-6 text-gray-400"/></button>
            </div>
            <div className="p-8 max-h-[500px] overflow-y-auto space-y-4">
               {subscriptionHistory.filter(h => h.userId === viewHistoryUser.id).map(h => (
                 <div key={h.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                    <div>
                       <p className="text-xs font-black text-gray-900 uppercase">{h.packageName}</p>
                       <p className="text-[9px] text-gray-400 font-bold uppercase">{h.date} • {h.paymentDetails}</p>
                    </div>
                    <p className="text-sm font-black text-brand-700">S/ {h.amount.toFixed(2)}</p>
                 </div>
               ))}
               {subscriptionHistory.filter(h => h.userId === viewHistoryUser.id).length === 0 && <p className="text-center py-10 text-gray-400 text-xs italic">No hay registros.</p>}
            </div>
            <div className="p-6 bg-gray-50 border-t flex justify-center">
              <button onClick={() => setViewHistoryUser(null)} className="px-10 py-3 bg-white border border-gray-200 rounded-2xl text-[10px] font-black uppercase text-gray-500">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PREVISUALIZACIÓN DE VOUCHER DE PAGO */}
      {previewVoucherRec && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl relative animate-fade-in-up">
            <div className="p-6 bg-brand-600 text-white flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <CreditCard className="w-6 h-6"/>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide">Comprobante de Pago</h3>
                  <p className="text-[10px] opacity-80 uppercase font-bold">{previewVoucherRec.packageName} — S/ {previewVoucherRec.amount.toFixed(2)}</p>
                </div>
              </div>
              <button onClick={() => setPreviewVoucherRec(null)} className="text-white hover:rotate-90 transition"><X className="w-5 h-5"/></button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="flex justify-between items-center text-xs border-b border-gray-100 pb-3">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase">Usuario</p>
                  <p className="font-black text-gray-900 uppercase">{users.find(u => u.id === previewVoucherRec.userId)?.name || 'Cliente'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-gray-400 uppercase">Fecha Solicitud</p>
                  <p className="font-mono font-bold text-gray-700">{previewVoucherRec.date}</p>
                </div>
              </div>

              {previewVoucherRec.voucherImage ? (
                <div className="rounded-2xl border-2 border-brand-100 overflow-hidden bg-gray-50 flex items-center justify-center p-2">
                  <img
                    src={`data:image/jpeg;base64,${previewVoucherRec.voucherImage}`}
                    alt="Voucher de pago"
                    className="max-h-96 w-full object-contain rounded-xl shadow-md bg-white"
                  />
                </div>
              ) : (
                <p className="p-8 text-center text-gray-400 italic text-sm">No hay imagen adjunta para este pago.</p>
              )}

              {previewVoucherRec.status === 'PENDING' && (
                <div className="pt-4 flex gap-3 border-t border-gray-100">
                  <button
                    onClick={() => {
                      const reqUser = users.find(u => u.id === previewVoucherRec.userId);
                      if (!reqUser) return;
                      const pkg = packages.find(p => p.name === previewVoucherRec.packageName);
                      const durationMonths = pkg ? pkg.durationMonths : 1;
                      let baseStartDate = new Date();
                      const hasActiveSub = reqUser.subscriptionStatus === SubscriptionStatus.ACTIVE && reqUser.subscriptionEndDate && new Date(reqUser.subscriptionEndDate) > new Date();
                      if (hasActiveSub && reqUser.subscriptionEndDate) {
                        baseStartDate = new Date(reqUser.subscriptionEndDate);
                      }
                      const endDate = new Date(baseStartDate);
                      endDate.setMonth(endDate.getMonth() + durationMonths);
                      const startStr = baseStartDate.toISOString().split('T')[0];
                      const endStr = endDate.toISOString().split('T')[0];
                      const userStartStr = (hasActiveSub && reqUser.subscriptionStartDate) ? reqUser.subscriptionStartDate : startStr;

                      updateUser(reqUser.id, {
                        subscriptionStatus: SubscriptionStatus.ACTIVE,
                        subscriptionStartDate: userStartStr,
                        subscriptionEndDate: endStr
                      });
                      updateSubscriptionRecord(previewVoucherRec.id, { status: 'PAID', startDate: startStr, endDate: endStr });
                      addNotification({
                        id: Date.now().toString(),
                        userId: reqUser.id,
                        message: hasActiveSub
                          ? `¡Tu renovación al ${previewVoucherRec.packageName} fue APROBADA! Tu suscripción se ha extendido hasta el ${new Date(endStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}.`
                          : `¡Tu suscripción al ${previewVoucherRec.packageName} fue APROBADA! Tu plan está activo hasta el ${new Date(endStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
                        date: new Date().toLocaleDateString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                        isRead: false,
                        type: 'SUBSCRIPTION'
                      });
                      setPreviewVoucherRec(null);
                    }}
                    className="flex-1 py-3 bg-green-600 text-white rounded-xl text-xs font-black uppercase hover:bg-green-700 transition shadow-lg flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Aprobar Pago
                  </button>
                  <button
                    onClick={() => {
                      const reqUser = users.find(u => u.id === previewVoucherRec.userId);
                      if (!reqUser) return;
                      const hasActiveSub = reqUser.subscriptionStatus === SubscriptionStatus.ACTIVE && reqUser.subscriptionEndDate && new Date(reqUser.subscriptionEndDate) > new Date();
                      if (!hasActiveSub) {
                        updateUser(reqUser.id, { subscriptionStatus: SubscriptionStatus.EXPIRED });
                      }
                      updateSubscriptionRecord(previewVoucherRec.id, { status: 'CANCELLED' });
                      addNotification({
                        id: Date.now().toString(),
                        userId: reqUser.id,
                        message: `Tu solicitud de pago para el ${previewVoucherRec.packageName} fue rechazada por el administrador.`,
                        date: new Date().toLocaleDateString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                        isRead: false,
                        type: 'SUBSCRIPTION'
                      });
                      setPreviewVoucherRec(null);
                    }}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase hover:bg-red-700 transition shadow-lg flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" /> Rechazar Pago
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
