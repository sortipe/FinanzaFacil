import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Shield, Key, FileCode, CheckCircle, AlertCircle, Upload } from 'lucide-react';


const getInitialFormData = (user: any) => ({
    ruc: user?.ruc || '',
    solUser: user?.solUser || user?.user || '',
    solPass: user?.solPass || user?.pass || '',
    emitterName: user?.businessName || '',
    certPass: user?.certPass || '',
    sunatEnv: user?.sunatEnv || (user?.sunatApiUrl?.includes('localhost') ? 'BETA' : 'PRODUCTION')
});

export const SunatSettings: React.FC = () => {
    const { currentUser, updateUser } = useStore();
    const [formData, setFormData] = useState(getInitialFormData(currentUser));

    // Sincronizar formData cuando currentUser cambia (ej: después de guardar)
    useEffect(() => {
        setFormData(getInitialFormData(currentUser));
    }, [currentUser]);

    // Migrar datos viejos (user/pass → solUser/solPass) al cargar el usuario
    useEffect(() => {
        if (currentUser && (currentUser as any).user && !currentUser.solUser) {
            updateUser(currentUser.id, {
                solUser: (currentUser as any).user,
                solPass: (currentUser as any).pass
            });
        }
    }, [currentUser]);


    const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [certName, setCertName] = useState<string | null>(currentUser?.certBase64 ? 'Certificado cargado' : null);
    const [tempCertBase64, setTempCertBase64] = useState<string | null>(currentUser?.certBase64 || null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result as string;
                setTempCertBase64(base64);
                setCertName(file.name);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('saving');
        setErrorMsg(null);

        try {
            // 1. Verificar con el servidor (usa user/pass que espera el engine)
            const serverPayload = {
                credentials: {
                    ruc: formData.ruc,
                    user: formData.solUser,
                    pass: formData.solPass,
                    certBase64: tempCertBase64,
                    certPass: formData.certPass,
                    env: formData.sunatEnv
                }
            };

            const response = await fetch('http://localhost:5555/verificar-conexion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serverPayload)
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'No se pudo conectar con SUNAT');
            }

            // 2. Si es exitoso, guardar con los nombres que lee el formulario (solUser/solPass)
            updateUser(currentUser!.id, {
                ruc: formData.ruc,
                solUser: formData.solUser,
                solPass: formData.solPass,
                certBase64: tempCertBase64,
                certPass: formData.certPass,
                sunatEnv: formData.sunatEnv,
                businessName: formData.emitterName,
                sunatApiUrl: 'http://localhost:5555'
            });
            
            setStatus('success');
            setTimeout(() => setStatus('idle'), 3000);
        } catch (error: any) {
            setErrorMsg(error.message);
            setStatus('error');
        }
    };


    if (!currentUser) return null;

    return (
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl mx-auto border border-gray-100">
            <div className="flex items-center gap-3 mb-8 border-b pb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                    <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Configuración SUNAT</h2>
                    <p className="text-gray-500 text-sm">Configura tus credenciales para facturación directa (Sin costos)</p>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            RUC de Empresa
                        </label>
                        <input
                            type="text"
                            className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={formData.ruc}
                            onChange={(e) => setFormData({ ...formData, ruc: e.target.value })}
                            placeholder="Ej: 20123456789"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Razón Social</label>
                        <input
                            type="text"
                            className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.emitterName}
                            onChange={(e) => setFormData({ ...formData, emitterName: e.target.value })}
                            placeholder="Nombre comercial"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Key className="w-4 h-4" /> Usuario SOL
                        </label>
                        <input
                            type="text"
                            className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.solUser}
                            onChange={(e) => setFormData({ ...formData, solUser: e.target.value })}
                            placeholder="MODDATOS"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Clave SOL</label>
                        <input
                            type="password"
                            className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.solPass}
                            onChange={(e) => setFormData({ ...formData, solPass: e.target.value })}
                            placeholder="********"
                        />
                    </div>
                </div>

                <div className="p-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <div className="flex flex-col items-center text-center">
                        <FileCode className="w-10 h-10 text-gray-400 mb-3" />
                        <h3 className="font-semibold text-gray-800">Certificado Digital (.pfx)</h3>
                        <p className="text-xs text-gray-500 mb-4">Sube tu archivo de firma electrónica</p>
                        
                        <div className="flex items-center gap-4">
                            <label className="bg-white border px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-all flex items-center gap-2 text-sm font-medium">
                                <Upload className="w-4 h-4" />
                                {certName ? 'Cambiar archivo' : 'Seleccionar .pfx'}
                                <input type="file" className="hidden" accept=".pfx,.p12" onChange={handleFileChange} />
                            </label>
                            {certName && (
                                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> {certName}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Contraseña del Certificado</label>
                    <input
                        type="password"
                        className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.certPass}
                        onChange={(e) => setFormData({ ...formData, certPass: e.target.value })}
                        placeholder="La clave que usas para instalar el PFX"
                    />
                </div>

                <div className="flex items-center justify-between pt-4">
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="env"
                                checked={formData.sunatEnv === 'BETA'}
                                onChange={() => setFormData({ ...formData, sunatEnv: 'BETA' })}
                            />
                            <span className="text-sm font-medium text-gray-600">BETA (Pruebas)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="env"
                                checked={formData.sunatEnv === 'PRODUCTION'}
                                onChange={() => setFormData({ ...formData, sunatEnv: 'PRODUCTION' })}
                            />
                            <span className="text-sm font-medium text-gray-600">PRODUCCIÓN</span>
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={status === 'saving'}
                        className={`px-8 py-3 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95 ${
                            status === 'success' ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {status === 'saving' ? 'Guardando...' : status === 'success' ? '¡Guardado!' : 'Guardar Cambios'}
                    </button>
                </div>


                {status === 'error' && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 text-sm border border-red-100">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <div>
                            <p className="font-bold">Error de Verificación</p>
                            <p className="text-xs opacity-80">{errorMsg}</p>
                        </div>
                    </div>
                )}

            </form>
        </div>
    );
};
