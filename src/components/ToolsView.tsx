import React, { useState } from 'react';
import { Calculator, RefreshCw, ChevronRight, Info, Database, TrendingUp, Beaker } from 'lucide-react';
import CostCalculator from './CostCalculator';
import BulkPriceUpdater from './BulkPriceUpdater';
import LoadTestData from './LoadTestData';
import DynamicPricingTool from './DynamicPricingTool';
import VolumeCalculator from './VolumeCalculator';
import { Product, RawMaterial, Simulation, Activity } from '../types';
import { updateMirrorProductVariants, getVariantStock } from '../utils/stockUtils';

interface ToolsViewProps {
  products: Product[];
  rawMaterials: RawMaterial[];
  simulations: Simulation[];
  onSaveSimulation: (simulation: Simulation) => Promise<void>;
  onDeleteSimulation: (id: string) => Promise<void>;
  onUpdateProducts: (products: Product[]) => Promise<void>;
  onUpdateRawMaterials: (materials: RawMaterial[]) => Promise<void>;
  onAddActivity: (activity: Activity) => Promise<void>;
  onAddMultipleProducts: (products: Product[]) => Promise<void>;
  onAddMultipleRawMaterials: (materials: RawMaterial[]) => Promise<void>;
}

export default function ToolsView({ 
  products, 
  rawMaterials, 
  simulations,
  onSaveSimulation,
  onDeleteSimulation,
  onUpdateProducts, 
  onUpdateRawMaterials,
  onAddActivity,
  onAddMultipleProducts,
  onAddMultipleRawMaterials
}: ToolsViewProps) {
  const [activeTool, setActiveTool] = useState<'menu' | 'calculator' | 'bulk-update' | 'load-data' | 'dynamic-pricing' | 'volume'>('menu');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSyncMirrorStocks = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const mirrorMaterials = rawMaterials.filter(rm => {
        if (rm.sellAsProduct) return true;
        if (rm.linkedProductId) return true;
        // Search if there is a public product of type 'insumo' with the exact same name
        const match = products.find(p => p.catalogType === 'insumo' && p.name.trim().toLowerCase() === rm.name.trim().toLowerCase());
        return !!match;
      });

      const productsToUpdateMap = new Map<string, Product>();
      const materialsToUpdate: RawMaterial[] = [];
      let updatedCount = 0;

      // Track assigned product IDs to avoid assigning the same product to multiple materials
      const assignedProductIds = new Set<string>();
      
      // Seed with already properly linked product IDs
      rawMaterials.forEach(rm => {
        if (rm.linkedProductId && rm.sellAsProduct) {
          assignedProductIds.add(rm.linkedProductId);
        }
      });

      mirrorMaterials.forEach(rm => {
        let mirrorProduct = productsToUpdateMap.get(rm.linkedProductId || '') || 
                            products.find(p => p.id === rm.linkedProductId);
        let needsRmUpdate = false;
        let updatedRm = { ...rm };

        if (!mirrorProduct) {
          // Match by name, but ensure the product has not been assigned to another raw material yet
          mirrorProduct = productsToUpdateMap.get(rm.linkedProductId || '') || 
                          products.find(p => 
                            p.name.trim().toLowerCase() === rm.name.trim().toLowerCase() &&
                            !assignedProductIds.has(p.id)
                          );
          if (mirrorProduct) {
            updatedRm.linkedProductId = mirrorProduct.id;
            updatedRm.sellAsProduct = true;
            needsRmUpdate = true;
            assignedProductIds.add(mirrorProduct.id);
          }
        } else if (!rm.sellAsProduct) {
          updatedRm.sellAsProduct = true;
          needsRmUpdate = true;
        }

        if (mirrorProduct) {
          if (needsRmUpdate) {
            materialsToUpdate.push(updatedRm);
          } else {
            // Only update the product directly if the raw material doesn't need to be updated.
            // If the raw material does need update, onUpdateRawMaterials will handle the product update automatically.
            const updatedVariants = updateMirrorProductVariants(
              mirrorProduct.variants,
              rm.id,
              rm.stock || 0,
              rm.compromisedStock || 0
            );
            productsToUpdateMap.set(mirrorProduct.id, {
              ...mirrorProduct,
              variants: updatedVariants
            });
          }
          updatedCount++;
        }
      });

      // Recalculate dynamic stocks for ALL products (including mirror ones and recipe-dependent ones)
      const allProductsScanMap = new Map<string, Product>();
      products.forEach(p => allProductsScanMap.set(p.id, p));
      productsToUpdateMap.forEach(p => allProductsScanMap.set(p.id, p));

      allProductsScanMap.forEach((product, productId) => {
        let productChanged = false;
        const updatedVariants = product.variants.map(variant => {
          if (variant.isFinishedGood === false && variant.recipe && variant.recipe.length > 0) {
            const newStock = getVariantStock(variant, rawMaterials);
            if (variant.stock !== newStock) {
              productChanged = true;
              return { ...variant, stock: newStock };
            }
          }
          return variant;
        });

        if (productChanged) {
          productsToUpdateMap.set(productId, { ...product, variants: updatedVariants });
        }
      });

      const uniqueProductsToUpdate = Array.from(productsToUpdateMap.values());

      const seenMaterialIds = new Set<string>();
      const uniqueMaterialsToUpdate = materialsToUpdate.filter(m => {
        if (seenMaterialIds.has(m.id)) return false;
        seenMaterialIds.add(m.id);
        return true;
      });

      if (uniqueProductsToUpdate.length > 0 || uniqueMaterialsToUpdate.length > 0) {
        if (uniqueProductsToUpdate.length > 0) {
          await onUpdateProducts(uniqueProductsToUpdate);
        }
        if (uniqueMaterialsToUpdate.length > 0) {
          await onUpdateRawMaterials(uniqueMaterialsToUpdate);
        }
        setSyncStatus({ type: 'success', message: `Sincronización exitosa: ${updatedCount} insumos vinculados y stock dinámico recalculado en el catálogo público.` });
      } else {
        setSyncStatus({ type: 'success', message: 'El catálogo público ya está perfectamente sincronizado con el stock actual.' });
      }
    } catch (error) {
      console.error('Error syncing stocks:', error);
      // Try to parse the error message if it's JSON from handleFirestoreError
      let errMsg = 'Ocurrió un error al intentar sincronizar los stocks.';
      if (error instanceof Error) {
        try {
          const parsed = JSON.parse(error.message);
          if (parsed && parsed.error) {
            errMsg = `Error en la base de datos: ${parsed.error}`;
          }
        } catch (_) {
          errMsg = `Error: ${error.message}`;
        }
      }
      setSyncStatus({ type: 'error', message: errMsg });
    } finally {
      setIsSyncing(false);
    }
  };

  const renderTool = () => {
    switch (activeTool) {
      case 'calculator':
        return (
          <CostCalculator 
            rawMaterials={rawMaterials} 
            simulations={simulations}
            onSaveSimulation={onSaveSimulation}
            onDeleteSimulation={onDeleteSimulation}
          />
        );
      case 'bulk-update':
        return (
          <BulkPriceUpdater 
            products={products} 
            rawMaterials={rawMaterials}
            onUpdateProducts={onUpdateProducts}
            onUpdateRawMaterials={onUpdateRawMaterials}
            onAddActivity={onAddActivity}
          />
        );
      case 'load-data':
        return (
          <LoadTestData 
            onAddMultipleProducts={onAddMultipleProducts}
            onAddMultipleRawMaterials={onAddMultipleRawMaterials}
          />
        );
      case 'dynamic-pricing':
        return (
          <DynamicPricingTool 
            products={products}
            rawMaterials={rawMaterials}
            onUpdateProducts={onUpdateProducts}
            onUpdateRawMaterials={onUpdateRawMaterials}
            onAddActivity={onAddActivity}
          />
        );
      case 'volume':
        return <VolumeCalculator />;
      default:
        return null;
    }
  };

  if (activeTool !== 'menu') {
    return (
      <div className="flex-1 flex flex-col min-h-0 space-y-6">
        <div className="flex-none">
          <button 
            onClick={() => setActiveTool('menu')}
            className="flex items-center text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 transition-colors group"
          >
            <ChevronRight className="rotate-180 mr-1 group-hover:-translate-x-1 transition-transform" size={20} />
            Volver a Herramientas
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto pb-6">
          {renderTool()}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-8">
      <div className="flex-none">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-white font-cinzel tracking-tight">Herramientas</h2>
        <p className="text-stone-500 dark:text-stone-400">Utilidades avanzadas para la gestión de tu negocio</p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 space-y-8 pb-6 pr-2 -mr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cost Calculator Card */}
          <button
            onClick={() => setActiveTool('calculator')}
            className="group flex flex-col p-6 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm hover:shadow-md hover:border-emerald-500/50 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
              <Calculator size={24} />
            </div>
            <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">Calculadora de Costos</h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-4 flex-1">
              Simula el costo de nuevos productos o kits sin afectar tu inventario real. Ideal para presupuestar lanzamientos.
            </p>
            <div className="flex items-center text-emerald-600 dark:text-emerald-400 font-medium text-sm">
              Abrir herramienta <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Dynamic Pricing Card */}
          <button
            onClick={() => setActiveTool('dynamic-pricing')}
            className="group flex flex-col p-6 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm hover:shadow-md hover:border-rose-500/50 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4 group-hover:scale-110 transition-transform">
              <TrendingUp size={24} />
            </div>
            <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">Fijación de Precios Dinámica</h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-4 flex-1">
              Ajusta automáticamente los precios de tus productos cuando cambia el costo de un insumo, manteniendo tu margen de ganancia.
            </p>
            <div className="flex items-center text-rose-600 dark:text-rose-400 font-medium text-sm">
              Abrir herramienta <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Volume Calculator Card */}
          <button
            onClick={() => setActiveTool('volume')}
            className="group flex flex-col p-6 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm hover:shadow-md hover:border-teal-500/50 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-4 group-hover:scale-110 transition-transform">
              <Beaker size={24} />
            </div>
            <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">Calculadora de Volúmenes</h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-4 flex-1">
              Calcula la cantidad exacta de cera necesaria para un nuevo envase o molde ingresando sus dimensiones.
            </p>
            <div className="flex items-center text-teal-600 dark:text-teal-400 font-medium text-sm">
              Abrir herramienta <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Bulk Price Updater Card */}
          <button
            onClick={() => setActiveTool('bulk-update')}
            className="group flex flex-col p-6 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm hover:shadow-md hover:border-indigo-500/50 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
              <RefreshCw size={24} />
            </div>
            <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">Actualizador Masivo</h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-4 flex-1">
              Ajusta precios de venta de forma masiva por categoría o proveedor. Perfecto para combatir la inflación rápidamente.
            </p>
            <div className="flex items-center text-indigo-600 dark:text-indigo-400 font-medium text-sm">
              Abrir herramienta <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Load Test Data Card */}
          <button
            onClick={() => setActiveTool('load-data')}
            className="group flex flex-col p-6 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm hover:shadow-md hover:border-blue-500/50 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform">
              <Database size={24} />
            </div>
            <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">Cargar Datos de Prueba</h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-4 flex-1">
              Restaura productos y materias primas de ejemplo. Útil si borraste los datos iniciales y necesitas probar el sistema.
            </p>
            <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium text-sm">
              Abrir herramienta <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Sincronizar Stock Espejo Card */}
          <button
            onClick={handleSyncMirrorStocks}
            disabled={isSyncing}
            className="group flex flex-col p-6 bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm hover:shadow-md hover:border-amber-500/50 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 group-hover:scale-110 transition-transform">
              <RefreshCw className={isSyncing ? "animate-spin" : ""} size={24} />
            </div>
            <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">Sincronizar Stock Espejo</h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-4 flex-1">
              Sincroniza manualmente el stock real de las materias primas y los insumos hacia el catálogo público.
            </p>
            <div className="flex items-center text-amber-600 dark:text-amber-400 font-medium text-sm">
              {isSyncing ? 'Sincronizando...' : 'Ejecutar sincronización'} <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>

        {syncStatus && (
          <div className={`border rounded-xl p-4 flex gap-3 ${syncStatus.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'}`}>
            <Info className="shrink-0 animate-pulse text-emerald-600 dark:text-emerald-400" size={20} />
            <p className="text-sm">
              {syncStatus.message}
            </p>
          </div>
        )}

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-3">
          <Info className="text-amber-600 dark:text-amber-400 shrink-0" size={20} />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Nota:</strong> Las simulaciones en la calculadora no se guardan permanentemente a menos que las registres como productos reales en el inventario.
          </p>
        </div>
      </div>
    </div>
  );
}
