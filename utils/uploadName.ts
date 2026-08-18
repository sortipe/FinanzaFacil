export const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export interface ParsedUploadName {
  folderPath: string;
  name: string;
}

export const parseUploadName = (filename: string): ParsedUploadName => {
  const dotIndex = filename.lastIndexOf('.');
  const base = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const ext = dotIndex > 0 ? filename.slice(dotIndex) : '';
  const parts = base.split('_').filter(p => p.length > 0);
  if (parts.length <= 1) return { folderPath: '', name: base + ext };
  if (parts.length === 2) return { folderPath: parts[0], name: parts[1] + ext };
  return { folderPath: `${parts[0]}/${parts[1]}`, name: parts.slice(2).join('_') + ext };
};

export const derivePeriod = (subfolder: string): { month: string; year: number } | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(subfolder);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const monthIdx = parseInt(match[2], 10);
  if (monthIdx < 1 || monthIdx > 12) return null;
  return { month: MONTHS[monthIdx - 1], year };
};

export const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error('read-error'));
    reader.readAsDataURL(file);
  });
