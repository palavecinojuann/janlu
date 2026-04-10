import React, { useState } from 'react';
import { Product, ProductionOrder, RawMaterial } from '../types';
import { Plus, CheckCircle, Clock, XCircle, Package, ArrowRight, AlertTriangle, Edit2, RotateCcw, Trash2 } from 'lucide-react';
import { formatUMB, toUMB, Unit, Dimension, UMB_FOR_DIMENSION, UNIT_DIMENSIONS } from '../utils/units';
import SearchableSelect from './ui/SearchableSelect';

interface ProductionViewProps {
  products: Product[];
  productionOrders: ProductionOrder[];
  rawMaterials: RawMaterial[];
  onAddOrder: (order: Omit<ProductionOrder, 'id' | 'createdAt' | 'status'>) => Promise<void>;
  onUpdateOrder: (order: ProductionOrder) => Promise<void>;
  onCompleteOrder: (id: string) => Promise<void>;
  onDeleteOrder: (id: string) => void;
}

export default function ProductionView({ 
  products, 
  productionOrders, 
  rawMaterials,
  onAddOrder,
  onUpdateOrder,
  onCompleteOrder, 
  onDeleteOrder 
}: ProductionViewProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ProductionOrder | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedVariant, setSelectedVariant] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const productsWithVariants = products.filter(p => p.variants.length > 0);

  const handleEdit = (order: ProductionOrder) => {
    setEditingOrder(order);
    setSelectedProduct(order.productId);
    setSelectedVariant(order.variantId);
    setQuantity(order.quantity);
    setDate(order.date);
    setIsAdding(true);
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingOrder(null);
    setSelectedProduct('');
    setSelectedVariant('');
    setQuantity(1);
    setDate(new Date().toISOString().split('T')[0]);
  };

  const getCommittedStock = (materialId: string) => {
    let committed = 0;
    const pendingOrders = productionOrders.filter(o => o.status === 'pending');
    
    for (const order of pendingOrders) {
      const product = products.find(p => p.id === order.productId);
      if (!product) continue;
      
      const variant = product.variants.find(v => v.id === order.variantId);
      if (!variant || !variant.recipe) continue;
      
      const recipeItem = variant.recipe.find(r => r.rawMaterialId === materialId);
      if (recipeItem) {
        const material = rawMaterials.find(m => m.id === materialId);
        if (material) {
          const effectiveUnit = recipeItem.unit || material.baseUnit || UMB_FOR_DIMENSION[material.dimension || (material.unit ? UNIT_DIMENSIONS[material.unit as Unit] : 'units')];
          const quantityUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
          committed += (quantityUMB * order.quantity);
        }
      }
    }
    return committed;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.id === selectedProduct);
    const variant = product?.variants.find(v => v.id === selectedVariant);
    
    if (product && variant) {
      try {
        if (editingOrder) {
          await onUpdateOrder({
            ...editingOrder,
            productId: selectedProduct,
            variantId: selectedVariant,
            productName: product.name,
            variantName: variant.name,
            quantity,
            date
          });
        } else {
          await onAddOrder({
            productId: selectedProduct,
            variantId: selectedVariant,
            productName: product.name,
            variantName: variant.name,
            quantity,
            date
          });
        }
        cancelEdit();
      } catch (error: any) {
        console.error("Error saving production order:", error);
        let errorMessage = "Hubo un error al guardar la orden de producción. Por favor, inténtelo de nuevo.";
        try {
          const parsed = JSON.parse(error.message);
          if (parsed.error) errorMessage = parsed.error;
        } catch (e) {
          if (error.message) errorMessage = error.message;
        }
        alert(errorMessage);
      }
    }
  };

  const handleCompleteOrder = async (id: string) => {
    try {
      await onCompleteOrder(id);
    } catch (error: any) {
      console.error("Error completing production order:", error);
      let errorMessage = "Hubo un error al completar la orden de producción. Por favor, inténtelo de nuevo.";
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        if (error.message) errorMessage = error.message;
      }
      alert(errorMessage);
    }
  };

  const getStatusBadge = (status: ProductionOrder['status']) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircle size={12} className="mr-1" /> Completado</span>;
      case 'cancelled':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400"><XCircle size={12} className="mr-1" /> Cancelado</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"><Clock size={12} className="mr-1" /> Pendiente</span>;
    }
  };

  const productOptions = productsWithVariants.map(p => ({ id: p.id, name: p.name }));

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      {completingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 max-w-md w-full shadow-xl border border-stone-100 dark:border-stone-800 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4 text-emerald-600">
              <CheckCircle size={24} />
              <h3 className="text-lg font-bold">¿Completar Producción?</h3>
            </div>
            <p className="text-stone-600 dark:text-stone-400 mb-6 text-sm leading-relaxed">
              Al completar la orden, se <strong>descontarán las materias primas</strong> del stock y se <strong>incrementará el stock del producto terminado</strong>.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCompletingId(null)}
                className="px-4 py-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (completingId) {
                    await handleCompleteOrder(completingId);
                  }
                  setCompletingId(null);
                }}
                className="px-6 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm"
              >
                Confirmar Completado
              </button>
            </div>
          </div>
        </div>
      )}

      {revertingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 max-w-md w-full shadow-xl border border-stone-100 dark:border-stone-800 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4 text-amber-600">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold">¿Revertir Orden?</h3>
            </div>
            <p className="text-stone-600 dark:text-stone-400 mb-6 text-sm leading-relaxed">
              Esta acción volverá la orden al estado <strong>Pendiente</strong>. 
              Se restará el stock del producto terminado y se devolverán las materias primas al inventario.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRevertingId(null)}
                className="px-4 py-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  const order = productionOrders.find(o => o.id === revertingId);
                  if (order) {
                    await onUpdateOrder({ ...order, status: 'pending' });
                  }
                  setRevertingId(null);
                }}
                className="px-6 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors text-sm font-medium shadow-sm"
              >
                Confirmar Reversión
              </button>
            </div>
          </div>
        </div>
      )}

      {cancellingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 max-w-md w-full shadow-xl border border-stone-100 dark:border-stone-800 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4 text-rose-600">
              <XCircle size={24} />
              <h3 className="text-lg font-bold">¿Cancelar Orden?</h3>
            </div>
            <p className="text-stone-600 dark:text-stone-400 mb-6 text-sm leading-relaxed">
              Esta acción marcará la orden como <strong>Cancelada</strong>. 
              Si la orden estaba completada, se revertirá el stock. Si estaba pendiente, simplemente se cancelará.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCancellingId(null)}
                className="px-4 py-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors text-sm font-medium"
              >
                Volver
              </button>
              <button
                onClick={async () => {
                  const order = productionOrders.find(o => o.id === cancellingId);
                  if (order) {
                    await onUpdateOrder({ ...order, status: 'cancelled' });
                  }
                  setCancellingId(null);
                }}
                className="px-6 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors text-sm font-medium shadow-sm"
              >
                Confirmar Cancelación
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 max-w-md w-full shadow-xl border border-stone-100 dark:border-stone-800 animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4 text-rose-600">
              <Trash2 size={24} />
              <h3 className="text-lg font-bold">¿Eliminar Orden?</h3>
            </div>
            <p className="text-stone-600 dark:text-stone-400 mb-6 text-sm leading-relaxed">
              ¿Estás seguro de eliminar esta orden permanentemente? 
              <br />
              <span className="text-rose-500 font-medium">Esta acción no se puede deshacer y NO revertirá el stock si la orden ya fue completada.</span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (deletingId) onDeleteOrder(deletingId);
                  setDeletingId(null);
                }}
                className="px-6 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors text-sm font-medium shadow-sm"
              >
                Eliminar Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-none flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Ordenes de Producción</h2>
          <p className="text-stone-500 dark:text-stone-400 text-sm">Gestiona la fabricación de productos terminados a partir de materias primas.</p>
        </div>
        <button
          onClick={() => {
            if (isAdding) {
              cancelEdit();
            } else {
              setIsAdding(true);
            }
          }}
          className={`flex items-center px-4 py-2 text-white rounded-xl transition-colors text-sm font-medium shadow-sm ${
            isAdding 
              ? 'bg-stone-500 hover:bg-stone-600 dark:bg-stone-700 dark:hover:bg-stone-600' 
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {isAdding ? (
            <>
              <XCircle size={18} className="mr-2" />
              Cancelar
            </>
          ) : (
            <>
              <Plus size={18} className="mr-2" />
              Nueva Orden
            </>
          )}
        </button>
      </div>

      {isAdding && (
        <div className="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 animate-in fade-in slide-in-from-top-4">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Producto a Fabricar</label>
                <SearchableSelect
                  options={productOptions}
                  value={selectedProduct}
                  onChange={(id) => {
                    setSelectedProduct(id);
                    setSelectedVariant('');
                  }}
                  placeholder="Buscar producto por nombre..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Variante / Presentación</label>
                <select
                  required
                  disabled={!selectedProduct}
                  value={selectedVariant}
                  onChange={(e) => setSelectedVariant(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                >
                  <option value="">Seleccionar variante...</option>
                  {selectedProduct && products.find(p => p.id === selectedProduct)?.variants.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Cantidad a Producir</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Fecha Programada</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            {selectedProduct && selectedVariant && products.find(p => p.id === selectedProduct)?.variants.find(v => v.id === selectedVariant)?.recipe && products.find(p => p.id === selectedProduct)?.variants.find(v => v.id === selectedVariant)?.recipe!.length > 0 && (
              <div className="bg-stone-50 dark:bg-stone-950/50 p-4 rounded-xl border border-stone-100 dark:border-stone-800">
                <h4 className="text-sm font-bold text-stone-700 dark:text-stone-300 mb-2 uppercase tracking-wider">Consumo Estimado de Materias Primas</h4>
                <div className="space-y-2">
                  {products.find(p => p.id === selectedProduct)?.variants.find(v => v.id === selectedVariant)?.recipe?.map(item => {
                    const rm = rawMaterials.find(r => r.id === item.rawMaterialId);
                    const committedStock = rm ? getCommittedStock(rm.id) : 0;
                    const availableStock = rm ? Math.max(0, rm.stock - committedStock) : 0;
                    const effectiveUnit = item.unit || rm?.baseUnit || UMB_FOR_DIMENSION[rm?.dimension || (rm?.unit ? UNIT_DIMENSIONS[rm.unit as Unit] : 'units')];
                    const quantityUMB = toUMB(item.quantity, effectiveUnit as Unit);
                    const totalRequiredUMB = quantityUMB * quantity;
                    const hasEnoughStock = availableStock >= totalRequiredUMB;
                    
                    return (
                      <div key={item.rawMaterialId} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-stone-600 dark:text-stone-400">{rm?.name || 'Materia Prima'}</span>
                          {!hasEnoughStock && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
                              Stock Insuficiente
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end">
                          <span className={`font-mono font-medium ${hasEnoughStock ? 'text-stone-900 dark:text-stone-100' : 'text-rose-600 dark:text-rose-400'}`}>
                            {formatUMB(totalRequiredUMB, rm?.dimension as Dimension, rm?.unit as Unit)}
                          </span>
                          <span className="text-[10px] text-stone-500 dark:text-stone-400">
                            Disponible: {formatUMB(availableStock, rm?.dimension as Dimension, rm?.unit as Unit)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
              >
                {editingOrder ? 'Guardar Cambios' : 'Crear Orden'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!isAdding && (
        <>
          <div className="flex-1 bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 flex flex-col min-h-0">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse relative">
              <thead className="sticky top-0 z-10 bg-stone-50 dark:bg-stone-950/50 shadow-sm">
                <tr className="border-b border-stone-100 dark:border-stone-800 text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">Fecha</th>
                  <th className="p-4 font-medium">Producto</th>
                  <th className="p-4 font-medium">Cantidad</th>
                  <th className="p-4 font-medium">Estado</th>
                  <th className="p-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {productionOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-stone-500 dark:text-stone-400">
                      No hay ordenes de producción registradas.
                    </td>
                  </tr>
                ) : (
                  [...productionOrders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(order => (
                    <tr key={order.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/50 group">
                      <td className="p-4 text-sm text-stone-900 dark:text-stone-100">{order.date}</td>
                      <td className="p-4">
                        <div className="text-sm font-medium text-stone-900 dark:text-stone-100">{order.productName}</div>
                        <div className="text-xs text-stone-500 dark:text-stone-400">{order.variantName}</div>
                      </td>
                      <td className="p-4 text-sm font-mono font-medium text-stone-900 dark:text-stone-100">{order.quantity} unid.</td>
                      <td className="p-4">{getStatusBadge(order.status)}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(order)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          {order.status === 'completed' && (
                            <button
                              onClick={() => setRevertingId(order.id)}
                              className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                              title="Volver a Pendiente"
                            >
                              <RotateCcw size={18} />
                            </button>
                          )}
                          {order.status === 'pending' && (
                            <button
                              onClick={() => setCompletingId(order.id)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                              title="Completar Producción"
                            >
                              <CheckCircle size={18} />
                            </button>
                          )}
                          {order.status !== 'cancelled' && (
                            <button
                              onClick={() => setCancellingId(order.id)}
                              className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                              title="Cancelar Orden"
                            >
                              <XCircle size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => setDeletingId(order.id)}
                            className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                            title="Eliminar permanentemente"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex-none grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-800 rounded-xl text-indigo-600 dark:text-indigo-300">
                <Package size={20} />
              </div>
              <h3 className="font-bold text-indigo-900 dark:text-indigo-100">Stock Centralizado</h3>
            </div>
            <p className="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed">
              Recuerda que la producción descuenta automáticamente de la UMB (Unidad de Medida Base) de tus materias primas.
            </p>
          </div>
          
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-xl text-emerald-600 dark:text-emerald-300">
                <ArrowRight size={20} />
              </div>
              <h3 className="font-bold text-emerald-900 dark:text-emerald-100">Flujo de Salida</h3>
            </div>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed">
              Al completar una orden, el stock del producto terminado aumenta y las materias primas se consumen según la receta.
            </p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-2xl border border-amber-100 dark:border-amber-800/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-xl text-amber-600 dark:text-amber-300">
                <Clock size={20} />
              </div>
              <h3 className="font-bold text-amber-900 dark:text-amber-100">Planificación</h3>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
              Mantén tus recetas actualizadas para asegurar que el cálculo de costos y stock sea siempre preciso.
            </p>
          </div>
        </div>
      </>
      )}
    </div>
  );
}
