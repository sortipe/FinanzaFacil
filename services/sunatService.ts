

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
   * Emite una Liquidación de Compra Electrónica (Serie E001, Tipo SUNAT 04)
   */
  emitirLiquidacionCompra: async (
    data: any,
    token: string,
    apiUrl: string = BASE_URL_LOCAL,
    userCredentials?: any,
    serie: string = 'E001',
    currency: string = 'PEN'
  ): Promise<SunatResponse> => {
    try {
      const isLocal = !apiUrl || apiUrl.startsWith('/') || apiUrl.includes('localhost');
      
      const payload = {
        invoiceData: {
          id: data.documentId || `${serie}-${Math.floor(Math.random() * 100000)}`,
          issueDate: data.date,
          customerRuc: data.recipientDocNumber,
          customerName: data.recipientName,
          customerType: data.recipientDocType || '1',
          purchaseLocation: data.purchaseLocation,
          emitterName: userCredentials?.emitterName || 'MI EMPRESA S.A.C.',
          items: data.items,
          subtotal: data.subtotal,
          igv: data.igv,
          retentionRate: data.retentionRate || 1.5,
          retentionAmount: data.retentionAmount || 0,
          total: data.total,
          netTotal: data.netTotal,
          currency: currency || 'PEN',
          documentType: '04'
        },
        credentials: userCredentials
      };

      if (isLocal) {
        const base = apiUrl && !apiUrl.startsWith('/') ? apiUrl : '';
        const response = await fetch(`${base}/emitir-factura`, {
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
          let errMsj = result.error || 'Error al emitir a SUNAT';
          if (errMsj.includes('Validation ZIP Filename error') || errMsj.includes('0151')) {
            errMsj = `SUNAT rechazó la serie E001 para este RUC (Error 0151). Verifica en Clave SUNAT SOL que la empresa tenga autorizada la serie E001 y el perfil para emitir Liquidaciones de Compra Electrónicas (Tipo 04) en el Sistema del Contribuyente.`;
          }
          return { success: false, error: errMsj };
        }
      } else {
        return sunatService.emitirConApisunat(payload, token, apiUrl);
      }
    } catch (error) {
      console.error('Error al emitir Liquidación de Compra:', error);
      return { success: false, error: 'Error de conexión con el servidor SUNAT' };
    }
  },

  /**
   * Emite una Guía de Remisión Electrónica Remitente (Serie T001, Tipo SUNAT 09)
   */
  emitirGuiaRemision: async (
    data: any,
    token: string,
    apiUrl: string = BASE_URL_LOCAL,
    userCredentials?: any,
    serie: string = 'T001'
  ): Promise<SunatResponse> => {
    try {
      const isLocal = !apiUrl || apiUrl.startsWith('/') || apiUrl.includes('localhost');
      
      const payload = {
        invoiceData: {
          id: data.documentId || `${serie}-${Math.floor(Math.random() * 100000)}`,
          issueDate: data.date,
          customerRuc: data.recipientRuc,
          customerName: data.recipientName,
          customerType: data.recipientDocType || (data.recipientRuc?.length === 8 ? '1' : '6'),
          emitterName: userCredentials?.emitterName || 'MI EMPRESA S.A.C.',
          transferReason: data.transferReason || '01',
          transportMode: data.transportMode || '02',
          transferStartDate: data.transferStartDate || data.date,
          totalGrossWeight: data.totalGrossWeight,
          weightUnit: data.weightUnit || 'KGM',
          packageCount: data.packageCount || 1,
          startAddress: data.startAddress,
          endAddress: data.endAddress,
          carrierRuc: data.carrierRuc,
          carrierName: data.carrierName,
          vehiclePlate: data.vehiclePlate,
          driverDocNumber: data.driverDocNumber,
          driverLicense: data.driverLicense,
          driverName: data.driverName,
          relatedDocNumber: data.relatedDocNumber,
          items: data.items,
          total: data.totalGrossWeight || 0,
          currency: 'PEN',
          documentType: '09'
        },
        credentials: userCredentials
      };

      if (isLocal) {
        const base = apiUrl && !apiUrl.startsWith('/') ? apiUrl : '';
        const response = await fetch(`${base}/emitir-factura`, {
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
        return sunatService.emitirConApisunat(payload, token, apiUrl);
      }
    } catch (error) {
      console.error('Error al emitir Guía de Remisión:', error);
      return { success: false, error: 'Error de conexión con el servidor SUNAT' };
    }
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
          const base = apiUrl && !apiUrl.startsWith('/') ? apiUrl : '';
          const payload = {
              invoiceData: {
                  id: data.documentId || `${serie || (data.recipientRuc?.length === 8 ? 'B001' : 'F001')}-${Math.floor(Math.random() * 100000)}`,
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

          const response = await fetch(`${base}/emitir-factura`, {
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
          let errMsj = result.error || 'Error al emitir a SUNAT';
          if (errMsj.includes('Validation ZIP Filename error') || errMsj.includes('0151')) {
            errMsj = `SUNAT rechazó la serie E001 para este RUC (Error 0151). Verifica en Clave SUNAT SOL que la empresa tenga autorizada la serie E001 y el perfil para emitir Liquidaciones de Compra Electrónicas (Tipo 04) en el Sistema del Contribuyente.`;
          }
          return { success: false, error: errMsj };
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
      const isLocal = !apiUrl || apiUrl.startsWith('/') || apiUrl.includes('localhost');
      if (!isLocal) {
        return { success: false, error: 'Notas de crédito/débito solo soportadas en motor local por ahora' };
      }
      const base = apiUrl && !apiUrl.startsWith('/') ? apiUrl : '';

      const noteIssueDate = data.issueDate || data.date || new Date().toISOString().split('T')[0];
      const payload = {
        noteType: 'nota_credito',
        noteData: {
          id: data.id,
          issueDate: noteIssueDate,
          date: noteIssueDate,
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

      const response = await fetch(`${base}/emitir-nota`, {
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
      const isLocal = !apiUrl || apiUrl.startsWith('/') || apiUrl.includes('localhost');
      if (!isLocal) {
        return { success: false, error: 'Notas de crédito/débito solo soportadas en motor local por ahora' };
      }
      const base = apiUrl && !apiUrl.startsWith('/') ? apiUrl : '';

      const noteIssueDate = data.issueDate || data.date || new Date().toISOString().split('T')[0];
      const payload = {
        noteType: 'nota_debito',
        noteData: {
          id: data.id,
          issueDate: noteIssueDate,
          date: noteIssueDate,
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

      const response = await fetch(`${base}/emitir-nota`, {
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
  },

  /**
   * Emite una Guía de Remisión Electrónica Transportista (V001 - SUNAT 31)
   */
  emitirGuiaTransportista: async (
    data: any,
    token: string,
    apiUrl: string = BASE_URL_LOCAL,
    userCredentials?: any,
    serie: string = 'V001'
  ): Promise<SunatResponse> => {
    try {
      const base = apiUrl && !apiUrl.startsWith('/') ? apiUrl : '';
      const payload = {
        invoiceData: {
          id: data.id || `${serie}-${Math.floor(Math.random() * 100000)}`,
          documentType: '31',
          issueDate: data.issueDate || new Date().toISOString().split('T')[0],
          senderRuc: data.senderRuc,
          senderName: data.senderName,
          customerRuc: data.recipientRuc,
          customerName: data.recipientName,
          customerType: data.recipientRuc?.length === 8 ? '1' : '6',
          payerRuc: data.payerRuc,
          payerName: data.payerName,
          emitterName: userCredentials?.emitterName || 'EMPRESA DE TRANSPORTES S.A.C.',
          mtcRegistrationNumber: data.mtcRegistrationNumber,
          items: data.items || [],
          total: 0,
          currency: 'PEN',
          grossWeight: data.grossWeight,
          weightUnit: data.weightUnit,
          packagesCount: data.packagesCount,
          originAddress: data.originAddress,
          destinationAddress: data.destinationAddress,
          vehiclePlate: data.vehiclePlate,
          trailerPlate: data.trailerPlate,
          driverLicense: data.driverLicense,
          driverDni: data.driverDni,
          driverName: data.driverName,
          docRefId: data.docRefId
        },
        credentials: userCredentials
      };

      const response = await fetch(`${base}/emitir-factura`, {
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
      console.error('Error emitting Guia Transportista:', error);
      return { success: false, error: 'Error de conexión con el servidor de SUNAT' };
    }
  }
};

