import React from 'react';
import { AlertTriangle, Camera, X } from 'lucide-react';
import { QualityReport } from '../services/imageQuality';

interface Props {
  report: QualityReport;
  onRetry: () => void;
  onContinue: () => void;
  onDismiss: () => void;
}

export const ImageQualityAlert: React.FC<Props> = ({ report, onRetry, onContinue, onDismiss }) => {
  const issues = [
    report.blur.ok ? null : report.blur,
    report.brightness.ok ? null : report.brightness,
    report.contrast.ok ? null : report.contrast,
    report.resolution.ok ? null : report.resolution,
  ].filter(Boolean);

  if (issues.length === 0) return null;

  return (
    <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-amber-800 uppercase tracking-tight">
            Foto no óptima para OCR
          </p>
          <ul className="mt-2 space-y-1">
            {issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span className="text-[11px] text-amber-700 font-bold leading-tight">{issue!.message}</span>
              </li>
            ))}
          </ul>
        </div>
        <button type="button" onClick={onDismiss} className="p-1 text-amber-400 hover:text-amber-600 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-2 pl-8">
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-amber-600 transition-colors"
        >
          <Camera className="w-3 h-3" />
          Reintentar
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="px-3 py-1.5 bg-white border-2 border-amber-300 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-amber-100 transition-colors"
        >
          Continuar de todos modos
        </button>
      </div>
    </div>
  );
};
