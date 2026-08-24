import React from 'react';
import { Check, X } from 'lucide-react';
import { PasswordAnalysis } from '../utils/passwordValidation';

export const PasswordStrengthMeter: React.FC<{ analysis: PasswordAnalysis }> = ({ analysis }) => {
  const { score, label, color, checks } = analysis;

  return (
    <div className="mt-2.5 space-y-2 text-left animate-fade-in">
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
          <span className="text-slate-400">Seguridad de clave:</span>
          <span className={score >= 70 ? 'text-emerald-600 font-bold' : score >= 45 ? 'text-amber-600 font-bold' : 'text-red-600 font-bold'}>
            {label} ({score}%)
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
          <div
            className={`h-full transition-all duration-300 ${color}`}
            style={{ width: `${Math.max(5, score)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-[10px] font-semibold text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
        <div className={`flex items-center gap-1 ${checks.minLength ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
          {checks.minLength ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <X className="w-3 h-3 text-slate-300 shrink-0" />} 8+ caracteres
        </div>
        <div className={`flex items-center gap-1 ${checks.hasUppercase ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
          {checks.hasUppercase ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <X className="w-3 h-3 text-slate-300 shrink-0" />} Mayúscula (A-Z)
        </div>
        <div className={`flex items-center gap-1 ${checks.hasLowercase ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
          {checks.hasLowercase ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <X className="w-3 h-3 text-slate-300 shrink-0" />} Minúscula (a-z)
        </div>
        <div className={`flex items-center gap-1 ${checks.hasNumber ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
          {checks.hasNumber ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <X className="w-3 h-3 text-slate-300 shrink-0" />} Número (0-9)
        </div>
        <div className={`flex items-center gap-1 ${checks.hasSpecial ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
          {checks.hasSpecial ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <X className="w-3 h-3 text-slate-300 shrink-0" />} Símbolo (!@#$...)
        </div>
        <div className={`flex items-center gap-1 ${checks.notCommon ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
          {checks.notCommon ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <X className="w-3 h-3 text-slate-300 shrink-0" />} No clave común
        </div>
      </div>
    </div>
  );
};
