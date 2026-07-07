import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { Shield, Key, FileCode, CheckCircle, AlertCircle, Upload, FileText, Search, Loader2 } from 'lucide-react';
import { consultaService } from '../services/consultaService';


const getInitialFormData = (user: any) => {
    const getCorr = (userId: string | undefined, serie: string) => {
        if (!userId) return 0;
        return parseInt(localStorage.getItem(`ff_corr_${userId}_${serie}`) || '0', 10);
    };
    return {
        ruc: user?.ruc || '',
        solUser: user?.solUser || user?.user || '',
        solPass: user?.solPass || user?.pass || '',
        emitterName: user?.businessName || '',
        certPass: user?.certPass || '',
        serieFactura: user?.serieFactura || 'F001',
        serieBoleta: user?.serieBoleta || 'B001',
        correlativoFactura: getCorr(user?.id, user?.serieFactura || 'F001'),
        correlativoBoleta: getCorr(user?.id, user?.serieBoleta || 'B001')
    };
};

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
    const [searchingRuc, setSearchingRuc] = useState(false);

    const handleSearchRuc = async () => {
        const ruc = formData.ruc.replace(/\D/g, '');
        if (ruc.length !== 11) { setErrorMsg('El RUC debe tener 11 dígitos'); setStatus('error'); return; }
        setSearchingRuc(true); setErrorMsg(null); setStatus('idle');
        try {
            const res = await consultaService.consultarRUC(ruc);
            if (res.success && res.razonSocial) {
                setFormData(prev => ({ ...prev, emitterName: res.razonSocial || '' }));
                setStatus('success');
                setTimeout(() => setStatus('idle'), 2000);
            } else {
                setErrorMsg(res.error || 'No se encontró el RUC');
                setStatus('error');
            }
        } catch {
            setErrorMsg('Error al consultar RUC');
            setStatus('error');
        } finally { setSearchingRuc(false); }
    };

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

        // Validar series
        if (!formData.serieFactura.startsWith('F')) {
            setErrorMsg('La serie de factura debe empezar con F (ej: F001)');
            setStatus('error');
            return;
        }
        if (formData.serieFactura.length !== 4) {
            setErrorMsg('La serie de factura debe tener exactamente 4 caracteres');
            setStatus('error');
            return;
        }
        if (!formData.serieBoleta.startsWith('B')) {
            setErrorMsg('La serie de boleta debe empezar con B (ej: B001)');
            setStatus('error');
            return;
        }
        if (formData.serieBoleta.length !== 4) {
            setErrorMsg('La serie de boleta debe tener exactamente 4 caracteres');
            setStatus('error');
            return;
        }

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
                serieFactura: formData.serieFactura,
                serieBoleta: formData.serieBoleta
            });

            // Guardar correlativos en localStorage
            const uid = currentUser!.id;
            if (formData.serieFactura) localStorage.setItem(`ff_corr_${uid}_${formData.serieFactura}`, String(formData.correlativoFactura));
            if (formData.serieBoleta) localStorage.setItem(`ff_corr_${uid}_${formData.serieBoleta}`, String(formData.correlativoBoleta));
            
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
                        <div className="flex gap-2">
                            <input type="text" maxLength={11}
                                className="flex-1 px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                value={formData.ruc}
                                onChange={(e) => setFormData({ ...formData, ruc: e.target.value.replace(/\D/g, '') })}
                                placeholder="Ej: 20610900012" />
                            <button type="button" onClick={handleSearchRuc} disabled={searchingRuc}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-1 text-sm font-semibold">
                                {searchingRuc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Razón Social</label>
                        <input type="text"
                            className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.emitterName}
                            onChange={(e) => setFormData({ ...formData, emitterName: e.target.value })}
                            placeholder="Nombre o Razón Social" />
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

                {/* Serie y Correlativo */}
                <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-200">
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5 text-amber-600" />
                        <h3 className="text-sm font-bold text-amber-800">Serie y Correlativo</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-700">Serie Factura</label>
                            <input type="text" maxLength={4}
                                className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm uppercase ${!formData.serieFactura.startsWith('F') || formData.serieFactura.length !== 4 ? 'border-red-400 bg-red-50' : ''}`}
                                value={formData.serieFactura}
                                onChange={e => setFormData({ ...formData, serieFactura: e.target.value.toUpperCase() })}
                                placeholder="F001" />
                            {!formData.serieFactura.startsWith('F') && <p className="text-[10px] text-red-500 ml-1">Debe empezar con F (ej: F001)</p>}
                            {formData.serieFactura.length > 0 && formData.serieFactura.length !== 4 && <p className="text-[10px] text-red-500 ml-1">Debe tener exactamente 4 caracteres</p>}
                            <label className="text-xs font-semibold text-gray-700 mt-2 block">Último Correlativo</label>
                            <input type="text" inputMode="numeric" maxLength={8}
                                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                                value={formData.correlativoFactura > 0 ? String(formData.correlativoFactura) : ''}
                                onChange={e => {
                                    const digits = e.target.value.replace(/\D/g, '');
                                    const prev = formData.correlativoFactura;
                                    const prevStr = prev > 0 ? String(prev) : '';
                                    if (digits.length > prevStr.length && digits.startsWith(prevStr)) {
                                        const added = parseInt(digits.slice(-1), 10);
                                        const next = prev * 10 + added;
                                        if (next <= 99999999) setFormData({ ...formData, correlativoFactura: next });
                                    } else if (digits.length < prevStr.length) {
                                        setFormData({ ...formData, correlativoFactura: Math.floor(prev / 10) });
                                    } else if (digits !== prevStr) {
                                        setFormData({ ...formData, correlativoFactura: digits ? parseInt(digits, 10) : 0 });
                                    }
                                }}
                                placeholder="0" />
                            <p className="text-[9px] text-gray-400 ml-1">Se guardará como: {String(formData.correlativoFactura > 0 ? formData.correlativoFactura : 0).padStart(8, '0')}</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-700">Serie Boleta</label>
                            <input type="text" maxLength={4}
                                className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm uppercase ${!formData.serieBoleta.startsWith('B') || formData.serieBoleta.length !== 4 ? 'border-red-400 bg-red-50' : ''}`}
                                value={formData.serieBoleta}
                                onChange={e => setFormData({ ...formData, serieBoleta: e.target.value.toUpperCase() })}
                                placeholder="B001" />
                            {!formData.serieBoleta.startsWith('B') && <p className="text-[10px] text-red-500 ml-1">Debe empezar con B (ej: B001)</p>}
                            {formData.serieBoleta.length > 0 && formData.serieBoleta.length !== 4 && <p className="text-[10px] text-red-500 ml-1">Debe tener exactamente 4 caracteres</p>}
                            <label className="text-xs font-semibold text-gray-700 mt-2 block">Último Correlativo</label>
                            <input type="text" inputMode="numeric" maxLength={8}
                                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                                value={formData.correlativoBoleta > 0 ? String(formData.correlativoBoleta) : ''}
                                onChange={e => {
                                    const digits = e.target.value.replace(/\D/g, '');
                                    const prev = formData.correlativoBoleta;
                                    const prevStr = prev > 0 ? String(prev) : '';
                                    if (digits.length > prevStr.length && digits.startsWith(prevStr)) {
                                        const added = parseInt(digits.slice(-1), 10);
                                        const next = prev * 10 + added;
                                        if (next <= 99999999) setFormData({ ...formData, correlativoBoleta: next });
                                    } else if (digits.length < prevStr.length) {
                                        setFormData({ ...formData, correlativoBoleta: Math.floor(prev / 10) });
                                    } else if (digits !== prevStr) {
                                        setFormData({ ...formData, correlativoBoleta: digits ? parseInt(digits, 10) : 0 });
                                    }
                                }}
                                placeholder="0" />
                            <p className="text-[9px] text-gray-400 ml-1">Se guardará como: {String(formData.correlativoBoleta > 0 ? formData.correlativoBoleta : 0).padStart(8, '0')}</p>
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3 ml-1">El correlativo se auto-incrementa al emitir. Puedes ajustarlo manualmente aquí. Poner 0 reinicia desde 1.</p>
                </div>

                <div className="flex items-center justify-end pt-4">
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
