import React, { useState, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { Expense } from '../types';
import { 
  X, Upload, Download, FileSpreadsheet, Plus, CheckCircle2, AlertCircle, 
  Globe, DollarSign, Calendar, FileText, Check, ShieldCheck, RefreshCw, Eye
} from 'lucide-react';
import { downloadExpenseTemplateCsv, parseExpenseCsv, ParsedExpenseRow } from '../utils/excelParser';
import { compressImageFile, fileToBase64 } from '../services/geminiService';
import { formatImageUrl } from '../utils/imageUtils';

interface NonSunatExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  companyId?: string | null;
}

const QUICK_PROVIDERS = [
  { name: 'Meta / Facebook Ads', category: 'Publicidad Digital', currency: 'USD', icon: '📘' },
  { name: 'Instagram Ads', category: 'Publicidad Digital', currency: 'USD', icon: '📸' },
  { name: 'Google Ads', category: 'Publicidad Digital', currency: 'USD', icon: '🔍' },
  { name: 'Hostinger', category: 'Hosting & Cloud', currency: 'USD', icon: '🌐' },
  { name: 'Amazon Web Services (AWS)', category: 'Hosting & Cloud', currency: 'USD', icon: '☁️' },
  { name: 'OpenAI / ChatGPT', category: 'Software & IA', currency: 'USD', icon: '🤖' },
  { name: 'Zoom Video', category: 'Software & IA', currency: 'USD', icon: '📹' },
  { name: 'Canva Pro', category: 'Software & IA', currency: 'USD', icon: '🎨' },
  { name: 'Uber / Movilidad', category: 'Movilidad & Transportes', currency: 'PEN', icon: '🚖' },
];

const NON_SUNAT_CATEGORIES = [
  'Publicidad Digital (Facebook/Google)',
  'Hosting & Cloud (Hostinger/AWS)',
  'Software & IA (ChatGPT/Zoom/Canva)',
  'Comisiones Bancarias / Pasarelas (Stripe/PayPal)',
  'Movilidad & Transportes',
  'Logística & Courier Internacional',
  'Capacitación & Cursos Online',
  'Mantenimiento & Reparaciones Menores',
  'Otros Egresos No Deducibles SUNAT',
];

