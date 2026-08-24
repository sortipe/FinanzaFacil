import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../context/StoreContext';
import { Shield, Key, FileCode, CheckCircle, AlertCircle, Upload, FileText, Search, Loader2 } from 'lucide-react';
import { consultaService } from '../services/consultaService';
import { getNextCorrelative, setCorrelativoBaseline } from '../src/services/api';


const getInitialFormData = (company: any) => {
    const getCorr = (companyId: string | undefined, serie: string) => {
        if (!companyId) return 0;
        return parseInt(localStorage.getItem(`ff_corr_${companyId}_${serie}`) || '0', 10);
    };
    return {
        ruc: company?.ruc || '',
        solUser: company?.solUser || '',
        solPass: company?.solPass || '',
        sireClientId: company?.sireClientId || '',
        sireClientSecret: company?.sireClientSecret || '',
        emitterName: company?.businessName || '',
        certPass: company?.certPass || '',
        sunatEnv: company?.sunatEnv || 'SANDBOX',
        serieFactura: company?.serieFactura || 'F001',
        serieBoleta: company?.serieBoleta || 'B001',
        serieLiquidacion: company?.serieLiquidacion || 'E001',
        serieGuiaRemision: company?.serieGuiaRemision || 'T001',
        serieGuiaTransporte: company?.serieGuiaTransporte || 'V001',
        correlativoFactura: getCorr(company?.id, company?.serieFactura || 'F001'),
        correlativoBoleta: getCorr(company?.id, company?.serieBoleta || 'B001'),
        correlativoLiquidacion: getCorr(company?.id, company?.serieLiquidacion || 'E001'),
        correlativoGuiaRemision: getCorr(company?.id, company?.serieGuiaRemision || 'T001'),
        correlativoGuiaTransporte: getCorr(company?.id, company?.serieGuiaTransporte || 'V001'),
    };
};

