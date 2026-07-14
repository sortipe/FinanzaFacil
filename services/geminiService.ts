
const API_URL = '';

// Helper to convert file to base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

export interface ReceiptData {
  total: number;
  date: string;
  merchant: string;
  category: string;
  ruc?: string;
  invoiceNumber?: string;
  subtotal?: number;
  igv?: number;
}

export const analyzeReceipt = async (base64Image: string, mimeType: string): Promise<ReceiptData> => {
  const response = await fetch(`/analizar-recibo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Image, mimeType })
  });
  const result = await response.json();
  if (result.success && result.data) {
    return result.data as ReceiptData;
  }
  throw new Error(result.error || 'Error al analizar el recibo');
};
