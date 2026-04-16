import React, { useState } from 'react';
import { Product, Variant } from '../types';
import { X, Hammer, AlertTriangle, Minus, Plus } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 w-full max-w-md rounded-[24px] shadow-2xl border border-stone-100 dark:border-stone-800 overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between p-6 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
          <div>
            <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Hammer size={20} className="text-stone-900 dark:text-white" />
              Fabricar Producto
            </h3>
            <p className="text-xs uppercase tracking-widest font-bold text-stone-400 mt-1">
              {product.name} <span className="text-stone-300 mx-1">|</span> {variant.name}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 bg-white dark:bg-stone-800 rounded-full text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 shadow-sm hover:rotate-90 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo del Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 p-4 rounded-xl flex items-start text-sm">
              <AlertTriangle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 text-center">
              Cantidad a fabricar
            </label>
            
            {/* Selector de Cantidad Mejorado (Estilo Boutique) */}
            <div className="flex items-center justify-between border-2 border-stone-200 dark:border-stone-700 rounded-2xl overflow-hidden h-16 bg-white dark:bg-stone-950 shrink-0 max-w-[200px] mx-auto">
              <button 
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-16 h-full flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 active:bg-stone-100 transition-colors"
              >
                <Minus className="w-5 h-5" />
              </button>
              
              <input
                type="number"
                min="1"
                required
                value={quantity || ''}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                className="flex-1 w-full text-center font-bold text-2xl text-stone-900 dark:text-stone-100 bg-transparent border-none focus:ring-0 p-0"
              />
              
              <button 
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-16 h-full flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 active:bg-stone-100 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[11px] text-stone-400 font-medium text-center bg-stone-50 dark:bg-stone-800/50 py-2 px-4 rounded-lg">
              <AlertTriangle size={12} className="inline mr-1 mb-0.5" />
              Se descontarán los insumos de la receta del stock actual.
            </p>
          </div>

          {/* Botones de Acción */}
          <div className="flex gap-3 pt-4 border-t border-stone-100 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-4 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={quantity <= 0 || isSubmitting}
              className="flex-[2] flex items-center justify-center px-4 py-4 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:grayscale bg-stone-900 hover:bg-stone-800 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Fabricando...
                </span>
              ) : (
                <>
                  <Hammer size={16} className="mr-2" />
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
