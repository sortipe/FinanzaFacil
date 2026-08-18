
import React, { useState, useMemo } from 'react';
import { X, ChevronRight, ChevronLeft, FileText, Search, CheckCircle, AlertTriangle } from 'lucide-react';
import { TaxDocument, NC_MOTIVOS, ND_MOTIVOS, NcNdMotivo, Company } from '../types';
import { useStore } from '../context/StoreContext';
import { sunatService } from '../services/sunatService';
import { allocateNextCorrelative } from '../src/services/api';

interface NoteWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onEmitted: (doc: TaxDocument) => void;
  initialType?: 'nota_credito' | 'nota_debito';
  company?: Company;
  accountantId?: string;
}

interface NoteData {
  noteType: 'nota_credito' | 'nota_debito';
  originalDocId: string;
  originalDocDate: string;
  reasonCode: string;
  reasonDescription: string;
  amount: number;
  currency: 'PEN' | 'USD';
  issueDate: string;
  description: string;
  customerPhone?: string;
}

export default function NoteWizard({ isOpen, onClose, onEmitted, initialType = 'nota_credito', company, accountantId }: NoteWizardProps) {
  const { currentUser, selectedCompany, taxDocuments, expenses, pendingInvoices, addPendingInvoice, sunatGlobalConfig } = useStore();
  const effectiveCompany = company ?? selectedCompany;
  const accountId = accountantId ?? '';
  const isAccountantMode = !!accountantId;

  const [step, setStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOriginalDoc, setSelectedOriginalDoc] = useState<TaxDocument | null>(null);
  const [noteData, setNoteData] = useState<NoteData>({
    noteType: initialType,
    originalDocId: '',
    originalDocDate: '',
    reasonCode: '01',
    reasonDescription: (initialType === 'nota_debito' ? ND_MOTIVOS : NC_MOTIVOS)['01'],
    amount: 0,
    currency: 'PEN',
    issueDate: new Date().toISOString().split('T')[0],
    description: '',
    customerPhone: '',
  });
  const [isEmitting, setIsEmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const isCredit = noteData.noteType === 'nota_credito';
  const currentMotivos = isCredit ? NC_MOTIVOS : ND_MOTIVOS;

  const getDocAmount = (doc: TaxDocument): number | undefined => {
    if (doc.metadata?.amount) return doc.metadata.amount;
    if (doc.xmlContent) {
      try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(doc.xmlContent, 'text/xml');
        const ext = xml.getElementsByTagNameNS('urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2', 'PayableAmount')[0]
          || xml.getElementsByTagNameNS('urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2', 'Amount')[0];
        if (ext) return parseFloat(ext.textContent || '0');
      } catch {}
    }
    const linkedExpense = expenses.find(e => e.invoiceNumber === doc.id);
    if (linkedExpense?.amount) return linkedExpense.amount;
    return undefined;
  };

  const getDocCustomerRuc = (doc: TaxDocument): string => {
    if (doc.metadata?.recipientRuc) return doc.metadata.recipientRuc;
    if (doc.xmlContent) {
      const match = doc.xmlContent.match(/<cac:AccountingCustomerParty>[\s\S]*?<cbc:ID[^>]*>([^<]+)<\/cbc:ID>/i);
      if (match?.[1]) return match[1].trim();
    }
    return '';
  };

  const getDocCustomerName = (doc: TaxDocument): string => {
    if (doc.metadata?.recipientName) return doc.metadata.recipientName;
    if (doc.xmlContent) {
      const match = doc.xmlContent.match(/<cac:AccountingCustomerParty>[\s\S]*?<cbc:RegistrationName>([^<]+)<\/cbc:RegistrationName>/i);
      if (match?.[1]) return match[1].trim();
    }
    return '';
  };

  // Filter eligible documents (facturas y boletas aceptadas o enviadas)
  const eligibleDocs = useMemo(() => {
    return taxDocuments.filter(d =>
      (d.sunatStatus === 'SENT' || d.sunatStatus === 'ACEPTADO') && (d.id.startsWith('F') || d.id.startsWith('B')) &&
      (!effectiveCompany || d.companyId === effectiveCompany.id) &&
      (d.userId === currentUser?.id)
    );
  }, [taxDocuments, effectiveCompany, currentUser]);

  const filteredDocs = useMemo(() => {
    if (!searchQuery) return eligibleDocs;
    const q = searchQuery.toLowerCase();
    return eligibleDocs.filter(d =>
      d.name?.toLowerCase().includes(q) ||
      d.id.toLowerCase().includes(q) ||
      getDocCustomerName(d).toLowerCase().includes(q) ||
      getDocCustomerRuc(d).includes(q)
    );
  }, [eligibleDocs, searchQuery]);

  // La serie de una nota es la del comprobante original (F001/B001), válida ante SUNAT.
  // El correlativo se reserva en el servidor (secuencia compartida por empresa + serie).
  const originalSerie = (selectedOriginalDoc?.id || '').split('-')[0] || '';

  const handleSelectDoc = (doc: TaxDocument) => {
    setSelectedOriginalDoc(doc);
    const docAmount = getDocAmount(doc) || 0;
    const rawDocId = doc.name?.replace(/.*?(\w+-\d+)$/, '$1') || doc.id;
    const cleanDocId = rawDocId.replace(/^BB([0-9]{3}-)/i, 'B$1').replace(/^FF([0-9]{3}-)/i, 'F$1');
    setNoteData(prev => ({
      ...prev,
      originalDocId: cleanDocId,
      originalDocDate: doc.metadata?.date || doc.uploadDate,
      amount: docAmount > 0 ? docAmount : prev.amount,
      customerName: getDocCustomerName(doc),
      customerPhone: doc.metadata?.recipientPhone || '',
    }));
    setStep(1);
  };

  const handleEmit = async () => {
    if (!effectiveCompany || !currentUser) return;
    setIsEmitting(true);
    setResult(null);

    try {
      if (!selectedOriginalDoc) {
        setResult({ success: false, message: 'Selecciona el documento original para emitir la nota.' });
        setStep(3);
        return;
      }

      // Serie del documento original (F001/B001) — solo series SUNAT válidas
      const docSerie = (selectedOriginalDoc.id || '').split('-')[0] || '';
      if (!/^[FB][0-9]{3}$/.test(docSerie)) {
        setResult({ success: false, message: `El documento original tiene serie inválida (${docSerie}). No se puede emitir la nota.` });
        setStep(3);
        return;
      }

      const customerRuc = getDocCustomerRuc(selectedOriginalDoc);
      const customerName = getDocCustomerName(selectedOriginalDoc);
      if (!customerRuc || !customerName) {
        setResult({ success: false, message: 'El documento original no tiene los datos del cliente (RUC y nombre). No se puede emitir la nota.' });
        setStep(3);
        return;
      }

      // Reservar correlativo secuencial en el servidor (compartido con facturas de la misma serie)
      const alloc = await allocateNextCorrelative(effectiveCompany.id, docSerie);
      const nextCorr = Number(alloc?.next) || 1;
      const noteId = `${docSerie}-${String(nextCorr).padStart(8, '0')}`;

      const credentials = {
        ruc: effectiveCompany.ruc,
        user: effectiveCompany.solUser,
        pass: effectiveCompany.solPass,
        certBase64: effectiveCompany.certBase64,
        certPass: effectiveCompany.certPass,
        emitterName: effectiveCompany.businessName || effectiveCompany.name,
        env: effectiveCompany.sunatEnv || 'SANDBOX',
      };

      const validIssueDate = noteData.issueDate || new Date().toISOString().split('T')[0];
      const data = {
        id: noteId,
        serie: docSerie,
        issueDate: validIssueDate,
        date: validIssueDate,
        currency: noteData.currency,
        total: noteData.amount,
        originalDocId: noteData.originalDocId,
        originalDocDate: noteData.originalDocDate,
        reasonCode: noteData.reasonCode,
        reasonDescription: noteData.reasonDescription,
        customerRuc,
        customerName,
        customerPhone: noteData.customerPhone,
        items: [{ description: noteData.description || noteData.reasonDescription, quantity: 1, unitPrice: noteData.amount }],
      };

      const apiUrl = effectiveCompany.sunatApiUrl || '';
      let response;
      if (noteData.noteType === 'nota_credito') {
        response = await sunatService.emitirNotaCredito(data, effectiveCompany.sunatToken || '', apiUrl, credentials);
      } else {
        response = await sunatService.emitirNotaDebito(data, effectiveCompany.sunatToken || '', apiUrl, credentials);
      }

      if (response.success) {
        const doc: TaxDocument = {
          id: `${noteData.noteType === 'nota_credito' ? 'NC' : 'ND'}-${Date.now()}`,
          userId: effectiveCompany.ownerUserId,
          companyId: effectiveCompany.id,
          accountantId: accountId,
          name: `${noteData.noteType === 'nota_credito' ? 'N. Crédito' : 'N. Débito'} ${noteId}`,
          fileUrl: '',
          mimeType: 'application/xml',
          uploadDate: validIssueDate,
          periodMonth: new Date(validIssueDate).toLocaleString('es', { month: 'long' }),
          periodYear: new Date(validIssueDate).getFullYear(),
          sunatStatus: 'SENT',
          documentType: noteData.noteType,
          originalDocumentId: selectedOriginalDoc.id,
          uploadedBy: isAccountantMode ? 'ACCOUNTANT' : 'USER',
          xmlContent: response.xmlContent,
          cdrBase64: response.cdrBase64,
          metadata: {
            recipientName: customerName,
            recipientRuc: customerRuc,
            description: noteData.description || noteData.reasonDescription,
            amount: noteData.amount,
            retention: 0,
            netAmount: noteData.amount / 1.18,
            date: validIssueDate,
          },
        };
        onEmitted(doc);
        setResult({
          success: true,
          message: `${noteData.noteType === 'nota_credito' ? 'Nota de Crédito' : 'Nota de Débito'} emitida correctamente (${noteId}).`,
        });
      } else {
        const pendingInvoice = {
          id: `pending-${Date.now()}`,
          userId: effectiveCompany.ownerUserId,
          companyId: effectiveCompany.id,
          serie: docSerie,
          correlative: nextCorr,
          documentType: noteData.noteType,
          originalDocumentId: selectedOriginalDoc.id,
          payload: data,
          customerDocType: customerRuc.length === 8 ? 'DNI' : 'RUC',
          customerDocNumber: customerRuc,
          customerName,
          customerPhone: noteData.customerPhone,
          amount: noteData.amount,
          createdAt: validIssueDate,
          lastAttempt: validIssueDate,
          attemptCount: 0,
          status: 'PENDIENTE' as const,
          lastError: response.error,
        };
        addPendingInvoice(pendingInvoice);
        setResult({
          success: false,
          message: `Error: ${response.error || 'No se pudo conectar con SUNAT'}. Guardado en Pendientes SUNAT para reintento.`,
        });
      }
      setStep(3);
    } catch (error: any) {
      setResult({ success: false, message: `Error al emitir la nota: ${error?.message || 'Desconocido'}` });
      setStep(3);
    } finally {
      setIsEmitting(false);
    }
  };

  const resetWizard = () => {
    setStep(0);
    setSelectedOriginalDoc(null);
    setSearchQuery('');
    setNoteData({
      noteType: initialType,
      originalDocId: '',
      originalDocDate: '',
      reasonCode: '01',
      reasonDescription: currentMotivos['01'],
      amount: 0,
      currency: 'PEN',
      issueDate: new Date().toISOString().split('T')[0],
      description: '',
    });
    setResult(null);
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={handleClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-50 rounded-xl text-brand-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-wide">
                {isCredit ? 'Nota de Crédito' : 'Nota de Débito'}
              </h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase">
                Paso {step + 1} de 4
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-3 flex gap-2">
          {[0, 1, 2, 3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-brand-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        <div className="p-6">
          {/* Step 0: Select Original Document */}
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="font-black text-gray-800 text-sm uppercase">Seleccionar Documento Original</h3>
              <p className="text-xs text-gray-500">Busca y selecciona la factura o boleta a la que Applies la nota.</p>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, RUC o ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-brand-600"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {filteredDocs.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">No se encontraron documentos</p>
                ) : (
                  filteredDocs.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => handleSelectDoc(doc)}
                      className="w-full text-left p-4 border-2 border-gray-100 rounded-xl hover:border-brand-400 hover:bg-brand-50 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-gray-800">{doc.name}</p>
                          <p className="text-[10px] text-gray-500">
                            {getDocCustomerName(doc) || 'Sin nombre'} • RUC: {getDocCustomerRuc(doc) || 'Sin RUC'}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Fecha: {doc.metadata?.date || doc.uploadDate}
                          </p>
                        </div>
                        <div className="text-right ml-3 flex-shrink-0">
                          {getDocAmount(doc) ? (
                            <p className="text-sm font-black text-green-700">S/ {getDocAmount(doc)!.toFixed(2)}</p>
                          ) : (
                            <p className="text-[10px] text-orange-400 font-bold">Sin monto</p>
                          )}
                          <ChevronRight className="w-4 h-4 text-gray-400 ml-auto mt-1" />
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Step 1: Note Details */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-black text-gray-800 text-sm uppercase">Datos de la Nota</h3>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Tipo</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNoteData(p => ({ ...p, noteType: 'nota_credito', reasonCode: '01', reasonDescription: NC_MOTIVOS['01'] }))}
                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition ${noteData.noteType === 'nota_credito' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    Nota de Crédito
                  </button>
                  <button
                    onClick={() => setNoteData(p => ({ ...p, noteType: 'nota_debito', reasonCode: '01', reasonDescription: ND_MOTIVOS['01'] }))}
                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition ${noteData.noteType === 'nota_debito' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    Nota de Débito
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Motivo</label>
                <select
                  value={noteData.reasonCode}
                  onChange={e => setNoteData(p => ({ ...p, reasonCode: e.target.value, reasonDescription: currentMotivos[e.target.value] }))}
                  className="w-full border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600"
                >
                  {Object.entries(currentMotivos).map(([code, desc]) => (
                    <option key={code} value={code}>{code} - {desc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Descripción adicional</label>
                <textarea
                  value={noteData.description}
                  onChange={e => setNoteData(p => ({ ...p, description: e.target.value }))}
                  placeholder="Detalle del motivo..."
                  className="w-full border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600 resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Fecha de Emisión</label>
                  <input
                    type="date"
                    value={noteData.issueDate}
                    onChange={e => setNoteData(p => ({ ...p, issueDate: e.target.value }))}
                    className="w-full border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Moneda</label>
                  <select
                    value={noteData.currency}
                    onChange={e => setNoteData(p => ({ ...p, currency: e.target.value as 'PEN' | 'USD' }))}
                    className="w-full border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600"
                  >
                    <option value="PEN">Soles (PEN)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Monto {isCredit ? 'a reducir' : 'a adicionar'} (S/)</label>
                {selectedOriginalDoc && getDocAmount(selectedOriginalDoc) && (
                  <p className="text-[10px] text-gray-400 mb-1">Monto del documento original: S/ {getDocAmount(selectedOriginalDoc)!.toFixed(2)}</p>
                )}
                <input
                  type="number"
                  step="0.01"
                  value={noteData.amount || ''}
                  onChange={e => setNoteData(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                  className="w-full border-2 border-gray-200 p-3 rounded-xl text-sm font-bold outline-none focus:border-brand-600"
                />
              </div>

              {selectedOriginalDoc && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                  <p className="font-black text-blue-700 uppercase text-[10px] mb-2 tracking-wider">Documento Original</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-gray-800">{selectedOriginalDoc.name}</p>
                      <p className="text-[11px] text-gray-500">{getDocCustomerName(selectedOriginalDoc) || 'Sin nombre'} • RUC: {getDocCustomerRuc(selectedOriginalDoc) || 'Sin RUC'}</p>
                    </div>
                    <div className="text-right">
                      {getDocAmount(selectedOriginalDoc) ? (
                        <>
                          <p className="text-[10px] text-gray-400 uppercase font-bold">Monto total</p>
                          <p className="text-lg font-black text-green-700">S/ {getDocAmount(selectedOriginalDoc)!.toFixed(2)}</p>
                        </>
                      ) : (
                        <p className="text-[11px] text-orange-500 font-bold">Monto no registrado</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Celular del cliente (opcional)</label>
                <input type="tel" placeholder="987654321" maxLength={9}
                  className={`
                    w-full bg-gray-50 border-2 p-3 rounded-xl text-sm text-gray-900 outline-none focus:border-brand-600 focus:bg-white uppercase
                    ${noteData.customerPhone && !/^9\d{8}$/.test(noteData.customerPhone) ? 'border-amber-400 bg-amber-50' : 'border-gray-200'}
                  `}
                  value={noteData.customerPhone} onChange={e => setNoteData(p => ({ ...p, customerPhone: e.target.value.replace(/\D/g, '').slice(0, 9) }))} />
                {noteData.customerPhone && !/^9\d{8}$/.test(noteData.customerPhone) && (
                  <p className="text-[9px] font-bold text-amber-600 mt-1">Formato: 9XXXXXXXX (9 dígitos)</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Summary */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-black text-gray-800 text-sm uppercase">Resumen</h3>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-gray-500">Tipo</span>
                  <span className="font-black text-gray-800">{isCredit ? 'Nota de Crédito' : 'Nota de Débito'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-gray-500">Motivo</span>
                  <span className="font-black text-gray-800">{noteData.reasonCode} - {noteData.reasonDescription}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-gray-500">Documento Original</span>
                  <span className="font-black text-gray-800">{selectedOriginalDoc?.name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-gray-500">Fecha Emisión</span>
                  <span className="font-black text-gray-800">{noteData.issueDate}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-gray-500">Monto</span>
                  <span className="font-black text-brand-600 text-sm">{noteData.currency} {noteData.amount.toFixed(2)}</span>
                </div>
                {noteData.description && (
                  <div className="text-xs">
                    <span className="font-bold text-gray-500">Descripción:</span>
                    <p className="text-gray-800 mt-1">{noteData.description}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-xs font-black uppercase hover:bg-gray-50 transition">
                  Editar
                </button>
                <button
                  onClick={handleEmit}
                  disabled={isEmitting || noteData.amount <= 0}
                  className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-xs font-black uppercase hover:bg-brand-700 transition disabled:opacity-50"
                >
                  {isEmitting ? 'Emitiendo...' : 'Emitir Nota'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Result */}
          {step === 3 && result && (
            <div className="text-center space-y-4">
              {result.success ? (
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              ) : (
                <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto" />
              )}
              <h3 className="font-black text-gray-800 text-lg uppercase">
                {result.success ? 'Éxito' : 'Con Error'}
              </h3>
              <p className="text-sm text-gray-600">{result.message}</p>
              <button
                onClick={handleClose}
                className="w-full py-3 bg-brand-600 text-white rounded-xl text-xs font-black uppercase hover:bg-brand-700 transition"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {step < 2 && (
          <div className="p-6 border-t border-gray-100 flex justify-between">
            <button
              onClick={() => step > 0 ? setStep(step - 1) : handleClose()}
              className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-800 transition flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> {step === 0 ? 'Cancelar' : 'Atrás'}
            </button>
            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                disabled={noteData.amount <= 0}
                className="px-6 py-2 bg-brand-600 text-white rounded-xl text-xs font-black uppercase hover:bg-brand-700 transition disabled:opacity-50 flex items-center gap-1"
              >
                Revisar <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