export const SunatSettings: React.FC = () => {
    const { selectedCompany, selectedCompanyId, companies, currentUser, updateCompany } = useStore();
    const activeCompany = selectedCompany || (companies.filter(c => c.ownerUserId === currentUser?.id)[0]) || null;
    const [formData, setFormData] = useState(getInitialFormData(activeCompany));

    // Sincronizar formData cuando activeCompany cambia
    useEffect(() => {
        setFormData(getInitialFormData(activeCompany));
        const cid = activeCompany?.id;
        if (!cid) return;
        let cancelled = false;
        const series = [
            { key: 'correlativoFactura', serie: activeCompany?.serieFactura || 'F001' },
            { key: 'correlativoBoleta', serie: activeCompany?.serieBoleta || 'B001' },
            { key: 'correlativoLiquidacion', serie: activeCompany?.serieLiquidacion || 'E001' },
            { key: 'correlativoGuiaRemision', serie: activeCompany?.serieGuiaRemision || 'T001' },
            { key: 'correlativoGuiaTransporte', serie: activeCompany?.serieGuiaTransporte || 'V001' },
        ];
        series.forEach(({ key, serie }) => {
            getNextCorrelative(cid, serie)
                .then((res: any) => {
                    if (cancelled || !res?.success) return;
                    setFormData(prev => ({ ...prev, [key]: Number(res.last) || 0 }));
                })
                .catch(() => {});
        });
        return () => { cancelled = true; };
    }, [activeCompany]);



    const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [certName, setCertName] = useState<string | null>(selectedCompany?.certBase64 ? 'Certificado cargado' : null);
    const [tempCertBase64, setTempCertBase64] = useState<string | null>(selectedCompany?.certBase64 || null);
    const [searchingRuc, setSearchingRuc] = useState(false);
    const [toast, setToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
    const toastTimer = useRef<number | null>(null);

    const showToast = (type: 'error' | 'success', message: string) => {
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        setToast({ type, message });
        toastTimer.current = window.setTimeout(() => setToast(null), 4000);
    };

    const handleSearchRuc = async () => {
        const ruc = formData.ruc.replace(/\D/g, '');
        if (ruc.length !== 11) { showToast('error', 'El RUC debe tener 11 dígitos'); return; }
        setSearchingRuc(true);
        try {
            const res = await consultaService.consultarRUC(ruc);
            if (res.success && res.razonSocial) {
                setFormData(prev => ({ ...prev, emitterName: res.razonSocial || '' }));
                showToast('success', `RUC encontrado: ${res.razonSocial}`);
            } else {
                showToast('error', res.error || 'No se encontró el RUC');
            }
        } catch {
            showToast('error', 'Error al consultar RUC');
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

            const response = await fetch('/verificar-conexion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(serverPayload)
            });

            const text = await response.text();
            let result: any = {};
            try {
                result = text ? JSON.parse(text) : {};
            } catch (e) {
                throw new Error(`Respuesta inválida del servidor (${response.status}): ${text ? text.slice(0, 150) : 'Sin respuesta'}`);
            }

            if (!result.success) {
                const msg = typeof result.error === 'string' ? result.error : (result.error?.message || 'No se pudo conectar con SUNAT');
                throw new Error(msg);
            }

            // 2. Si es exitoso, guardar en la empresa
            const targetCid = activeCompany?.id || selectedCompanyId;
                if (targetCid) {
                updateCompany(targetCid, {
                    ruc: formData.ruc,
                    solUser: formData.solUser,
                    solPass: formData.solPass,
                    sireClientId: formData.sireClientId,
                    sireClientSecret: formData.sireClientSecret,
                    certBase64: tempCertBase64,
                    certPass: formData.certPass,
                    sunatEnv: formData.sunatEnv as any,
                    businessName: formData.emitterName,
                    serieFactura: formData.serieFactura,
                    serieBoleta: formData.serieBoleta,
                    serieLiquidacion: formData.serieLiquidacion,
                    serieGuiaRemision: formData.serieGuiaRemision,
                    serieGuiaTransporte: formData.serieGuiaTransporte
                });
            }

            // Guardar correlativos en el servidor (fuente compartida por empresa+serie)
            const cid = targetCid || '';
            const saveSerieCorr = (serie: string, corrVal: number) => {
                if (!serie) return;
                setCorrelativoBaseline(cid, serie, Number(corrVal) || 0).catch(() => {});
                localStorage.setItem(`ff_corr_${cid}_${serie}`, String(corrVal));
            };
            saveSerieCorr(formData.serieFactura, formData.correlativoFactura);
            saveSerieCorr(formData.serieBoleta, formData.correlativoBoleta);
            saveSerieCorr(formData.serieLiquidacion, formData.correlativoLiquidacion);
            saveSerieCorr(formData.serieGuiaRemision, formData.correlativoGuiaRemision);
            saveSerieCorr(formData.serieGuiaTransporte, formData.correlativoGuiaTransporte);
            
            setStatus('success');
            showToast('success', 'Configuración SUNAT guardada correctamente');
            setTimeout(() => setStatus('idle'), 3000);
        } catch (error: any) {
            setErrorMsg(error.message);
            showToast('error', error.message || 'No se pudo conectar con SUNAT');
            setStatus('error');
        }
    };


    if (!activeCompany) return (
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl mx-auto border border-gray-100 text-center">
            <p className="text-gray-500 font-bold">Selecciona una empresa para configurar sus credenciales SUNAT.</p>
        </div>
    );

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
                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-600" /> Entorno de Emisión SUNAT
                        </label>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Selecciona Producción para comprobantes reales con tu RUC/SOL o Beta para pruebas
                        </p>
                    </div>
                    <select
                        value={formData.sunatEnv}
                        onChange={(e) => setFormData({ ...formData, sunatEnv: e.target.value as 'SANDBOX' | 'PRODUCTION' })}
                        className="px-4 py-2 bg-white border border-blue-200 rounded-xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
                    >
                        <option value="SANDBOX">Pruebas (Beta / Sandbox)</option>
                        <option value="PRODUCTION">Producción (Comprobantes Reales)</option>
                    </select>
                </div>

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

                {/* API SIRE OAuth2 Credentials */}
                <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-4">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-indigo-600" />
                        <div>
                            <h4 className="text-sm font-bold text-indigo-900">API SIRE SUNAT (OAuth2)</h4>
                            <p className="text-xs text-indigo-700">Credenciales obtenidas desde SUNAT SOL &gt; Empresas &gt; Registro de Credenciales de API</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-700">Client ID SIRE</label>
                            <input
                                type="text"
                                className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={formData.sireClientId}
                                onChange={(e) => setFormData({ ...formData, sireClientId: e.target.value })}
                                placeholder="Ej: 1480c5d6-444a-4d7a-8bd8-b570081dcf30"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-700">Client Secret SIRE</label>
                            <input
                                type="password"
                                className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={formData.sireClientSecret}
                                onChange={(e) => setFormData({ ...formData, sireClientSecret: e.target.value })}
                                placeholder="••••••••••••••••••••••••"
                            />
                        </div>
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
                    <div className="flex items-center gap-2 mb-5">
                        <FileText className="w-5 h-5 text-amber-600" />
                        <h3 className="text-sm font-bold text-amber-800">Serie y Correlativo</h3>
                    </div>

                    <div className="space-y-4">
                        {/* Factura */}
                        <div className="bg-white rounded-xl border border-amber-100 overflow-hidden shadow-sm">
                            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">F</div>
                                <span className="text-xs font-bold text-blue-800">Factura Electrónica</span>
                                <span className="text-[10px] font-semibold text-blue-400 ml-auto">Serie F001</span>
                            </div>
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Serie</label>
                                    <input type="text" maxLength={4}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm uppercase font-mono ${!formData.serieFactura.startsWith('F') || formData.serieFactura.length !== 4 ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                                        value={formData.serieFactura}
                                        onChange={e => setFormData({ ...formData, serieFactura: e.target.value.toUpperCase() })}
                                        placeholder="F001" />
                                    {!formData.serieFactura.startsWith('F') && <p className="text-[10px] text-red-500">Debe empezar con F</p>}
                                    {formData.serieFactura.length > 0 && formData.serieFactura.length !== 4 && <p className="text-[10px] text-red-500">Debe tener 4 caracteres</p>}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Último Correlativo</label>
                                    <input type="text" inputMode="numeric" maxLength={8}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                                        value={formData.correlativoFactura > 0 ? String(formData.correlativoFactura) : ''}
                                        onChange={e => {
                                            const d = e.target.value.replace(/\D/g, '');
                                            const p = formData.correlativoFactura;
                                            const ps = p > 0 ? String(p) : '';
                                            if (d.length > ps.length && d.startsWith(ps)) { const n = p * 10 + parseInt(d.slice(-1), 10); if (n <= 99999999) setFormData({ ...formData, correlativoFactura: n }); }
                                            else if (d.length < ps.length) setFormData({ ...formData, correlativoFactura: Math.floor(p / 10) });
                                            else if (d !== ps) setFormData({ ...formData, correlativoFactura: d ? parseInt(d, 10) : 0 });
                                        }}
                                        placeholder="0" />
                                    <p className="text-[9px] text-gray-400 font-mono">= {String(formData.correlativoFactura > 0 ? formData.correlativoFactura : 0).padStart(8, '0')}</p>
                                </div>
                            </div>
                        </div>

                        {/* Boleta */}
                        <div className="bg-white rounded-xl border border-amber-100 overflow-hidden shadow-sm">
                            <div className="px-4 py-2 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-purple-600 text-white text-[10px] font-black flex items-center justify-center">B</div>
                                <span className="text-xs font-bold text-purple-800">Boleta Electrónica</span>
                                <span className="text-[10px] font-semibold text-purple-400 ml-auto">Serie B001</span>
                            </div>
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Serie</label>
                                    <input type="text" maxLength={4}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm uppercase font-mono ${!formData.serieBoleta.startsWith('B') || formData.serieBoleta.length !== 4 ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                                        value={formData.serieBoleta}
                                        onChange={e => setFormData({ ...formData, serieBoleta: e.target.value.toUpperCase() })}
                                        placeholder="B001" />
                                    {!formData.serieBoleta.startsWith('B') && <p className="text-[10px] text-red-500">Debe empezar con B</p>}
                                    {formData.serieBoleta.length > 0 && formData.serieBoleta.length !== 4 && <p className="text-[10px] text-red-500">Debe tener 4 caracteres</p>}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Último Correlativo</label>
                                    <input type="text" inputMode="numeric" maxLength={8}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-mono"
                                        value={formData.correlativoBoleta > 0 ? String(formData.correlativoBoleta) : ''}
                                        onChange={e => {
                                            const d = e.target.value.replace(/\D/g, '');
                                            const p = formData.correlativoBoleta;
                                            const ps = p > 0 ? String(p) : '';
                                            if (d.length > ps.length && d.startsWith(ps)) { const n = p * 10 + parseInt(d.slice(-1), 10); if (n <= 99999999) setFormData({ ...formData, correlativoBoleta: n }); }
                                            else if (d.length < ps.length) setFormData({ ...formData, correlativoBoleta: Math.floor(p / 10) });
                                            else if (d !== ps) setFormData({ ...formData, correlativoBoleta: d ? parseInt(d, 10) : 0 });
                                        }}
                                        placeholder="0" />
                                    <p className="text-[9px] text-gray-400 font-mono">= {String(formData.correlativoBoleta > 0 ? formData.correlativoBoleta : 0).padStart(8, '0')}</p>
                                </div>
                            </div>
                        </div>

                        {/* Liquidación de Compra */}
                        <div className="bg-white rounded-xl border border-amber-100 overflow-hidden shadow-sm">
                            <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">E</div>
                                <span className="text-xs font-bold text-emerald-800">Liquidación de Compra</span>
                                <span className="text-[10px] font-semibold text-emerald-400 ml-auto">Serie E001</span>
                            </div>
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Serie</label>
                                    <input type="text" maxLength={4}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm uppercase font-mono ${!formData.serieLiquidacion.startsWith('E') || formData.serieLiquidacion.length !== 4 ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                                        value={formData.serieLiquidacion}
                                        onChange={e => setFormData({ ...formData, serieLiquidacion: e.target.value.toUpperCase() })}
                                        placeholder="E001" />
                                    {!formData.serieLiquidacion.startsWith('E') && <p className="text-[10px] text-red-500">Debe empezar con E</p>}
                                    {formData.serieLiquidacion.length > 0 && formData.serieLiquidacion.length !== 4 && <p className="text-[10px] text-red-500">Debe tener 4 caracteres</p>}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Último Correlativo</label>
                                    <input type="text" inputMode="numeric" maxLength={8}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-mono"
                                        value={formData.correlativoLiquidacion > 0 ? String(formData.correlativoLiquidacion) : ''}
                                        onChange={e => {
                                            const d = e.target.value.replace(/\D/g, '');
                                            const p = formData.correlativoLiquidacion;
                                            const ps = p > 0 ? String(p) : '';
                                            if (d.length > ps.length && d.startsWith(ps)) { const n = p * 10 + parseInt(d.slice(-1), 10); if (n <= 99999999) setFormData({ ...formData, correlativoLiquidacion: n }); }
                                            else if (d.length < ps.length) setFormData({ ...formData, correlativoLiquidacion: Math.floor(p / 10) });
                                            else if (d !== ps) setFormData({ ...formData, correlativoLiquidacion: d ? parseInt(d, 10) : 0 });
                                        }}
                                        placeholder="0" />
                                    <p className="text-[9px] text-gray-400 font-mono">= {String(formData.correlativoLiquidacion > 0 ? formData.correlativoLiquidacion : 0).padStart(8, '0')}</p>
                                </div>
                            </div>
                        </div>

                        {/* Guía Remitente */}
                        <div className="bg-white rounded-xl border border-amber-100 overflow-hidden shadow-sm">
                            <div className="px-4 py-2 bg-sky-50 border-b border-sky-100 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-sky-600 text-white text-[10px] font-black flex items-center justify-center">T</div>
                                <span className="text-xs font-bold text-sky-800">Guía de Remisión Electrónica</span>
                                <span className="text-[10px] font-semibold text-sky-400 ml-auto">Serie T001</span>
                            </div>
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Serie</label>
                                    <input type="text" maxLength={4}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm uppercase font-mono ${!formData.serieGuiaRemision.startsWith('T') || formData.serieGuiaRemision.length !== 4 ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                                        value={formData.serieGuiaRemision}
                                        onChange={e => setFormData({ ...formData, serieGuiaRemision: e.target.value.toUpperCase() })}
                                        placeholder="T001" />
                                    {!formData.serieGuiaRemision.startsWith('T') && <p className="text-[10px] text-red-500">Debe empezar con T</p>}
                                    {formData.serieGuiaRemision.length > 0 && formData.serieGuiaRemision.length !== 4 && <p className="text-[10px] text-red-500">Debe tener 4 caracteres</p>}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Último Correlativo</label>
                                    <input type="text" inputMode="numeric" maxLength={8}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm font-mono"
                                        value={formData.correlativoGuiaRemision > 0 ? String(formData.correlativoGuiaRemision) : ''}
                                        onChange={e => {
                                            const d = e.target.value.replace(/\D/g, '');
                                            const p = formData.correlativoGuiaRemision;
                                            const ps = p > 0 ? String(p) : '';
                                            if (d.length > ps.length && d.startsWith(ps)) { const n = p * 10 + parseInt(d.slice(-1), 10); if (n <= 99999999) setFormData({ ...formData, correlativoGuiaRemision: n }); }
                                            else if (d.length < ps.length) setFormData({ ...formData, correlativoGuiaRemision: Math.floor(p / 10) });
                                            else if (d !== ps) setFormData({ ...formData, correlativoGuiaRemision: d ? parseInt(d, 10) : 0 });
                                        }}
                                        placeholder="0" />
                                    <p className="text-[9px] text-gray-400 font-mono">= {String(formData.correlativoGuiaRemision > 0 ? formData.correlativoGuiaRemision : 0).padStart(8, '0')}</p>
                                </div>
                            </div>
                        </div>

                        {/* Guía Transportista */}
                        <div className="bg-white rounded-xl border border-amber-100 overflow-hidden shadow-sm">
                            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-amber-600 text-white text-[10px] font-black flex items-center justify-center">V</div>
                                <span className="text-xs font-bold text-amber-800">Guía de Transportista Electrónica</span>
                                <span className="text-[10px] font-semibold text-amber-500 ml-auto">Serie V001</span>
                            </div>
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Serie</label>
                                    <input type="text" maxLength={4}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm uppercase font-mono ${!formData.serieGuiaTransporte.startsWith('V') || formData.serieGuiaTransporte.length !== 4 ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                                        value={formData.serieGuiaTransporte}
                                        onChange={e => setFormData({ ...formData, serieGuiaTransporte: e.target.value.toUpperCase() })}
                                        placeholder="V001" />
                                    {!formData.serieGuiaTransporte.startsWith('V') && <p className="text-[10px] text-red-500">Debe empezar con V</p>}
                                    {formData.serieGuiaTransporte.length > 0 && formData.serieGuiaTransporte.length !== 4 && <p className="text-[10px] text-red-500">Debe tener 4 caracteres</p>}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Último Correlativo</label>
                                    <input type="text" inputMode="numeric" maxLength={8}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm font-mono"
                                        value={formData.correlativoGuiaTransporte > 0 ? String(formData.correlativoGuiaTransporte) : ''}
                                        onChange={e => {
                                            const d = e.target.value.replace(/\D/g, '');
                                            const p = formData.correlativoGuiaTransporte;
                                            const ps = p > 0 ? String(p) : '';
                                            if (d.length > ps.length && d.startsWith(ps)) { const n = p * 10 + parseInt(d.slice(-1), 10); if (n <= 99999999) setFormData({ ...formData, correlativoGuiaTransporte: n }); }
                                            else if (d.length < ps.length) setFormData({ ...formData, correlativoGuiaTransporte: Math.floor(p / 10) });
                                            else if (d !== ps) setFormData({ ...formData, correlativoGuiaTransporte: d ? parseInt(d, 10) : 0 });
                                        }}
                                        placeholder="0" />
                                    <p className="text-[9px] text-gray-400 font-mono">= {String(formData.correlativoGuiaTransporte > 0 ? formData.correlativoGuiaTransporte : 0).padStart(8, '0')}</p>
                                </div>
                            </div>
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

            {toast && createPortal(
                <div className={`fixed top-5 right-5 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-semibold border animate-[fadeIn_0.2s_ease-out] ${toast.type === 'error' ? 'bg-red-600 text-white border-red-700' : 'bg-green-600 text-white border-green-700'}`}>
                    {toast.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
                    <span>{toast.message}</span>
                    <button type="button" onClick={() => setToast(null)} className="ml-2 opacity-80 hover:opacity-100 text-lg leading-none" aria-label="Cerrar">✕</button>
                </div>,
                document.body
            )}
        </div>
    );
};
