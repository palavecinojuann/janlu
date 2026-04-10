import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Calculator, Info, Save, ChevronRight, RefreshCw } from 'lucide-react';
import { RawMaterial, Simulation } from '../types';
import { toUMB, Unit, getUnitsForDimension, formatUMB, UNIT_DIMENSIONS, UMB_FOR_DIMENSION, Dimension } from '../utils/units';

interface CostCalculatorProps {
  rawMaterials: RawMaterial[];
  simulations: Simulation[];
  onSaveSimulation: (simulation: Simulation) => Promise<void>;
  onDeleteSimulation: (id: string) => Promise<void>;
}

interface SimulationItem {
  id: string;
  rawMaterialId: string;
  quantity: number;
  unit: Unit | '';
}

export default function CostCalculator({ 
  rawMaterials, 
  simulations, 
  onSaveSimulation, 
  onDeleteSimulation 
}: CostCalculatorProps) {
  const [items, setItems] = useState<SimulationItem[]>([]);
  const [simulationName, setSimulationName] = useState('');
  const [wastePercentage, setWastePercentage] = useState(5);
  const [quantityMultiplier, setQuantityMultiplier] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  const addItem = () => {
    setItems(prev => [
      ...prev,
      { id: Math.random().toString(36).substr(2, 9), rawMaterialId: '', quantity: 0, unit: '' }
    ]);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof SimulationItem, value: string | number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const calculatedResults = useMemo(() => {
    let subtotal = 0;
    const itemDetails = items.map(item => {
      const material = rawMaterials.find(m => m.id === item.rawMaterialId);
      const effectiveUnit = item.unit || (material ? (material.baseUnit || UMB_FOR_DIMENSION[material.dimension || (material.unit ? UNIT_DIMENSIONS[material.unit as Unit] : 'units')]) : undefined);
      if (!material || !effectiveUnit) return { ...item, cost: 0 };

      const quantityUMB = toUMB(item.quantity * quantityMultiplier, effectiveUnit as Unit);
      const cost = quantityUMB * material.costPerUnit;
      
      subtotal += cost;
      return { ...item, cost, materialName: material.name, dimension: material.dimension, materialUnit: material.unit, quantityUMB, totalQuantity: item.quantity * quantityMultiplier };
    });

    const wasteAmount = subtotal * (wastePercentage / 100);
    const total = subtotal + wasteAmount;

    return { itemDetails, subtotal, wasteAmount, total };
  }, [items, rawMaterials, wastePercentage]);

  const handleSave = async () => {
    if (!simulationName) {
      alert('Por favor, ingresa un nombre para la simulación');
      return;
    }
    setIsSaving(true);
    try {
      const simulation = {
        id: Math.random().toString(36).substr(2, 9),
        name: simulationName,
        totalCost: calculatedResults.total,
        wastePercentage,
        items: items.map(item => {
          const material = rawMaterials.find(m => m.id === item.rawMaterialId);
          return {
            ...item,
            rawMaterialName: material?.name || 'Insumo desconocido',
            cost: calculatedResults.itemDetails.find(d => d.id === item.id)?.cost || 0
          };
        }),
        createdAt: new Date().toISOString()
      };
      await onSaveSimulation(simulation);
      alert('Simulación guardada con éxito');
    } catch (error) {
      console.error('Error saving simulation:', error);
      alert('Error al guardar la simulación');
    } finally {
      setIsSaving(false);
    }
  };

  const loadSimulation = (sim: Simulation) => {
    setSimulationName(sim.name);
    setWastePercentage(sim.wastePercentage || 5);
    setItems(sim.items.map((item) => ({
      id: Math.random().toString(36).substr(2, 9),
      rawMaterialId: item.rawMaterialId,
      quantity: item.quantity,
      unit: item.unit as Unit | ''
    })));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      <div className="flex-none flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-stone-800 dark:text-white font-cinzel">Calculadora de Costos</h2>
          <p className="text-stone-500 dark:text-stone-400">Simula el costo de fabricación de un nuevo producto</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-stone-800 rounded-2xl p-6 shadow-sm border border-stone-200 dark:border-stone-700">
            <div className="mb-6">
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Nombre de la Simulación</label>
              <input
                type="text"
                value={simulationName}
                onChange={(e) => setSimulationName(e.target.value)}
                placeholder="Ej: Vela Aromática 250g"
                className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:text-white"
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-stone-800 dark:text-white">Insumos</h3>
                <button
                  onClick={addItem}
                  className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  <Plus size={18} /> Agregar Insumo
                </button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-8 text-stone-400 dark:text-stone-500 border-2 border-dashed border-stone-100 dark:border-stone-800 rounded-xl">
                  No hay insumos agregados a la simulación
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map(item => {
                    const selectedRM = rawMaterials.find(m => m.id === item.rawMaterialId);
                    const availableUnits = selectedRM ? getUnitsForDimension(selectedRM.dimension as Dimension, selectedRM.unit as Unit) : [];
                    
                    return (
                    <div key={item.id} className="flex flex-wrap sm:flex-nowrap gap-3 items-end p-3 bg-stone-50 dark:bg-stone-900/50 rounded-xl border border-stone-100 dark:border-stone-800">
                      <div className="flex-1 min-w-[150px]">
                        <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Insumo</label>
                        <select
                          value={item.rawMaterialId}
                          onChange={(e) => {
                            const newRmId = e.target.value;
                            const newRm = rawMaterials.find(m => m.id === newRmId);
                            updateItem(item.id, 'rawMaterialId', newRmId);
                            if (newRm) {
                              const effectiveDimension = newRm.dimension || (newRm.unit ? UNIT_DIMENSIONS[newRm.unit as Unit] : 'units');
                              const baseUnit = newRm.baseUnit || UMB_FOR_DIMENSION[effectiveDimension];
                              updateItem(item.id, 'unit', baseUnit);
                            }
                          }}
                          className="w-full px-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-sm dark:text-white"
                        >
                          <option value="">Seleccionar...</option>
                          {rawMaterials.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} (Stock: {formatUMB(m.stock, m.dimension as Dimension, m.unit as Unit)})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-24">
                        <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Cant.</label>
                        <input
                          type="number"
                          step="any"
                          value={item.quantity || ''}
                          onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-sm dark:text-white"
                        />
                      </div>
                      <div className="w-20">
                        <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Unidad</label>
                        {selectedRM ? (
                          <select
                            value={item.unit || selectedRM.baseUnit || UMB_FOR_DIMENSION[selectedRM.dimension || (selectedRM.unit ? UNIT_DIMENSIONS[selectedRM.unit as Unit] : 'units')]}
                            onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                            className="w-full px-3 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-sm dark:text-white"
                          >
                            {availableUnits.map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="w-full px-3 py-1.5 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-sm text-stone-400 text-center">
                            -
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-stone-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )})}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-stone-800 rounded-2xl p-6 shadow-sm border border-stone-200 dark:border-stone-700">
            <h3 className="font-semibold text-stone-800 dark:text-white mb-4">Ajustes Globales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Cantidad a Producir (Multiplicador)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantityMultiplier}
                    onChange={(e) => setQuantityMultiplier(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <span className="text-xs text-stone-500 dark:text-stone-400">unidades</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Margen de Desperdicio (%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={wastePercentage}
                    onChange={(e) => setWastePercentage(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <span className="text-sm font-bold text-stone-700 dark:text-stone-300 w-8">{wastePercentage}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Saved Simulations */}
          <div className="bg-white dark:bg-stone-800 rounded-2xl p-6 shadow-sm border border-stone-200 dark:border-stone-700">
            <h3 className="font-semibold text-stone-800 dark:text-white mb-4">Simulaciones Guardadas</h3>
            <div className="space-y-3">
              {simulations.map((sim) => (
                <div key={sim.id} className="flex justify-between items-center p-3 bg-stone-50 dark:bg-stone-900/50 rounded-xl border border-stone-100 dark:border-stone-800 group">
                  <div className="flex flex-col">
                    <span className="font-medium text-stone-800 dark:text-stone-200">{sim.name}</span>
                    <span className="text-xs text-stone-500 dark:text-stone-400">
                      ${sim.totalCost.toLocaleString('es-AR', { minimumFractionDigits: 2 })} · {new Date(sim.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadSimulation(sim)}
                      className="p-2 text-stone-400 hover:text-emerald-600 transition-colors"
                      title="Cargar"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <button
                      onClick={() => onDeleteSimulation(sim.id)}
                      className="p-2 text-stone-400 hover:text-rose-500 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {simulations.length === 0 && (
                <p className="text-center text-stone-400 py-4 text-sm italic">No hay simulaciones guardadas</p>
              )}
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          <div className="bg-emerald-600 text-white rounded-2xl p-6 shadow-lg shadow-emerald-500/20">
            <div className="flex items-center gap-2 mb-4 opacity-80">
              <Calculator size={20} />
              <span className="text-sm font-medium uppercase tracking-wider">Costo Estimado</span>
            </div>
            <div className="text-4xl font-bold mb-2">
              ${calculatedResults.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-emerald-100 text-sm">
              Costo total por unidad fabricada
            </p>

            <div className="mt-6 pt-6 border-t border-white/20 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="opacity-80">Subtotal insumos:</span>
                <span className="font-medium">${calculatedResults.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="opacity-80">Desperdicio ({wastePercentage}%):</span>
                <span className="font-medium">${calculatedResults.wasteAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving || !simulationName || items.length === 0}
              className="w-full mt-6 py-3 bg-white text-emerald-600 font-bold rounded-xl hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
              Guardar Simulación
            </button>
          </div>

          <div className="bg-white dark:bg-stone-800 rounded-2xl p-6 shadow-sm border border-stone-200 dark:border-stone-700">
            <h3 className="font-semibold text-stone-800 dark:text-white mb-4">Desglose de Costos</h3>
            <div className="space-y-3">
              {calculatedResults.itemDetails.map((item, idx) => (
                <div key={item.id} className="flex justify-between items-center text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium text-stone-800 dark:text-stone-200">{item.materialName || 'Insumo sin seleccionar'}</span>
                    <span className="text-xs text-stone-500 dark:text-stone-400">
                      {item.quantity} {item.unit} {item.quantityUMB !== undefined && `(${formatUMB(item.quantityUMB, item.dimension as Dimension, item.materialUnit as Unit)})`}
                    </span>
                  </div>
                  <span className="font-bold text-stone-700 dark:text-stone-300">
                    ${item.cost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-center text-stone-400 py-4 text-sm italic">Agrega insumos para ver el desglose</p>
              )}
            </div>
          </div>

          <div className="bg-stone-50 dark:bg-stone-900/50 rounded-2xl p-4 flex gap-3">
            <Info className="text-stone-400 shrink-0" size={18} />
            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
              Los costos se calculan en base al precio actual de tus materias primas en el inventario. Cambiar los precios en el inventario actualizará automáticamente esta simulación.
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
