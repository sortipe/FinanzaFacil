import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { LogOut, Home, Users, DollarSign, Settings, FileText, Menu, X, User, Camera, Lock, Save, ShieldCheck, Headphones, CheckCircle2, Loader2, Globe, Book, Send, AlertCircle, Info, Plus, Trash2, UserCheck, RefreshCw, UserPlus, Eye, EyeOff, Mail } from 'lucide-react';
import { sunatService } from '../services/sunatService';
import { fileToBase64 } from '../services/geminiService';
import { formatImageUrl } from '../utils/imageUtils';
import { evaluatePassword } from '../utils/passwordValidation';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentUser, currentSubUser, savedAccounts, switchAccount, removeSavedAccount, logout, updateUser, sunatGlobalConfig, addComplaint, isSubUser, changePassword, login } = useStore();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [addAccEmail, setAddAccEmail] = useState('');
  const [addAccPassword, setAddAccPassword] = useState('');
  const [addAccError, setAddAccError] = useState('');
  const [showAddAccPassword, setShowAddAccPassword] = useState(false);
  const [addAccLoading, setAddAccLoading] = useState(false);

  const handleOpenAddAccount = () => {
    setAddAccEmail('');
    setAddAccPassword('');
    setAddAccError('');
    setShowAddAccPassword(false);
    setShowAccountsModal(false);
    setShowAddAccountModal(true);
  };

  const handleAddAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddAccError('');
    if (!addAccEmail || !addAccPassword) {
      setAddAccError('Por favor ingresa tu correo y contraseña.');
      return;
    }
    setAddAccLoading(true);
    try {
      const ok = login(addAccEmail, addAccPassword);
      if (ok) {
        setShowAddAccountModal(false);
        setAddAccEmail('');
        setAddAccPassword('');
      } else {
        setAddAccError('Credenciales incorrectas o la cuenta requiere activación.');
      }
    } catch (err: any) {
      setAddAccError(err.message || 'Error al conectar con el servidor.');
    } finally {
      setAddAccLoading(false);
    }
  };
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [complaintForm, setComplaintForm] = useState({
    type: 'RECLAMO' as 'RECLAMO' | 'QUEJA',
    description: '',
    detail: ''
  });
  const [complaintSuccess, setComplaintSuccess] = useState(false);

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNextPw, setShowNextPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    profilePicture: '',
    ruc: '',
    solUser: '',
    solPass: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser && showProfileModal) {
      setFormData({
        name: currentUser.name || '',
        profilePicture: currentUser.profilePicture || '',
        ruc: currentUser.ruc || '',
        solUser: currentUser.solUser || '',
        solPass: currentUser.solPass || ''
      });
      setSaveSuccess(false);
      setPwForm({ current: '', next: '', confirm: '' });
      setPwError('');
      setPwSuccess(false);
      setShowCurrentPw(false);
      setShowNextPw(false);
      setShowConfirmPw(false);
    }
  }, [currentUser, showProfileModal]);

  if (!currentUser) return <>{children}</>;

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setPwSuccess(false);
    setPwError('');

    const pwdEval = evaluatePassword(pwForm.next, currentUser.email, currentUser.name);
    if (!pwdEval.isValid) {
      setPwError(`La nueva contraseña no cumple los requisitos: ${pwdEval.errors.join('. ')}.`);
      return;
    }

    if (pwForm.next !== pwForm.confirm) {
      setPwError('Las contraseñas no coinciden.');
      return;
    }

    if (changePassword(currentUser.id, pwForm.current, pwForm.next)) {
      setPwForm({ current: '', next: '', confirm: '' });
      setPwError('');
      setPwSuccess(true);
      setShowCurrentPw(false);
      setShowNextPw(false);
      setShowConfirmPw(false);
    } else {
      setPwError('La contraseña actual es incorrecta.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      setFormData(prev => ({ ...prev, profilePicture: base64 }));
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    updateUser(currentUser.id, {
       name: formData.name,
       profilePicture: formData.profilePicture,
       ruc: formData.ruc || undefined,
       solUser: formData.solUser || undefined,
       solPass: formData.solPass || undefined
    });

    setSaveSuccess(true);
    setTimeout(() => {
      setShowProfileModal(false);
      setSaveSuccess(false);
    }, 1500);
  };

  const handleComplaintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const newComplaint = {
      id: `COMP-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      date: new Date().toLocaleDateString('es-ES'),
      time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      ...complaintForm,
      status: 'PENDIENTE' as 'PENDIENTE' | 'ATENDIDO'
    };

    addComplaint(newComplaint);
    setComplaintSuccess(true);
    setTimeout(() => {
      setShowComplaintModal(false);
      setComplaintSuccess(false);
      setComplaintForm({ type: 'RECLAMO', description: '', detail: '' });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar Mobile Navigation */}
      <div className="md:hidden bg-white border-b px-4 py-3 flex justify-between items-center sticky top-0 z-40">
        <h1 className="text-xl font-bold text-brand-700">FinanzaFacil</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAccountsModal(true)}
            className="px-2.5 py-1 bg-brand-50 text-brand-700 rounded-full text-[9px] font-black uppercase flex items-center gap-1 border border-brand-200"
          >
            <Users className="w-3 h-3" /> Cuentas ({savedAccounts.length})
          </button>
          <button onClick={() => setShowProfileModal(true)} className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center border border-brand-200 overflow-hidden">
            {currentUser.profilePicture ? <img src={formatImageUrl(currentUser.profilePicture)} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-brand-500" />}
          </button>
        </div>
      </div>

      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-brand-700">FinanzaFacil</h1>
          <p className="text-[10px] text-gray-400 mt-1 font-black uppercase tracking-widest">{currentUser.role}</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
           <div className="px-4 mb-3">
             <button onClick={() => setShowProfileModal(true)} className="w-full bg-brand-50 rounded-2xl p-4 flex items-center space-x-3 hover:bg-brand-100 transition text-left group border border-transparent hover:border-brand-200">
               <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center overflow-hidden border border-brand-200 shrink-0 shadow-sm">
                  {currentUser.profilePicture ? <img src={formatImageUrl(currentUser.profilePicture)} className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-brand-500" />}
               </div>
               <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-brand-900 truncate">{currentUser.name}</p>
                  <p className="text-[9px] text-brand-600 font-black uppercase flex items-center mt-0.5 tracking-tighter"><Settings className="w-3 h-3 mr-1" /> Configurar Cuenta</p>
               </div>
             </button>
           </div>

           {/* SECCIÓN MULTI-CUENTA (CAMBIO RÁPIDO) */}
           <div className="px-4 mb-4">
             <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 space-y-2">
               <div className="flex items-center justify-between px-1">
                 <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                   <Users className="w-3.5 h-3.5 text-brand-600" /> Mis Cuentas ({savedAccounts.length})
                 </p>
                 <button
                   onClick={() => setShowAccountsModal(true)}
                   className="text-[9px] font-black uppercase text-brand-600 hover:text-brand-800 transition"
                 >
                   Gestionar
                 </button>
               </div>

               <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                 {savedAccounts.slice(0, 4).map((acc) => {
                   const isActive = currentUser.id === acc.userId && (acc.subUserId || '') === (currentSubUser?.id || '');
                   return (
                     <div
                       key={`${acc.userId}-${acc.subUserId || ''}`}
                       onClick={() => {
                         if (!isActive) switchAccount(acc.userId, acc.subUserId);
                       }}
                       className={`p-2 rounded-xl flex items-center justify-between gap-2 transition text-left ${
                         isActive
                           ? 'bg-white border-2 border-brand-400 shadow-sm'
                           : 'hover:bg-white hover:border-slate-300 cursor-pointer border border-transparent'
                       }`}
                     >
                       <div className="flex items-center space-x-2 min-w-0 flex-1">
                         <div className="w-7 h-7 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center shrink-0 overflow-hidden text-brand-700 font-bold text-xs">
                           {acc.profilePicture ? (
                             <img src={formatImageUrl(acc.profilePicture)} className="w-full h-full object-cover" />
                           ) : (
                             acc.name.charAt(0).toUpperCase()
                           )}
                         </div>
                         <div className="min-w-0 flex-1">
                           <p className="text-xs font-black text-slate-900 truncate leading-tight">{acc.name}</p>
                           <p className="text-[8px] font-bold text-brand-600 uppercase tracking-tighter truncate">
                             {acc.accountTypeLabel || acc.role}
                           </p>
                         </div>
                       </div>
                       {isActive ? (
                         <span className="text-[8px] font-black bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full uppercase shrink-0">
                           En Uso
                         </span>
                       ) : (
                         <span className="text-[8px] font-black text-slate-400 group-hover:text-brand-600 uppercase shrink-0">
                           Cambiar
                         </span>
                       )}
                     </div>
                   );
                 })}
               </div>

                <button
                  onClick={handleOpenAddAccount}
                  className="w-full mt-2 py-2 bg-white hover:bg-brand-50 text-slate-700 hover:text-brand-700 rounded-xl text-[9px] font-black uppercase transition border border-slate-200 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 text-brand-600" /> Agregar otra cuenta
                </button>
             </div>
           </div>

           <div className="px-4 mt-auto">
               <button 
                 onClick={() => {
                   const rawPhone = (sunatGlobalConfig.supportPhone || '999888777').replace(/\D/g, '');
                   const cleanPhone = rawPhone.startsWith('51') ? rawPhone : `51${rawPhone}`;
                   window.open(`https://wa.me/${cleanPhone}`, '_blank');
                 }} 
                 className="w-full flex items-center px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
               >
                 <Headphones className="w-4 h-4 mr-3" /> Soporte Premium
               </button>
              <button onClick={() => setShowComplaintModal(true)} className="w-full flex items-center px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all mt-1">
                <Book className="w-4 h-4 mr-3" /> Libro de Reclamaciones
              </button>
           </div>
        </nav>
        <div className="p-4 border-t border-gray-100">
          <button onClick={logout} className="flex items-center justify-center w-full px-4 py-2.5 text-xs font-black uppercase tracking-widest text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
            <LogOut className="w-4 h-4 mr-2" /> Salir
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {/* Profile / Settings Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-black uppercase tracking-tight text-gray-800">Ajustes de Perfil</h3>
              <button onClick={() => setShowProfileModal(false)}><X className="w-6 h-6 text-gray-400 hover:text-red-500 transition"/></button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-8 space-y-6 overflow-y-auto bg-white">
              {saveSuccess ? (
                <div className="py-12 text-center animate-bounce">
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h4 className="text-xl font-black text-green-900 uppercase">¡Guardado!</h4>
                  <p className="text-sm text-gray-500 font-bold">Tus datos han sido actualizados.</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center">
                    <div onClick={() => fileInputRef.current?.click()} className="relative w-24 h-24 rounded-3xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer overflow-hidden group shadow-inner">
                      {formData.profilePicture ? <img src={formatImageUrl(formData.profilePicture)} className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-gray-300" />}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"><Camera className="w-6 h-6 text-white"/></div>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                    <p className="mt-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cambiar Foto</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Nombre Completo</label>
                      <input
                        type="text"
                        placeholder="Escribe tu nombre aquí"
                        className="w-full bg-white border-gray-200 border-2 p-3.5 rounded-2xl text-sm font-bold text-gray-900 focus:border-brand-500 outline-none transition-all placeholder:text-gray-300"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="border-t border-dashed border-gray-200 pt-6">
                    <p className="text-xs font-black text-brand-900 uppercase tracking-tight mb-1">Datos SUNAT para Recibos por Honorarios</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-4">Usa tu RUC personal y credenciales SOL de empleado.</p>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">RUC (Personal)</label>
                        <input
                          type="text"
                          maxLength={11}
                          placeholder="20123456789"
                          className="w-full bg-white border-gray-200 border-2 p-3.5 rounded-2xl text-sm font-mono font-bold text-gray-900 focus:border-brand-500 outline-none transition-all placeholder:text-gray-300"
                          value={formData.ruc}
                          onChange={e => setFormData({...formData, ruc: e.target.value.replace(/\D/g, '')})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Usuario SOL</label>
                        <input
                          type="text"
                          placeholder="AAAFFF11111"
                          className="w-full bg-white border-gray-200 border-2 p-3.5 rounded-2xl text-sm font-mono font-bold text-gray-900 focus:border-brand-500 outline-none transition-all placeholder:text-gray-300"
                          value={formData.solUser}
                          onChange={e => setFormData({...formData, solUser: e.target.value.toUpperCase()})}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Clave SOL</label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          className="w-full bg-white border-gray-200 border-2 p-3.5 rounded-2xl text-sm font-mono font-bold text-gray-900 focus:border-brand-500 outline-none transition-all placeholder:text-gray-300"
                          value={formData.solPass}
                          onChange={e => setFormData({...formData, solPass: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest mt-4 shadow-xl hover:bg-brand-700 transition active:scale-[0.98] flex items-center justify-center">
                    <Save className="w-4 h-4 mr-2" /> Guardar Cambios
                  </button>
                </>
              )}
            </form>
            {!currentUser.parentId && !isSubUser && (
              <div className="p-8 pt-0 overflow-y-auto bg-white">
                <div className="border-t border-dashed border-gray-200 pt-6">
                  <div className="flex items-center mb-1">
                    <Lock className="w-4 h-4 text-brand-600 mr-2" />
                    <p className="text-xs font-black text-brand-900 uppercase tracking-tight">Cambiar Contraseña</p>
                  </div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mb-4">Ingresa tu contraseña actual y una nueva.</p>
                  {pwSuccess ? (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-2xl text-xs font-black uppercase animate-fade-in-up">
                      <CheckCircle2 className="w-4 h-4" /> Contraseña actualizada correctamente
                    </div>
                  ) : (
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Contraseña Actual</label>
                        <div className="relative">
                          <input
                            type={showCurrentPw ? 'text' : 'password'}
                            required
                            placeholder="••••••••"
                            className="w-full bg-white border-gray-200 border-2 p-3.5 pr-11 rounded-2xl text-sm font-mono font-bold text-gray-900 focus:border-brand-500 outline-none transition-all placeholder:text-gray-300"
                            value={pwForm.current}
                            onChange={e => setPwForm({ ...pwForm, current: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPw(!showCurrentPw)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                          >
                            {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Nueva Contraseña</label>
                        <div className="relative">
                          <input
                            type={showNextPw ? 'text' : 'password'}
                            required
                            minLength={8}
                            placeholder="Mínimo 8 caracteres"
                            className="w-full bg-white border-gray-200 border-2 p-3.5 pr-11 rounded-2xl text-sm font-mono font-bold text-gray-900 focus:border-brand-500 outline-none transition-all placeholder:text-gray-300"
                            value={pwForm.next}
                            onChange={e => setPwForm({ ...pwForm, next: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => setShowNextPw(!showNextPw)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                          >
                            {showNextPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {pwForm.next.length > 0 && (
                          <PasswordStrengthMeter analysis={evaluatePassword(pwForm.next, currentUser?.email, currentUser?.name)} />
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Confirmar Nueva Contraseña</label>
                        <div className="relative">
                          <input
                            type={showConfirmPw ? 'text' : 'password'}
                            required
                            placeholder="Repite la nueva clave"
                            className="w-full bg-white border-gray-200 border-2 p-3.5 pr-11 rounded-2xl text-sm font-mono font-bold text-gray-900 focus:border-brand-500 outline-none transition-all placeholder:text-gray-300"
                            value={pwForm.confirm}
                            onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPw(!showConfirmPw)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                          >
                            {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      {pwError && (
                        <p className="text-[10px] font-black text-red-500 uppercase flex items-center">
                          <AlertCircle className="w-3.5 h-3.5 mr-1.5 shrink-0" /> {pwError}
                        </p>
                      )}
                      <button type="submit" className="w-full py-4 bg-brand-50 text-brand-700 border-2 border-brand-200 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-100 transition active:scale-[0.98] flex items-center justify-center">
                        <Lock className="w-4 h-4 mr-2" /> Cambiar Contraseña
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Libro de Reclamaciones Modal */}
      {showComplaintModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center bg-brand-600 text-white">
              <div className="flex items-center space-x-3">
                <Book className="w-6 h-6"/>
                <h3 className="text-lg font-black uppercase tracking-tight">Libro de Reclamaciones</h3>
              </div>
              <button onClick={() => setShowComplaintModal(false)}><X className="w-6 h-6 text-white hover:rotate-90 transition-transform"/></button>
             </div>

             <div className="p-8 overflow-y-auto bg-white">
              {complaintSuccess ? (
                <div className="py-12 text-center">
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h4 className="text-xl font-black text-green-900 uppercase tracking-tight">¡Enviado con Éxito!</h4>
                  <p className="text-sm text-gray-500 font-bold max-w-xs mx-auto">Tu reclamo ha sido registrado. Nos pondremos en contacto contigo pronto.</p>
                </div>
              ) : (
                <form onSubmit={handleComplaintSubmit} className="space-y-6">
                  <div className="bg-brand-50 p-4 rounded-2xl border border-brand-100 flex items-start space-x-3">
                    <Info className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-brand-800 font-bold uppercase leading-tight">
                      Conforme a lo establecido en el Código de Protección y Defensa del Consumidor, esta institución cuenta con un Libro de Reclamaciones a su disposición.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">Tipo de Solicitud</label>
                       <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setComplaintForm({...complaintForm, type: 'RECLAMO'})}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${complaintForm.type === 'RECLAMO' ? 'bg-brand-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                          >
                            Reclamo
                          </button>
                          <button
                            type="button"
                            onClick={() => setComplaintForm({...complaintForm, type: 'QUEJA'})}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${complaintForm.type === 'QUEJA' ? 'bg-brand-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                          >
                            Queja
                          </button>
                       </div>
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Identificación del Bien Contratado</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Servicio de suscripción mensual"
                        className="w-full bg-white border-gray-200 border-2 p-3.5 rounded-2xl text-sm font-bold text-gray-900 focus:border-brand-500 outline-none transition-all uppercase"
                        value={complaintForm.description}
                        onChange={e => setComplaintForm({...complaintForm, description: e.target.value})}
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Detalle del Reclamo o Queja</label>
                      <textarea
                        required
                        rows={4}
                        placeholder="Describe detalladamente lo sucedido..."
                        className="w-full bg-white border-gray-200 border-2 p-3.5 rounded-2xl text-sm font-bold text-gray-900 focus:border-brand-500 outline-none transition-all"
                        value={complaintForm.detail}
                        onChange={e => setComplaintForm({...complaintForm, detail: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col space-y-4 pt-4">
                    <button type="submit" className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-brand-700 transition active:scale-[0.98] flex items-center justify-center">
                      <Send className="w-4 h-4 mr-2" /> Enviar Hoja de Reclamación
                    </button>
                    <p className="text-[9px] text-center text-gray-400 font-bold uppercase italic">* Se enviará una copia a su correo electrónico registrado.</p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Conmutador de Cuentas / Mis Cuentas Guardadas */}
      {showAccountsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up flex flex-col max-h-[85vh]">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight text-gray-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand-600" /> Mis Cuentas Guardadas
                </h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Conmutador rápido de usuarios</p>
              </div>
              <button onClick={() => setShowAccountsModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-red-500 transition"/>
              </button>
            </div>

            <div className="p-6 space-y-3 overflow-y-auto bg-white">
              {savedAccounts.map((acc) => {
                const isActive = currentUser.id === acc.userId && (acc.subUserId || '') === (currentSubUser?.id || '');
                return (
                  <div
                    key={`${acc.userId}-${acc.subUserId || ''}`}
                    className={`p-4 rounded-2xl border transition flex items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-brand-50/50 border-2 border-brand-500 shadow-sm'
                        : 'bg-gray-50 border-gray-200 hover:border-brand-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-white border border-brand-200 flex items-center justify-center shrink-0 overflow-hidden text-brand-700 font-black text-sm shadow-xs">
                        {acc.profilePicture ? (
                          <img src={formatImageUrl(acc.profilePicture)} className="w-full h-full object-cover" />
                        ) : (
                          acc.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-gray-900 truncate">{acc.name}</p>
                          {isActive && (
                            <span className="text-[8px] bg-green-100 text-green-700 font-black px-2 py-0.5 rounded-full uppercase shrink-0">
                              En Uso
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 truncate font-mono">{acc.email}</p>
                        <span className="inline-block text-[9px] font-black text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md uppercase tracking-wider mt-1">
                          {acc.accountTypeLabel || acc.role}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isActive && (
                        <button
                          onClick={() => {
                            switchAccount(acc.userId, acc.subUserId);
                            setShowAccountsModal(false);
                          }}
                          className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-[10px] font-black uppercase rounded-xl transition shadow-xs flex items-center gap-1"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Entrar
                        </button>
                      )}
                      {savedAccounts.length > 1 && (
                        <button
                          onClick={() => {
                            if (isActive) {
                              if (confirm('¿Deseas cerrar la sesión de esta cuenta y eliminarla de las cuentas guardadas?')) {
                                removeSavedAccount(acc.userId, acc.subUserId);
                              }
                            } else {
                              if (confirm(`¿Eliminar la cuenta "${acc.name}" de la lista de cuentas guardadas?`)) {
                                removeSavedAccount(acc.userId, acc.subUserId);
                              }
                            }
                          }}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                          title="Eliminar de cuentas guardadas"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="pt-4 border-t border-gray-100 space-y-2">
                <button
                  onClick={handleOpenAddAccount}
                  className="w-full py-3.5 bg-[#0B192C] hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition flex items-center justify-center gap-2 shadow-md"
                >
                  <Plus className="w-4 h-4 text-amber-400" /> Agregar Otra Cuenta (Iniciar Sesión)
                </button>
                <p className="text-[9px] text-center text-gray-400 font-bold uppercase tracking-wider">
                  Al agregar otra cuenta, tus cuentas guardadas se conservarán para cambiar fácilmente.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD ACCOUNT POPUP MODAL */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 relative animate-fade-in-up">
            {/* Header */}
            <div className="p-6 bg-[#0B192C] text-white flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-amber-500/20 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-400 shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-white">Agregar Otra Cuenta</h3>
                  <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Inicia sesión sin cerrar la sesión actual</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAccountModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl transition hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleAddAccountSubmit} className="p-6 space-y-4">
              {addAccError && (
                <div className="p-3.5 bg-red-50 border-2 border-red-200 rounded-2xl flex items-center gap-2.5 animate-shake">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <p className="text-xs font-black text-red-800 leading-tight">{addAccError}</p>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={addAccEmail}
                    onChange={e => setAddAccEmail(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-200 p-3.5 pl-11 rounded-2xl text-sm font-bold text-slate-900 focus:border-amber-500 outline-none transition-all placeholder:text-slate-300"
                    placeholder="ejemplo@correo.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showAddAccPassword ? 'text' : 'password'}
                    required
                    value={addAccPassword}
                    onChange={e => setAddAccPassword(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-200 p-3.5 pl-11 pr-11 rounded-2xl text-sm font-bold text-slate-900 focus:border-amber-500 outline-none transition-all placeholder:text-slate-300"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddAccPassword(!showAddAccPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  >
                    {showAddAccPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl text-xs uppercase tracking-wider transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addAccLoading}
                  className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {addAccLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
                  ) : (
                    <><UserPlus className="w-4 h-4" /> Vincular Cuenta</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
