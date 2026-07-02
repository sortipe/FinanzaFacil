import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { UserRole, SubscriptionStatus } from '../types';

export const Auth: React.FC = () => {
  const { login, registerUser } = useStore();
  const [isLogin, setIsLogin] = useState(true);
  
  // State
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.USER);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLogin) {
      // For demo, we just try to login with any role if it matches the mock data
      // In real app, password check here
      if(email.includes('admin')) login(email, UserRole.ADMIN);
      else if(email.includes('contador')) login(email, UserRole.ACCOUNTANT);
      else login(email, UserRole.USER);
    } else {
      registerUser({
        id: Date.now().toString(),
        email,
        name,
        role: UserRole.USER, // Self-register is always USER
        subscriptionStatus: SubscriptionStatus.PENDING
      });
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
              <input 
                type="text" 
                required 
                className="mt-1 w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-500 outline-none bg-white" 
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
            <input 
              type="email" 
              required 
              className="mt-1 w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-500 outline-none bg-white"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700">Contraseña</label>
             <input 
               type="password" 
               required 
               className="mt-1 w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-500 outline-none bg-white"
               placeholder="********"
             />
          </div>

          <button 
            type="submit" 
            className="w-full bg-brand-600 text-white font-bold py-3 rounded-lg hover:bg-brand-700 transition"
          >
            {isLogin ? 'Ingresar' : 'Registrarse'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-brand-600 hover:underline"
          >
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Ingresa'}
          </button>
        </div>

        {/* Demo Credentials Helper */}
        {isLogin && (
           <div className="mt-8 bg-gray-50 p-4 rounded text-xs text-gray-500 border border-gray-200">
             <p className="font-bold mb-1">Credenciales Demo:</p>
             <p>Admin: admin@app.com</p>
             <p>Contador: carlos@contador.com</p>
             <p>Usuario: user@demo.com</p>
           </div>
        )}
      </div>
    </div>
  );
};