import React, { useState, useMemo, useEffect } from 'react';
import { Product, Variant, Offer, Campaign, RawMaterial, StoreSettings, Course } from '../types';
import { X, Minus, Plus, Flame, Info, ShoppingBag } from 'lucide-react';
import { getVariantStock } from '../utils/stockUtils';

interface CartItem {
  product?: Product;
  variant?: Variant;
  course?: Course;
  quantity: number;
}

interface ProductModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onUpdateCart: (p: Product, v: Variant, q: number) => void;
  activeOffers: Offer[];
  activeCampaign: Campaign | null;
  formatCurrency: (n: number) => string;
  getEffectivePrice: (p: Product, v: Variant, q: number) => number;
  formatStock: (s: number) => string;
  cart: CartItem[];
  rawMaterials: RawMaterial[];
  storeSettings?: StoreSettings;
}

export default function ProductModal({
  product,
  isOpen,
  onClose,
  onUpdateCart,
  activeOffers,
  activeCampaign,
  formatCurrency,
  getEffectivePrice,
  formatStock,
  cart,
  rawMaterials,
  storeSettings
}: ProductModalProps) {
  const [localVariant, setLocalVariant] = useState<Variant | null>(
    product.variants.find(v => getVariantStock(v, rawMaterials) > 0) || product.variants[0] || null
  );

  useEffect(() => {
    setLocalVariant(product.variants.find(v => getVariantStock(v, rawMaterials) > 0) || product.variants[0] || null);
  }, [product, rawMaterials]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const quantityInCart = useMemo(() => {
    if (!localVariant) return 0;
    const item = cart.find(i => i.product?.id === product.id && i.variant?.id === localVariant.id);
    return item ? item.quantity : 0;
  }, [cart, product.id, localVariant]);

  const isOutOfStock = product.variants.every(v => getVariantStock(v, rawMaterials) <= 0);
  const productOffers = activeOffers.filter(offer => 
    !offer.productIds || offer.productIds.length === 0 || offer.productIds.includes(product.id)
  );
  
  const currentPrice = localVariant ? getEffectivePrice(product, localVariant, quantityInCart > 0 ? quantityInCart : 1) : 0;
  const originalPrice = localVariant?.price || 0;
  const hasDiscount = currentPrice < originalPrice;
  const cashDiscount = storeSettings?.cashDiscountPercentage || storeSettings?.transferDiscountPercentage || 0;
  const cashPrice = currentPrice * (1 - cashDiscount / 100);
  const installmentsCount = storeSettings?.installmentsCount || 0;
  const installmentsWithoutInterest = storeSettings?.installmentsWithoutInterest || false;
  const installmentPrice = installmentsCount > 0 ? currentPrice / installmentsCount : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 md:p-6 lg:p-8">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className="relative bg-white w-full max-w-[1000px] h-[100dvh] sm:h-[85vh] sm:min-h-[600px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:flex-row z-10 animate-in fade-in zoom-in-95 duration-300">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 md:top-6 md:right-6 z-30 p-2 bg-white/90 backdrop-blur-md rounded-full text-stone-400 hover:text-stone-900 shadow-sm transition-all hover:rotate-90 hover:bg-white"
          aria-label="Cerrar"
        >
          <X size={24} />
        </button>

        <div className="w-full md:w-[50%] h-[40vh] md:h-full bg-stone-50 relative flex-shrink-0 border-b md:border-b-0 md:border-r border-stone-100">
          {product.photoUrl ? (
            <img 
              src={product.photoUrl} 
              alt={product.name} 
              className={`absolute inset-0 w-full h-full object-cover ${isOutOfStock ? 'grayscale' : ''}`}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-stone-200">
              <Flame size={80} strokeWidth={1} />
              <span className="text-xs mt-4 uppercase tracking-[0.3em] font-bold">Sin imagen</span>
            </div>
          )}
          
          {isOutOfStock && (
            <div className="absolute inset-0 bg-white/40 flex items-center justify-center backdrop-blur-[2px]">
              <span className="bg-white text-stone-900 text-sm font-bold px-8 py-4 uppercase tracking-[0.2em] border border-stone-900 shadow-xl">
                Agotado
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 p-6 md:p-10 lg:p-12 overflow-y-auto flex flex-col bg-white">
          <div className="mb-8">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3 block">
              SKU: {localVariant?.sku || product.id.slice(0, 8).toUpperCase()}
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-stone-900 leading-tight mb-6">
              {product.name}
            </h2>
            
            <div className="space-y-2">
              <div className="flex items-baseline gap-4">
                <span className="text-3xl md:text-4xl font-bold text-stone-900 tracking-tight">
                  {formatCurrency(currentPrice)}
                  {quantityInCart > 1 && <span className="text-sm font-medium text-stone-400 ml-2">c/u</span>}
                </span>
                {hasDiscount && (
                  <span className="text-xl text-stone-300 line-through font-light">
                    {formatCurrency(originalPrice)}
                  </span>
                )}
              </div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-stone-400">
                Precio sin impuestos {formatCurrency(currentPrice * 0.82)}
              </p>

              {/* ✨ NUEVO: Subtotal Acumulado (solo aparece si llevan más de 1) */}
              {quantityInCart > 1 && (
                <div className="mt-4 inline-flex items-center gap-2 bg-stone-900 px-4 py-2 rounded-xl">
                  <span className="text-xs font-bold text-stone-300 uppercase tracking-widest">Total:</span>
                  <span className="text-lg font-bold text-white tracking-tight">
                    {formatCurrency(currentPrice * quantityInCart)}
                  </span>
                </div>
              )}
            </div>

            {/* ✨ CORRECCIÓN: La caja gris ahora solo se muestra SI HAY descuentos o cuotas */}
            {(cashDiscount > 0 || installmentsCount > 0) && (
              <div className="mt-6 space-y-3 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                {cashDiscount > 0 && (
                  <div>
                    <p className="text-lg md:text-xl font-bold text-rose-600 flex items-center gap-2">
                      {formatCurrency(cashPrice * (quantityInCart > 0 ? quantityInCart : 1))} <span className="text-xs font-medium uppercase tracking-widest">en Efectivo</span>
                    </p>
                    <p className="text-[10px] text-rose-600 font-bold uppercase tracking-widest opacity-80 mt-1">
                      {cashDiscount}% de descuento pagando en billete físico
                    </p>
                  </div>
                )}
                
                {installmentsCount > 0 && (
                  <div className={`${cashDiscount > 0 ? 'pt-3 border-t border-stone-200/60' : ''}`}>
                    <p className="text-xs text-stone-700 font-medium uppercase tracking-wider">
                      <span className="font-bold text-stone-900">{installmentsCount} cuotas sin interés</span> de {formatCurrency((currentPrice * (quantityInCart > 0 ? quantityInCart : 1)) / installmentsCount)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {product.description && (
              <div className="mt-8 pt-8 border-t border-stone-100">
                <div className="text-sm text-stone-600 leading-relaxed whitespace-pre-line font-medium">
                  {product.description}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-8 mt-auto pt-8">
            {product.variants.length > 1 && (
              <div>
                <label className="block text-xs font-bold text-stone-900 uppercase tracking-widest mb-4">
                  Medida: <span className="text-stone-500 font-medium ml-1">{localVariant?.name}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map(v => {
                    const currentStock = getVariantStock(v, rawMaterials);
                    const isSelected = localVariant?.id === v.id;
                    const isVariantOutOfStock = currentStock <= 0;
                    const variantQuantityInCart = cart.find(i => i.product?.id === product.id && i.variant?.id === v.id)?.quantity || 0;

                    return (
                      <button
                        key={v.id}
                        onClick={() => setLocalVariant(v)}
                        disabled={isVariantOutOfStock}
                        className={`px-5 py-3 text-xs font-bold uppercase tracking-wider border rounded-xl transition-all relative ${
                          isVariantOutOfStock
                            ? 'opacity-40 line-through cursor-not-allowed border-stone-200 text-stone-400 bg-stone-50'
                            : isSelected
                            ? 'border-stone-900 bg-stone-900 text-white shadow-lg shadow-stone-900/20'
                            : 'border-stone-200 text-stone-600 hover:border-stone-900 hover:text-stone-900 bg-white'
                        }`}
                      >
                        {v.name}
                        {variantQuantityInCart > 0 && (
                          <span className={`absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${isSelected ? 'bg-white text-stone-900' : 'bg-emerald-500 text-white'}`}>
                            {variantQuantityInCart}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <div className="flex flex-col gap-1 w-full sm:w-auto">
                  <div className="flex items-center border-2 border-stone-200 rounded-2xl overflow-hidden h-14 bg-white">
                    <button 
                      onClick={() => {
                        if (localVariant) {
                          onUpdateCart(product, localVariant, Math.max(0, quantityInCart - 1));
                        }
                      }}
                      className="w-14 h-full flex items-center justify-center text-stone-400 hover:text-stone-900 hover:bg-stone-50 transition-colors"
                    >
                      <Minus size={18} />
                    </button>
                    <div className="w-14 text-center font-bold text-stone-900 text-lg">{quantityInCart}</div>
                    <button 
                      onClick={() => {
                        if (localVariant) {
                          onUpdateCart(product, localVariant, quantityInCart + 1);
                        }
                      }}
                      className="w-14 h-full flex items-center justify-center text-stone-400 hover:text-stone-900 hover:bg-stone-50 transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  {!isOutOfStock && localVariant && (
                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest text-center mt-1">
                      {getVariantStock(localVariant, rawMaterials)} disponibles
                    </span>
                  )}
                </div>

                <button
                  disabled={isOutOfStock || !localVariant}
                  onClick={() => {
                    if (localVariant) {
                      if (quantityInCart === 0) {
                        onUpdateCart(product, localVariant, 1);
                      }
                      onClose();
                    }
                  }}
                  className="flex-1 h-14 bg-stone-900 text-white font-bold uppercase tracking-[0.2em] text-xs hover:bg-stone-800 rounded-2xl transition-all shadow-xl shadow-stone-900/10 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2"
                >
                  <ShoppingBag size={16} />
                  {quantityInCart === 0 ? 'Agregar al carrito' : 'Confirmar y Volver'}
                </button>
              </div>
            </div>

            {(product.customNote || storeSettings?.productModalNotice) && (
              <div className="mt-8 pt-6 border-t border-stone-100 bg-stone-50/50 -mx-6 md:-mx-10 lg:-mx-12 px-6 md:px-10 lg:px-12 -mb-6 md:-mb-10 lg:-mb-12 pb-6 md:pb-10 lg:pb-12">
                <div className="flex gap-3 text-stone-500 max-w-md">
                  <Info size={16} className="shrink-0 mt-0.5" />
                  <p className="text-[11px] md:text-xs leading-relaxed font-medium">
                    {product.customNote || storeSettings?.productModalNotice}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
