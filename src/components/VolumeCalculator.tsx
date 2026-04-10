import React, { useState } from 'react';
import { Calculator, Info, Save, RotateCcw } from 'lucide-react';

export default function VolumeCalculator() {
  const [shape, setShape] = useState<'cylinder' | 'cube'>('cylinder');
  const [diameter, setDiameter] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [width, setWidth] = useState<number | ''>('');
  const [length, setLength] = useState<number | ''>('');
  const [density, setDensity] = useState<number>(0.9); // Default soy wax density
  const [fillPercentage, setFillPercentage] = useState<number>(90); // Default fill percentage

  const calculateVolume = () => {
    let volume = 0;
    if (shape === 'cylinder' && diameter && height) {
      const radius = Number(diameter) / 2;
      volume = Math.PI * Math.pow(radius, 2) * Number(height);
    } else if (shape === 'cube' && width && length && height) {
      volume = Number(width) * Number(length) * Number(height);
    }
    return volume; // in cm³ (which is equivalent to ml)
  };

  const volume = calculateVolume();
  const fillVolume = volume * (fillPercentage / 100);
  const waxWeight = fillVolume * density;

  const handleReset = () => {
    setDiameter('');
    setHeight('');
    setWidth('');
    setLength('');
    setDensity(0.9);
    setFillPercentage(90);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 max-w-4xl mx-auto w-full space-y-6">
      <div className="flex-none">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-white font-cinzel flex items-center">
          <Calculator className="mr-3 text-emerald-500" size={28} />
          Calculadora de Volúmenes por Envase
        </h2>
        <p className="text-stone-500 dark:text-stone-400 mt-2">
          Calcula la cantidad exacta de cera necesaria para un nuevo envase o molde sin hacer pruebas de ensayo y error.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-stone-800 dark:text-white mb-4">Dimensiones del Envase (cm)</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">Forma del Envase</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      className="text-emerald-500 focus:ring-emerald-500"
                      checked={shape === 'cylinder'}
                      onChange={() => setShape('cylinder')}
                    />
                    <span className="ml-2 text-stone-700 dark:text-stone-300">Cilindro (Vasos, frascos redondos)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      className="text-emerald-500 focus:ring-emerald-500"
                      checked={shape === 'cube'}
                      onChange={() => setShape('cube')}
                    />
                    <span className="ml-2 text-stone-700 dark:text-stone-300">Cubo/Prisma (Moldes cuadrados)</span>
                  </label>
                </div>
              </div>

              {shape === 'cylinder' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Diámetro Interior (cm)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={diameter}
                      onChange={(e) => setDiameter(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-white"
                      placeholder="Ej: 8.5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Altura Interior (cm)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={height}
                      onChange={(e) => setHeight(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-white"
                      placeholder="Ej: 10"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Ancho (cm)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={width}
                      onChange={(e) => setWidth(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Largo (cm)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={length}
                      onChange={(e) => setLength(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Altura (cm)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={height}
                      onChange={(e) => setHeight(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-stone-800 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-stone-800 dark:text-white mb-4">Parámetros de Llenado</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Densidad de la Cera (g/cm³)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={density}
                  onChange={(e) => setDensity(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-white"
                />
                <p className="text-xs text-stone-500 mt-1">Cera de soja BPF aprox: 0.90</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">% de Llenado</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={fillPercentage}
                  onChange={(e) => setFillPercentage(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-900 text-stone-900 dark:text-white"
                />
                <p className="text-xs text-stone-500 mt-1">No se llena hasta el borde (aprox 90%)</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800 p-6 shadow-sm sticky top-6">
            <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-400 mb-6 border-b border-emerald-200 dark:border-emerald-800/50 pb-4">
              Resultados
            </h3>
            
            <div className="space-y-6">
              <div>
                <p className="text-sm text-emerald-600 dark:text-emerald-500 mb-1">Volumen Total del Envase</p>
                <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-300 font-mono">
                  {volume.toFixed(1)} <span className="text-lg">ml</span>
                </p>
              </div>

              <div>
                <p className="text-sm text-emerald-600 dark:text-emerald-500 mb-1">Volumen de Llenado ({fillPercentage}%)</p>
                <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-400 font-mono">
                  {fillVolume.toFixed(1)} <span className="text-base">ml</span>
                </p>
              </div>

              <div className="pt-4 border-t border-emerald-200 dark:border-emerald-800/50">
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400 mb-1">Cera Necesaria (Peso)</p>
                <p className="text-4xl font-bold text-emerald-900 dark:text-emerald-300 font-mono">
                  {waxWeight.toFixed(1)} <span className="text-xl">g</span>
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-2">
                  Por cada vela que fabriques con este envase.
                </p>
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center px-4 py-2 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
              >
                <RotateCcw size={16} className="mr-2" />
                Limpiar Datos
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
