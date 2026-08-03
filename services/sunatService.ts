

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
  cdrUrl?: string;
  xmlContent?: string;
  cdrBase64?: string;
  sunatStatus?: string;
  amount?: number;
  name?: string;
  customerName?: string;
  id?: string;
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
    const payload = {
      ...data,
      items: data.items || [{ description: data.description || 'Servicios profesionales', quantity: 1, unitPrice: parseFloat(data.amount) || 0 }],
      total: data.total ?? data.amount
    };
    return sunatService.emitirFactura(payload, token, apiUrl, userCredentials, 'E001', 'PEN');
  },

  /**
   * Emite un Recibo por Honorarios (RH) usando el scraper web del Portal SOL
   */
  emitirReciboHonorariosScraper: async (
    data: any,
    apiUrl: string = BASE_URL_LOCAL
  ): Promise<SunatResponse> => {
    try {
      const base = apiUrl || BASE_URL_LOCAL;
      const url = base.startsWith('/') ? `${base}/scrape/rh` : `${base}/scrape/rh`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (response.ok && result.ok) {
        return {
          success: true,
          data: result,
          pdfUrl: result.pdfPath ? result.pdfPath.replace(/\\/g, '/').replace(/^.*?downloads/, '/downloads') : '',
          xmlUrl: result.xmlPath ? result.xmlPath.replace(/\\/g, '/').replace(/^.*?downloads/, '/downloads') : '',
          sunatStatus: 'ACEPTADO'
        };
      }
      return { success: false, error: result.error || 'Error del scraper SUNAT' };
    } catch (error: any) {
      console.error('Error en scraper RH:', error);
      return { success: false, error: 'Error de conexión con el scraper de SUNAT: ' + (error.message || 'Desconocido') };
    }
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
      const isLocal = !apiUrl || apiUrl.startsWith('/') || apiUrl.includes('localhost');
      
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
  },

  /**
   * Emite una Nota de Crédito
   */
  emitirNotaCredito: async (
    data: any,
    token: string,
    apiUrl: string = BASE_URL_LOCAL,
    userCredentials?: any
  ): Promise<SunatResponse> => {
    try {
      const isLocal = apiUrl && apiUrl.includes('localhost');
      if (!isLocal) {
        return { success: false, error: 'Notas de crédito/débito solo soportadas en motor local por ahora' };
      }

      const payload = {
        noteType: 'nota_credito',
        noteData: {
          id: data.id,
          issueDate: data.date,
          currency: data.currency || 'PEN',
          originalDocId: data.originalDocId,
          originalDocDate: data.originalDocDate,
          reasonCode: data.reasonCode,
          reasonDescription: data.reasonDescription,
          customerRuc: data.customerRuc,
          customerName: data.customerName,
          customerType: data.customerRuc?.length === 8 ? '1' : '6',
          emitterName: userCredentials?.emitterName || 'MI EMPRESA S.A.C.',
          total: data.total,
          items: data.items || [{ description: data.reasonDescription || 'Nota de Crédito', quantity: 1, unitPrice: data.total }]
        },
        credentials: userCredentials
      };

      const response = await fetch(`${apiUrl}/emitir-nota`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success) {
        return {
          success: true,
          sunatStatus: 'ACEPTADO',
          xmlContent: result.xmlContent,
          cdrBase64: result.cdrBase64
        };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error emitting Nota de Crédito:', error);
      return { success: false, error: 'Error de conexión con el servidor de SUNAT' };
    }
  },

  /**
   * Emite una Nota de Débito
   */
  emitirNotaDebito: async (
    data: any,
    token: string,
    apiUrl: string = BASE_URL_LOCAL,
    userCredentials?: any
  ): Promise<SunatResponse> => {
    try {
      const isLocal = apiUrl && apiUrl.includes('localhost');
      if (!isLocal) {
        return { success: false, error: 'Notas de crédito/débito solo soportadas en motor local por ahora' };
      }

      const payload = {
        noteType: 'nota_debito',
        noteData: {
          id: data.id,
          issueDate: data.date,
          currency: data.currency || 'PEN',
          originalDocId: data.originalDocId,
          originalDocDate: data.originalDocDate,
          reasonCode: data.reasonCode,
          reasonDescription: data.reasonDescription,
          customerRuc: data.customerRuc,
          customerName: data.customerName,
          customerType: data.customerRuc?.length === 8 ? '1' : '6',
          emitterName: userCredentials?.emitterName || 'MI EMPRESA S.A.C.',
          total: data.total,
          items: data.items || [{ description: data.reasonDescription || 'Nota de Débito', quantity: 1, unitPrice: data.total }]
        },
        credentials: userCredentials
      };

      const response = await fetch(`${apiUrl}/emitir-nota`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.success) {
        return {
          success: true,
          sunatStatus: 'ACEPTADO',
          xmlContent: result.xmlContent,
          cdrBase64: result.cdrBase64
        };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error emitting Nota de Débito:', error);
      return { success: false, error: 'Error de conexión con el servidor de SUNAT' };
    }
  }
};

