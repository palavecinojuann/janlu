import React, { useState, useMemo } from 'react';
import { Product, Variant, Sale, RawMaterial } from '../types';
import { Edit2, Trash2, Search, Filter, Image as ImageIcon, PlusCircle, AlertTriangle, TrendingDown, Share2, Check, ShoppingBag, ArrowUpCircle, Hammer, Printer } from 'lucide-react';
import StockAdjustmentModal from './StockAdjustmentModal';
import ProduceModal from './ProduceModal';
import { getVariantStock } from '../utils/stockUtils';

interface ProductListProps {
  products: Product[];
  rawMaterials: RawMaterial[];
  sales: Sale[];
  onAdd: () => void;
  onAddMultiple: (products: Product[]) => void;
  onEdit: (id: string) => void;
  onUpdate: (product: Product) => void;
  onDelete: (id: string) => void;
  onAdjustStock: (productId: string, variantId: string, quantity: number) => void;
  onProduce: (productId: string, variantId: string, quantity: number) => Promise<void>;
  onNavigateToCatalog: () => void;
  onPrintVariant: (product: Product, variant: Variant) => void;
}

export default function ProductList({ 
  products, 
  rawMaterials,
  sales, 
  onAdd, 
  onAddMultiple, 
  onEdit, 
  onUpdate, 
  onDelete, 
  onAdjustStock,
  onProduce,
  onNavigateToCatalog,
  onPrintVariant
}: ProductListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [adjustingStock, setAdjustingStock] = useState<{ product: Product, variant: Variant } | null>(null);
  const [producingProduct, setProducingProduct] = useState<{ product: Product, variant: Variant } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShareCatalog = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('view');
    url.hash = 'catalog';
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    const lowerCategory = categoryFilter;

    return products.filter(p => {
      const name = (p.name || '').toLowerCase();
      const description = (p.description || '').toLowerCase();
      const matchesSearch = name.includes(lowerSearch) || 
                            description.includes(lowerSearch);
      const matchesCategory = lowerCategory === 'All' || p.category === lowerCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, categoryFilter]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', { 
      style: 'currency', 
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Calculate average daily sales for the last 30 days
  const averageDailySales = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSales = sales.filter(s => new Date(s.date) >= thirtyDaysAgo);
    
    const salesByVariant: Record<string, number> = {};
    recentSales.forEach(sale => {
      sale.items.forEach(item => {
        salesByVariant[item.variantId] = (salesByVariant[item.variantId] || 0) + item.quantity;
      });
    });

    // Convert to daily average
    Object.keys(salesByVariant).forEach(key => {
      salesByVariant[key] = salesByVariant[key] / 30;
    });

    return salesByVariant;
  }, [sales]);

  const getStockAlert = (variant: Variant) => {
    const dailyAvg = averageDailySales[variant.id] || 0;
    if (dailyAvg === 0) return null;

    const currentStock = getVariantStock(variant, rawMaterials);
    const daysOfStock = currentStock / dailyAvg;
    
    if (daysOfStock <= 7) {
      return { level: 'critical', message: `Stock para ${Math.floor(daysOfStock)} días` };
    } else if (daysOfStock <= 14) {
      return { level: 'warning', message: `Stock para ${Math.floor(daysOfStock)} días` };
    }
    return null;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      <div className="flex-none flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Inventario</h2>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 dark:text-stone-500" size={18} />
            <input
              type="text"
              placeholder="Buscar productos..."
              className="pl-10 pr-4 py-2 w-full sm:w-64 border border-stone-200 dark:border-stone-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 dark:text-stone-500" size={18} />
            <select
              className="pl-10 pr-8 py-2 w-full sm:w-auto border border-stone-200 dark:border-stone-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm appearance-none bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <button
            onClick={onNavigateToCatalog}
            className="flex items-center justify-center px-4 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors text-sm font-medium border border-rose-100 dark:border-rose-800"
          >
            <ShoppingBag size={18} className="mr-2" />
            Ver Catálogo Online
          </button>
          <button
            onClick={handleShareCatalog}
            className="flex items-center justify-center px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors text-sm font-medium"
          >
            {copied ? <Check size={18} className="mr-2 text-emerald-500" /> : <Share2 size={18} className="mr-2" />}
            {copied ? '¡Copiado!' : 'Compartir Catálogo'}
          </button>
          <button
            onClick={onAdd}
            className="flex items-center justify-center px-4 py-2 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl hover:bg-stone-800 dark:hover:bg-white transition-colors text-sm font-medium"
          >
            <PlusCircle size={18} className="mr-2" />
            Nuevo Producto
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 flex flex-col min-h-0">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10 bg-stone-50 dark:bg-stone-950 shadow-sm">
              <tr className="border-b border-stone-100 dark:border-stone-800 text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">
                <th className="p-4 font-medium">Producto</th>
                <th className="p-4 font-medium">Categoría</th>
                <th className="p-4 font-medium">Variantes</th>
                <th className="p-4 font-medium">Stock Total</th>
                <th className="p-4 font-medium">Catálogo</th>
                <th className="p-4 font-medium">Rango de Precios</th>
                <th className="p-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-stone-500 dark:text-stone-400">
                    No se encontraron productos.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const totalStock = product.variants.reduce((sum, v) => sum + getVariantStock(v, rawMaterials), 0);
                  const prices = product.variants.map(v => v.price);
                  const minPrice = Math.min(...prices);
                  const maxPrice = Math.max(...prices);
                  const priceRange = prices.length > 0 
                    ? minPrice === maxPrice 
                      ? formatCurrency(minPrice) 
                      : `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`
                    : '-';

                  return (
                    <tr key={product.id} className="hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center overflow-hidden border border-stone-200 dark:border-stone-700 shrink-0">
                            {product.photoUrl ? (
                              <img src={product.photoUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <ImageIcon className="text-stone-400 dark:text-stone-500" size={20} />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-stone-900 dark:text-stone-100">{product.name}</p>
                              {rawMaterials.some(rm => rm.linkedProductId === product.id) && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400" title="Generado desde un Insumo">
                                  Insumo
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-stone-500 dark:text-stone-400 truncate max-w-[200px]">{product.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200">
                          {product.category || 'N/A'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-2">
                          {product.variants.map(v => {
                            const alert = getStockAlert(v);
                            return (
                              <div key={v.id} className="flex items-center gap-2">
                                <button
                                  onClick={() => v.isFinishedGood !== false && setAdjustingStock({ product, variant: v })}
                                  disabled={v.isFinishedGood === false}
                                  className={`text-[10px] px-2 py-1.5 rounded-md border transition-all flex items-center group/btn whitespace-nowrap font-bold uppercase tracking-wider shadow-sm ${
                                    v.isFinishedGood === false 
                                      ? 'bg-stone-100 text-stone-500 border-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:border-stone-700 cursor-not-allowed'
                                      : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:scale-105 active:scale-95'
                                  }`}
                                  title={v.isFinishedGood === false ? "Stock dinámico basado en materia prima" : "Reponer Stock"}
                                >
                                  {v.name}: {getVariantStock(v, rawMaterials)}
                                  {v.isFinishedGood !== false && <ArrowUpCircle size={14} className="ml-1.5 text-emerald-500 group-hover/btn:scale-110 transition-transform" />}
                                </button>
                                {v.recipe && v.recipe.length > 0 && (
                                  <button
                                    onClick={() => setProducingProduct({ product, variant: v })}
                                    className="text-[10px] px-2 py-1.5 rounded-md border transition-all flex items-center group/btn whitespace-nowrap font-bold uppercase tracking-wider shadow-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:scale-105 active:scale-95"
                                    title="Fabricar Producto"
                                  >
                                    <Hammer size={14} className="mr-1.5 text-indigo-500 group-hover/btn:scale-110 transition-transform" />
                                    Fabricar
                                  </button>
                                )}
                                {alert && (
                                  <span 
                                    className={`flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                      alert.level === 'critical' 
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' 
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    }`}
                                    title={`Basado en ventas de los últimos 30 días (${(averageDailySales[v.id] || 0).toFixed(2)}/día)`}
                                  >
                                    {alert.level === 'critical' ? <AlertTriangle size={10} className="mr-1" /> : <TrendingDown size={10} className="mr-1" />}
                                    {alert.message}
                                  </span>
                                )}
                                <button
                                  onClick={() => onPrintVariant(product, v)}
                                  className="p-1 text-stone-400 hover:text-stone-900 transition-colors"
                                  title="Imprimir Etiqueta QR"
                                >
                                  <Printer size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`font-medium ${totalStock <= 5 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-900 dark:text-stone-100'}`}>
                          {totalStock}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => {
                            const current = product.showInCatalog;
                            const nextValue = !(current === true || current === undefined);
                            onUpdate({ ...product, showInCatalog: nextValue });
                          }}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                            (product.showInCatalog === true || product.showInCatalog === undefined)
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                          }`}
                        >
                          {(product.showInCatalog === true || product.showInCatalog === undefined) ? 'Visible' : 'Oculto'}
                        </button>
                      </td>
                      <td className="p-4 text-stone-600 dark:text-stone-400 font-medium">
                        {priceRange}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setAdjustingStock({ product, variant: product.variants[0] }); }}
                            className="p-2 text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                            title="Reponer Stock"
                          >
                            <ArrowUpCircle size={16} />
                          </button>
                          {rawMaterials.some(rm => rm.linkedProductId === product.id) ? (
                            <button 
                              disabled
                              className="p-2 text-stone-300 dark:text-stone-600 cursor-not-allowed rounded-lg"
                              title="Editar desde Insumos"
                            >
                              <Edit2 size={16} />
                            </button>
                          ) : (
                            <button 
                              onClick={(e) => { e.stopPropagation(); onEdit(product.id); }}
                              className="p-2 text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('Delete button clicked for product:', product.id);
                              onDelete(product.id);
                            }}
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

      {adjustingStock && (
        <StockAdjustmentModal
          product={adjustingStock.product}
          variant={adjustingStock.variant}
          onClose={() => setAdjustingStock(null)}
          onAdjust={(qty) => {
            onAdjustStock(adjustingStock.product.id, adjustingStock.variant.id, qty);
            setAdjustingStock(null);
          }}
        />
      )}

      {producingProduct && (
        <ProduceModal
          product={producingProduct.product}
          variant={producingProduct.variant}
          onClose={() => setProducingProduct(null)}
          onProduce={async (quantity) => {
            await onProduce(producingProduct.product.id, producingProduct.variant.id, quantity);
            setProducingProduct(null);
          }}
        />
      )}
    </div>
  );
}
