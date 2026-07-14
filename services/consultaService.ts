/**
 * Servicio para consultar datos de RUC y DNI a través del servidor local (proxy SUNAT)
 */

const SERVER_URL = '';

export interface PersonaData {
  success: boolean;
  name?: string;
  razonSocial?: string;
  address?: string;
  error?: string;
}

export const consultaService = {
  consultarDNI: async (dni: string): Promise<PersonaData> => {
    try {
      const response = await fetch(`/consultar-dni?dni=${dni}`);
      const result = await response.json();
      return result;
    } catch {
      return { success: false, error: 'Error de conexión con el servidor' };
    }
  },

  consultarRUC: async (ruc: string): Promise<PersonaData> => {
    try {
      const response = await fetch(`/consultar-ruc?ruc=${ruc}`);
      const result = await response.json();
      return result;
    } catch {
      return { success: false, error: 'Error de conexión con el servidor' };
    }
  }
};
