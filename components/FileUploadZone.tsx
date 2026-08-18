import React, { useRef, useEffect } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { parseUploadName } from '../utils/uploadName';

interface FileUploadZoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  accept?: string;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  files,
  onFilesChange,
  accept = '.pdf,.xml,.jpg,.jpeg,.png'
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    if (inputRef.current) inputRef.current.files = dt.files;
  }, [files]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesChange(Array.from(e.target.files || []) as File[]);
    }
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div onClick={() => inputRef.current?.click()}
        className="border-4 border-dashed border-gray-200 rounded-2xl p-8 text-center cursor-pointer hover:border-brand-400 transition">
        <div className="space-y-3">
          <Upload className="w-10 h-10 text-gray-300 mx-auto" />
          <p className="text-sm font-black text-gray-500">Click para seleccionar archivos</p>
          <p className="text-[10px] text-gray-400">Varios a la vez · carpeta_subcarpeta_archivo</p>
        </div>
      </div>
      <input type="file" ref={inputRef} className="hidden" multiple accept={accept} onChange={handleFileSelect} />
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((file, i) => {
            const parsed = parseUploadName(file.name);
            return (
              <div key={`${file.name}-${i}`} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{parsed.name}</p>
                    <p className="text-[9px] text-gray-400 font-bold">{parsed.folderPath ? `Carpeta: ${parsed.folderPath}` : 'Sin carpeta'}</p>
                  </div>
                </div>
                <button type="button" onClick={() => removeFile(i)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0" title="Quitar">
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          <p className="text-[9px] text-gray-400 font-bold">Convención: la 1.ª palabra es la carpeta, la 2.ª la subcarpeta. Ej: pdt_2026-06_empresa.pdf → pdt/2026-06</p>
        </div>
      )}
    </div>
  );
};
