import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { UserRole, SubscriptionStatus } from '../types';
import { CheckCircle2, AlertCircle, Lock, KeyRound, ArrowRight, ShieldCheck, Eye, EyeOff, User, Mail, Sparkles, TrendingUp, UserCheck, Loader2, RefreshCw, Check, X } from 'lucide-react';
import { verifyEmailToken, resendVerificationEmail } from '../src/services/api';
import { evaluatePassword, PasswordAnalysis } from '../utils/passwordValidation';

const PasswordStrengthMeter: React.FC<{ analysis: PasswordAnalysis }> = ({ analysis }) => {
  const { score, label, color, checks } = analysis;

  return (
    <div className="mt-2.5 space-y-2 text-left animate-fade-in">
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
          <span className="text-slate-400">Seguridad de clave:</span>
          <span className={score >= 70 ? 'text-emerald-600 font-bold' : score >= 45 ? 'text-amber-600 font-bold' : 'text-red-600 font-bold'}>
            {label} ({score}%)
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
          <div
            className={`h-full transition-all duration-300 ${color}`}
            style={{ width: `${Math.max(5, score)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-[10px] font-semibold text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
        <div className={`flex items-center gap-1 ${checks.minLength ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
          {checks.minLength ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <X className="w-3 h-3 text-slate-300 shrink-0" />} 8+ caracteres
        </div>
        <div className={`flex items-center gap-1 ${checks.hasUppercase ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
          {checks.hasUppercase ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <X className="w-3 h-3 text-slate-300 shrink-0" />} Mayúscula (A-Z)
        </div>
        <div className={`flex items-center gap-1 ${checks.hasLowercase ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
          {checks.hasLowercase ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <X className="w-3 h-3 text-slate-300 shrink-0" />} Minúscula (a-z)
        </div>
        <div className={`flex items-center gap-1 ${checks.hasNumber ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
          {checks.hasNumber ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <X className="w-3 h-3 text-slate-300 shrink-0" />} Número (0-9)
        </div>
        <div className={`flex items-center gap-1 ${checks.hasSpecial ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
          {checks.hasSpecial ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <X className="w-3 h-3 text-slate-300 shrink-0" />} Símbolo (!@#$...)
        </div>
        <div className={`flex items-center gap-1 ${checks.notCommon ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
          {checks.notCommon ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <X className="w-3 h-3 text-slate-300 shrink-0" />} No clave común
        </div>
      </div>
    </div>
  );
};

export const Auth: React.FC = () => {
  const { currentUser, login, registerUser, changePassword, forgotPassword, logout } = useStore();
  const [isLogin, setIsLogin] = useState(true);

  // If user is already logged in but must change password, show change form
  const mustChange = currentUser && currentUser.mustChangePassword;

  // Login/Register fields
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState(UserRole.PERSONA_NATURAL);

  // Verification states
  const [isVerifying, setIsVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verify_token');
    const paramEmail = params.get('email');

    if (paramEmail) {
      setEmail(paramEmail);
      setIsLogin(true);
    }

    if (verifyToken) {
      setIsVerifying(true);
      verifyEmailToken(verifyToken)
        .then(res => {
          setSuccessMsg(res.message || '¡Tu cuenta ha sido activada exitosamente! Ya puedes iniciar sesión.');
          if (res.email) setEmail(res.email);
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch(err => {
          setAuthError(err.message || 'El enlace de activación es inválido o ha expirado.');
        })
        .finally(() => {
          setIsVerifying(false);
        });
    }
  }, []);

  // Change password fields
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmNewPwd, setConfirmNewPwd] = useState('');

  // Feedback states
  const [changeError, setChangeError] = useState('');
  const [authError, setAuthError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Password visibility toggles
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmNewPwd, setShowConfirmNewPwd] = useState(false);

  // Forgot password recovery
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleLogin = (e?: React.FormEvent, customEmail?: string, customPassword?: string) => {
    if (e) e.preventDefault();
    setAuthError('');
    setSuccessMsg('');
    const loginEmail = customEmail || email;
    const loginPwd = customPassword || password;
    const ok = login(loginEmail, loginPwd);
    if (!ok) {
      setAuthError('Credenciales incorrectas. Revisa tu correo y contraseña.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setSuccessMsg('');

    const pwdEval = evaluatePassword(password, email, name);
    if (!pwdEval.isValid) {
      setAuthError(`La contraseña no cumple los requisitos: ${pwdEval.errors.join('. ')}.`);
      return;
    }

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
        role: selectedRole,
        subscriptionStatus: SubscriptionStatus.PENDING,
        isVerified: false
      });
      setSuccessMsg(`¡Cuenta registrada! Te hemos enviado un enlace de activación a tu correo (${email}). Por favor revisa tu bandeja de entrada o spam para activar tu cuenta antes de ingresar.`);
      setIsLogin(true);
    } catch (err: any) {
      setAuthError(err.message || 'Error al conectar con el servidor.');
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setAuthError('Ingresa tu correo electrónico para reenviar el enlace.');
      return;
    }
    setResending(true);
    setAuthError('');
    setSuccessMsg('');
    try {
      const res = await resendVerificationEmail(email);
      setSuccessMsg(res.message || 'Se ha enviado un nuevo enlace de activación a tu correo.');
    } catch (err: any) {
      setAuthError(err.message || 'No se pudo reenviar el correo de activación.');
    } finally {
      setResending(false);
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError('');
    setSuccessMsg('');

    const pwdEval = evaluatePassword(newPwd, currentUser?.email, currentUser?.name);
    if (!pwdEval.isValid) {
      setChangeError(`La nueva contraseña no cumple los requisitos: ${pwdEval.errors.join('. ')}.`);
      return;
    }

    if (newPwd !== confirmNewPwd) {
      setChangeError('Las contraseñas nuevas no coinciden');
      return;
    }
    if (!currentUser) return;

    const ok = changePassword(currentUser.id, currentPwd, newPwd);
    if (ok) {
      setSuccessMsg('¡Contraseña actualizada exitosamente! Accediendo a tu panel principal...');
    } else {
      setChangeError('La contraseña actual ingresada es incorrecta.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setRecoveryStatus('loading');
    const ok = await forgotPassword(recoveryEmail);
    if (ok) {
      setRecoveryStatus('success');
    } else {
      setRecoveryStatus('idle');
      setAuthError('Error al enviar la recuperación. Intenta más tarde.');
    }
  };

  const fillDemoUser = (demoEmail: string, demoPwd: string) => {
    setEmail(demoEmail);
    setPassword(demoPwd);
    setIsLogin(true);
    handleLogin(undefined, demoEmail, demoPwd);
  };

  // ─── CHANGE PASSWORD VIEW (SPLIT SCREEN THEME) ───
  if (mustChange) {
    return (
      <div className="min-h-screen flex bg-slate-50 text-slate-800">
        {/* LADO IZQUIERDO: HERO BRANDING */}
        <div className="hidden lg:flex w-1/2 bg-[#0B192C] text-white p-12 flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center font-black text-slate-900 text-xl shadow-lg shadow-amber-500/20">FF</div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white">Finanza<span className="text-amber-500">Facil</span></h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gestión Contable e Inventario</p>
              </div>
            </div>

            <div className="space-y-4 max-w-lg">
              <span className="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold rounded-full uppercase tracking-wider">Seguridad de la Cuenta</span>
              <h2 className="text-3xl font-black tracking-tight text-white leading-tight">Actualiza tu clave de acceso temporal</h2>
              <p className="text-sm text-slate-300 font-medium leading-relaxed">Por motivos de seguridad, debes definir una contraseña personal antes de ingresar a tu panel principal.</p>
            </div>
          </div>

          <div className="relative z-10 text-xs text-slate-400 font-medium border-t border-white/10 pt-4 flex justify-between">
            <span>© 2026 FinanzaFacil SAC</span>
            <span>Seguridad Verificada</span>
          </div>
        </div>

        {/* LADO DERECHO: FORMULARIO CAMBIO DE CLAVE */}
        <div className="w-full lg:w-1/2 bg-slate-50 p-6 md:p-12 flex items-center justify-center">
          <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl border border-slate-100 relative">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <KeyRound className="w-8 h-8 text-amber-600" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1">Cambio de Contraseña</h1>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
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
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Contraseña Actual</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showCurrentPwd ? 'text' : 'password'}
                      required
                      value={currentPwd}
                      onChange={e => setCurrentPwd(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-200 p-3.5 pl-11 pr-11 rounded-2xl text-sm font-bold text-slate-900 focus:border-amber-500 outline-none transition-all placeholder:text-slate-300"
                      placeholder="Ingresa tu clave temporal"
                    />
                    <button type="button" onClick={() => setShowCurrentPwd(!showCurrentPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                      {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nueva Contraseña</label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showNewPwd ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={newPwd}
                      onChange={e => setNewPwd(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-200 p-3.5 pl-11 pr-11 rounded-2xl text-sm font-bold text-slate-900 focus:border-amber-500 outline-none transition-all placeholder:text-slate-300"
                      placeholder="Mínimo 8 caracteres"
                    />
                    <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                      {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPwd.length > 0 && (
                    <PasswordStrengthMeter analysis={evaluatePassword(newPwd, currentUser?.email, currentUser?.name)} />
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Confirmar Nueva Contraseña</label>
                  <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showConfirmNewPwd ? 'text' : 'password'}
                      required
                      value={confirmNewPwd}
                      onChange={e => setConfirmNewPwd(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-200 p-3.5 pl-11 pr-11 rounded-2xl text-sm font-bold text-slate-900 focus:border-amber-500 outline-none transition-all placeholder:text-slate-300"
                      placeholder="Repite la nueva clave"
                    />
                    <button type="button" onClick={() => setShowConfirmNewPwd(!showConfirmNewPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
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
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-amber-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  Actualizar Contraseña <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={logout}
                  className="w-full text-slate-400 hover:text-slate-600 text-xs font-bold py-2 transition text-center uppercase tracking-wider"
                >
                  Cerrar Sesión
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── LOGIN / REGISTER VIEW (OPCIÓN A - SPLIT SCREEN) ───
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      handleLogin(e);
    } else {
      handleRegister(e);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800">

      {/* LADO IZQUIERDO: BRANDING & HERO (OPCIÓN A) */}
      <div className="hidden lg:flex w-1/2 bg-[#0B192C] text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Glows Decorativos */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center font-black text-slate-900 text-xl shadow-lg shadow-amber-500/20">FF</div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white">Finanza<span className="text-amber-500">Facil</span></h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gestión Contable e Inventario</p>
            </div>
          </div>

          <div className="space-y-4 max-w-lg">
            <span className="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold rounded-full uppercase tracking-wider">Plantilla Web 2026</span>
            <h2 className="text-3xl font-black tracking-tight text-white leading-tight">Tus finanzas empresariales y tributarias, simplificadas.</h2>
            <p className="text-sm text-slate-300 font-medium leading-relaxed">Conexión directa con SUNAT, control de facturación electrónica, gestión de planillas, recibos por honorarios e inventario inteligente.</p>
          </div>
        </div>

        {/* WIDGETS DE MUESTRA (Basados en plantilla WEB .docx) */}
        <div className="relative z-10 grid grid-cols-2 gap-4 my-8">
          <div className="bg-white/5 border border-white/10 backdrop-blur-md p-4 rounded-2xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ventas del Mes</p>
            <p className="text-2xl font-black text-white mt-1">S/ 84,200</p>
            <span className="text-[11px] font-bold text-emerald-400">↑ +12.4% vs mes anterior</span>
          </div>
          <div className="bg-white/5 border border-white/10 backdrop-blur-md p-4 rounded-2xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estatus SUNAT</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">Normal</p>
            <span className="text-[11px] font-bold text-slate-300">Sin observaciones</span>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-400 font-medium border-t border-white/10 pt-4 flex justify-between">
          <span>© 2026 FinanzaFacil SAC</span>
          <span>Soporte Premium 24/7</span>
        </div>
      </div>

      {/* LADO DERECHO: FORMULARIO DE ACCESO */}
      <div className="w-full lg:w-1/2 bg-slate-50 p-6 md:p-12 flex items-center justify-center">
        <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl border border-slate-100 relative">

          {/* MOBILE HEADER (visible solo en pantallas pequeñas) */}
          <div className="flex lg:hidden items-center gap-3 mb-6 justify-center text-center">
            <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center font-black text-slate-900 text-lg shadow-md">FF</div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900">Finanza<span className="text-amber-500">Facil</span></h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Gestión Contable</p>
            </div>
          </div>

          {/* TABS INICIAR SESIÓN / CREAR CUENTA */}
          <div className="flex bg-slate-100 p-1 rounded-2xl mb-8">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setAuthError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${isLogin ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setAuthError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all ${!isLogin ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
            >
              Crear Cuenta
            </button>
          </div>

          <div className="mb-6">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {isLogin ? '¡Bienvenido de vuelta!' : 'Crear Cuenta Empresarial'}
            </h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
              {isLogin ? 'Ingresa tus credenciales para acceder' : 'Completa tus datos para empezar'}
            </p>
          </div>

          {successMsg && (
            <div className="mb-6 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center gap-3 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-xs font-black text-emerald-950 uppercase">{successMsg}</p>
            </div>
          )}

          {authError && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-2xl space-y-2 animate-shake">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <p className="text-xs font-black text-red-800 leading-tight">{authError}</p>
              </div>
              {authError.toLowerCase().includes('activar') && (
                <button
                  type="button"
                  disabled={resending}
                  onClick={handleResendVerification}
                  className="w-full mt-2 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-[10px] font-black uppercase transition flex items-center justify-center gap-1.5"
                >
                  {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Reenviar Enlace de Activación
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nombre Completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 border-2 border-slate-200 p-3.5 pl-11 rounded-2xl text-sm font-bold text-slate-900 focus:border-amber-500 outline-none transition-all placeholder:text-slate-300"
                    placeholder="Ej. Elena García"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
              </div>
            )}

            {!isLogin && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Tipo de Cuenta</label>
                <div className="relative">
                  <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value as UserRole)}
                    className="w-full bg-slate-50 border-2 border-slate-200 p-3.5 pl-11 rounded-2xl text-sm font-bold text-slate-900 focus:border-amber-500 outline-none transition-all appearance-none"
                  >
                    <option value={UserRole.PERSONA_NATURAL}>Persona Natural</option>
                    <option value={UserRole.EMPRESARIO}>Empresario</option>
                    <option value={UserRole.CONTADOR}>Contador</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  className="w-full bg-slate-50 border-2 border-slate-200 p-3.5 pl-11 rounded-2xl text-sm font-bold text-slate-900 focus:border-amber-500 outline-none transition-all placeholder:text-slate-300"
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5 ml-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contraseña</label>
                {isLogin && (
                  <button type="button" onClick={() => { setShowForgotPassword(true); setAuthError(''); setSuccessMsg(''); }} className="text-[10px] font-bold text-amber-600 hover:underline">
                    ¿Olvidaste tu clave?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={(isLogin ? showLoginPassword : showRegisterPassword) ? 'text' : 'password'}
                  required
                  className="w-full bg-slate-50 border-2 border-slate-200 p-3.5 pl-11 pr-11 rounded-2xl text-sm font-bold text-slate-900 focus:border-amber-500 outline-none transition-all placeholder:text-slate-300"
                  placeholder={isLogin ? '••••••••••••' : 'Mínimo 8 caracteres'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => isLogin ? setShowLoginPassword(!showLoginPassword) : setShowRegisterPassword(!showRegisterPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                  {(isLogin ? showLoginPassword : showRegisterPassword) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {!isLogin && password.length > 0 && (
                <PasswordStrengthMeter analysis={evaluatePassword(password, email, name)} />
              )}
            </div>

            {!isLogin && (
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Confirmar Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    className="w-full bg-slate-50 border-2 border-slate-200 p-3.5 pl-11 pr-11 rounded-2xl text-sm font-bold text-slate-900 focus:border-amber-500 outline-none transition-all placeholder:text-slate-300"
                    placeholder="Repite la contraseña"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-amber-500/25 transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2"
            >
              {isLogin ? 'Ingresar al Sistema' : 'Crear Cuenta'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* RECOVERY FORM (forgot password) */}
          {showForgotPassword && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <KeyRound className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Recuperar Contraseña</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Ingresa tu email y te enviamos una nueva clave temporal</p>
              </div>

              {authError && (
                <div className="mb-4 p-3 bg-red-50 border-2 border-red-200 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <p className="text-xs font-black text-red-800">{authError}</p>
                </div>
              )}

              {recoveryStatus === 'success' ? (
                <div className="space-y-4 text-center">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="text-xs text-slate-500 font-bold leading-relaxed">
                    Si el email está registrado, recibirás una nueva contraseña temporal en tu bandeja de entrada.
                  </p>
                  <p className="text-xs text-slate-500 font-bold leading-relaxed">
                    Vuelve a iniciar sesión con la nueva clave y cambia tu contraseña.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(false); setRecoveryEmail(''); setRecoveryStatus('idle'); }}
                    className="text-xs font-black text-amber-600 hover:underline uppercase tracking-wider"
                  >
                    ← Volver al inicio de sesión
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Correo Electrónico</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        className="w-full bg-slate-50 border-2 border-slate-200 p-3.5 pl-11 rounded-2xl text-sm font-bold text-slate-900 focus:border-amber-500 outline-none transition-all placeholder:text-slate-300"
                        placeholder="ejemplo@correo.com"
                        value={recoveryEmail}
                        onChange={e => setRecoveryEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={recoveryStatus === 'loading'}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-amber-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {recoveryStatus === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
                    Enviar Nueva Contraseña
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ACCESOS RÁPIDOS DEMO (CHIPS 1-CLIC) */}
          {!showForgotPassword && (
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-3">Accesos Rápido Demo (1-Clic)</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillDemoUser('admin@app.com', '123')}
                className="p-2.5 bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-xl text-[10px] font-black text-slate-700 hover:text-purple-800 transition active:scale-95 text-center truncate"
                title="Administrador (admin@app.com)"
              >
                Admin (Sistema)
              </button>
              <button
                type="button"
                onClick={() => fillDemoUser('elena@gmail.com', 'Elena123')}
                className="p-2.5 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl text-[10px] font-black text-slate-700 hover:text-amber-800 transition active:scale-95 text-center truncate"
                title="Elena García (Usuario Empresa)"
              >
                Elena (Empresa)
              </button>
            <button
              type="button"
              onClick={() => fillDemoUser('pendiente@test.com', '123')}
              className="p-2.5 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl text-[10px] font-black text-slate-700 hover:text-amber-800 transition active:scale-95 text-center truncate"
              title="Miguel Pendiente (Usuario PENDING sin plan)"
            >
              Miguel (Nuevo)
            </button>
            <button
              type="button"
              onClick={() => fillDemoUser('carlos@contador.com', '123')}
              className="p-2.5 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-[10px] font-black text-slate-700 hover:text-blue-800 transition active:scale-95 text-center truncate"
              title="Carlos Ruiz (Contador)"
            >
              Carlos (Contador)
            </button>
            <button
              type="button"
              onClick={() => fillDemoUser('prof@demo.com', 'Prof123')}
              className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-[10px] font-black text-slate-700 hover:text-emerald-800 transition active:scale-95 text-center truncate"
              title="Carlos Profesional (Persona Natural emisora)"
            >
              Profe (Natural)
            </button>
              <button
                type="button"
                onClick={() => fillDemoUser('asistente@test.com', 'JGNWJHx7F@')}
                className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-[10px] font-black text-slate-700 hover:text-emerald-800 transition active:scale-95 text-center truncate"
                title="Asistente (Sub-Usuario)"
              >
                Sub-Usuario
              </button>
             </div>
           </div>)}

         </div>
      </div>

    </div>
  );
};
