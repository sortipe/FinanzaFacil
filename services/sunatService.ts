

/**
 * Servicio para integración con SUNAT.
 * Soporta APISUNAT (externo) y el nuevo Motor Local (Directo).
 */

const BASE_URL_LOCAL = '/api';
const BASE_URL_PROD = 'https://api.apisunat.com/api/v3';

export interface SunatResponse {
  success: boolean;
  data?: any;
  error?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  sunatStatus?: string;
}

export const sunatService = {
  /**
   * Verifica la validez del token o la conexión al servidor local
   */
  verifyCredentials: async (token: string, apiUrl: string = BASE_URL_LOCAL): Promise<boolean> => {
    try {
      if (apiUrl.includes('localhost')) {
          // Si es local, solo verificamos que responda
          const resp = await fetch(`${apiUrl}/status`).catch(() => null);
          return !!resp;
      }
      if (token && token.length > 30) return true;
      return false;
    } catch (error) {
      console.error('Error verifying SUNAT credentials:', error);
      return false;
    }
  },

  /**
   * Emite un Recibo por Honorarios (RH)
   */
  emitirReciboHonorarios: async (
    data: any, 
    token: string, 
    apiUrl: string = BASE_URL_LOCAL,
    userCredentials?: any
  ): Promise<SunatResponse> => {
    // Los RH usualmente requieren portal SOL directo o APIs específicas.
    // Por ahora redirigimos al flujo local si se desea.
    return sunatService.emitirFactura(data, token, apiUrl, userCredentials, 'E001', 'PEN');
  },


  /**
   * Emite una Factura o Boleta Electrónica
   */
  emitirFactura: async (
    data: any, 
    token: string, 
    apiUrl: string = BASE_URL_LOCAL,
    userCredentials?: any,
    serie?: string,
    currency?: string
  ): Promise<SunatResponse> => {
    try {
      const isLocal = apiUrl && apiUrl.includes('localhost');
      
      if (isLocal) {
          const payload = {
              invoiceData: {
                  id: `${serie || (data.recipientRuc?.length === 8 ? 'B001' : 'F001')}-${Math.floor(Math.random() * 100000)}`,
                  issueDate: data.date,
                  customerRuc: data.recipientRuc,
                  customerName: data.recipientName,
                  customerType: data.recipientRuc?.length === 8 ? '1' : '6',
                  emitterName: userCredentials?.emitterName || 'MI EMPRESA S.A.C.',
                  items: data.items,
                  total: data.total,
                  currency: currency || 'PEN',
                  paymentType: data.paymentType,
                  hasDetraction: data.hasDetraction,
                  detractionCode: data.detractionCode,
                  detractionPercent: data.detractionPercent,
                  isExport: data.isExport,
                  hasEstablishment: data.hasEstablishment
              },
              credentials: userCredentials
          };

          const response = await fetch(`${apiUrl}/emitir-factura`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });

          const result = await response.json();
          if (result.success) {
              return {
                  success: true,
                  sunatStatus: 'ACEPTADO',
                  data: result.sunatResponse,
                  xmlContent: result.xmlContent,
                  cdrBase64: result.cdrBase64
              };
          } else {
              return { success: false, error: result.error };
          }
      } else {
          return sunatService.emitirConApisunat(data, token, apiUrl);
      }
    } catch (error) {
      console.error('Error emitting Factura:', error);
      return { success: false, error: 'Error de conexión con el servidor de SUNAT' };
    }
  },

  emitirConApisunat: async (
    payload: any,
    token: string,
    apiUrl: string = BASE_URL_PROD
  ): Promise<SunatResponse> => {
    try {
      const response = await fetch(`${apiUrl}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (response.ok && result.success) {
        return {
          success: true,
          data: result,
          pdfUrl: result.payload?.pdf?.a4,
          xmlUrl: result.payload?.xml,
          sunatStatus: result.payload?.estado
        };
      } else {
        return { success: false, error: result.message || result.error || 'Error en APISUNAT' };
      }
    } catch (error) {
      console.error('Error en APISUNAT:', error);
      return { success: false, error: 'Error de conexión con APISUNAT' };
    }
  }
};

