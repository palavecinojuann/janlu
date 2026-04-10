import React, { useState } from 'react';
import { Calculator, RefreshCw, ChevronRight, Info, Database, TrendingUp, Beaker } from 'lucide-react';
import CostCalculator from './CostCalculator';
import BulkPriceUpdater from './BulkPriceUpdater';
import LoadTestData from './LoadTestData';
import DynamicPricingTool from './DynamicPricingTool';
import VolumeCalculator from './VolumeCalculator';
import { Product, RawMaterial, Simulation, Activity } from '../types';

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
        </div>

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
