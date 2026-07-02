
import { GoogleGenAI, Type } from "@google/genai";

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

// Corrected model name to 'gemini-3-flash-preview' and ensured SDK initialization follows guidelines
export const analyzeReceipt = async (base64Image: string, mimeType: string): Promise<ReceiptData> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          },
          {
            text: "Analiza este recibo peruano (Factura o Boleta). Extrae: 1. Total (número), 2. Fecha (YYYY-MM-DD), 3. Nombre del comercio (Razón Social), 4. RUC del emisor (11 dígitos), 5. Número de comprobante (serie y número, ej: F001-000123), 6. Subtotal (base imponible), 7. IGV (18%), 8. Categoría (Alimentación, Transporte, Servicios, Ocio, Salud, Otros)."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            total: { type: Type.NUMBER },
            date: { type: Type.STRING },
            merchant: { type: Type.STRING },
            ruc: { type: Type.STRING },
            invoiceNumber: { type: Type.STRING },
            subtotal: { type: Type.NUMBER },
            igv: { type: Type.NUMBER },
            category: { type: Type.STRING }
          },
          required: ["total", "date", "merchant", "category"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as ReceiptData;
    }
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};