export const NonSunatExpensesModal: React.FC<NonSunatExpensesModalProps> = ({
  isOpen,
  onClose,
  userId,
  companyId,
}) => {
  const { addExpense, addBatchExpenses } = useStore();

  const [activeTab, setActiveTab] = useState<'individual' | 'batch'>('individual');

  // Single Form State
  const [merchantName, setMerchantName] = useState('');
  const [category, setCategory] = useState(NON_SUNAT_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [voucherUrl, setVoucherUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const singleFileInputRef = useRef<HTMLInputElement>(null);
  const excelFileInputRef = useRef<HTMLInputElement>(null);

  // Batch Import State
  const [parsedRows, setParsedRows] = useState<ParsedExpenseRow[]>([]);
  const [batchFileName, setBatchFileName] = useState('');
  const [batchError, setBatchError] = useState('');
  const [isImportingBatch, setIsImportingBatch] = useState(false);

  if (!isOpen) return null;

  // Quick shortcut selection
  const handleSelectQuickProvider = (prov: typeof QUICK_PROVIDERS[0]) => {
    setMerchantName(prov.name);
    setCategory(prov.category);
    setCurrency(prov.currency);
    if (!description) {
      setDescription(`Pago suscripción/servicio ${prov.name}`);
    }
  };

  // Upload single voucher file (image)
  const handleSingleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsCompressing(true);
      const b64 = await compressImageFile(file);
      setVoucherUrl(b64);
    } catch (err) {
      console.error('Error cargando voucher:', err);
    } finally {
      setIsCompressing(false);
    }
  };

  // Handle Single Submit
  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0 || !description.trim()) return;

    const fullDesc = merchantName ? `[${merchantName}] ${description.trim()}` : description.trim();

    addExpense({
      id: `exp-nonsunat-${Date.now()}`,
      userId,
      companyId: companyId || undefined,
      amount: parseFloat(amount),
      currency,
      description: fullDesc,
      date,
      category,
      invoiceNumber: invoiceNumber.trim() || undefined,
      internalVoucherUrl: voucherUrl || undefined,
      accountantVoucherUrl: voucherUrl || undefined,
      isPrivate: false,
    });

    setSuccessMsg('¡Egreso registrado correctamente!');
    setTimeout(() => {
      setSuccessMsg('');
      onClose();
    }, 1500);
  };

  // Upload Excel/CSV File
  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBatchFileName(file.name);
    setBatchError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = parseExpenseCsv(text);
        if (rows.length === 0) {
          setBatchError('No se encontraron registros de egresos válidos en el archivo.');
          setParsedRows([]);
        } else {
          setParsedRows(rows);
        }
      } catch (err: any) {
        setBatchError('Error al leer el archivo Excel/CSV: ' + err.message);
        setParsedRows([]);
      }
    };
    reader.readAsText(file);
  };

  // Confirm Batch Import
  const handleConfirmBatchImport = () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) return;

    setIsImportingBatch(true);

    const expenseObjects: Expense[] = validRows.map((r, idx) => ({
      id: `exp-batch-${Date.now()}-${idx}`,
      userId,
      companyId: companyId || undefined,
      amount: r.amount,
      currency: r.currency,
      description: r.merchantName ? `[${r.merchantName}] ${r.description}` : r.description,
      date: r.date,
      category: r.category || 'Otros Egresos No SUNAT',
      invoiceNumber: r.invoiceNumber || undefined,
      isPrivate: false,
    }));

    addBatchExpenses(expenseObjects);

    setIsImportingBatch(false);
    setSuccessMsg(`¡Se importaron con éxito ${validRows.length} egresos masivos!`);
    setTimeout(() => {
      setSuccessMsg('');
      onClose();
    }, 1800);
  };

  const validBatchCount = parsedRows.filter(r => r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 md:p-6 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-[2.5rem] max-w-4xl w-full p-6 md:p-8 shadow-2xl relative border-2 border-brand-100 max-h-[92vh] overflow-y-auto space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 p-2.5 rounded-full hover:bg-gray-100 transition z-10"
          title="Cerrar"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3.5">
          <div className="p-3.5 bg-brand-50 text-brand-600 rounded-2xl border border-brand-100">
            <Globe className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base md:text-lg font-black text-gray-900 uppercase tracking-tight">
              Egresos sin Comprobante SUNAT
            </h2>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">
              Servicios extranjeros (Meta, Google, Hostinger, AWS), software e invoices internacionales
            </p>
          </div>
        </div>

        {/* Success Message Banner */}
        {successMsg && (
          <div className="bg-emerald-500 text-white p-4 rounded-2xl flex items-center gap-3 shadow-md animate-fade-in">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <p className="text-xs font-black uppercase tracking-wider">{successMsg}</p>
          </div>
        )}

        {/* Tab Selector */}
        <div className="grid grid-cols-2 bg-gray-100 p-1.5 rounded-2xl gap-2">
          <button
            onClick={() => setActiveTab('individual')}
            className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'individual'
                ? 'bg-white text-brand-600 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4" /> Carga Individual (PDF / Imagen)
          </button>

          <button
            onClick={() => setActiveTab('batch')}
            className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'batch'
                ? 'bg-white text-emerald-600 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" /> Importación Masiva (Excel / CSV)
          </button>
        </div>

        {/* TAB 1: CARGA INDIVIDUAL */}
        {activeTab === 'individual' && (
          <div className="space-y-6">
            {/* Quick Provider Shortcuts */}
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                Accesos Rápido a Proveedores Frecuentes:
              </label>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROVIDERS.map((prov, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectQuickProvider(prov)}
                    className="px-3 py-2 bg-gray-50 hover:bg-brand-50 hover:border-brand-300 border border-gray-200 rounded-xl text-[10px] font-bold text-gray-700 hover:text-brand-700 transition flex items-center gap-1.5 active:scale-95"
                  >
                    <span>{prov.icon}</span>
                    <span>{prov.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSingleSubmit} className="space-y-4 pt-2 border-t border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                    Proveedor / Plataforma Extranjera *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Meta Platforms, Google LLC, Hostinger..."
                    value={merchantName}
                    onChange={e => setMerchantName(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 focus:border-brand-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                    Categoría del Gasto *
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 focus:border-brand-500 outline-none"
                  >
                    {NON_SUNAT_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                  Descripción del Egreso *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Campaña Publicitaria Facebook Anuncios Agosto"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 focus:border-brand-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                    Monto *
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={currency}
                      onChange={e => setCurrency(e.target.value)}
                      className="bg-gray-50 border-2 border-gray-100 p-3 rounded-2xl text-xs font-black text-gray-900 outline-none"
                    >
                      <option value="USD">$ USD</option>
                      <option value="PEN">S/ PEN</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="150.00"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 focus:border-brand-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                    Fecha del Egreso *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 focus:border-brand-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                    N° Invoice / Recibo Extranjero
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. INV-894721"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-100 p-3.5 rounded-2xl text-xs font-bold text-gray-900 focus:border-brand-500 outline-none"
                  />
                </div>
              </div>

              {/* File Upload Section */}
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1.5">
                  Adjunto: Recibo o Voucher PDF / Imagen (Opcional)
                </label>
                <input
                  type="file"
                  ref={singleFileInputRef}
                  accept="image/*"
                  onChange={handleSingleFileChange}
                  className="hidden"
                />

                {voucherUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-gray-200 h-28 bg-gray-100 flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <img src={formatImageUrl(voucherUrl)} className="w-16 h-16 object-cover rounded-xl border" />
                      <div>
                        <p className="text-xs font-bold text-gray-800">Comprobante / Recibo Adjuntado</p>
                        <p className="text-[10px] text-emerald-600 font-bold">✓ Imagen comprimida lista</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVoucherUrl(null)}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => singleFileInputRef.current?.click()}
                    disabled={isCompressing}
                    className="w-full p-4 border-2 border-dashed border-gray-300 rounded-2xl text-center hover:border-brand-500 transition bg-gray-50 hover:bg-white"
                  >
                    <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                    <span className="text-xs font-bold text-gray-600 block">
                      {isCompressing ? 'Procesando archivo...' : 'Seleccionar foto del Invoice o comprobante'}
                    </span>
                  </button>
                )}
              </div>

              {/* Form Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-3 text-xs font-black uppercase text-gray-500 hover:bg-gray-100 rounded-2xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition shadow-md flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Registrar Egreso
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: IMPORTACIÓN MASIVA EN EXCEL */}
        {activeTab === 'batch' && (
          <div className="space-y-6">
            {/* Step 1 & Step 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-emerald-50 border-2 border-emerald-100 p-5 rounded-3xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-800">
                  <Download className="w-5 h-5 text-emerald-600" />
                  <h4 className="text-xs font-black uppercase tracking-wider">Paso 1: Descargar Plantilla Excel</h4>
                </div>
                <p className="text-[11px] text-emerald-900 font-medium">
                  Descarga la plantilla pre-formateada para ingresar múltiples egresos de Meta, Hostinger o servicios extranjeros a la vez.
                </p>
                <button
                  onClick={downloadExpenseTemplateCsv}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Plantilla Excel (.csv)
                </button>
              </div>

              <div className="bg-brand-50 border-2 border-brand-100 p-5 rounded-3xl space-y-3">
                <div className="flex items-center gap-2 text-brand-800">
                  <Upload className="w-5 h-5 text-brand-600" />
                  <h4 className="text-xs font-black uppercase tracking-wider">Paso 2: Cargar Archivo Llenado</h4>
                </div>
                <p className="text-[11px] text-brand-900 font-medium">
                  Selecciona tu archivo Excel o CSV guardado para procesar la importación en lote.
                </p>
                <input
                  type="file"
                  ref={excelFileInputRef}
                  accept=".csv, .xlsx, .txt"
                  onChange={handleExcelFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => excelFileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-sm flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Subir Archivo Excel/CSV
                </button>
              </div>
            </div>

            {batchFileName && (
              <div className="p-3 bg-gray-100 rounded-xl flex items-center justify-between text-xs font-bold text-gray-800">
                <span>📄 Archivo cargado: <strong>{batchFileName}</strong></span>
                <button onClick={() => { setBatchFileName(''); setParsedRows([]); }} className="text-red-500 hover:underline text-[10px]">
                  Quitar
                </button>
              </div>
            )}

            {batchError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-2 text-xs font-bold">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{batchError}</span>
              </div>
            )}

            {/* Preview Table */}
            {parsedRows.length > 0 && (
              <div className="space-y-4 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Vista Previa de Importación ({parsedRows.length} Filas)
                  </h4>
                  <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full uppercase">
                    ✓ {validBatchCount} Registros Válidos Listos
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-2xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-100 sticky top-0 font-black text-gray-600 text-[10px] uppercase">
                      <tr>
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Proveedor</th>
                        <th className="p-3">Categoría</th>
                        <th className="p-3">Descripción</th>
                        <th className="p-3">Monto</th>
                        <th className="p-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {parsedRows.map((row, idx) => (
                        <tr key={idx} className={row.isValid ? 'bg-white' : 'bg-red-50/50'}>
                          <td className="p-3 font-medium text-gray-700">{row.date}</td>
                          <td className="p-3 font-bold text-gray-900">{row.merchantName}</td>
                          <td className="p-3 text-gray-600">{row.category}</td>
                          <td className="p-3 text-gray-800">{row.description}</td>
                          <td className="p-3 font-black text-gray-900">{row.currency === 'USD' ? '$' : 'S/'} {row.amount.toFixed(2)}</td>
                          <td className="p-3">
                            {row.isValid ? (
                              <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-black uppercase">
                                OK
                              </span>
                            ) : (
                              <span className="text-[9px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black uppercase">
                                {row.error || 'Error'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Confirm Import Action */}
                <div className="pt-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-3 text-xs font-black uppercase text-gray-500 hover:bg-gray-100 rounded-2xl transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmBatchImport}
                    disabled={validBatchCount === 0 || isImportingBatch}
                    className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition shadow-md flex items-center gap-2"
                  >
                    {isImportingBatch ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Confirmar Importación Masiva ({validBatchCount})</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
