import React, { useState } from 'react';
import { Database, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Product, RawMaterial } from '../types';

interface LoadTestDataProps {
  onAddMultipleProducts: (products: Product[]) => Promise<void>;
  onAddMultipleRawMaterials: (materials: RawMaterial[]) => Promise<void>;
}

export default function LoadTestData({ onAddMultipleProducts, onAddMultipleRawMaterials }: LoadTestDataProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoadData = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Create some test raw materials
      const testMaterials: RawMaterial[] = [
        {
          id: 'rm-test-1',
          name: 'Tela Algodón Premium',
          unit: 'm',
          dimension: 'length',
          baseUnit: 'cm',
          stock: 10000, // 100m in cm
          costPerUnit: 15, // 1500 per m -> 15 per cm
          minStock: 2000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'rm-test-2',
          name: 'Hilo Poliéster',
          unit: 'u',
          dimension: 'units',
          baseUnit: 'u',
          stock: 50,
          costPerUnit: 500,
          minStock: 10,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      // Create some test products
      const testProducts: Product[] = [
        {
          id: 'prod-test-1',
          name: 'Remera Básica',
          description: 'Remera de algodón premium',
          category: 'Remeras',
          photoUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=800',
          showInCatalog: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          variants: [
            { 
              id: 'v1', 
              name: 'Talle S', 
              stock: 10, 
              cost: 5000,
              margin: 200,
              price: 15000,
              sku: 'TEST-S',
              isFinishedGood: true,
              recipe: [
                { id: 'ri1', rawMaterialId: 'rm-test-1', quantity: 150, unit: 'cm' },
                { id: 'ri2', rawMaterialId: 'rm-test-2', quantity: 1, unit: 'u' }
              ]
            },
            { 
              id: 'v2', 
              name: 'Talle M', 
              stock: 10, 
              cost: 5000,
              margin: 200,
              price: 15000,
              sku: 'TEST-M',
              isFinishedGood: true,
              recipe: [
                { id: 'ri3', rawMaterialId: 'rm-test-1', quantity: 160, unit: 'cm' },
                { id: 'ri4', rawMaterialId: 'rm-test-2', quantity: 1, unit: 'u' }
              ]
            }
          ]
        },
        {
          id: 'prod-test-2',
          name: 'Pantalón Cargo',
          description: 'Pantalón cargo de gabardina',
          category: 'Pantalones',
          photoUrl: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&q=80&w=800',
          showInCatalog: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          variants: [
            { 
              id: 'v4', 
              name: 'Talle 40', 
              stock: 5, 
              cost: 12000,
              margin: 190,
              price: 35000,
              sku: 'TEST-40',
              isFinishedGood: true,
              recipe: [
                { id: 'ri5', rawMaterialId: 'rm-test-1', quantity: 250, unit: 'cm' },
                { id: 'ri6', rawMaterialId: 'rm-test-2', quantity: 2, unit: 'u' }
              ]
            }
          ]
        }
      ];

      await onAddMultipleRawMaterials(testMaterials);
      await onAddMultipleProducts(testProducts);
      
      setSuccess(true);
    } catch (err: unknown) {
      console.error("Error loading test data:", err);
      setError(err instanceof Error ? err.message : "Error al cargar los datos de prueba");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
          <Database size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-stone-800 dark:text-white">Cargar Datos de Prueba</h2>
          <p className="text-stone-500 dark:text-stone-400">Restaura productos y materias primas de ejemplo</p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6 flex gap-3">
        <AlertTriangle className="text-blue-600 dark:text-blue-400 shrink-0" size={20} />
        <div className="text-sm text-blue-800 dark:text-blue-200">
          <p className="font-medium mb-1">¿Para qué sirve esto?</p>
          <p>Si borraste los productos de prueba o se perdieron, puedes volver a cargarlos con este botón. Se agregarán materias primas y productos básicos para que puedas probar el sistema.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 size={18} />
          Datos de prueba cargados correctamente.
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleLoadData}
          disabled={loading}
          className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 size={20} className="mr-2 animate-spin" />
              Cargando...
            </>
          ) : (
            <>
              <Database size={20} className="mr-2" />
              Cargar Datos Ahora
            </>
          )}
        </button>
      </div>
    </div>
  );
}
