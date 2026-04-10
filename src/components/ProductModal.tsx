import React, { useState, useMemo, useEffect } from 'react';
import { Product, Variant, Offer, Campaign, RawMaterial, StoreSettings, Course } from '../types';
import { X, Minus, Plus, Flame, Tag, Package, RotateCcw, Info, ChevronRight, Sparkles } from 'lucide-react';
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

  // Reset localVariant when product changes
  useEffect(() => {
    setLocalVariant(product.variants.find(v => getVariantStock(v, rawMaterials) > 0) || product.variants[0] || null);
  }, [product, rawMaterials]);

  // Handle escape key to close modal
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

  // Lock scroll on body when modal is open
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className="relative bg-white w-full max-w-5xl h-full sm:h-auto sm:max-h-[95vh] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:flex-row z-10 animate-in fade-in zoom-in-95 duration-300">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-30 p-2 bg-white/80 backdrop-blur-md rounded-full text-stone-400 hover:text-stone-900 shadow-sm transition-all hover:rotate-90"
        >
          <X size={24} />
        </button>

        {/* --- LEFT COLUMN: Image Section --- */}
        <div className="w-full md:w-[55%] bg-stone-50 relative h-[40vh] md:h-auto flex-shrink-0 border-r border-stone-100">
          {product.photoUrl ? (
            <img 
              src={product.photoUrl} 
              alt={product.name} 
              className={`w-full h-full object-cover ${isOutOfStock ? 'grayscale' : ''}`}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-stone-200">
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

        {/* --- RIGHT COLUMN: Content Section (Price & Buy) --- */}
        <div className="w-full md:w-[45%] p-8 md:p-12 overflow-y-auto flex flex-col bg-white">
          <div className="mb-8">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 block">SKU: {localVariant?.sku || product.id.slice(0, 8).toUpperCase()}</span>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-stone-900 leading-tight mb-4">{product.name}</h2>
            
            <div className="space-y-1">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-stone-900">
                  {formatCurrency(currentPrice)}
                </span>
                {hasDiscount && (
                  <span className="text-xl text-stone-300 line-through font-light">
                    {formatCurrency(originalPrice)}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400">Precio sin impuestos {formatCurrency(currentPrice * 0.82)}</p>
            </div>

            <div className="mt-4 space-y-2">
              {cashDiscount > 0 && (
                <>
                  <p className="text-xl font-bold text-rose-600">
                    {formatCurrency(cashPrice)} <span className="text-sm font-medium">en Efectivo</span>
                  </p>
                  <p className="text-sm text-rose-600 font-medium">
                    {cashDiscount}% de descuento <span className="text-stone-500">pagando en Efectivo</span>
                  </p>
                </>
              )}
              
              {installmentsCount > 0 && (
                <p className="text-sm text-stone-900">
                  <span className="font-bold">{installmentsCount} cuotas sin interés de {formatCurrency(installmentPrice)}</span>
                </p>
              )}
            </div>

            {product.description && (
              <div className="mt-8 pt-8 border-t border-stone-100">
                <div className="text-sm text-stone-600 leading-relaxed whitespace-pre-line font-medium">
                  {product.description}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-8 mt-auto">
            {product.variants.length > 1 && (
              <div>
                <label className="block text-xs font-bold text-stone-900 uppercase tracking-widest mb-4">Medida: <span className="text-stone-500 font-medium">{localVariant?.name}</span></label>
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
                        className={`px-4 py-2 text-xs font-medium border transition-all relative ${
                          isVariantOutOfStock
                            ? 'opacity-30 line-through cursor-not-allowed border-stone-100 text-stone-300'
                            : isSelected
                            ? 'border-stone-900 bg-stone-900 text-white shadow-lg'
                            : 'border-stone-200 text-stone-600 hover:border-stone-400'
                        }`}
                      >
                        {v.name}
                        {variantQuantityInCart > 0 && (
                          <span className={`absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${isSelected ? 'bg-white text-stone-900' : 'bg-stone-900 text-white'}`}>
                            {variantQuantityInCart}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {quantityInCart > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-[#C5D92D] animate-pulse"></div>
                <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">
                  Ya tienes {quantityInCart} {quantityInCart === 1 ? 'unidad' : 'unidades'} en tu carrito
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden h-14">
                  <button 
                    onClick={() => {
                      if (localVariant) {
                        onUpdateCart(product, localVariant, Math.max(0, quantityInCart - 1));
                      }
                    }}
                    className="w-12 h-full flex items-center justify-center text-stone-400 hover:text-stone-900 hover:bg-stone-50 transition-colors"
                  >
                    <Minus size={18} />
                  </button>
                  <div className="w-12 text-center font-bold text-stone-900">{quantityInCart}</div>
                  <button 
                    onClick={() => {
                      if (localVariant) {
                        onUpdateCart(product, localVariant, quantityInCart + 1);
                      }
                    }}
                    className="w-12 h-full flex items-center justify-center text-stone-400 hover:text-stone-900 hover:bg-stone-50 transition-colors"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                {!isOutOfStock && localVariant && (
                  <span className="text-[10px] text-stone-400 font-medium text-center">
                    {getVariantStock(localVariant, rawMaterials)} en stock
                  </span>
                )}
              </div>

              <button
                disabled={isOutOfStock || !localVariant}
                onClick={() => {
                  if (localVariant) {
                    onUpdateCart(product, localVariant, quantityInCart + 1);
                  }
                }}
                className="flex-1 h-14 bg-[#C5D92D] text-stone-900 font-bold uppercase tracking-widest text-xs hover:bg-[#b5c928] transition-all shadow-lg shadow-[#C5D92D]/20 disabled:opacity-50 disabled:grayscale"
              >
                Agregar al carrito
              </button>
            </div>

            {/* Lógica de Nota Destacada */}
            {(product.customNote || storeSettings?.productModalNotice) && (
              <div className="mt-8 pt-6 border-t border-stone-100">
                <p className="text-[11px] md:text-xs text-stone-500 leading-relaxed whitespace-pre-line text-center italic">
                  {product.customNote || storeSettings?.productModalNotice}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

