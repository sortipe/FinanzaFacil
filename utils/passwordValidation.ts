export interface PasswordAnalysis {
  isValid: boolean;
  score: number; // 0 to 100
  label: 'Muy Débil' | 'Débil' | 'Media' | 'Fuerte' | 'Excelente';
  color: string;
  checks: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
    notCommon: boolean;
  };
  errors: string[];
}

const COMMON_PASSWORDS = [
  '123456', '12345678', '123456789', 'password', 'qwerty', 'admin123',
  '123123', '111111', 'abc123', 'finanza', 'finanza123', 'cambiar123'
];

export function evaluatePassword(password: string, email?: string, name?: string): PasswordAnalysis {
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const lowerPwd = (password || '').toLowerCase();
  const lowerEmail = email ? email.toLowerCase().split('@')[0] : '';
  const lowerName = name ? name.toLowerCase() : '';

  let notCommon = true;
  if (COMMON_PASSWORDS.includes(lowerPwd)) {
    notCommon = false;
  }
  if (lowerEmail && lowerEmail.length > 2 && lowerPwd.includes(lowerEmail)) {
    notCommon = false;
  }
  if (lowerName && lowerName.length > 2 && lowerPwd.includes(lowerName)) {
    notCommon = false;
  }

  const checks = {
    minLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial,
    notCommon,
  };

  const errors: string[] = [];
  if (!minLength) errors.push('Mínimo 8 caracteres');
  if (!hasUppercase) errors.push('Al menos una letra mayúscula (A-Z)');
  if (!hasLowercase) errors.push('Al menos una letra minúscula (a-z)');
  if (!hasNumber) errors.push('Al menos un número (0-9)');
  if (!hasSpecial) errors.push('Al menos un carácter especial (!@#$%...)');
  if (!notCommon) errors.push('No use contraseñas comunes ni datos personales');

  let score = 0;
  if (password && password.length > 0) {
    if (minLength) score += 20;
    if (password.length >= 12) score += 10;
    if (hasUppercase) score += 20;
    if (hasLowercase) score += 15;
    if (hasNumber) score += 15;
    if (hasSpecial) score += 20;
    if (!notCommon) score = Math.max(0, score - 30);
  }

  const isValid = minLength && hasUppercase && hasLowercase && hasNumber && hasSpecial && notCommon;

  let label: PasswordAnalysis['label'] = 'Muy Débil';
  let color = 'bg-red-500';

  if (isValid && score >= 85) {
    label = 'Excelente';
    color = 'bg-emerald-500';
  } else if (isValid || (score >= 65 && minLength && hasUppercase && hasLowercase && hasNumber)) {
    label = 'Fuerte';
    color = 'bg-green-500';
  } else if (score >= 45 && minLength) {
    label = 'Media';
    color = 'bg-amber-500';
  } else if (score >= 25) {
    label = 'Débil';
    color = 'bg-orange-500';
  }

  return {
    isValid,
    score: Math.min(100, score),
    label,
    color,
    checks,
    errors
  };
}
