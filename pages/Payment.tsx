import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { SubscriptionStatus } from '../types';
import { Check, Smartphone, CheckCircle, QrCode, Calendar } from 'lucide-react';

export const Payment: React.FC = () => {
  const { packages, paymentMethods, currentUser, updateUser, addNotification, addSubscriptionRecord } = useStore();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [expirationDate, setExpirationDate] = useState('');

  if (!currentUser) return null;

  const handlePayment = () => {
    const pkg = packages.find(p => p.id === selectedPackage);
    if (!pkg || !currentUser) return;

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + pkg.durationMonths);
    const endStr = endDate.toISOString().split('T')[0];
    setExpirationDate(endStr);

    setTimeout(() => {
      if (currentUser) {
        updateUser(currentUser.id, {
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          subscriptionStartDate: new Date().toISOString().split('T')[0],
          subscriptionEndDate: endStr
        });

        addSubscriptionRecord({
          id: Date.now().toString(),
          userId: currentUser.id,
          packageName: pkg.name,
          amount: pkg.price,
          date: new Date().toISOString().split('T')[0],
          startDate: new Date().toISOString().split('T')[0],
          endDate: endStr,
          status: 'PAID',
          paymentDetails: selectedMethod
        });

        addNotification({
          id: Date.now().toString(),
          message: `El usuario ${currentUser.name} se ha suscrito al ${pkg.name}.`,
          date: new Date().toLocaleDateString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          isRead: false,
          type: 'SUBSCRIPTION'
        });
      }
    }, 1500);
    setShowConfirm(true);
  };

  if (showConfirm) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">¡Pago Exitoso!</h2>
          <p className="text-gray-600">Tu suscripción ha sido activada correctamente. Ahora puedes empezar a gestionar tus gastos.</p>
          {expirationDate && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-amber-600" />
              <span className="font-bold text-amber-800">Vence el {new Date(expirationDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          )}
          <button 
             onClick={() => window.location.reload()}
             className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl hover:bg-brand-700 transition mt-6"
          >
            Ir al Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  const activePaymentMethod = paymentMethods.find(pm => pm.id === selectedMethod);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">Elige tu Plan</h2>
          <p className="mt-4 text-xl text-gray-500">Desbloquea todas las funciones de FinanzaFacil</p>
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {packages.map(pkg => (
            <div 
              key={pkg.id}
              onClick={() => setSelectedPackage(pkg.id)}
              className={`relative bg-white rounded-2xl shadow-lg cursor-pointer transition-all duration-200 border-2 overflow-hidden ${
                selectedPackage === pkg.id ? 'border-brand-500 ring-2 ring-brand-200 scale-105' : 'border-transparent hover:border-brand-200'
              }`}
            >
              <div className="p-8">
                <h3 className="text-xl font-bold text-gray-900">{pkg.name}</h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-extrabold text-gray-900">S/ {pkg.price}</span>
                  <span className="ml-2 text-gray-500">/ {pkg.durationMonths === 1 ? 'mes' : 'año'}</span>
                </div>
                <ul className="mt-6 space-y-4">
                  {pkg.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-2 shrink-0" />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`p-4 text-center font-bold ${selectedPackage === pkg.id ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {selectedPackage === pkg.id ? 'Seleccionado' : 'Seleccionar Plan'}
              </div>
            </div>
          ))}
        </div>

        {selectedPackage && (
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 animate-fade-in-up">
            <h3 className="text-xl font-bold mb-6 text-gray-900">Método de Pago</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paymentMethods.map(method => (
                <div 
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={`p-4 border rounded-xl cursor-pointer flex items-center space-x-4 ${
                    selectedMethod === method.id ? 'bg-brand-50 border-brand-500 text-brand-700' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border shadow-sm shrink-0 overflow-hidden">
                    {method.qrImage ? (
                        <QrCode className="w-6 h-6 text-brand-600" />
                    ) : (
                        <Smartphone className="w-6 h-6 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold">{method.name}</p>
                    <p className="text-sm opacity-80">{method.details}</p>
                  </div>
                </div>
              ))}
            </div>

            {selectedMethod && activePaymentMethod && (
              <div className="mt-8 text-center space-y-6">
                
                {activePaymentMethod.qrImage && (
                    <div className="flex flex-col items-center p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <p className="text-sm font-bold text-gray-700 mb-2">Escanea el código para pagar</p>
                        <img 
                            src={`data:image/jpeg;base64,${activePaymentMethod.qrImage}`} 
                            alt={`QR ${activePaymentMethod.name}`} 
                            className="w-48 h-48 object-contain rounded-lg shadow-sm bg-white"
                        />
                    </div>
                )}

                <div className="bg-yellow-50 p-4 rounded-lg text-yellow-800 text-sm inline-block">
                  <p>Realiza el pago al número indicado o escanea el QR y haz clic en "Confirmar Pago".</p>
                </div>
                <button 
                  onClick={handlePayment}
                  className="w-full md:w-auto px-12 py-4 bg-brand-600 text-white font-bold rounded-xl shadow-lg hover:bg-brand-700 transition"
                >
                  Confirmar Pago
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
