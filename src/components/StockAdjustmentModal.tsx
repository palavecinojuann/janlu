import React, { useState } from 'react';
import { Product, Variant } from '../types';
import { X, Plus, Minus, Save } from 'lucide-react';

interface StockAdjustmentModalProps {
  product: Product;
  variant: Variant;
  onClose: () => void;
  onAdjust: (quantity: number) => void;
}

export default function StockAdjustmentModal({ product, variant, onClose, onAdjust }: StockAdjustmentModalProps) {
  const [adjustment, setAdjustment] = useState<number>(0);
  const [type, setType] = useState<'add' | 'remove'>('add');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustment === 0) return;
    onAdjust(type === 'add' ? adjustment : -adjustment);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-2xl shadow-xl border border-stone-100 dark:border-stone-800 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-stone-100 dark:border-stone-800">
          <div>
            <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100">Ajustar Stock</h3>
            <p className="text-sm text-stone-500 dark:text-stone-400">{product.name} - {variant.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex bg-stone-100 dark:bg-stone-950 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setType('add')}
              className={`flex-1 flex items-center justify-center py-2 rounded-lg text-sm font-medium transition-all ${
                type === 'add' 
                  ? 'bg-white dark:bg-stone-800 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
              }`}
            >
              <Plus size={16} className="mr-2" />
              Ingreso
            </button>
            <button
              type="button"
              onClick={() => setType('remove')}
              className={`flex-1 flex items-center justify-center py-2 rounded-lg text-sm font-medium transition-all ${
                type === 'remove' 
                  ? 'bg-white dark:bg-stone-800 text-rose-600 dark:text-rose-400 shadow-sm' 
                  : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
              }`}
            >
              <Minus size={16} className="mr-2" />
              Egreso
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Cantidad a {type === 'add' ? 'ingresar' : 'retirar'}</label>
            <div className="relative">
              <input
                type="number"
                min="1"
                required
                autoFocus
                step="any"
                value={adjustment || ''}
                onChange={(e) => setAdjustment(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xl font-bold text-center text-stone-900 dark:text-stone-100"
                placeholder="0"
              />
            </div>
            <div className="flex justify-between text-xs text-stone-500 dark:text-stone-400 px-1">
              <span>Stock actual: {variant.stock}</span>
              <span>Stock final: {type === 'add' ? variant.stock + adjustment : Math.max(0, variant.stock - adjustment)}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 font-medium rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={adjustment <= 0}
              className={`flex-1 flex items-center justify-center px-4 py-2.5 text-white font-medium rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                type === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              <Save size={18} className="mr-2" />
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
