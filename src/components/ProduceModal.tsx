import React, { useState } from 'react';
import { Product, Variant } from '../types';
import { X, Hammer, AlertTriangle } from 'lucide-react';

interface ProduceModalProps {
  product: Product;
  variant: Variant;
  onClose: () => void;
  onProduce: (quantity: number) => Promise<void>;
}

export default function ProduceModal({ product, variant, onClose, onProduce }: ProduceModalProps) {
  const [quantity, setQuantity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      await onProduce(quantity);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al fabricar el producto');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-2xl shadow-xl border border-stone-100 dark:border-stone-800 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-stone-100 dark:border-stone-800">
          <div>
            <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 flex items-center">
              <Hammer size={20} className="mr-2 text-indigo-500" />
              Fabricar Producto
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400">{product.name} - {variant.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 p-4 rounded-xl flex items-start text-sm">
              <AlertTriangle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Cantidad a fabricar</label>
            <div className="relative">
              <input
                type="number"
                min="1"
                required
                autoFocus
                step="1"
                value={quantity || ''}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xl font-bold text-center text-stone-900 dark:text-stone-100"
                placeholder="1"
              />
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 text-center mt-2">
              Esta acción descontará los insumos de la receta del stock actual.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 font-medium rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={quantity <= 0 || isSubmitting}
              className="flex-1 flex items-center justify-center px-4 py-2.5 text-white font-medium rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Procesando...
                </span>
              ) : (
                <>
                  <Hammer size={18} className="mr-2" />
                  Fabricar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
