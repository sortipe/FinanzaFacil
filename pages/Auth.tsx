import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { UserRole, SubscriptionStatus } from '../types';

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
  const [changeError, setChangeError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login(email, password);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }
    registerUser({
      id: Date.now().toString(),
      email,
      name,
      password,
      mustChangePassword: false,
      role: UserRole.USER,
      subscriptionStatus: SubscriptionStatus.PENDING
    });
    alert('Cuenta creada exitosamente. Ahora puedes iniciar sesión.');
    setIsLogin(true);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError('');
    if (newPwd !== confirmNewPwd) {
      setChangeError('Las contraseñas nuevas no coinciden');
      return;
    }
    if (!currentUser) return;
    const ok = changePassword(currentUser.id, currentPwd, newPwd);
    if (ok) {
      alert('Contraseña cambiada exitosamente. Ahora accederás al sistema.');
    } else {
      setChangeError('La contraseña actual es incorrecta');
    }
  };

  // ─── CHANGE PASSWORD VIEW ───
  if (mustChange) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔒</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Cambio de Contraseña Requerido</h1>
            <p className="text-sm text-gray-500">{currentUser.name}, debes cambiar tu contraseña temporal para continuar.</p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Contraseña Actual</label>
              <input type="password" required value={currentPwd} onChange={e => setCurrentPwd(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-500 outline-none bg-white" placeholder="Ingresa tu contraseña temporal" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Nueva Contraseña</label>
              <input type="password" required value={newPwd} onChange={e => setNewPwd(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-500 outline-none bg-white" placeholder="Mínimo 6 caracteres" minLength={6} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirmar Nueva Contraseña</label>
              <input type="password" required value={confirmNewPwd} onChange={e => setConfirmNewPwd(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-500 outline-none bg-white" placeholder="Repite la nueva contraseña" />
            </div>

            {changeError && (
              <p className="text-red-600 text-sm font-bold">{changeError}</p>
            )}

            <button type="submit"
              className="w-full bg-brand-600 text-white font-bold py-3 rounded-lg hover:bg-brand-700 transition">
              Cambiar Contraseña
            </button>
            <button type="button" onClick={logout}
              className="w-full text-gray-400 text-sm font-bold py-2 hover:text-gray-600 transition">
              Cerrar Sesión
            </button>
          </form>
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
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-brand-700 mb-2">FinanzaFacil</h1>
        <p className="text-center text-gray-500 mb-8">{isLogin ? 'Ingresa a tu cuenta' : 'Crea tu cuenta'}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
              <input type="text" required
                className="mt-1 w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
            <input type="email" required
              className="mt-1 w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-500 outline-none bg-white"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Contraseña</label>
            <input type="password" required
              className="mt-1 w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-500 outline-none bg-white"
              placeholder="********" value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirmar Contraseña</label>
              <input type="password" required
                className="mt-1 w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                placeholder="Repite la contraseña" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </div>
          )}

          <button type="submit"
            className="w-full bg-brand-600 text-white font-bold py-3 rounded-lg hover:bg-brand-700 transition">
            {isLogin ? 'Ingresar' : 'Registrarse'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-brand-600 hover:underline">
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Ingresa'}
          </button>
        </div>

        {isLogin && (
          <div className="mt-8 bg-gray-50 p-4 rounded text-xs text-gray-500 border border-gray-200">
            <p className="font-bold mb-2">Credenciales Demo:</p>
            <p className="mb-1"><span className="font-bold">Admin:</span> admin@app.com / 123</p>
            <p className="mb-1"><span className="font-bold">Contador:</span> carlos@contador.com / 123</p>
            <p><span className="font-bold">Usuario:</span> user@demo.com / 123</p>
          </div>
        )}
      </div>
    </div>
  );
};