import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { UserRole, SubscriptionStatus } from '../types';
import { CheckCircle2, AlertCircle, Lock, KeyRound, ArrowRight, ShieldCheck, Database, RefreshCw, X, Loader2, Eye, EyeOff } from 'lucide-react';

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

  // DB Validator states
  const [showDbStatusModal, setShowDbStatusModal] = useState(false);
  const [dbStatusData, setDbStatusData] = useState<any>(null);
  const [testingDb, setTestingDb] = useState(false);

  // Password visibility toggles
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmNewPwd, setShowConfirmNewPwd] = useState(false);

  const checkDbConnection = async () => {
    setTestingDb(true);
    try {
      const res = await fetch('/api/db-status');
      const data = await res.json();
      setDbStatusData(data);
    } catch (err: any) {
      setDbStatusData({
        status: 'error',
        message: err.message || 'Sin respuesta del servidor backend',
        timestamp: new Date().toISOString()
      });
    } finally {
      setTestingDb(false);
    }
  };

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
                    type={showCurrentPwd ? 'text' : 'password'}
                    required 
                    value={currentPwd} 
                    onChange={e => setCurrentPwd(e.target.value)}
                    className="w-full bg-white border-2 border-gray-200 p-3.5 pl-11 pr-11 rounded-2xl text-sm font-bold text-gray-900 focus:border-brand-500 outline-none transition-all placeholder:text-gray-300" 
                    placeholder="Ingresa tu clave temporal" 
                  />
                  <button type="button" onClick={() => setShowCurrentPwd(!showCurrentPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                    {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nueva Contraseña</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type={showNewPwd ? 'text' : 'password'}
                    required 
                    minLength={6}
                    value={newPwd} 
                    onChange={e => setNewPwd(e.target.value)}
                    className="w-full bg-white border-2 border-gray-200 p-3.5 pl-11 pr-11 rounded-2xl text-sm font-bold text-gray-900 focus:border-brand-500 outline-none transition-all placeholder:text-gray-300" 
                    placeholder="Mínimo 6 caracteres" 
                  />
                  <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                    {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Confirmar Nueva Contraseña</label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type={showConfirmNewPwd ? 'text' : 'password'}
                    required 
                    value={confirmNewPwd} 
                    onChange={e => setConfirmNewPwd(e.target.value)}
                    className="w-full bg-white border-2 border-gray-200 p-3.5 pl-11 pr-11 rounded-2xl text-sm font-bold text-gray-900 focus:border-brand-500 outline-none transition-all placeholder:text-gray-300" 
                    placeholder="Repite la nueva clave" 
                  />
                  <button type="button" onClick={() => setShowConfirmNewPwd(!showConfirmNewPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                    {showConfirmNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
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
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type={(isLogin ? showLoginPassword : showRegisterPassword) ? 'text' : 'password'}
                  required
                  className="w-full bg-white border-2 border-gray-200 p-3.5 pl-11 pr-11 rounded-2xl text-sm font-bold text-gray-900 focus:border-brand-500 outline-none transition-all"
                  placeholder={isLogin ? '********' : 'Mínimo 6 caracteres'} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                />
                <button type="button" onClick={() => isLogin ? setShowLoginPassword(!showLoginPassword) : setShowRegisterPassword(!showRegisterPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                  {(isLogin ? showLoginPassword : showRegisterPassword) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Confirmar Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  className="w-full bg-white border-2 border-gray-200 p-3.5 pl-11 pr-11 rounded-2xl text-sm font-bold text-gray-900 focus:border-brand-500 outline-none transition-all"
                  placeholder="Repite la contraseña" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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

        <div className="mt-8 pt-4 border-t border-gray-100 text-center">
          <button
            type="button"
            onClick={() => {
              setShowDbStatusModal(true);
              checkDbConnection();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition shadow-sm"
          >
            <Database className="w-3.5 h-3.5 text-brand-600" />
            Verificar Estado de Base de Datos
          </button>
        </div>
      </div>

      {/* MODAL VALIDADOR DE CONEXIÓN A BASE DE DATOS */}
      {showDbStatusModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-fade-in-up relative">
            <div className="p-6 bg-gray-900 text-white flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <Database className="w-6 h-6 text-brand-400" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide">Estado de Base de Datos</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Validador público de conexión MySQL</p>
                </div>
              </div>
              <button onClick={() => setShowDbStatusModal(false)} className="text-gray-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {testingDb ? (
                <div className="py-8 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
                  <p className="text-xs font-black text-gray-600 uppercase tracking-widest">Probando conexión a MySQL...</p>
                </div>
              ) : dbStatusData ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-2xl border-2 flex items-center gap-3 ${
                    dbStatusData.status === 'connected'
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    <div className={`w-3 h-3 rounded-full shrink-0 ${
                      dbStatusData.status === 'connected' ? 'bg-green-500 animate-ping' : 'bg-red-500'
                    }`} />
                    <div>
                      <p className="text-xs font-black uppercase tracking-wide">
                        {dbStatusData.status === 'connected' ? 'Conexión Exitosa' : 'Error de Conexión'}
                      </p>
                      <p className="text-[10px] font-bold opacity-80">
                        {dbStatusData.status === 'connected' ? 'Base de datos respondiendo en tiempo real.' : dbStatusData.message}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2.5 text-xs font-bold text-gray-700">
                    <div className="flex justify-between items-center border-b border-gray-200/60 pb-2">
                      <span className="text-[10px] font-black uppercase text-gray-400">Servidor (Host)</span>
                      <span className="font-mono font-black text-gray-900">{dbStatusData.host || '127.0.0.1'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-200/60 pb-2">
                      <span className="text-[10px] font-black uppercase text-gray-400">Puerto</span>
                      <span className="font-mono font-black text-gray-900">{dbStatusData.port || '3306'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-200/60 pb-2">
                      <span className="text-[10px] font-black uppercase text-gray-400">Base de Datos</span>
                      <span className="font-black text-brand-700 uppercase">{dbStatusData.database || 'finanzafacil'}</span>
                    </div>
                    {dbStatusData.responseTimeMs !== undefined && (
                      <div className="flex justify-between items-center border-b border-gray-200/60 pb-2">
                        <span className="text-[10px] font-black uppercase text-gray-400">Latencia / Tiempo</span>
                        <span className="font-mono font-black text-green-600">{dbStatusData.responseTimeMs} ms</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-1 text-[9px] text-gray-400">
                      <span>Última comprobación</span>
                      <span className="font-mono">{new Date(dbStatusData.timestamp).toLocaleTimeString('es-ES')}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={checkDbConnection}
                  disabled={testingDb}
                  className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-brand-700 transition shadow-md flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${testingDb ? 'animate-spin' : ''}`} /> Probar Conexión Nuevamente
                </button>
                <button
                  type="button"
                  onClick={() => setShowDbStatusModal(false)}
                  className="px-5 py-3 border border-gray-200 text-gray-600 rounded-xl text-xs font-black uppercase hover:bg-gray-100 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};