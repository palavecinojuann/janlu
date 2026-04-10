import React from 'react';
import BarcodeScanner from './BarcodeScanner';
import { Product, RawMaterial } from '../types';

interface ScannerViewProps {
  products: Product[];
  rawMaterials: RawMaterial[];
  onProductFound: (productId: string) => void;
  onRawMaterialFound: (materialId: string) => void;
}

export default function ScannerView({ products, rawMaterials, onProductFound, onRawMaterialFound }: ScannerViewProps) {
  const handleScan = (barcode: string) => {
    const product = products.find(p => p.variants.some(v => v.barcode === barcode));
    if (product) {
      onProductFound(product.id);
      return;
    }

    const material = rawMaterials.find(m => m.barcode === barcode);
    if (material) {
      onRawMaterialFound(material.id);
      return;
    }

    alert('Código no encontrado en el inventario');
  };

  return (
    <div className="flex-1 p-4 lg:p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100">Escáner de Códigos</h1>
          <p className="text-stone-500 dark:text-stone-400 mt-2">
            Escanea el código de barras de un producto o insumo para buscarlo rápidamente en el inventario.
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 overflow-hidden relative">
          <BarcodeScanner onScan={handleScan} onClose={() => {}} hideCloseButton={true} />
        </div>
      </div>
    </div>
  );
}
