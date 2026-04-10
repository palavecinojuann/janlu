/// <reference types="vite/client" />
import { Product, Customer, Sale, RawMaterial } from '../types';

class GoogleSheetsService {
  private getUrl(): string {
    // Usamos variables de entorno, es mucho más seguro y persistente
    const url = import.meta.env.VITE_GOOGLE_SHEETS_URL;
    if (!url) {
      console.error('CRÍTICO: URL de Google Sheets no configurada en .env');
      throw new Error('Configuración de base de datos faltante.');
    }
    return url;
  }

  private async fetchSheets(action: string, data?: any) {
    const url = this.getUrl();

    try {
      // Quitamos el no-cors y usamos application/json real
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ action, ...data }),
      });

      // ¡AHORA SÍ podemos saber si falló!
      if (!response.ok) {
        throw new Error(`Error en el servidor de Google: ${response.status}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      // Aquí podrías agregar lógica para reintentar o guardar localmente
      // si no hay internet, para enviarlo después.
      console.error(`Error al sincronizar [${action}]:`, error);
      throw error; // Lanzamos el error para que la UI le avise al usuario
    }
  }

  async syncAll(data: {
    products: Product[];
    customers: Customer[];
    sales: Sale[];
    rawMaterials: RawMaterial[];
    campaigns?: any[];
    userProfile?: any;
    financialDocs?: any[];
  }) {
    return this.fetchSheets('syncAll', data);
  }

  async syncProducts(products: Product[]) {
    return this.fetchSheets('syncProducts', { products });
  }

  async syncCustomers(customers: Customer[]) {
    return this.fetchSheets('syncCustomers', { customers });
  }

  async syncSales(sales: Sale[]) {
    return this.fetchSheets('syncSales', { sales });
  }

  async syncRawMaterials(materials: RawMaterial[]) {
    return this.fetchSheets('syncRawMaterials', { materials });
  }
}

export const googleSheetsService = new GoogleSheetsService();
