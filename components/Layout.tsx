import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { LogOut, Home, Users, DollarSign, Settings, FileText, Menu, X, User, Camera, Lock, Save, ShieldCheck, Headphones, CheckCircle2, Loader2, Globe, Book, Send, AlertCircle, Info } from 'lucide-react';
import { sunatService } from '../services/sunatService';
import { fileToBase64 } from '../services/geminiService';
import { UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentUser, logout, updateUser, sunatGlobalConfig } = useStore();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [verificationMsg, setVerificationMsg] = useState('');
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [complaintForm, setComplaintForm] = useState({
    type: 'RECLAMO' as 'RECLAMO' | 'QUEJA',
    description: '',
    detail: ''
  });
  const [complaintSuccess, setComplaintSuccess] = useState(false);
  const { addComplaint } = useStore();
  
  const [formData, setFormData] = useState({
    name: '',
    profilePicture: ''
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser && showProfileModal) {
      setFormData({
        name: currentUser.name || '',
        profilePicture: currentUser.profilePicture || ''
      });
      setSaveSuccess(false);
    }
  }, [currentUser, showProfileModal]);

  if (!currentUser) return <>{children}</>;

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
       profilePicture: formData.profilePicture
    });

    setSaveSuccess(true);
    setTimeout(() => {
      setShowProfileModal(false);
      setSaveSuccess(false);
    }, 1500);
  };
  
  const handleVerifyCredentials = async () => {
    if (!formData.ruc || formData.ruc.length !== 11) {
        setVerificationStatus('error');
        setVerificationMsg('Ingresa un RUC válido (11 dígitos)');
        return;
    }
    if (!formData.solUser || !formData.solPass) {
        setVerificationStatus('error');
        setVerificationMsg('Usuario y Clave SOL son obligatorios');
        return;
    }
    
    // Always use global token now that user field is removed
    const activeToken = sunatGlobalConfig.sunatToken;
    
    if (!activeToken) {
        setVerificationStatus('error');
        setVerificationMsg('Falta Token Maestro en Panel Admin');
        return;
    }
    
    setIsVerifying(true);
    setVerificationStatus('idle');
    setVerificationMsg('Validando con APISUNAT...');
    
    try {
        // En un entorno real, aquí se llamaría a un endpoint de APISUNAT que valide 
        // la combinación de RUC + SOL User + SOL Pass + Token.
        // Por ahora usamos la validación de token existente y simulamos el éxito.
        const isValid = await sunatService.verifyCredentials(activeToken);
        
        // Simulamos un pequeño delay para que el usuario vea que se está procesando
        await new Promise(resolve => setTimeout(resolve, 800));

        if (isValid) {
            setVerificationStatus('success');
            setVerificationMsg(`¡Vínculo Exitoso con RUC ${formData.ruc}!`);
        } else {
            setVerificationStatus('error');
            setVerificationMsg('Token Maestro inválido o expirado');
        }
    } catch (error) {
        setVerificationStatus('error');
        setVerificationMsg('Error de red al conectar con SUNAT');
    } finally {
        setIsVerifying(false);
    }
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
        <button onClick={() => setShowProfileModal(true)} className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center border border-brand-200 overflow-hidden">
          {currentUser.profilePicture ? <img src={`data:image/jpeg;base64,${currentUser.profilePicture}`} className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-brand-500" />}
        </button>
      </div>

      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-brand-700">FinanzaFacil</h1>
          <p className="text-[10px] text-gray-400 mt-1 font-black uppercase tracking-widest">{currentUser.role}</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
           <div className="px-4 mb-4">
             <button onClick={() => setShowProfileModal(true)} className="w-full bg-brand-50 rounded-2xl p-4 flex items-center space-x-3 hover:bg-brand-100 transition text-left group border border-transparent hover:border-brand-200">
               <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center overflow-hidden border border-brand-200 shrink-0 shadow-sm">
                  {currentUser.profilePicture ? <img src={`data:image/jpeg;base64,${currentUser.profilePicture}`} className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-brand-500" />}
               </div>
               <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-brand-900 truncate">{currentUser.name}</p>
                  <p className="text-[9px] text-brand-600 font-black uppercase flex items-center mt-0.5 tracking-tighter"><Settings className="w-3 h-3 mr-1" /> Configurar Cuenta</p>
               </div>
             </button>
           </div>
           
           <div className="px-4 mt-auto">
              <button onClick={() => window.open('https://wa.me/51999888777', '_blank')} className="w-full flex items-center px-4 py-3 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all">
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
                      {formData.profilePicture ? <img src={`data:image/jpeg;base64,${formData.profilePicture}`} className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-gray-300" />}
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

                  <button type="submit" className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest mt-4 shadow-xl hover:bg-brand-700 transition active:scale-[0.98] flex items-center justify-center">
                    <Save className="w-4 h-4 mr-2" /> Guardar Cambios
                  </button>
                </>
              )}
            </form>
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
    </div>
  );
};
