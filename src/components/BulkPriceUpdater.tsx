import React, { useState, useMemo } from 'react';
import { RefreshCw, Filter, Search, Check, AlertTriangle, ChevronRight, Info } from 'lucide-react';
import { Product, RawMaterial, Activity } from '../types';

interface BulkPriceUpdaterProps {
  products: Product[];
  rawMaterials: RawMaterial[];
  onUpdateProducts: (products: Product[]) => Promise<void>;
  onUpdateRawMaterials: (materials: RawMaterial[]) => Promise<void>;
  onAddActivity: (activity: Omit<Activity, 'id' | 'createdAt'>) => Promise<void>;
}

export default function BulkPriceUpdater({ 
  products, 
  rawMaterials, 
  onUpdateProducts, 
  onUpdateRawMaterials,
  onAddActivity
}: BulkPriceUpdaterProps) {
  const [targetType, setTargetType] = useState<'products' | 'raw-materials'>('products');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [adjustmentType, setAdjustmentType] = useState<'percentage' | 'fixed'>('percentage');
  const [adjustmentValue, setAdjustmentValue] = useState<number>(0);
  const [isIncrease, setIsIncrease] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    const cats = new Set<string>();
    if (targetType === 'products') {
      products.forEach(p => cats.add(p.category));
    } else {
      rawMaterials.forEach(m => cats.add(m.unit)); // Using unit as category for materials for now
    }
    return Array.from(cats);
  }, [targetType, products, rawMaterials]);

  const filteredItems = useMemo(() => {
    let items: (Product | RawMaterial)[] = targetType === 'products' ? products : rawMaterials;
    if (categoryFilter !== 'all') {
      items = items.filter(item => {
        if (targetType === 'products') {
          return (item as Product).category === categoryFilter;
        } else {
          return (item as RawMaterial).unit === categoryFilter;
        }
      });
    }
    return items;
  }, [targetType, products, rawMaterials, categoryFilter]);

  // Initialize selected IDs when filtered items change
  React.useEffect(() => {
    setSelectedIds(new Set(filteredItems.map(item => item.id)));
  }, [filteredItems]);

  const previewItems = useMemo(() => {
    return filteredItems.map(item => {
      const isSelected = selectedIds.has(item.id);
      if (!isSelected) return { ...item, newPrice: null };

      let newPrice: number;
      if (targetType === 'products') {
        // For products, we update all variants
        const product = item as Product;
        const updatedVariants = product.variants.map((v) => {
          let price = v.price;
          if (adjustmentType === 'percentage') {
            const factor = 1 + (adjustmentValue / 100) * (isIncrease ? 1 : -1);
            price = v.price * factor;
          } else {
            price = v.price + adjustmentValue * (isIncrease ? 1 : -1);
          }
          return { ...v, newPrice: Math.max(0, price) };
        });
        return { ...product, updatedVariants };
      } else {
        // For raw materials
        const material = item as RawMaterial;
        let price = material.costPerUnit;
        if (adjustmentType === 'percentage') {
          const factor = 1 + (adjustmentValue / 100) * (isIncrease ? 1 : -1);
          price = item.costPerUnit * factor;
        } else {
          price = item.costPerUnit + adjustmentValue * (isIncrease ? 1 : -1);
        }
        return { ...item, newPrice: Math.max(0, price) };
      }
    });
  }, [filteredItems, selectedIds, adjustmentType, adjustmentValue, isIncrease, targetType]);

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleUpdate = async () => {
    setIsProcessing(true);
    try {
      if (targetType === 'products') {
        const updatedProducts = products.map(p => {
          if (!selectedIds.has(p.id)) return p;
          return {
            ...p,
            variants: p.variants.map(v => {
              let price = v.price;
              if (adjustmentType === 'percentage') {
                const factor = 1 + (adjustmentValue / 100) * (isIncrease ? 1 : -1);
                price = v.price * factor;
              } else {
                price = v.price + adjustmentValue * (isIncrease ? 1 : -1);
              }
              return { ...v, price: Math.max(0, price) };
            }),
            updatedAt: new Date().toISOString()
          };
        });
        await onUpdateProducts(updatedProducts);
      } else {
        const updatedMaterials = rawMaterials.map(m => {
          if (!selectedIds.has(m.id)) return m;
          let price = m.costPerUnit;
          if (adjustmentType === 'percentage') {
            const factor = 1 + (adjustmentValue / 100) * (isIncrease ? 1 : -1);
            price = m.costPerUnit * factor;
          } else {
            price = m.costPerUnit + adjustmentValue * (isIncrease ? 1 : -1);
          }
          return {
            ...m,
            costPerUnit: Math.max(0, price),
            updatedAt: new Date().toISOString()
          };
        });
        await onUpdateRawMaterials(updatedMaterials);
      }
      
      // Log activity
      await onAddActivity({
        type: 'inventory',
        title: 'Actualización Masiva de Precios',
        description: `Se actualizaron los precios de ${selectedIds.size} ${targetType === 'products' ? 'productos' : 'insumos'} (${isIncrease ? '+' : '-'}${adjustmentValue}${adjustmentType === 'percentage' ? '%' : '$'})`,
        status: 'completed',
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });

      setShowConfirm(false);
      alert('Precios actualizados con éxito');
    } catch (error) {
      console.error('Error updating prices:', error);
      alert('Error al actualizar precios');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      <div className="flex-none flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-stone-800 dark:text-white font-cinzel">Actualizador Masivo</h2>
          <p className="text-stone-500 dark:text-stone-400">Ajusta precios de forma masiva por inflación o cambios de costos</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Section */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-stone-800 rounded-2xl p-6 shadow-sm border border-stone-200 dark:border-stone-700">
            <h3 className="font-semibold text-stone-800 dark:text-white mb-4 flex items-center gap-2">
              <Filter size={18} className="text-indigo-500" /> 1. Filtros
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Tipo de Item</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setTargetType('products'); setCategoryFilter('all'); }}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      targetType === 'products' 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
                    }`}
                  >
                    Productos
                  </button>
                  <button
                    onClick={() => { setTargetType('raw-materials'); setCategoryFilter('all'); }}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      targetType === 'raw-materials' 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
                    }`}
                  >
                    Insumos
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Categoría</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-sm dark:text-white"
                >
                  <option value="all">Todas las categorías</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-stone-800 rounded-2xl p-6 shadow-sm border border-stone-200 dark:border-stone-700">
            <h3 className="font-semibold text-stone-800 dark:text-white mb-4 flex items-center gap-2">
              <RefreshCw size={18} className="text-indigo-500" /> 2. Ajuste
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Tipo de Cambio</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAdjustmentType('percentage')}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      adjustmentType === 'percentage' 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
                    }`}
                  >
                    Porcentaje (%)
                  </button>
                  <button
                    onClick={() => setAdjustmentType('fixed')}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      adjustmentType === 'fixed' 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
                    }`}
                  >
                    Monto Fijo ($)
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsIncrease(true)}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isIncrease 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                      : 'bg-stone-50 dark:bg-stone-900 text-stone-400 border border-transparent'
                  }`}
                >
                  Aumento
                </button>
                <button
                  onClick={() => setIsIncrease(false)}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    !isIncrease 
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800' 
                      : 'bg-stone-50 dark:bg-stone-900 text-stone-400 border border-transparent'
                  }`}
                >
                  Descuento
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase mb-2">Valor</label>
                <div className="relative">
                  <input
                    type="number"
                    value={adjustmentValue || ''}
                    onChange={(e) => setAdjustmentValue(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full pl-4 pr-10 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold">
                    {adjustmentType === 'percentage' ? '%' : '$'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowConfirm(true)}
                disabled={adjustmentValue <= 0 || selectedIds.size === 0}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-stone-200 dark:disabled:bg-stone-800 disabled:text-stone-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
              >
                Actualizar {selectedIds.size} Items
              </button>
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-700 overflow-hidden">
            <div className="p-4 border-b border-stone-200 dark:border-stone-700 flex justify-between items-center bg-stone-50 dark:bg-stone-900/50">
              <h3 className="font-semibold text-stone-800 dark:text-white">Previsualización de Cambios</h3>
              <div className="text-xs text-stone-500 dark:text-stone-400">
                {selectedIds.size} de {filteredItems.length} seleccionados
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-100 dark:border-stone-800">
                    <th className="p-4 w-10">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                        onChange={() => {
                          if (selectedIds.size === filteredItems.length) {
                            setSelectedIds(new Set());
                          } else {
                            setSelectedIds(new Set(filteredItems.map(i => i.id)));
                          }
                        }}
                        className="rounded border-stone-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="p-4 text-xs font-bold text-stone-400 uppercase">Item</th>
                    <th className="p-4 text-xs font-bold text-stone-400 uppercase">Precio Actual</th>
                    <th className="p-4 text-xs font-bold text-stone-400 uppercase">Precio Nuevo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50 dark:divide-stone-900">
                  {previewItems.map((item) => (
                    <tr key={item.id} className={`hover:bg-stone-50 dark:hover:bg-stone-900/30 transition-colors ${!selectedIds.has(item.id) ? 'opacity-50' : ''}`}>
                      <td className="p-4">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelection(item.id)}
                          className="rounded border-stone-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-stone-900 dark:text-white">{item.name}</div>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                          {targetType === 'products' ? (item as Product).category : `Unidad: ${(item as RawMaterial).unit}`}
                        </div>
                      </td>
                      <td className="p-4">
                        {targetType === 'products' ? (
                          <div className="space-y-1">
                            {(item as Product).variants.map((v) => (
                              <div key={v.id} className="text-xs text-stone-600 dark:text-stone-400">
                                {v.name}: <span className="font-medium">${v.price.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm font-medium text-stone-600 dark:text-stone-400">
                            ${(item as RawMaterial).costPerUnit.toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        {selectedIds.has(item.id) ? (
                          targetType === 'products' ? (
                            <div className="space-y-1">
                              {((item as unknown) as { updatedVariants: { id: string, name: string, newPrice: number }[] }).updatedVariants.map((v) => (
                                <div key={v.id} className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                  {v.name}: ${v.newPrice.toLocaleString()}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                              ${item.newPrice.toLocaleString()}
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-stone-400 italic">Sin cambios</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-stone-400 italic">
                        No se encontraron items con los filtros seleccionados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0" size={20} />
            <div className="text-xs text-amber-800 dark:text-amber-200">
              <strong>Atención:</strong> Esta acción modificará permanentemente los precios en tu inventario. Asegúrate de revisar la previsualización antes de confirmar.
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-800 rounded-2xl p-8 max-w-md w-full shadow-2xl border border-stone-200 dark:border-stone-700">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-bold text-stone-900 dark:text-white text-center mb-2">¿Confirmar Actualización?</h3>
            <p className="text-stone-600 dark:text-stone-400 text-center mb-8">
              Estás a punto de actualizar el precio de <strong>{selectedIds.size}</strong> {targetType === 'products' ? 'productos' : 'insumos'}. 
              Esta acción no se puede deshacer de forma automática.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-400 font-bold rounded-xl hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdate}
                disabled={isProcessing}
                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <RefreshCw className="animate-spin" size={20} />
                ) : (
                  'Confirmar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
