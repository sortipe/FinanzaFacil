import React, { useState, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { SubscriptionStatus } from '../types';
import { Check, Smartphone, CheckCircle, QrCode, Calendar, Clock, Upload, X, AlertCircle } from 'lucide-react';
import { fileToBase64, compressImageFile } from '../services/geminiService';

export const Payment: React.FC = () => {
  const { packages, paymentMethods, currentUser, updateUser, addNotification, addSubscriptionRecord } = useStore();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [expirationDate, setExpirationDate] = useState('');
  const [voucherImage, setVoucherImage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!currentUser) return null;

  const handleVoucherUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setUploadError('Por favor selecciona una imagen válida (PNG, JPG, etc.).');
        return;
      }
      try {
        const base64 = await compressImageFile(file, 1000, 1000, 0.7);
        setVoucherImage(base64);
        setUploadError(null);
      } catch (err) {
        setUploadError('Error al procesar y comprimir la imagen.');
      }
    }
  };

  const handlePayment = () => {
    const pkg = packages.find(p => p.id === selectedPackage);
    if (!pkg || !currentUser) return;
    if (!voucherImage) {
      setUploadError('Es obligatorio subir la foto del comprobante de pago.');
      return;
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + pkg.durationMonths);
    const endStr = endDate.toISOString().split('T')[0];
    setExpirationDate(endStr);

    if (currentUser.subscriptionStatus !== SubscriptionStatus.ACTIVE) {
      updateUser(currentUser.id, {
        subscriptionStatus: SubscriptionStatus.PENDING
      });
    }

    addSubscriptionRecord({
      id: Date.now().toString(),
      userId: currentUser.id,
      packageName: pkg.name,
      amount: pkg.price,
      date: new Date().toISOString().split('T')[0],
      startDate: new Date().toISOString().split('T')[0],
      endDate: endStr,
      status: 'PENDING',
      paymentDetails: selectedMethod || 'Desconocido',
      voucherImage: voucherImage
    });

    addNotification({
      id: Date.now().toString(),
      message: `El usuario ${currentUser.name} ha realizado un pago por el ${pkg.name} (S/ ${pkg.price}). Pendiente de verificación por el administrador.`,
      date: new Date().toLocaleDateString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      isRead: false,
      type: 'SUBSCRIPTION'
    });

    setShowConfirm(true);
  };

  if (showConfirm) {
    const pkg = packages.find(p => p.id === selectedPackage);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-4 border border-brand-100">
          <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-6">
            <Clock className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">¡Solicitud Registrada!</h2>
          <p className="text-gray-600 text-sm font-medium">
            Tu pago por el <span className="font-bold text-gray-900">{pkg?.name || 'Plan'}</span> (S/ {pkg?.price}) fue enviado con éxito.
            <br/><br/>
            Se encuentra <span className="font-bold text-amber-700">pendiente de verificación</span> por el administrador. En cuanto sea confirmado, tu plan quedará 100% activo.
          </p>
          <button 
             onClick={() => window.location.reload()}
             className="w-full bg-brand-600 text-white font-black py-3.5 rounded-2xl hover:bg-brand-700 transition shadow-lg mt-6 uppercase text-xs tracking-wider"
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

                <div className="bg-yellow-50 p-4 rounded-xl text-yellow-900 text-sm inline-block border border-yellow-200">
                  <p className="font-medium">1. Realiza el pago al número indicado o escanea el QR.</p>
                  <p className="font-bold mt-1">2. Adjunta la foto o captura del comprobante antes de confirmar.</p>
                </div>

                {/* ADJUNTAR VOUCHER */}
                <div className="flex flex-col items-center max-w-md mx-auto space-y-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleVoucherUpload}
                    accept="image/*"
                    className="hidden"
                  />

                  {voucherImage ? (
                    <div className="relative border-2 border-green-500 rounded-2xl p-2 bg-green-50/50 w-full flex items-center gap-3">
                      <img
                        src={`data:image/jpeg;base64,${voucherImage}`}
                        alt="Comprobante de pago"
                        className="w-16 h-16 object-cover rounded-xl border border-green-200 shadow-sm"
                      />
                      <div className="flex-1 text-left">
                        <p className="text-xs font-black text-green-800 uppercase">Comprobante Adjuntado</p>
                        <p className="text-[10px] text-gray-500 font-bold">Listo para validar</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setVoucherImage(null)}
                        className="p-2 text-red-500 hover:bg-red-100 rounded-full transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 px-6 border-2 border-dashed border-brand-300 hover:border-brand-500 bg-brand-50/30 hover:bg-brand-50 rounded-2xl flex items-center justify-center gap-3 text-brand-700 font-black text-xs uppercase tracking-wider transition group shadow-sm"
                    >
                      <Upload className="w-5 h-5 text-brand-600 group-hover:scale-110 transition" />
                      Adjuntar Comprobante de Pago (Obligatorio)
                    </button>
                  )}

                  {uploadError && (
                    <p className="text-xs font-black text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {uploadError}
                    </p>
                  )}
                </div>

                <button 
                  onClick={handlePayment}
                  disabled={!voucherImage}
                  className={`w-full md:w-auto px-12 py-4 text-white font-black rounded-2xl shadow-lg transition uppercase text-xs tracking-wider ${
                    voucherImage ? 'bg-brand-600 hover:bg-brand-700 active:scale-95' : 'bg-gray-300 cursor-not-allowed'
                  }`}
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
