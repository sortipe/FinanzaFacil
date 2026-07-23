import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { UserRole, SubscriptionStatus } from '../types';
import { CheckCircle2, AlertCircle, Lock, KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';

export const Auth: React.FC = () => {
  const { currentUser, login, registerUser, changePassword, logout } = useStore();
  const [isLogin, setIsLogin] = useState(true);

  // If user is already logged in but must change password, show change form
  const mustChange = currentUser && currentUser.mustChangePassword;

  // Login/Register fields
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Change password fields
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmNewPwd, setConfirmNewPwd] = useState('');
  
  // Feedback states
  const [changeError, setChangeError] = useState('');
  const [authError, setAuthError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSuccessMsg('');
    const ok = login(email, password);
    if (!ok) {
      setAuthError('Credenciales incorrectas. Revisa tu correo y contraseña.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSuccessMsg('');
    if (password !== confirmPassword) {
      setAuthError('Las contraseñas ingresadas no coinciden.');
      return;
    }
    try {
      await registerUser({
        id: Date.now().toString(),
        email,
        name,
        password,
        mustChangePassword: false,
        role: UserRole.USER,
        subscriptionStatus: SubscriptionStatus.PENDING
      });
      setSuccessMsg('¡Cuenta registrada con éxito! Ya puedes iniciar sesión.');
      setIsLogin(true);
    } catch (err: any) {
      setAuthError(err.message || 'Error al conectar con el servidor.');
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError('');
    setSuccessMsg('');

    if (newPwd !== confirmNewPwd) {
      setChangeError('Las contraseñas nuevas no coinciden');
      return;
    }
    if (!currentUser) return;

    const ok = changePassword(currentUser.id, currentPwd, newPwd);
    if (ok) {
      setSuccessMsg('¡Contraseña actualizada exitosamente! Accediendo a tu cuenta...');
    } else {
      setChangeError('La contraseña actual ingresada es incorrecta.');
    }
  };

  // ─── CHANGE PASSWORD VIEW ───
  if (mustChange) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-orange-50/30 p-4">
        <div className="bg-white/80 backdrop-blur-md p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-gray-100 w-full max-w-md relative overflow-hidden animate-fade-in">
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
            <ShieldCheck className="w-32 h-32 text-brand-600" />
          </div>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <KeyRound className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-1">Cambio de Contraseña</h1>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
              {currentUser.name}, actualiza tu clave temporal
            </p>
          </div>

          {successMsg ? (
            <div className="bg-emerald-50 border-2 border-emerald-200 p-6 rounded-3xl text-center space-y-4 animate-fade-in shadow-sm">
              <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center mx-auto text-white shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-black text-emerald-950 uppercase tracking-tight">{successMsg}</p>
                <p className="text-[11px] font-medium text-emerald-700 mt-1">Cargando tu panel principal...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Contraseña Actual</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="password" 
                    required 
                    value={currentPwd} 
                    onChange={e => setCurrentPwd(e.target.value)}
                    className="w-full bg-white border-2 border-gray-200 p-3.5 pl-11 rounded-2xl text-sm font-bold text-gray-900 focus:border-brand-500 outline-none transition-all placeholder:text-gray-300" 
                    placeholder="Ingresa tu clave temporal" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nueva Contraseña</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="password" 
                    required 
                    minLength={6}
                    value={newPwd} 
                    onChange={e => setNewPwd(e.target.value)}
                    className="w-full bg-white border-2 border-gray-200 p-3.5 pl-11 rounded-2xl text-sm font-bold text-gray-900 focus:border-brand-500 outline-none transition-all placeholder:text-gray-300" 
                    placeholder="Mínimo 6 caracteres" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Confirmar Nueva Contraseña</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="password" 
                    required 
                    value={confirmNewPwd} 
                    onChange={e => setConfirmNewPwd(e.target.value)}
                    className="w-full bg-white border-2 border-gray-200 p-3.5 pl-11 rounded-2xl text-sm font-bold text-gray-900 focus:border-brand-500 outline-none transition-all placeholder:text-gray-300" 
                    placeholder="Repite la nueva clave" 
                  />
                </div>
              </div>

              {changeError && (
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-center gap-3 animate-shake">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <p className="text-xs font-black text-red-800 leading-tight">{changeError}</p>
                </div>
              )}

              <button 
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-brand-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Actualizar Contraseña <ArrowRight className="w-4 h-4" />
              </button>

              <button 
                type="button" 
                onClick={logout}
                className="w-full text-gray-400 hover:text-gray-600 text-xs font-bold py-2 transition text-center uppercase tracking-wider"
              >
                Cerrar Sesión
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ─── LOGIN / REGISTER VIEW ───
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      handleLogin(e);
    } else {
      handleRegister(e);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-gray-100 to-orange-50/30 p-4">
      <div className="bg-white/90 backdrop-blur-md p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-gray-100 w-full max-w-md animate-fade-in relative">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Finanza<span className="text-brand-600">Facil</span></h1>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
            {isLogin ? 'Ingresa a tu cuenta' : 'Crea tu cuenta empresarial'}
          </p>
        </div>

        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center gap-3 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-xs font-black text-emerald-900 uppercase">{successMsg}</p>
          </div>
        )}

        {authError && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-center gap-3 animate-shake">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-xs font-black text-red-800 leading-tight">{authError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nombre Completo</label>
              <input 
                type="text" 
                required
                className="w-full bg-white border-2 border-gray-200 p-3.5 rounded-2xl text-sm font-bold text-gray-900 focus:border-brand-500 outline-none transition-all"
                value={name} 
                onChange={e => setName(e.target.value)} 
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Correo Electrónico</label>
            <input 
              type="email" 
              required
              className="w-full bg-white border-2 border-gray-200 p-3.5 rounded-2xl text-sm font-bold text-gray-900 focus:border-brand-500 outline-none transition-all"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Contraseña</label>
            <input 
              type="password" 
              required
              className="w-full bg-white border-2 border-gray-200 p-3.5 rounded-2xl text-sm font-bold text-gray-900 focus:border-brand-500 outline-none transition-all"
              placeholder="********" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Confirmar Contraseña</label>
              <input 
                type="password" 
                required
                className="w-full bg-white border-2 border-gray-200 p-3.5 rounded-2xl text-sm font-bold text-gray-900 focus:border-brand-500 outline-none transition-all"
                placeholder="Repite la contraseña" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
              />
            </div>
          )}

          <button 
            type="submit"
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-brand-500/20 transition-all active:scale-[0.98] mt-2"
          >
            {isLogin ? 'Ingresar al Sistema' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => { setIsLogin(!isLogin); setAuthError(''); setSuccessMsg(''); }}
            className="text-xs font-bold text-brand-600 hover:text-brand-800 transition uppercase tracking-wider"
          >
            {isLogin ? '¿No tienes cuenta? Regístrate gratis' : '¿Ya tienes cuenta? Ingresa aquí'}
          </button>
        </div>

        {isLogin && (
          <div className="mt-8 bg-gray-50/80 p-4 rounded-2xl text-xs text-gray-500 border border-gray-100">
            <p className="font-black uppercase tracking-widest text-[9px] text-gray-400 mb-2">Credenciales Demo:</p>
            <p className="mb-1"><span className="font-bold text-gray-700">Admin:</span> admin@app.com / 123</p>
            <p className="mb-1"><span className="font-bold text-gray-700">Contador:</span> carlos@contador.com / 123</p>
            <p><span className="font-bold text-gray-700">Usuario:</span> user@demo.com / 123</p>
          </div>
        )}
      </div>
    </div>
  );
};