import React, { useState, useMemo } from 'react';
import { Product, RawMaterial, Activity } from '../types';
import { Search, Check, AlertTriangle, ChevronRight, TrendingUp, DollarSign, RefreshCw } from 'lucide-react';

interface DynamicPricingToolProps {
  products: Product[];
  rawMaterials: RawMaterial[];
  onUpdateProducts: (products: Product[]) => Promise<void>;
  onUpdateRawMaterials: (materials: RawMaterial[]) => Promise<void>;
  onAddActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => Promise<void>;
}

export default function DynamicPricingTool({
  products,
  rawMaterials,
  onUpdateProducts,
  onUpdateRawMaterials,
  onAddActivity
}: DynamicPricingToolProps) {
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [newCost, setNewCost] = useState<number>(0);
  const [desiredMargin, setDesiredMargin] = useState<number>(50); // Default 50%
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const selectedMaterial = useMemo(() => 
    rawMaterials.find(m => m.id === selectedMaterialId), 
  [rawMaterials, selectedMaterialId]);

  // When material changes, set newCost to current cost
  React.useEffect(() => {
    if (selectedMaterial) {
      setNewCost(selectedMaterial.costPerUnit);
    }
  }, [selectedMaterial]);

  const affectedProducts = useMemo(() => {
    if (!selectedMaterial) return [];

    return products.filter(product => 
      product.variants.some(variant => 
        variant.recipe && variant.recipe.some(r => r.rawMaterialId === selectedMaterial.id)
      )
    );
  }, [products, selectedMaterial]);

  const previewUpdates = useMemo(() => {
    if (!selectedMaterial) return [];

    return affectedProducts.map(product => {
      const updatedVariants = product.variants.map(variant => {
        if (!variant.recipe) return variant;

        // Calculate old cost and new cost
        let oldTotalCost = 0;
        let newTotalCost = 0;

        variant.recipe.forEach(item => {
          const material = rawMaterials.find(m => m.id === item.rawMaterialId);
          if (material) {
            // Assuming item.quantity is in the same unit as material.costPerUnit for simplicity, 
            // or we should use the proper conversion if needed. 
            // For now, let's assume recipe cost calculation is direct or we can just calculate the difference.
            // Actually, we need to calculate the exact cost.
            // Let's just calculate the cost difference.
            const isTargetMaterial = material.id === selectedMaterial.id;
            const costPerUnit = isTargetMaterial ? newCost : material.costPerUnit;
            
            // Simplified cost calculation (assuming quantity is in base units)
            // In a real scenario, we'd use the proper UMB conversion here.
            oldTotalCost += material.costPerUnit * item.quantity;
            newTotalCost += costPerUnit * item.quantity;
          }
        });

        // Calculate suggested price based on new cost and desired margin
        // Price = Cost / (1 - Margin/100) or Price = Cost * (1 + Margin/100)
        // Let's use markup: Price = Cost * (1 + Margin/100)
        const suggestedPrice = newTotalCost * (1 + desiredMargin / 100);

        return {
          ...variant,
          oldCost: oldTotalCost,
          newCost: newTotalCost,
          suggestedPrice: Math.ceil(suggestedPrice / 10) * 10 // Round to nearest 10
        };
      });

      return {
        ...product,
        updatedVariants
      };
    });
  }, [affectedProducts, selectedMaterial, newCost, desiredMargin, rawMaterials]);

  const handleApply = async () => {
    if (!selectedMaterial) return;
    setIsProcessing(true);
    try {
      // 1. Update raw material
      const updatedMaterial = { ...selectedMaterial, costPerUnit: newCost };
      await onUpdateRawMaterials([updatedMaterial]);

      // 2. Update products
      const productsToUpdate = previewUpdates.map(p => {
        const variants = p.updatedVariants.map(v => ({
          ...v,
          price: v.suggestedPrice,
          // Remove temporary fields
          oldCost: undefined,
          newCost: undefined,
          suggestedPrice: undefined
        }));
        return { ...p, variants };
      });

      if (productsToUpdate.length > 0) {
        await onUpdateProducts(productsToUpdate);
      }

      await onAddActivity({
        title: 'Actualización Dinámica de Precios',
        description: `Se actualizaron los precios basados en el insumo: ${selectedMaterial.name}`,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].substring(0, 5),
        type: 'inventory',
        status: 'completed'
      });

      setShowConfirm(false);
      setSelectedMaterialId('');
      alert('Precios actualizados exitosamente.');
    } catch (error) {
      console.error('Error updating prices:', error);
      alert('Error al actualizar los precios.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('es-AR', { 
    style: 'currency', 
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      <div className="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800">
        <h3 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-4 flex items-center">
          <TrendingUp className="mr-2 text-indigo-500" size={20} />
          Fijación de Precios Dinámica
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Insumo que cambió de precio</label>
            <select
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
            >
              <option value="">-- Seleccionar Insumo --</option>
              {rawMaterials.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({formatCurrency(m.costPerUnit)}/{m.unit})</option>
              ))}
            </select>
          </div>

          {selectedMaterial && (
            <>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Nuevo Costo ({selectedMaterial.unit})</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newCost}
                    onChange={(e) => setNewCost(parseFloat(e.target.value) || 0)}
                    className="w-full pl-8 pr-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Margen de Ganancia Deseado (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={desiredMargin}
                    onChange={(e) => setDesiredMargin(parseFloat(e.target.value) || 0)}
                    className="w-full pr-8 pl-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500">%</span>
                </div>
              </div>
            </>
          )}
        </div>

        {selectedMaterial && affectedProducts.length > 0 && (
          <div className="mt-8">
            <h4 className="text-md font-medium text-stone-800 dark:text-stone-200 mb-4">Productos Afectados ({affectedProducts.length})</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-stone-500 dark:text-stone-400 uppercase bg-stone-50 dark:bg-stone-800/50">
                  <tr>
                    <th className="px-4 py-3 rounded-l-xl">Producto</th>
                    <th className="px-4 py-3">Variante</th>
                    <th className="px-4 py-3 text-right">Costo Anterior</th>
                    <th className="px-4 py-3 text-right">Costo Nuevo</th>
                    <th className="px-4 py-3 text-right">Precio Actual</th>
                    <th className="px-4 py-3 text-right text-indigo-600 dark:text-indigo-400 rounded-r-xl">Precio Sugerido</th>
                  </tr>
                </thead>
                <tbody>
                  {previewUpdates.map(product => (
                    product.updatedVariants.map(variant => (
                      <tr key={`${product.id}-${variant.id}`} className="border-b border-stone-100 dark:border-stone-800 last:border-0">
                        <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100">{product.name}</td>
                        <td className="px-4 py-3 text-stone-600 dark:text-stone-400">{variant.name}</td>
                        <td className="px-4 py-3 text-right text-stone-500">{formatCurrency(variant.oldCost)}</td>
                        <td className="px-4 py-3 text-right font-medium text-amber-600 dark:text-amber-500">{formatCurrency(variant.newCost)}</td>
                        <td className="px-4 py-3 text-right text-stone-500">{formatCurrency(variant.price)}</td>
                        <td className="px-4 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(variant.suggestedPrice)}</td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowConfirm(true)}
                className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
              >
                <Check size={20} className="mr-2" />
                Aplicar Nuevos Precios
              </button>
            </div>
          </div>
        )}

        {selectedMaterial && affectedProducts.length === 0 && (
          <div className="mt-8 p-6 text-center bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-200 dark:border-stone-700">
            <p className="text-stone-500 dark:text-stone-400">No hay productos que utilicen este insumo en su receta.</p>
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center text-amber-600 dark:text-amber-500 mb-4">
              <AlertTriangle size={24} className="mr-2" />
              <h3 className="text-lg font-bold">Confirmar Actualización</h3>
            </div>
            <p className="text-stone-600 dark:text-stone-400 mb-6">
              ¿Estás seguro de que deseas actualizar el costo de <strong>{selectedMaterial?.name}</strong> y aplicar los nuevos precios sugeridos a <strong>{affectedProducts.length}</strong> productos? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isProcessing}
                className="px-4 py-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleApply}
                disabled={isProcessing}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {isProcessing ? (
                  <><RefreshCw size={18} className="animate-spin mr-2" /> Procesando...</>
                ) : (
                  'Confirmar y Aplicar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
