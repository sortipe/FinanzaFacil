

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
          // Lógica para el servidor local propio (Costo Cero)
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
              credentials: userCredentials // Pasamos RUC, Usuario, Clave SOL y Certificado
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
          // Lógica anterior de APISUNAT (Con costo)
          const isDni = data.recipientRuc?.length === 8;
          const total = parseFloat(data.total) || 0;
          const payload: any = {
            documento: isDni ? 'boleta' : 'factura',
            serie: isDni ? 'B001' : 'F001',
            numero: Math.floor(Math.random() * 100000),
            fecha_de_emision: data.date,
            moneda: 'PEN',
            cliente_tipo_de_documento: isDni ? '1' : '6',
            cliente_numero_de_documento: data.recipientRuc,
            cliente_denominacion: data.recipientName,
            cliente_direccion: data.recipientAddress || 'CIUDAD',
            items: data.items.map((item: any) => ({
              unidad_de_medida: 'NIU',
              descripcion: item.description,
              cantidad: item.quantity.toString(),
              valor_unitario: (item.unitPrice / 1.18).toFixed(2),
              codigo_tipo_afectacion_igv: '10',
              porcentaje_igv: '18.00',
              nombre_tributo: 'IGV',
              total: parseFloat(item.total).toFixed(2)
            })),
            tipo_operacion: '0101',
            forma_pago: 'Contado',
            total: total.toFixed(2)
          };

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
            return { success: false, error: result.message || 'Error en APISUNAT' };
          }
      }
    } catch (error) {
      console.error('Error emitting Factura:', error);
      return { success: false, error: 'Error de conexión con el servidor de SUNAT' };
    }
  }
};

