import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { SireRegistro, SireComprobante } from '../types';
import {
  fetchSireRegistros, fetchSireComprobantes, generarSireLocal,
  aceptarSirePropuesta, exportarSireTxt, conectarSireSunatOAuth2,
  consultarPropuestaSunatOAuth2, aceptarPropuestaSunatOAuth2
} from '../src/services/api';
import {
  X, Database, FileSpreadsheet, Download, CheckCircle2, AlertTriangle,
  Loader2, RefreshCw, FileText, BarChart, TrendingUp, TrendingDown,
  ChevronRight, Search, Filter, Calendar, Building, ShieldCheck, Eye,
  Cloud, Zap, Lock, KeyRound, Globe, Check
} from 'lucide-react';

interface SireModuleProps {
  isOpen: boolean;
  onClose: () => void;
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const TIPO_COMPROBANTE_LABEL: Record<string, string> = {
  factura: 'FACTURA', boleta: 'BOLETA', nota_credito: 'N. CRÉDITO', nota_debito: 'N. DÉBITO',
  liquidacion_compra: 'LIQ. COMPRA', compra: 'COMPRA', '01': 'FACTURA', '03': 'BOLETA',
  '07': 'N. CRÉDITO', '08': 'N. DÉBITO', '04': 'LIQ. COMPRA',
};

export const SireModule: React.FC<SireModuleProps> = ({ isOpen, onClose }) => {
  const { selectedCompanyId, selectedCompany, updateCompany } = useStore();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<'RVIE' | 'RCE'>('RVIE');
  const [mode, setMode] = useState<'API_OAUTH2' | 'LOCAL'>('API_OAUTH2');

  const [registros, setRegistros] = useState<SireRegistro[]>([]);
  const [comprobantes, setComprobantes] = useState<SireComprobante[]>([]);
  const [loading, setLoading] = useState(false);

  // States para llamadas API SUNAT OAuth2
  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const [oauthConnected, setOauthConnected] = useState<boolean | null>(null);
  const [fetchingSunat, setFetchingSunat] = useState(false);
  const [acceptingSunat, setAcceptingSunat] = useState(false);

  // States para local / export
  const [generating, setGenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Form para credenciales API SIRE opcionales
  const [showConfigCredentials, setShowConfigCredentials] = useState(false);
  const [clientIdInput, setClientIdInput] = useState(selectedCompany?.sireClientId || '');
  const [clientSecretInput, setClientSecretInput] = useState(selectedCompany?.sireClientSecret || '');

  const periodo = useMemo(() => `${year}-${String(month).padStart(2, '0')}`, [year, month]);

  const currentRegistro = useMemo(() => {
    return registros.find(r => r.periodo === periodo && r.tipo === tab) || null;
  }, [registros, periodo, tab]);

  const filteredComprobantes = useMemo(() => {
    if (!searchTerm.trim()) return comprobantes;
    const term = searchTerm.toLowerCase();
    return comprobantes.filter(c =>
      c.razonSocialEmisor?.toLowerCase().includes(term) ||
      c.rucEmisor?.includes(term) ||
      c.serie?.toLowerCase().includes(term) ||
      c.numero?.includes(term)
    );
  }, [comprobantes, searchTerm]);

  useEffect(() => {
    if (!isOpen || !selectedCompanyId) return;
    loadData();
    setOauthConnected(null);
  }, [isOpen, selectedCompanyId, periodo, tab]);

  const loadData = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    setError('');
    try {
      const [regs, comps] = await Promise.all([
        fetchSireRegistros(selectedCompanyId, periodo).catch(() => []),
        fetchSireComprobantes(selectedCompanyId, periodo, tab).catch(() => []),
      ]);
      setRegistros(regs);
      setComprobantes(comps);
    } catch (err: any) {
      setError(err.message || 'Error cargando datos SIRE');
    } finally {
      setLoading(false);
    }
  };

  const handleTestOAuth2Connection = async () => {
    if (!selectedCompanyId) return;
    setConnectingOAuth(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await conectarSireSunatOAuth2(selectedCompanyId);
      if (res.success) {
        setOauthConnected(true);
        setSuccessMsg('✓ Conexión OAuth2 verificada exitosamente con la API SUNAT SIRE.');
      }
    } catch (err: any) {
      setOauthConnected(false);
      setError(err.message || 'Error conectando con la API OAuth2 SUNAT SIRE.');
    } finally {
      setConnectingOAuth(false);
    }
  };

  const handleConsultarPropuestaSunatOAuth2 = async () => {
    if (!selectedCompanyId) return;
    setFetchingSunat(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await consultarPropuestaSunatOAuth2({ companyId: selectedCompanyId, periodo, tipo: tab });
      if (res.success) {
        setSuccessMsg(`✓ Propuesta oficial ${tab} obtenida desde la API SUNAT SIRE (${res.totalRegistros} comprobantes).`);
        await loadData();
      }
    } catch (err: any) {
      setError(err.message || 'Error consultando propuesta en API SUNAT SIRE.');
    } finally {
      setFetchingSunat(false);
    }
  };

  const handleAceptarPropuestaSunatOAuth2 = async () => {
    if (!selectedCompanyId) return;
    setAcceptingSunat(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await aceptarPropuestaSunatOAuth2({ companyId: selectedCompanyId, periodo, tipo: tab });
      if (res.success) {
        setSuccessMsg(`✓ Propuesta ${tab} aceptada en SUNAT SIRE (Ticket N° ${res.ticket}).`);
        await loadData();
      }
    } catch (err: any) {
      setError(err.message || 'Error aceptando propuesta en API SUNAT SIRE.');
    } finally {
      setAcceptingSunat(false);
    }
  };

  const handleGenerarLocal = async () => {
    if (!selectedCompanyId) return;
    setGenerating(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await generarSireLocal({ companyId: selectedCompanyId, periodo, tipo: tab });
      if (res.success) {
        setSuccessMsg(`Registro ${tab} generado localmente con ${res.comprobantes} comprobantes para ${MESES[month - 1]} ${year}.`);
        await loadData();
      }
    } catch (err: any) {
      setError(err.message || 'Error al generar registro SIRE');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportar = async () => {
    if (!selectedCompanyId) return;
    setExporting(true);
    setError('');
    try {
      const res = await exportarSireTxt(selectedCompanyId, periodo, tab);
      if (res.success && res.content) {
        const blob = new Blob([res.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename || `SIRE_${tab}_${periodo}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        setSuccessMsg(`Archivo TXT exportado: ${res.filename} (${res.totalRegistros} registros)`);
      } else {
        setError('No se pudo generar el archivo de exportación.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al exportar');
    } finally {
      setExporting(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!selectedCompanyId) return;
    try {
      await updateCompany(selectedCompanyId, {
        sireClientId: clientIdInput.trim(),
        sireClientSecret: clientSecretInput.trim(),
      });
      setSuccessMsg('Credenciales Client ID / Secret guardadas correctamente.');
      setShowConfigCredentials(false);
    } catch (err: any) {
      setError('Error al guardar credenciales: ' + err.message);
    }
  };

  if (!isOpen) return null;

  const estadoColor: Record<string, string> = {
    PENDIENTE: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    GENERADO: 'bg-blue-100 text-blue-800 border-blue-300',
    PROPUESTA: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    ACEPTADO: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    REEMPLAZADO: 'bg-purple-100 text-purple-800 border-purple-300',
  };

  const cruceColor: Record<string, string> = {
    COINCIDE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    FALTANTE_LOCAL: 'bg-red-50 text-red-700 border-red-200',
    FALTANTE_SUNAT: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    DISCREPANCIA: 'bg-orange-50 text-orange-700 border-orange-200',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-[2.5rem] max-w-6xl w-full p-6 md:p-8 shadow-2xl relative border-2 border-indigo-100 max-h-[95vh] overflow-y-auto space-y-5">

        {/* Close Button */}
        <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-2.5 rounded-full hover:bg-gray-100 transition z-10">
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3.5 bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
              <Cloud className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-black text-gray-900 uppercase tracking-tight">
                  SIRE SUNAT API — Integración OAuth2 Directa
                </h2>
                {selectedCompany?.sunatEnv === 'PRODUCTION' || (selectedCompany?.sireClientId && selectedCompany?.sireClientSecret) ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 border border-emerald-300">
                    <Zap className="w-3 h-3 fill-emerald-600" /> PRODUCCIÓN SUNAT API
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 border border-amber-300">
                    <AlertTriangle className="w-3 h-3 text-amber-600" /> MODO SIMULADOR / DEMO
                  </span>
                )}
              </div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
                RVIE (Ventas) y RCE (Compras) · {selectedCompany?.businessName || selectedCompany?.name || 'Empresa'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfigCredentials(!showConfigCredentials)}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-gray-500" />
              <span>Credenciales API</span>
            </button>
            <button
              onClick={handleTestOAuth2Connection}
              disabled={connectingOAuth}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              {connectingOAuth ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>Verificar Token</span>
            </button>
          </div>
        </div>

        {/* Modal de Configuración Credenciales API */}
        {showConfigCredentials && (
          <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-3">
            <h4 className="text-xs font-black uppercase text-indigo-900 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-indigo-600" /> Credenciales Personalizadas de API SUNAT SIRE (Opcional)
            </h4>
            <p className="text-[11px] text-indigo-700 font-medium">
              Por defecto el sistema utiliza el Client ID / Secret preconfigurado. Si registraste tu propia aplicación en el Portal SUNAT SOL (Ruta: <em>Empresas &gt; Credenciales de API</em>), puedes ingresar tus claves personalizadas aquí.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-black uppercase text-gray-500 block mb-1">Client ID</label>
                <input
                  type="text"
                  placeholder="Ej. 1480c5d6-444a-4d7a-8bd8-b570081dcf30"
                  value={clientIdInput}
                  onChange={e => setClientIdInput(e.target.value)}
                  className="w-full bg-white border border-gray-200 p-2.5 rounded-xl text-xs font-bold text-gray-900 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-gray-500 block mb-1">Client Secret</label>
                <input
                  type="password"
                  placeholder="••••••••••••••••••••••••"
                  value={clientSecretInput}
                  onChange={e => setClientSecretInput(e.target.value)}
                  className="w-full bg-white border border-gray-200 p-2.5 rounded-xl text-xs font-bold text-gray-900 outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowConfigCredentials(false)} className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-200 rounded-lg">Cancelar</button>
              <button onClick={handleSaveCredentials} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm">Guardar Credenciales</button>
            </div>
          </div>
        )}

        {/* Controls Bar: Period Selector + Tab Switcher */}
        <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="bg-white border border-gray-200 px-3 py-2 rounded-xl text-xs font-bold text-gray-900 outline-none focus:border-indigo-500">
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-white border border-gray-200 px-3 py-2 rounded-xl text-xs font-bold text-gray-900 outline-none focus:border-indigo-500">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="flex bg-gray-200 p-0.5 rounded-xl">
            <button onClick={() => setTab('RVIE')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${tab === 'RVIE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <TrendingUp className="w-3.5 h-3.5 inline mr-1" /> RVIE (Ventas)
            </button>
            <button onClick={() => setTab('RCE')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${tab === 'RCE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <TrendingDown className="w-3.5 h-3.5 inline mr-1" /> RCE (Compras)
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={loadData} disabled={loading} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition" title="Refrescar vista">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-2 text-xs font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" /> <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> <span>{successMsg}</span>
          </div>
        )}

        {/* Resumen Card */}
        {currentRegistro ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-2xl">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Estado SIRE</p>
              <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${estadoColor[currentRegistro.estado] || 'bg-gray-100 text-gray-600'}`}>
                {currentRegistro.estado}
              </span>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-2xl">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Comprobantes</p>
              <p className="text-lg font-black text-gray-900 mt-0.5">{currentRegistro.totalRegistros}</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-2xl">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Base Imponible</p>
              <p className="text-sm font-black text-gray-900 mt-0.5">S/ {Number(currentRegistro.baseImponible).toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-2xl">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">IGV</p>
              <p className="text-sm font-black text-gray-900 mt-0.5">S/ {Number(currentRegistro.igv).toFixed(2)}</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-2xl">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Total Mapeado</p>
              <p className="text-sm font-black text-indigo-600 mt-0.5">S/ {Number(currentRegistro.total).toFixed(2)}</p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 p-6 rounded-2xl text-center">
            <Cloud className="w-10 h-10 text-indigo-400 mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Sin propuesta cargada para {tab} ({MESES[month - 1]} {year})
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              Haz clic en <strong>"Obtener Propuesta SUNAT (API OAuth2)"</strong> para consultar los comprobantes reales registrados en el servidor de SUNAT.
            </p>
          </div>
        )}

        {/* Action Toolbar */}
        <div className="flex flex-wrap gap-2.5 pt-1">
          {/* Botón Principal: Consulta Directa SUNAT OAuth2 */}
          <button
            onClick={handleConsultarPropuestaSunatOAuth2}
            disabled={fetchingSunat || loading}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition shadow-md flex items-center gap-1.5 disabled:opacity-50"
          >
            {fetchingSunat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
            <span>Obtener Propuesta SUNAT (API OAuth2)</span>
          </button>

          {/* Botón Aceptar Directo SUNAT API */}
          {currentRegistro && (
            <button
              onClick={handleAceptarPropuestaSunatOAuth2}
              disabled={acceptingSunat}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              {acceptingSunat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Aceptar en SUNAT (API Directa)</span>
            </button>
          )}

          {/* Botón Generar Local */}
          <button
            onClick={handleGenerarLocal}
            disabled={generating || loading}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-[10px] font-black uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>Recopilar Localmente</span>
          </button>

          {/* Botón Exportar TXT */}
          {currentRegistro && (
            <button
              onClick={handleExportar}
              disabled={exporting}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black uppercase tracking-wider rounded-xl transition shadow-md flex items-center gap-1.5 disabled:opacity-50 ml-auto"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Exportar TXT (SUNAT)</span>
            </button>
          )}
        </div>

        {/* Tabla de Comprobantes Detallada */}
        {comprobantes.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-3 pt-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                Comprobantes de Propuesta ({comprobantes.length})
              </h3>
              <div className="w-64">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar RUC, razón social, serie..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 pl-9 pr-3 py-1.5 rounded-xl text-[11px] font-bold text-gray-900 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left">
                    <th className="px-3 py-2.5 font-black text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-3 py-2.5 font-black text-gray-500 uppercase tracking-wider">Serie-Número</th>
                    <th className="px-3 py-2.5 font-black text-gray-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-3 py-2.5 font-black text-gray-500 uppercase tracking-wider">RUC</th>
                    <th className="px-3 py-2.5 font-black text-gray-500 uppercase tracking-wider">{tab === 'RVIE' ? 'Cliente' : 'Proveedor'}</th>
                    <th className="text-right px-3 py-2.5 font-black text-gray-500 uppercase tracking-wider">Base Imp.</th>
                    <th className="text-right px-3 py-2.5 font-black text-gray-500 uppercase tracking-wider">IGV</th>
                    <th className="text-right px-3 py-2.5 font-black text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="text-center px-3 py-2.5 font-black text-gray-500 uppercase tracking-wider">Origen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredComprobantes.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 transition">
                      <td className="px-3 py-2">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase">
                          {TIPO_COMPROBANTE_LABEL[c.tipoComprobante] || c.tipoComprobante}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-bold text-gray-900">{c.serie}{c.numero ? `-${c.numero}` : ''}</td>
                      <td className="px-3 py-2 text-gray-600 font-bold">{c.fechaEmision}</td>
                      <td className="px-3 py-2 font-mono text-gray-700 font-bold">{c.rucEmisor}</td>
                      <td className="px-3 py-2 text-gray-700 font-bold max-w-[200px] truncate">{c.razonSocialEmisor}</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-700">S/ {Number(c.baseImponible).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-700">S/ {Number(c.igv).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-black text-gray-900">S/ {Number(c.total).toFixed(2)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${c.origen === 'SUNAT' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-100 text-gray-600'}`}>
                          {c.origen === 'SUNAT' ? '☁ SUNAT API' : '💻 LOCAL'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200">
                    <td colSpan={5} className="px-3 py-2.5 text-right font-black text-gray-500 uppercase text-[10px] tracking-wider">Totales</td>
                    <td className="px-3 py-2.5 text-right font-black text-gray-900">
                      S/ {filteredComprobantes.reduce((a, c) => a + Number(c.baseImponible), 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-black text-gray-900">
                      S/ {filteredComprobantes.reduce((a, c) => a + Number(c.igv), 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-black text-indigo-600">
                      S/ {filteredComprobantes.reduce((a, c) => a + Number(c.total), 0).toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {/* Footer Info Box */}
        <div className="bg-indigo-50/60 border border-indigo-200/60 p-4 rounded-2xl">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-black text-indigo-900 uppercase tracking-wider mb-1">
                Servicio Oficial API REST OAuth2 SUNAT SIRE
              </p>
              <ul className="text-[10px] text-indigo-800 font-medium space-y-0.5">
                <li>• <strong>Endpoint Autenticación:</strong> <code>https://api-seguridad.sunat.gob.pe/v1/clientinformation/v1/oauth2/token/</code></li>
                <li>• <strong>Endpoint SIRE:</strong> <code>https://api-sire.sunat.gob.pe/v1/contribuyente/mvs/macroservice/</code></li>
                <li>• <strong>Autenticación:</strong> Token Bearer de 2 horas renovado con las credenciales SOL de la empresa.</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
