import React, { useState, useMemo } from 'react';
import { RawMaterial, Product, ProductionOrder } from '../types';
import { Plus, Edit2, Trash2, AlertTriangle, Search, ArrowUpCircle, X, Upload } from 'lucide-react';
import RawMaterialForm from './RawMaterialForm';
import ExcelImportModal from './ExcelImportModal';
import { formatUMB, toUMB, Unit, Dimension, UMB_FOR_DIMENSION, UNIT_DIMENSIONS } from '../utils/units';

interface RawMaterialListProps {
  rawMaterials: RawMaterial[];
  products: Product[];
  productionOrders: ProductionOrder[];
  onAdd: (material: RawMaterial) => void;
  onAddMultiple: (materials: RawMaterial[]) => Promise<void>;
  onUpdate: (material: RawMaterial) => void;
  onDelete: (id: string) => void;
  onRestock: (id: string, quantity: number, newCost?: number) => void;
}

export default function RawMaterialList({ rawMaterials, products, productionOrders, onAdd, onAddMultiple, onUpdate, onDelete, onRestock }: RawMaterialListProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [restockId, setRestockId] = useState<string | null>(null);
  const [restockData, setRestockData] = useState({ quantity: 0, cost: 0 });
  const [confirmAction, setConfirmAction] = useState<{ type: 'material', id: string } | null>(null);

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (restockId) {
      const material = rawMaterials.find(m => m.id === restockId);
      if (material) {
        // Convert input quantity (in material.unit) to UMB
        const quantityUMB = toUMB(restockData.quantity, material.unit as Unit);
        
        // Convert input cost (cost per material.unit) to cost per UMB
        let costPerUMB = undefined;
        if (restockData.cost) {
          costPerUMB = Math.round((restockData.cost / toUMB(1, material.unit as Unit)) * 10000) / 10000;
        }
        
        onRestock(restockId, quantityUMB, costPerUMB);
      }
      setRestockId(null);
      setRestockData({ quantity: 0, cost: 0 });
    }
  };

  const handleSave = (material: RawMaterial) => {
    if (editingMaterial) {
      onUpdate(material);
    } else {
      onAdd(material);
    }
    setIsFormOpen(false);
    setEditingMaterial(null);
  };

  const handleEdit = (material: RawMaterial) => {
    setEditingMaterial(material);
    setIsFormOpen(true);
  };

  const filteredMaterials = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return rawMaterials.filter(m => 
      m.name.toLowerCase().includes(lowerSearch)
    );
  }, [rawMaterials, searchTerm]);

  const committedStockMap = useMemo(() => {
    const map: Record<string, number> = {};
    const pendingOrders = productionOrders.filter(o => o.status === 'pending');
    
    for (const order of pendingOrders) {
      const product = products.find(p => p.id === order.productId);
      if (!product) continue;
      
      const variant = product.variants.find(v => v.id === order.variantId);
      if (!variant || !variant.recipe) continue;
      
      for (const recipeItem of variant.recipe) {
        const materialId = recipeItem.rawMaterialId;
        const material = rawMaterials.find(m => m.id === materialId);
        if (material) {
          const effectiveUnit = recipeItem.unit || material.baseUnit || UMB_FOR_DIMENSION[material.dimension || (material.unit ? UNIT_DIMENSIONS[material.unit as Unit] : 'units')];
          const quantityUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
          map[materialId] = (map[materialId] || 0) + (quantityUMB * order.quantity);
        }
      }
    }
    return map;
  }, [productionOrders, products, rawMaterials]);

  const getCommittedStock = (materialId: string) => {
    return committedStockMap[materialId] || 0;
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('es-AR', { 
    style: 'currency', 
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);

  if (isFormOpen) {
    return (
      <RawMaterialForm 
        initialData={editingMaterial || undefined}
        products={products}
        onSave={handleSave}
        onCancel={() => {
          setIsFormOpen(false);
          setEditingMaterial(null);
        }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      <div className="flex-none flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Materias Primas</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium cursor-pointer"
          >
            <Upload size={18} className="mr-2" />
            Importar Excel
          </button>
          <button
            onClick={() => {
              if (isFormOpen) {
                setIsFormOpen(false);
                setEditingMaterial(null);
              } else {
                setIsFormOpen(true);
              }
            }}
            className={`flex items-center px-4 py-2 text-white rounded-xl transition-colors text-sm font-medium ${
              isFormOpen
                ? 'bg-stone-500 hover:bg-stone-600 dark:bg-stone-700 dark:hover:bg-stone-600'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isFormOpen ? (
              <>
                <X size={18} className="mr-2" />
                Cancelar
              </>
            ) : (
              <>
                <Plus size={18} className="mr-2" />
                Nuevo Insumo
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex-none bg-white dark:bg-stone-900 p-4 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" size={20} />
          <input
            type="text"
            placeholder="Buscar materia prima..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-stone-50 dark:bg-stone-950 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500"
          />
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 flex flex-col min-h-0">
        {restockId && (
          <div className="flex-none p-6 border-b border-stone-100 dark:border-stone-800 bg-indigo-50/30 dark:bg-indigo-900/10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-indigo-900 dark:text-indigo-100">Ingresar Stock: {rawMaterials.find(m => m.id === restockId)?.name}</h3>
              <button onClick={() => setRestockId(null)} className="text-stone-400 hover:text-stone-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleRestockSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Cantidad a Sumar</label>
                <input 
                  type="number" 
                  step="any"
                  required 
                  value={restockData.quantity} 
                  onChange={e => setRestockData({...restockData, quantity: parseFloat(e.target.value)})}
                  className="w-full px-3 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase mb-1">Nuevo Costo Unitario (Opcional)</label>
                <input 
                  type="number" 
                  step="any"
                  value={restockData.cost} 
                  onChange={e => setRestockData({...restockData, cost: parseFloat(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Dejar vacío para mantener"
                />
              </div>
              <div className="flex items-end">
                <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-2 rounded-xl hover:bg-indigo-700 transition-colors">Confirmar Ingreso</button>
              </div>
            </form>
          </div>
        )}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10 bg-stone-50 dark:bg-stone-950 shadow-sm">
              <tr className="border-b border-stone-100 dark:border-stone-800 text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">
                <th className="p-4 font-medium">Nombre</th>
                <th className="p-4 font-medium">Stock Total</th>
                <th className="p-4 font-medium">Comprometido</th>
                <th className="p-4 font-medium">Disponible</th>
                <th className="p-4 font-medium">Unidad</th>
                <th className="p-4 font-medium">Costo Unitario</th>
                <th className="p-4 font-medium">Costo Total</th>
                <th className="p-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-stone-500 dark:text-stone-400">
                    No se encontraron materias primas.
                  </td>
                </tr>
              ) : (
                filteredMaterials.map(material => {
                  const committedStock = getCommittedStock(material.id);
                  const availableStock = Math.max(0, material.stock - committedStock);
                  const isLowStock = availableStock <= material.minStock;
                  return (
                    <tr key={material.id} className="hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center">
                          {material.photoUrl ? (
                            <img src={material.photoUrl} alt={material.name} className="w-10 h-10 rounded-lg object-cover mr-3 border border-stone-200 dark:border-stone-700" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center mr-3 border border-stone-200 dark:border-stone-700">
                              <span className="text-stone-400 text-xs font-medium">{material.name.substring(0, 2).toUpperCase()}</span>
                            </div>
                          )}
                          <div>
                            <div className="flex items-center">
                              <span className="font-medium text-stone-900 dark:text-stone-100">{material.name}</span>
                              {material.sellAsProduct && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400" title="Se vende como producto">
                                  Producto
                                </span>
                              )}
                              {isLowStock && (
                                <AlertTriangle size={14} className="ml-2 text-rose-500 dark:text-rose-400" title="Stock disponible bajo" />
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-300">
                          {formatUMB(material.stock, material.dimension as Dimension, material.unit as Unit)}
                        </span>
                      </td>
                      <td className="p-4">
                        {committedStock > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400">
                            {formatUMB(committedStock, material.dimension as Dimension, material.unit as Unit)}
                          </span>
                        ) : (
                          <span className="text-stone-400 dark:text-stone-600 text-sm">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          isLowStock ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400'
                        }`}>
                          {formatUMB(availableStock, material.dimension as Dimension, material.unit as Unit)}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-stone-600 dark:text-stone-400">{material.unit}</td>
                      <td className="p-4 text-sm text-stone-600 dark:text-stone-400">{formatCurrency(material.costPerUnit * toUMB(1, material.unit as Unit))} / {material.unit}</td>
                      <td className="p-4 text-sm font-medium text-stone-900 dark:text-stone-100">{formatCurrency(material.stock * material.costPerUnit)}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => {
                              setRestockId(material.id);
                              setRestockData({ quantity: 0, cost: material.costPerUnit * toUMB(1, material.unit as Unit) });
                            }}
                            className="p-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg transition-all hover:scale-110 active:scale-95 shadow-sm"
                            title="Ingresar Stock"
                          >
                            <ArrowUpCircle size={18} />
                          </button>
                          <button
                            onClick={() => handleEdit(material)}
                            className="p-2 text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setConfirmAction({ type: 'material', id: material.id })}
                            className="p-2 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {showImportModal && (
        <ExcelImportModal
          onClose={() => setShowImportModal(false)}
          onImport={async (newMaterials) => {
            console.log(`RawMaterialList: Received ${newMaterials.length} materials for import`);
            try {
              await onAddMultiple(newMaterials);
              console.log('RawMaterialList: onAddMultiple completed');
              alert(`Se importaron ${newMaterials.length} insumos exitosamente.`);
            } catch (error) {
              console.error('RawMaterialList: Error adding multiple materials:', error);
              throw error; // Let the modal handle it
            }
          }}
        />
      )}

      {/* Modal de Confirmación */}
      {confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-stone-200 dark:border-stone-800">
            <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-4">
              Eliminar Materia Prima
            </h3>
            <p className="text-stone-600 dark:text-stone-400 mb-6">
              ¿Estás seguro de que deseas eliminar esta materia prima? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (onDelete) {
                    onDelete(confirmAction.id);
                  }
                  setConfirmAction(null);
                }}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors font-medium"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
