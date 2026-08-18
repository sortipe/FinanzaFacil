import React, { useState, useMemo } from 'react';
import { TaxDocument } from '../types';
import { parseUploadName, derivePeriod, readFileAsBase64, MONTHS } from '../utils/uploadName';
import {
  X, Folder, FolderOpen, ChevronRight, ChevronDown, Download, FileText,
  Upload, Plus, Search, User as UserIcon, CheckCircle2, Clock, Trash2,
  FolderTree, FileUp, Sparkles, Eye, ShieldCheck, ReceiptText, Calendar
} from 'lucide-react';

interface FileTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: TaxDocument[];
  onAddDocument: (doc: TaxDocument) => void;
  onDeleteDocument?: (id: string) => void;
  onPreviewDocument?: (doc: TaxDocument) => void;
  companyId: string;
  userId: string;
  accountantId?: string;
  isSubUser?: boolean;
  allowDelete?: boolean;
  userRole?: string;
}

export interface TreeFolderNode {
  id: string; // pdt, pdt/2026-06
  name: string; // pdt, 2026-06
  fullPath: string;
  subfolders: Map<string, TreeFolderNode>;
  files: TaxDocument[];
}

export const FileTreeModal: React.FC<FileTreeModalProps> = ({
  isOpen,
  onClose,
  documents,
  onAddDocument,
  onDeleteDocument,
  onPreviewDocument,
  companyId,
  userId,
  accountantId = '',
  isSubUser = false,
  allowDelete = false,
  userRole
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'comprobantes' | 'accountant' | 'user'>('all');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedDoc, setSelectedDoc] = useState<TaxDocument | null>(null);

  const canDelete = !!allowDelete && !isSubUser && (
    userRole === 'USER' ||
    userRole === 'PERSONA_NATURAL' ||
    userRole === 'EMPRESARIO' ||
    !userRole
  );

  // New File Upload Form State
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [targetBaseFolder, setTargetBaseFolder] = useState('pdt');
  const [targetSubFolder, setTargetSubFolder] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [customBaseFolder, setCustomBaseFolder] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Helper for downloading files safely with fallback
  const downloadFile = (content: string | undefined, filename: string, type: string, isBase64: boolean = false, fallbackDoc?: TaxDocument) => {
    try {
      let dataStr = content || '';
      let isB64 = isBase64;

      if (!dataStr && fallbackDoc) {
        dataStr = `================================================
FINANZAFACIL - FICHA DE DOCUMENTO TRIBUTARIO
================================================
Nombre: ${fallbackDoc.name}
Periodo: ${fallbackDoc.periodMonth} ${fallbackDoc.periodYear}
Fecha de Registro: ${fallbackDoc.uploadDate}
Ruta / Carpeta: ${fallbackDoc.folderPath || 'Raíz'}
Enviado por: ${fallbackDoc.uploadedBy === 'ACCOUNTANT' ? 'Contador' : 'Usuario'}
Estado SUNAT: ${fallbackDoc.sunatStatus || 'Registrado'}
${fallbackDoc.sunatHash ? `Firma Digital (Hash): ${fallbackDoc.sunatHash}\n` : ''}
${fallbackDoc.metadata ? `Detalle: ${JSON.stringify(fallbackDoc.metadata, null, 2)}\n` : ''}
================================================
Documento archivado en la plataforma FinanzaFacil
`;
        type = 'text/plain;charset=utf-8';
        if (!filename.endsWith('.txt')) filename = `${filename}.txt`;
        isB64 = false;
      }

      if (!dataStr) {
        alert("El archivo no contiene datos adjuntos para descargar.");
        return;
      }

      if (dataStr.startsWith('/') || dataStr.startsWith('http://') || dataStr.startsWith('https://') || dataStr.startsWith('blob:')) {
        const a = document.createElement('a');
        a.href = dataStr;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      let rawBase64 = dataStr;
      if (dataStr.includes(';base64,')) {
        rawBase64 = dataStr.split(';base64,')[1];
        isB64 = true;
      }

      let blob: Blob;
      if (isB64) {
        const binary = atob(rawBase64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
        blob = new Blob([array], { type });
      } else {
        blob = new Blob([dataStr], { type });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error("Error al descargar archivo", err);
      alert("Error al procesar la descarga del archivo.");
    }
  };

  const handleDownloadAnyAsset = (doc: TaxDocument) => {
    if (doc.fileUrl) {
      downloadFile(doc.fileUrl, doc.name, doc.mimeType || 'application/octet-stream', true, doc);
    } else if (doc.pdfUrl) {
      downloadFile(doc.pdfUrl, `${doc.name}.pdf`, 'application/pdf', false, doc);
    } else if (doc.xmlContent || doc.xmlUrl) {
      downloadFile(doc.xmlContent || doc.xmlUrl, `${doc.name}.xml`, 'text/xml', false, doc);
    } else if (doc.cdrBase64 || doc.cdrUrl) {
      downloadFile(doc.cdrBase64 || doc.cdrUrl, `R-${doc.name}.zip`, 'application/zip', true, doc);
    } else {
      downloadFile('', doc.name, 'text/plain', false, doc);
    }
  };

  const getPdfViewerUrl = (doc: TaxDocument): string => {
    if (doc.pdfUrl) {
      if (doc.pdfUrl.startsWith('/') || doc.pdfUrl.startsWith('data:') || doc.pdfUrl.startsWith('http') || doc.pdfUrl.startsWith('blob:')) {
        return doc.pdfUrl;
      }
      return `data:application/pdf;base64,${doc.pdfUrl}`;
    }

    if (doc.fileUrl) {
      if (doc.fileUrl.startsWith('/') || doc.fileUrl.startsWith('data:') || doc.fileUrl.startsWith('http') || doc.fileUrl.startsWith('blob:')) {
        return doc.fileUrl;
      }
      const mime = doc.mimeType || 'application/pdf';
      return `data:${mime};base64,${doc.fileUrl}`;
    }

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${doc.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
    .card { background: white; max-width: 580px; margin: 0 auto; padding: 32px; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
    .header { border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 16px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 0; letter-spacing: -0.5px; }
    .subtitle { font-size: 11px; font-weight: 700; color: #64748b; margin-top: 4px; text-transform: uppercase; }
    .badge { background: #dbeafe; color: #1d4ed8; font-size: 9px; font-weight: 900; padding: 4px 10px; border-radius: 999px; text-transform: uppercase; shrink: 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .field { background: #f8fafc; padding: 12px; border-radius: 12px; border: 1px solid #f1f5f9; }
    .label { color: #94a3b8; font-weight: 800; text-transform: uppercase; font-size: 9px; margin-bottom: 2px; }
    .value { font-weight: 900; color: #1e293b; font-size: 12px; }
    .amount-box { background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 16px; padding: 16px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center; }
    .amount-title { font-size: 10px; color: #1d4ed8; font-weight: 900; text-transform: uppercase; }
    .amount-value { font-size: 22px; font-weight: 900; color: #1e40af; }
    .footer { margin-top: 28px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; font-weight: 700; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <h1 class="title">${doc.name}</h1>
        <div class="subtitle">Documento Tributario FinanzaFacil</div>
      </div>
      <span class="badge">${doc.uploadedBy === 'ACCOUNTANT' ? 'Enviado por Contador' : 'Registrado'}</span>
    </div>
    <div class="grid">
      <div class="field"><div class="label">Periodo Declarado</div><div class="value">${doc.periodMonth} ${doc.periodYear}</div></div>
      <div class="field"><div class="label">Fecha de Carga</div><div class="value">${doc.uploadDate}</div></div>
      <div class="field"><div class="label">Carpeta Ruta</div><div class="value">${doc.folderPath || 'Raíz'}</div></div>
      <div class="field"><div class="label">Estado SUNAT</div><div class="value">${doc.sunatStatus || 'ACEPTADO'}</div></div>
    </div>
    ${doc.metadata ? `
      <div class="field" style="margin-bottom:12px;">
        <div class="label">Destinatario / Emisor</div>
        <div class="value">${doc.metadata.recipientName || 'No especificado'}</div>
        ${doc.metadata.recipientRuc ? `<div style="font-size:10px; color:#64748b; font-family:monospace; margin-top:2px;">RUC/DNI: ${doc.metadata.recipientRuc}</div>` : ''}
      </div>
      <div class="amount-box">
        <div class="amount-title">Monto Total</div>
        <div class="amount-value">S/ ${(doc.metadata.amount || 0).toFixed(2)}</div>
      </div>
    ` : ''}
    ${doc.sunatHash ? `
      <div class="field" style="margin-top:12px;">
        <div class="label">Firma Digital (Hash CPE)</div>
        <div class="value" style="font-family:monospace; font-size:10px; word-break:break-all;">${doc.sunatHash}</div>
      </div>
    ` : ''}
    <div class="footer">Control Tributario Oficial - FinanzaFacil</div>
  </div>
</body>
</html>`;
    return `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
  };

  const isComprobanteDePago = (d: TaxDocument) => {
    if (['factura', 'boleta', 'nota_credito', 'nota_debito', 'rh'].includes(d.documentType || '')) return true;
    const name = (d.name || '').toUpperCase();
    const id = (d.id || '').toUpperCase();
    if (id.startsWith('F') || id.startsWith('B') || id.startsWith('NC-') || id.startsWith('ND-') || id.startsWith('RH-')) return true;
    if (name.startsWith('FACTURA') || name.startsWith('BOLETA') || name.startsWith('N. CRÉDITO') || name.startsWith('N. DÉBITO') || name.startsWith('RECIBO')) return true;
    return false;
  };

  // Filter documents by search and source
  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      if (doc.sunatStatus === 'BORRADO') return false;
      const isComp = isComprobanteDePago(doc);
      if (filterSource === 'comprobantes' && !isComp) return false;
      if (filterSource === 'accountant' && (doc.uploadedBy !== 'ACCOUNTANT' || isComp)) return false;
      if (filterSource === 'user' && (doc.uploadedBy === 'ACCOUNTANT' || isComp)) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = doc.name.toLowerCase().includes(q);
        const matchFolder = (doc.folderPath || '').toLowerCase().includes(q);
        const matchPeriod = `${doc.periodMonth} ${doc.periodYear}`.toLowerCase().includes(q);
        return matchName || matchFolder || matchPeriod;
      }
      return true;
    });
  }, [documents, filterSource, searchTerm]);

  // Build multi-level folder tree
  const treeData = useMemo(() => {
    const rootFolders = new Map<string, TreeFolderNode>();
    const rootFiles: TaxDocument[] = [];

    for (const doc of filteredDocs) {
      let pathStr = doc.folderPath || '';
      if (!pathStr && doc.name.includes('_')) {
        const parsed = parseUploadName(doc.name);
        pathStr = parsed.folderPath;
      }

      if (!pathStr) {
        rootFiles.push(doc);
        continue;
      }

      const parts = pathStr.split('/').filter(p => p.trim().length > 0);
      let currentMap = rootFolders;
      let currentPath = '';

      for (let i = 0; i < parts.length; i++) {
        const folderName = parts[i];
        currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

        if (!currentMap.has(folderName)) {
          currentMap.set(folderName, {
            id: currentPath,
            name: folderName,
            fullPath: currentPath,
            subfolders: new Map<string, TreeFolderNode>(),
            files: []
          });
        }

        const node = currentMap.get(folderName)!;
        if (i === parts.length - 1) {
          node.files.push(doc);
        }
        currentMap = node.subfolders;
      }
    }

    return { rootFolders, rootFiles };
  }, [filteredDocs]);

  // Expand all folders by default when treeData changes
  const allFolderIds = useMemo(() => {
    const ids: string[] = [];
    const traverse = (map: Map<string, TreeFolderNode>) => {
      for (const node of (Array.from(map.values()) as TreeFolderNode[])) {
        ids.push(node.id);
        traverse(node.subfolders);
      }
    };
    traverse(treeData.rootFolders);
    return ids;
  }, [treeData]);

  // Auto expand on search
  React.useEffect(() => {
    if (searchTerm.trim() || allFolderIds.length > 0) {
      setExpandedFolders(new Set(allFolderIds));
    }
  }, [searchTerm, allFolderIds]);

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedFolders(new Set(allFolderIds));
  const collapseAll = () => setExpandedFolders(new Set());

  // Handle uploading files into specific folder
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      alert("Selecciona al menos un archivo.");
      return;
    }

    setIsUploading(true);
    try {
      const baseFolder = customBaseFolder.trim() || targetBaseFolder;
      const folderPath = targetSubFolder ? `${baseFolder}/${targetSubFolder}` : baseFolder;
      const period = derivePeriod(targetSubFolder) || {
        month: MONTHS[new Date().getMonth()],
        year: new Date().getFullYear()
      };

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const base64 = await readFileAsBase64(file);
        const { name } = parseUploadName(file.name);

        const newDoc: TaxDocument = {
          id: `doc-${Date.now()}-${i}`,
          userId,
          companyId,
          accountantId,
          name: name || file.name,
          folderPath,
          fileUrl: base64,
          mimeType: file.type || 'application/octet-stream',
          uploadDate: new Date().toISOString().split('T')[0],
          periodMonth: period.month,
          periodYear: period.year,
          uploadedBy: 'USER',
          sunatStatus: 'SENT'
        };

        onAddDocument(newDoc);
      }

      alert(`Se subieron ${selectedFiles.length} archivo(s) a la carpeta ${folderPath}.`);
      setSelectedFiles([]);
      setShowUploadForm(false);
    } catch (err) {
      console.error("Error subiendo archivos", err);
      alert("Error al procesar y guardar los archivos.");
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  // Render a folder node recursively
  const renderFolderNode = (node: TreeFolderNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(node.id);
    const subfolderList = (Array.from(node.subfolders.values()) as TreeFolderNode[]);
    const totalFilesCount = node.files.length + subfolderList.reduce((acc, sf) => acc + sf.files.length, 0);
    const accountantFilesCount = node.files.filter(f => f.uploadedBy === 'ACCOUNTANT').length;
    const period = derivePeriod(node.name);

    return (
      <div key={node.id} className="space-y-1" style={{ marginLeft: `${level * 16}px` }}>
        <div
          onClick={() => toggleFolder(node.id)}
          className="flex items-center justify-between p-2 rounded-xl hover:bg-brand-50/60 cursor-pointer transition group border border-transparent hover:border-brand-100"
        >
          <div className="flex items-center gap-2 min-w-0">
            <button className="p-1 text-gray-400 group-hover:text-brand-600">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {isExpanded ? (
              <FolderOpen className="w-5 h-5 text-amber-500 shrink-0" />
            ) : (
              <Folder className="w-5 h-5 text-amber-500 shrink-0" />
            )}
            <span className="text-xs font-black uppercase text-gray-800 truncate tracking-wide">
              {node.name}
            </span>
            {period && (
              <span className="text-[9px] font-bold text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-full shrink-0">
                {period.month} {period.year}
              </span>
            )}
            <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
              {totalFilesCount} {totalFilesCount === 1 ? 'archivo' : 'archivos'}
            </span>
            {accountantFilesCount > 0 && (
              <span className="text-[8px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase flex items-center shrink-0">
                <UserIcon className="w-2.5 h-2.5 mr-1" /> {accountantFilesCount} del contador
              </span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const parts = node.fullPath.split('/');
              setTargetBaseFolder(parts[0] || 'pdt');
              if (parts[1]) setTargetSubFolder(parts[1]);
              setShowUploadForm(true);
            }}
            className="p-1 text-xs bg-white text-brand-600 border border-brand-200 hover:bg-brand-600 hover:text-white rounded-lg transition opacity-0 group-hover:opacity-100 flex items-center gap-1 font-bold shadow-sm"
            title="Subir archivo a esta carpeta"
          >
            <Plus className="w-3.5 h-3.5" /> Subir aquí
          </button>
        </div>

        {isExpanded && (
          <div className="space-y-1">
            {subfolderList.map(subNode => renderFolderNode(subNode, level + 1))}
            {node.files.map(file => renderFileNode(file, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Render a file item node
  const renderFileNode = (file: TaxDocument, level: number = 0) => {
    const isFromAccountant = file.uploadedBy === 'ACCOUNTANT';
    const isSelected = selectedDoc?.id === file.id;
    const displayName = file.name.includes('_') ? parseUploadName(file.name).name : file.name;

    return (
      <div
        key={file.id}
        style={{ marginLeft: `${(level + 1) * 16}px` }}
        onClick={() => setSelectedDoc(file)}
        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition cursor-pointer group ${
          isSelected
            ? 'bg-brand-50 border-brand-400 shadow-sm'
            : isFromAccountant
            ? 'bg-blue-50/30 border-blue-100 hover:border-blue-300 hover:bg-blue-50/60'
            : 'bg-gray-50/40 border-gray-100 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`p-2 rounded-lg border shrink-0 ${
              isFromAccountant ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-brand-600'
            }`}
          >
            {isFromAccountant ? (
              <UserIcon className="w-4 h-4" />
            ) : file.documentType === 'rh' || file.id.startsWith('RH-') ? (
              <ReceiptText className="w-4 h-4 text-blue-600" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-black text-gray-900 truncate uppercase tracking-tight">{displayName}</p>
              {isFromAccountant && (
                <span className="text-[8px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-black uppercase shrink-0">
                  CONTADOR
                </span>
              )}
            </div>
            <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">
              {file.periodMonth} {file.periodYear} · Subido: {file.uploadDate}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedDoc(file);
              if (onPreviewDocument) onPreviewDocument(file);
            }}
            className="p-1.5 bg-gray-100 text-gray-700 hover:bg-brand-600 hover:text-white rounded-lg transition flex items-center gap-1 text-[10px] font-black uppercase shadow-sm"
            title="Abrir Previsualización Completa"
          >
            <Eye className="w-3.5 h-3.5" /> Abrir
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadAnyAsset(file);
            }}
            className="p-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition flex items-center gap-1 text-[10px] font-black uppercase shadow-sm"
            title="Descargar archivo"
          >
            <Download className="w-3.5 h-3.5" /> Descargar
          </button>

          {canDelete && onDeleteDocument && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`¿Eliminar ${file.name}?`)) onDeleteDocument(file.id);
              }}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
              title="Eliminar archivo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-[2rem] w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100 relative animate-fade-in">
        {/* Header */}
        <div className="p-6 border-b bg-gray-50/80 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-600 text-white rounded-2xl shadow-lg shadow-brand-200">
              <FolderTree className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                Árbol de Documentos Tributarios
                <span className="text-xs bg-brand-100 text-brand-700 px-2.5 py-0.5 rounded-full font-black">
                  {documents.length} archivos
                </span>
              </h2>
              <p className="text-xs text-gray-500 font-bold">
                Estructura por carpetas y subcarpetas (`carpeta_subcarpeta_nombre.ext`)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUploadForm(true)}
              className="bg-brand-600 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase hover:bg-brand-700 transition flex items-center gap-2 shadow-lg shadow-brand-100 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Nuevo Archivo / Carpeta
            </button>
            <button
              onClick={onClose}
              className="p-2.5 bg-white border border-gray-200 rounded-full hover:bg-gray-100 transition text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="p-4 border-b bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, carpeta o periodo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 p-2.5 pl-10 rounded-xl text-xs font-bold outline-none focus:border-brand-600 focus:bg-white transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterSource('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition ${
                filterSource === 'all'
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              Todos ({documents.length})
            </button>
            <button
              onClick={() => setFilterSource('comprobantes')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition ${
                filterSource === 'comprobantes'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Comprobantes de Pago ({documents.filter(d => isComprobanteDePago(d)).length})
            </button>
            <button
              onClick={() => setFilterSource('accountant')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition flex items-center gap-1.5 ${
                filterSource === 'accountant'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" /> Del Contador ({documents.filter(d => d.uploadedBy === 'ACCOUNTANT' && !isComprobanteDePago(d)).length})
            </button>
            <button
              onClick={() => setFilterSource('user')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition ${
                filterSource === 'user'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Del Empresario ({documents.filter(d => d.uploadedBy !== 'ACCOUNTANT' && !isComprobanteDePago(d)).length})
            </button>
          </div>

          <div className="flex items-center gap-2 border-l pl-3">
            <button
              onClick={expandAll}
              className="px-2.5 py-1.5 text-[10px] font-black uppercase text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              Expandir Todo
            </button>
            <button
              onClick={collapseAll}
              className="px-2.5 py-1.5 text-[10px] font-black uppercase text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              Contraer Todo
            </button>
          </div>
        </div>

        {/* Modal Body: File Tree + Preview Panel */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3">
          {/* Tree Explorer */}
          <div className="lg:col-span-2 p-6 overflow-y-auto border-r border-gray-100 space-y-3">
            {filteredDocs.length === 0 ? (
              <div className="py-20 text-center space-y-3 text-gray-400">
                <FolderTree className="w-16 h-16 mx-auto opacity-30" />
                <p className="font-black uppercase text-xs">No se encontraron archivos en el árbol</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Render Folders */}
                {(Array.from(treeData.rootFolders.values()) as TreeFolderNode[]).map(node => renderFolderNode(node, 0))}

                {/* Render Root Level Files */}
                {treeData.rootFiles.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-2 flex items-center gap-1.5">
                      <FileText className="w-3 h-3" /> Archivos en Raíz ({treeData.rootFiles.length})
                    </p>
                    {treeData.rootFiles.map(file => renderFileNode(file, 0))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Visualizador de PDF / Documento Panel (Columna Derecha) */}
          <div className="p-4 bg-gray-50/50 overflow-hidden flex flex-col h-full">
            {selectedDoc ? (
              <div className="h-full flex flex-col space-y-3 animate-fade-in">
                {/* Control Bar superior del Visualizador */}
                <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 bg-blue-50 text-blue-700 rounded-xl shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black text-gray-900 truncate uppercase tracking-tight">{selectedDoc.name}</h3>
                        {selectedDoc.uploadedBy === 'ACCOUNTANT' && (
                          <span className="text-[8px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-black uppercase shrink-0">
                            CONTADOR
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">
                        {selectedDoc.periodMonth} {selectedDoc.periodYear} · {selectedDoc.folderPath || 'Raíz'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadAnyAsset(selectedDoc)}
                      className="px-3.5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 text-[10px] font-black uppercase shadow-sm"
                      title="Descargar archivo"
                    >
                      <Download className="w-3.5 h-3.5" /> Descargar
                    </button>

                    {onPreviewDocument && (
                      <button
                        onClick={() => onPreviewDocument(selectedDoc)}
                        className="px-3.5 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl transition flex items-center gap-1.5 text-[10px] font-black uppercase"
                        title="Ver en pantalla completa"
                      >
                        <Eye className="w-3.5 h-3.5" /> Ver Detalle
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedDoc(null)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
                      title="Cerrar vista previa"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Iframe del Visualizador PDF */}
                <div className="flex-1 rounded-2xl overflow-hidden border-2 border-gray-200 bg-white shadow-inner relative min-h-[450px]">
                  <iframe
                    src={getPdfViewerUrl(selectedDoc)}
                    title={selectedDoc.name}
                    className="w-full h-full border-0 bg-white"
                  />
                </div>
              </div>
            ) : (
              <div className="py-20 text-center space-y-3 text-gray-400 my-auto">
                <Eye className="w-12 h-12 mx-auto opacity-30" />
                <p className="font-black uppercase text-xs">Visualizador de PDF</p>
                <p className="text-[10px] text-gray-400">Selecciona cualquier archivo del árbol para cargarlo directamente aquí</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sub-modal: Formulario para Subir / Crear Archivo en Carpeta Especificada */}
      {showUploadForm && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl relative animate-fade-in">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="text-base font-black text-gray-900 uppercase flex items-center gap-2">
                <FileUp className="w-5 h-5 text-brand-600" /> Subir Archivo a Carpeta
              </h3>
              <button
                onClick={() => setShowUploadForm(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">
                  Carpeta Base (Ej: pdt, comprobantes, declaraciones)
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {['pdt', 'comprobantes', 'declaraciones'].map(f => (
                    <button
                      type="button"
                      key={f}
                      onClick={() => { setTargetBaseFolder(f); setCustomBaseFolder(''); }}
                      className={`py-2 rounded-xl text-xs font-black uppercase transition ${
                        targetBaseFolder === f && !customBaseFolder
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="O escribe una carpeta personalizada..."
                  value={customBaseFolder}
                  onChange={e => setCustomBaseFolder(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded-xl text-xs font-bold outline-none focus:border-brand-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">
                  Subcarpeta / Periodo (Ej: 2026-06, 2026-08)
                </label>
                <input
                  type="text"
                  placeholder="AAAA-MM (Ejemplo: 2026-08)"
                  value={targetSubFolder}
                  onChange={e => setTargetSubFolder(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded-xl text-xs font-bold outline-none focus:border-brand-600 font-mono"
                  required
                />
                <p className="text-[9px] text-gray-400 mt-1 font-bold">
                  La ruta final será: <span className="font-mono text-brand-600">{customBaseFolder.trim() || targetBaseFolder}/{targetSubFolder}</span>
                </p>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase block mb-1">
                  Seleccionar Archivo(s)
                </label>
                <input
                  type="file"
                  multiple
                  onChange={e => setSelectedFiles(Array.from(e.target.files || []))}
                  className="w-full bg-gray-50 border border-gray-200 p-2 rounded-xl text-xs font-bold"
                  required
                />
                {selectedFiles.length > 0 && (
                  <p className="text-[10px] text-brand-600 font-bold mt-1">
                    {selectedFiles.length} archivo(s) seleccionado(s)
                  </p>
                )}
              </div>

              <div className="pt-4 border-t flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-xs font-black uppercase hover:bg-gray-200 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex-1 py-3 bg-brand-600 text-white rounded-xl text-xs font-black uppercase hover:bg-brand-700 transition flex items-center justify-center gap-2 shadow-lg shadow-brand-100 disabled:opacity-50"
                >
                  {isUploading ? 'Guardando...' : 'Subir Archivos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
