/**
 * Servicio para consultar datos de RUC y DNI a través de apisperu.com
 */

const APISPERU_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Impvcmdlam9lbGlmenlhcGVAZ21haWwuY29tIn0.QWfgjFFFhjBTOJBHyK2v6WqJ2jyFeYMWpS8SHHBATrA';
const BASE_URL = 'https://dniruc.apisperu.com/api/v1';

export interface PersonaData {
  success: boolean;
  name?: string; // Para DNI
  razonSocial?: string; // Para RUC
  address?: string;
  error?: string;
}

export const consultaService = {
  /**
   * Consulta datos de un DNI
   */
  consultarDNI: async (dni: string): Promise<PersonaData> => {
    try {
      const response = await fetch(`${BASE_URL}/dni/${dni}?token=${APISPERU_TOKEN}`);
      const result = await response.json();
      
      if (response.ok && result.nombres) {
        return {
          success: true,
          name: `${result.nombres} ${result.apellidoPaterno} ${result.apellidoMaterno}`.trim()
        };
      }
      return { success: false, error: 'No se encontró el DNI' };
    } catch (error) {
      console.error('Error al consultar DNI:', error);
      return { success: false, error: 'Error de conexión' };
    }
  },

  /**
   * Consulta datos de un RUC
   */
  consultarRUC: async (ruc: string): Promise<PersonaData> => {
    try {
      const response = await fetch(`${BASE_URL}/ruc/${ruc}?token=${APISPERU_TOKEN}`);
      const result = await response.json();
      
      if (response.ok && result.razonSocial) {
        return {
          success: true,
          razonSocial: result.razonSocial,
          address: result.direccion
        };
      }
      return { success: false, error: 'No se encontró el RUC' };
    } catch (error) {
      console.error('Error al consultar RUC:', error);
      return { success: false, error: 'Error de conexión' };
    }
  }
};
