import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Product, RawMaterial, Offer, Variant, Campaign, Sale, SaleStatus, StoreSettings, Course } from '../types';
import { Search, Filter, Wind, Droplet, Flame, ShoppingBag, Instagram, Facebook, Phone, Lock, Unlock, Plus, Edit2, Trash2, X, Tag, Clock, Calendar, ShoppingCart, Minus, ChevronRight, ChevronLeft, AlertTriangle, Package, LayoutDashboard, ArrowRightLeft, Upload, CheckCircle, Timer, Zap, LogOut, Loader2, Gift, Shield, Music2, ShieldCheck, Truck, Mail, MapPin, GraduationCap, Copy, Heart, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import ProductForm from './ProductForm';
import ProductModal from './ProductModal';
import { getVariantStock } from '../utils/stockUtils';
import { roundFinancial } from '../utils/mathUtils';
import { useDraggableScroll } from '../useDraggableScroll';

interface PublicCatalogProps {
  products: Product[];
  rawMaterials?: RawMaterial[];
  offers?: Offer[];
  campaigns?: Campaign[];
  onAddProduct?: (product: Product) => Promise<void>;
  onUpdateProduct?: (product: Product) => Promise<void>;
  onDeleteProduct?: (id: string) => void;
  onRegisterSale?: (sale: Omit<Sale, 'id' | 'date'>) => any;
  onBackToAdmin?: () => void;
  isCustomer?: boolean;
  lastSync?: Date;
  onRefresh?: () => void;
  storeSettings?: StoreSettings;
  isSettingsLoaded?: boolean;
  onValidateCoupon?: (code: string, customerEmail?: string) => Promise<{ valid: boolean; discount?: number; error?: string }>;
  onLogin?: () => void;
  currentUser?: any;
  isAdmin?: boolean;
  courses?: Course[];
  onAddSubscriber?: (email: string) => Promise<void>;
  sales?: Sale[];
}

const CountdownTimer = ({ expiresAt }: { expiresAt: string }) => {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      let expirationDate: Date;
      
      if (expiresAt.includes('-') && !expiresAt.includes('T')) {
        const [year, month, day] = expiresAt.split('-').map(Number);
        expirationDate = new Date(year, month - 1, day, 23, 59, 59, 999);
      } else {
        expirationDate = new Date(expiresAt);
      }
      
      const difference = +expirationDate - +new Date();
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        setTimeLeft(null);
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (!timeLeft) return null;

  return (
    <div className="flex gap-2 sm:gap-4 items-center justify-center">
      {[
        { label: 'Días', value: timeLeft.days },
        { label: 'Hrs', value: timeLeft.hours },
        { label: 'Min', value: timeLeft.minutes },
        { label: 'Seg', value: timeLeft.seconds },
      ].map((item, i) => (
        <div key={i} className="flex flex-col items-center">
          <div className="bg-white/20 backdrop-blur-md rounded-lg w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-sm sm:text-base font-bold border border-white/30 text-white">
            {item.value.toString().padStart(2, '0')}
          </div>
          <span className="text-[8px] sm:text-[10px] uppercase tracking-widest mt-0.5 opacity-80 text-white/70 font-bold">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

interface CartItem {
  product?: Product;
  variant?: Variant;
  course?: Course;
  isCourse?: boolean;
  quantity: number;
  customDescription: string;
}

interface ProductCardProps {
  product: Product;
  isAdminMode: boolean;
  onEdit: (p: Product) => void;
  onDelete?: (id: string) => void;
  onUpdateCart: (p: Product, v: Variant, q: number) => void;
  activeOffers: Offer[];
  activeCampaign: Campaign | null;
  formatCurrency: (n: number) => string;
  getEffectivePrice: (p: Product, v: Variant, q: number) => number;
  formatStock: (s: number) => string;
  cart: CartItem[];
  rawMaterials: RawMaterial[];
  storeSettings?: StoreSettings;
  stockErrorId?: string | null;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onClick?: () => void;
}

const ProductCard: React.FC<ProductCardProps> = React.memo(({
  product,
  isAdminMode,
  onEdit,
  onDelete,
  onUpdateCart,
  activeOffers,
  activeCampaign,
  formatCurrency,
  getEffectivePrice,
  formatStock,
  cart,
  rawMaterials,
  storeSettings,
  onClick,
  stockErrorId,
  isFavorite,
  onToggleFavorite
}) => {
  const [localVariant, setLocalVariant] = useState<Variant | null>(
    product.variants.find(v => getVariantStock(v, rawMaterials) > 0) || product.variants[0] || null
  );

  useEffect(() => {
    setLocalVariant(prev => {
      const isCurrentVariantValid = prev && product.variants.some(v => v.id === prev.id);
      if (!isCurrentVariantValid) {
        return product.variants.find(v => getVariantStock(v, rawMaterials) > 0) || product.variants[0] || null;
      }
      if (getVariantStock(prev, rawMaterials) <= 0) {
        return product.variants.find(v => getVariantStock(v, rawMaterials) > 0) || product.variants[0] || null;
      }
      return prev;
    });
  }, [product, rawMaterials]);

  const quantityInCart = useMemo(() => {
    if (!localVariant) return 0;
    const item = cart.find(i => i.product?.id === product.id && i.variant?.id === localVariant.id);
    return item ? item.quantity : 0;
  }, [cart, product.id, localVariant]);

  const cartSummary = useMemo(() => {
    return cart.filter(i => i.product?.id === product.id);
  }, [cart, product.id]);

  const totalQuantityInCart = useMemo(() => {
    return cartSummary.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartSummary]);

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
  
  const totalStock = product.variants.reduce((sum, v) => sum + getVariantStock(v, rawMaterials), 0);
  const isLowStock = totalStock > 0 && totalStock <= 5;

  return (
    <div 
      className={`group bg-white flex flex-col cursor-pointer transition-all duration-500 ease-out hover:scale-[1.03] hover:z-10 relative ${isOutOfStock ? 'opacity-75' : ''}`}
      onClick={onClick}
    >
      <div className="aspect-[3/4] bg-stone-50 relative overflow-hidden mb-4">
        {/* Etiqueta de Edición Limitada (Si pertenece a una campaña activa) */}
        {activeCampaign && (
          <div className="absolute top-3 left-3 z-20">
            <span className="bg-stone-950 text-stone-100 text-[7px] sm:text-[8px] font-medium uppercase tracking-[0.3em] px-3 py-1.5 shadow-sm">
              Edición Limitada
            </span>
          </div>
        )}

        {/* Overlay Elegante de Agotado */}
        {isOutOfStock && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-stone-100/30 backdrop-blur-[2px] transition-all duration-300">
            <span className="bg-white/95 text-stone-900 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.4em] px-6 py-2.5 shadow-sm border border-stone-200/50">
              Agotado
            </span>
          </div>
        )}
        <button 
          onClick={onToggleFavorite}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-white/60 backdrop-blur-md hover:bg-white transition-all duration-300 shadow-sm"
        >
          <Heart 
            size={16} 
            className={`transition-colors duration-300 ${isFavorite ? 'fill-rose-500 text-rose-500' : 'text-stone-500'}`} 
          />
        </button>
        {product.photoUrl ? (
          <img 
            src={product.photoUrl} 
            alt={product.name} 
            className={`w-full h-full object-cover object-center bg-stone-50 transition-transform duration-700 ease-out ${isOutOfStock ? 'grayscale' : ''}`}
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-stone-200/50 animate-pulse transition-colors">
            <Flame size={48} className="text-stone-300/50" strokeWidth={1} />
          </div>
        )}
        
        {(productOffers.length > 0 || activeCampaign) && (
          <div className={`absolute ${isAdminMode ? 'top-12' : 'top-3'} right-3 bg-stone-900 px-2 py-1 text-[10px] uppercase tracking-widest text-white z-10`}>
            {productOffers.length > 0 
              ? (productOffers[0].type === 'discount' && productOffers[0].discountPercentage ? `${productOffers[0].discountPercentage}% OFF` : productOffers[0].title)
              : `${activeCampaign?.discount}% OFF`}
          </div>
        )}

        {isAdminMode && !product.showInCatalog && (
          <div className="absolute top-12 right-3 bg-stone-900/80 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-sm uppercase tracking-widest">
            Oculto
          </div>
        )}

        {isAdminMode && (
          <div className="absolute top-3 left-3 flex gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(product); }}
              className="bg-white/90 backdrop-blur-sm p-2 rounded-full text-stone-700 hover:text-indigo-600 shadow-sm transition-colors"
              title="Editar producto"
            >
              <Edit2 size={16} />
            </button>
            {onDelete && (
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onDelete(product.id);
                }}
                className="bg-white/90 backdrop-blur-sm p-2 rounded-full text-stone-700 hover:text-rose-600 shadow-sm transition-colors"
                title="Eliminar producto"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}

      {/* ✨ BARRA DE COMPRA RÁPIDA (Optimizada para Móvil y PC) */}
        {!isOutOfStock && (
          <div 
            // CAMBIO 1: En móvil fluye normal (relative) para no tapar la foto. En PC (md:absolute) flota encima.
            className="relative md:absolute md:bottom-0 left-0 right-0 p-3 sm:p-4 transition-transform duration-300 ease-out z-20 translate-y-0 md:translate-y-full md:group-hover:translate-y-0 bg-white/95 md:bg-stone-900/10 backdrop-blur-sm md:backdrop-blur-none border-t border-stone-100 md:border-none w-full"
            onClick={(e) => e.stopPropagation()} 
          >
            {quantityInCart === 0 ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (localVariant) {
                    onUpdateCart(product, localVariant, 1);
                  }
                }}
                // CAMBIO 2: Altura fija (h-14) y shrink-0 para igualar exactamente al selector de cantidad
                className="w-full h-14 sm:h-12 shrink-0 bg-stone-900 text-white text-sm sm:text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg rounded-xl sm:rounded-none"
              >
                <ShoppingBag className="w-5 h-5 sm:w-4 sm:h-4" />
                <span>Agregar</span>
              </button>
            ) : (
              <div className="w-full flex items-center justify-between bg-white border-2 border-stone-900 overflow-hidden shadow-lg h-14 sm:h-12 rounded-xl sm:rounded-none shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateCart(product, localVariant!, quantityInCart - 1);
                  }}
                  className="flex-1 h-full flex items-center justify-center hover:bg-stone-50 text-stone-900 active:bg-stone-100 transition-colors"
                >
                  <Minus className="w-6 h-6 sm:w-4 sm:h-4" />
                </button>
                <span className="flex-1 text-center font-bold text-stone-900 text-xl sm:text-base">
                  {quantityInCart}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateCart(product, localVariant!, quantityInCart + 1);
                  }}
                  className="flex-1 h-full flex items-center justify-center hover:bg-stone-50 text-stone-900 active:bg-stone-100 transition-colors"
                >
                  <Plus className="w-6 h-6 sm:w-4 sm:h-4" />
                </button>
              </div>
            )}
          </div>
        )}
            
           {/* ✨ BARRA DE COMPRA RÁPIDA (SOLO PC - FLOTA SOBRE LA IMAGEN) */}
        {!isOutOfStock && (
          <div 
            className="hidden md:block absolute bottom-0 left-0 right-0 p-4 transition-transform duration-300 ease-out z-20 translate-y-full group-hover:translate-y-0 bg-stone-900/10 backdrop-blur-sm w-full"
            onClick={(e) => e.stopPropagation()} 
          >
            {quantityInCart === 0 ? (
              <button
                onClick={(e) => { e.stopPropagation(); if (localVariant) onUpdateCart(product, localVariant, 1); }}
                className="w-full h-12 shrink-0 bg-stone-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Agregar</span>
              </button>
            ) : (
              <div className="w-full flex items-center justify-between bg-white border-2 border-stone-900 overflow-hidden shadow-lg h-12 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); onUpdateCart(product, localVariant!, quantityInCart - 1); }} className="flex-1 h-full flex items-center justify-center hover:bg-stone-50 text-stone-900 active:bg-stone-100 transition-colors">
                  <Minus className="w-4 h-4" />
                </button>
                <span className={`flex-1 text-center text-base transition-all duration-300 transform ${stockErrorId === localVariant?.id ? 'text-rose-600 scale-125 font-bold animate-pulse' : 'font-bold text-stone-900'}`}>{quantityInCart}</span>
                <button onClick={(e) => { e.stopPropagation(); onUpdateCart(product, localVariant!, quantityInCart + 1); }} className="flex-1 h-full flex items-center justify-center hover:bg-stone-50 text-stone-900 active:bg-stone-100 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div> {/* <-- ESTE DIV CIERRA LA IMAGEN, ES VITAL QUE ESTÉ AQUÍ */}

      {/* ✨ BARRA DE COMPRA RÁPIDA (SOLO MÓVIL - FLUYE DEBAJO DE LA IMAGEN) */}
      {!isOutOfStock && (
        <div className="md:hidden w-full px-2 mb-3" onClick={(e) => e.stopPropagation()}>
          {quantityInCart === 0 ? (
            <button
              onClick={(e) => { e.stopPropagation(); if (localVariant) onUpdateCart(product, localVariant, 1); }}
              // AQUI ESTÁ LA MAGIA DEL BOTÓN: h-14 fijo y shrink-0
              className="w-full h-14 shrink-0 bg-stone-900 text-white text-sm font-bold uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2 shadow-lg rounded-xl"
            >
              <ShoppingBag className="w-5 h-5" />
              <span>Agregar</span>
            </button>
          ) : (
            <div className="w-full flex items-center justify-between bg-white border-2 border-stone-900 overflow-hidden shadow-lg h-14 rounded-xl shrink-0">
              <button onClick={(e) => { e.stopPropagation(); onUpdateCart(product, localVariant!, quantityInCart - 1); }} className="flex-1 h-full flex items-center justify-center active:bg-stone-100 transition-colors text-stone-900">
                <Minus className="w-6 h-6" />
              </button>
              <span className={`flex-1 text-center text-xl transition-all duration-300 transform ${stockErrorId === localVariant?.id ? 'text-rose-600 scale-125 font-bold animate-pulse' : 'font-bold text-stone-900'}`}>{quantityInCart}</span>
              <button onClick={(e) => { e.stopPropagation(); onUpdateCart(product, localVariant!, quantityInCart + 1); }} className="flex-1 h-full flex items-center justify-center active:bg-stone-100 transition-colors text-stone-900">
                <Plus className="w-6 h-6" />
              </button>
            </div>
          )}
          <p className="text-[10px] text-stone-400 text-center uppercase tracking-widest mt-2 font-bold">
            Agrega: {localVariant?.name}
          </p>
        </div>
      )}
      
      <div className="flex flex-col flex-1 px-1">
        <h3 className="text-sm sm:text-base font-serif text-stone-900 mb-1 line-clamp-2">{product.name}</h3>
        
        <div className="flex items-center gap-2 mb-1">
          {hasDiscount && (
            <span className="text-xs text-stone-400 line-through">
              {formatCurrency(originalPrice)}
            </span>
          )}
          <span className="text-base font-bold text-stone-950">
            {formatCurrency(currentPrice)}
          </span>
        </div>

        {installmentsCount > 0 && (
          <div className="text-xs text-stone-600 mb-1">
            {installmentsCount} cuotas {installmentsWithoutInterest ? 'sin interés' : ''} de {formatCurrency(installmentPrice)}
          </div>
        )}

        {product.variants.length > 1 && (
          <div className="flex flex-wrap gap-1 mb-3 mt-1" onClick={(e) => e.stopPropagation()}>
            {product.variants.map(v => {
              const currentStock = getVariantStock(v, rawMaterials);
              const isSelected = localVariant?.id === v.id;
              const isVariantOutOfStock = currentStock <= 0;
              const variantQuantityInCart = cart.find(i => i.product?.id === product.id && i.variant?.id === v.id)?.quantity || 0;

              return (
                <button
                  key={v.id}
                  onClick={(e) => {
                    e.stopPropagation(); // Evitar que el modal se abra al cambiar la medida
                    setLocalVariant(v);
                  }}
                  disabled={isVariantOutOfStock}
                  className={`px-2 py-1 text-[10px] border transition-colors relative ${
                    isVariantOutOfStock
                      ? 'opacity-50 line-through cursor-not-allowed border-stone-200 text-stone-400'
                      : isSelected
                      ? 'border-stone-900 text-stone-900'
                      : 'border-stone-200 text-stone-500 hover:border-stone-400'
                  }`}
                >
                  {v.name}
                  {variantQuantityInCart > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-stone-900 text-white text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-sm z-10">
                      {variantQuantityInCart}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {totalQuantityInCart > 0 && (
          <div className="text-[10px] text-stone-500 font-medium mb-2 flex items-center gap-1">
            <span>🛍️</span> {totalQuantityInCart} en tu carrito
          </div>
        )}

        {cashDiscount > 0 && (
          <div className="text-sm font-bold text-stone-900 mb-2">
            {formatCurrency(cashPrice)} <span className="font-normal text-xs text-stone-600">en Efectivo</span>
          </div>
        )}

        {isLowStock && !isOutOfStock && (
          <div className="text-[10px] text-rose-600 uppercase tracking-wider mb-2">
            ¡Solo quedan {totalStock} en stock!
          </div>
        )}
      </div>
    </div>
  );
});

const PublicCampaignBanner = ({ campaign, onScrollToProducts }: { campaign: Campaign | null, onScrollToProducts?: () => void }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!campaign) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      let expirationDate: Date;
      
      if (campaign.expiresAt.includes('-') && !campaign.expiresAt.includes('T')) {
        const [year, month, day] = campaign.expiresAt.split('-').map(Number);
        expirationDate = new Date(year, month - 1, day, 23, 59, 59, 999);
      } else {
        expirationDate = new Date(campaign.expiresAt);
      }
      
      const distance = expirationDate.getTime() - now;

      if (distance < 0) {
        setTimeLeft('EXPIRADO');
        clearInterval(interval);
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [campaign]);

  if (!campaign) return null;

  return (
    <div className="w-full bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-stone-100 py-1 sm:py-2 px-4 flex items-center justify-center gap-2 sm:gap-6 text-[9px] sm:text-xs tracking-wide z-[60] relative overflow-hidden shadow-lg border-b border-white/5">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-rose-500/10 via-transparent to-rose-500/10 animate-pulse"></div>
      
      <div className="flex items-center gap-1.5 sm:gap-2 relative z-10">
        <div className="bg-amber-400/20 p-0.5 sm:p-1 rounded-full">
          <Zap size={12} className="text-amber-400 fill-amber-400 animate-pulse sm:w-[14px] sm:h-[14px]" />
        </div>
        <span className="font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-white">{campaign.title}</span>
      </div>

      <div className="hidden md:block w-px h-4 bg-white/10 relative z-10"></div>

      <div className="hidden sm:flex items-center gap-2 relative z-10">
        <span className="text-stone-300">
          Código: <span className="font-mono font-bold text-white px-2 py-0.5 bg-white/10 rounded border border-white/10 tracking-widest">{campaign.title}</span>
        </span>
        <ArrowRightLeft size={12} className="text-stone-500" />
        <span className="text-amber-400 font-bold text-sm">{campaign.discount}% OFF</span>
      </div>

      <div className="w-px h-3 sm:h-4 bg-white/10 relative z-10"></div>

      <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-amber-400 relative z-10 bg-white/5 border border-white/10 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-inner">
        <Timer size={12} className="animate-pulse sm:w-[14px] sm:h-[14px]" />
        <span className="font-bold">{timeLeft}</span>
      </div>

      {onScrollToProducts && (
        <button 
          onClick={onScrollToProducts}
          className="hidden sm:flex items-center gap-2 bg-white text-stone-900 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase hover:bg-stone-200 transition-colors shadow-sm ml-4"
        >
          Aprovechar <ArrowRightLeft size={12} className="rotate-90" />
        </button>
      )}
    </div>
  );
};

const ProductSlider: React.FC<{ title: string; products: Product[]; isAdminMode: boolean; onEdit: (p: Product) => void; onDelete?: (id: string) => void; onUpdateCart: (p: Product, v: Variant, q: number) => void; activeOffers: Offer[]; activeCampaign: Campaign | null; formatCurrency: (n: number) => string; getEffectivePrice: (p: Product, v: Variant, q: number) => number; formatStock: (s: number) => string; cart: CartItem[]; rawMaterials: RawMaterial[]; storeSettings?: StoreSettings; onProductClick: (p: Product) => void; favorites: string[]; onToggleFavorite: (id: string, e: React.MouseEvent) => void; onViewAll?: () => void; }> = ({ 
  title, products, isAdminMode, onEdit, onDelete, onUpdateCart, activeOffers, activeCampaign, formatCurrency, getEffectivePrice, formatStock, cart, rawMaterials, storeSettings, onProductClick, favorites, onToggleFavorite, onViewAll 
}) => {
  const { ref, onMouseDown, onMouseLeave, onMouseUp, onMouseMove, className, style } = useDraggableScroll();

  const handleScroll = (direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = direction === 'left' ? -400 : 400; 
      ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (products.length === 0) return null;

  return (
    <div className="mb-12 group/slider">
      <div className="flex items-center justify-between mb-6 px-4 sm:px-0">
        <h2 className="text-xl sm:text-2xl font-serif text-stone-900 tracking-tight">{title}</h2>
        <div className="h-px flex-1 bg-stone-100 mx-4 hidden sm:block"></div>
        
        <div className="flex items-center gap-4">
          {/* Controles de Carrusel (Visibles en Móvil y PC) */}
          <div className="flex gap-2">
            <button onClick={() => handleScroll('left')} className="p-2 rounded-full bg-stone-50 border border-stone-200 text-stone-600 hover:bg-stone-100 transition-colors shadow-sm">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => handleScroll('right')} className="p-2 rounded-full bg-stone-50 border border-stone-200 text-stone-600 hover:bg-stone-100 transition-colors shadow-sm">
              <ChevronRight size={18} />
            </button>
          </div>
          <button onClick={onViewAll} className="text-[10px] uppercase tracking-[0.2em] text-stone-400 hover:text-stone-900 transition-colors hidden sm:block">Ver todo</button>
        </div>
      </div>
      
      <div className="relative">
        <button
          onClick={() => handleScroll('left')}
          className="hidden md:flex absolute -left-5 top-[45%] -translate-y-1/2 z-30 w-12 h-12 bg-white/95 backdrop-blur-sm border border-stone-100 shadow-xl rounded-full items-center justify-center text-stone-400 hover:text-stone-900 hover:scale-110 transition-all opacity-0 group-hover/slider:opacity-100"
          aria-label="Desplazar a la izquierda"
        >
          <ChevronLeft size={24} strokeWidth={1.5} />
        </button>

        <div 
          ref={ref}
          className={`${className} flex flex-nowrap gap-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 py-6 select-none hide-scrollbar snap-x snap-mandatory`}
          style={style}
          onMouseDown={onMouseDown}
          onMouseLeave={onMouseLeave}
          onMouseUp={onMouseUp}
          onMouseMove={onMouseMove}
        >
          {products.map((product, index) => (
            <div 
              key={`${product.id}-${index}`} 
              className="flex-none w-[200px] sm:w-[280px] snap-start"
            >
              <ProductCard
                product={product}
                isAdminMode={isAdminMode}
                onEdit={onEdit}
                onDelete={onDelete}
                onUpdateCart={onUpdateCart}
                activeOffers={activeOffers}
                activeCampaign={activeCampaign}
                formatCurrency={formatCurrency}
                getEffectivePrice={getEffectivePrice}
                formatStock={formatStock}
                cart={cart}
                rawMaterials={rawMaterials}
                storeSettings={storeSettings}
                onClick={() => onProductClick(product)}
                isFavorite={favorites.includes(product.id)}
                onToggleFavorite={(e) => onToggleFavorite(product.id, e)}
              />
            </div>
          ))}
        </div>

        <button
          onClick={() => handleScroll('right')}
          className="hidden md:flex absolute -right-5 top-[45%] -translate-y-1/2 z-30 w-12 h-12 bg-white/95 backdrop-blur-sm border border-stone-100 shadow-xl rounded-full items-center justify-center text-stone-400 hover:text-stone-900 hover:scale-110 transition-all opacity-0 group-hover/slider:opacity-100"
          aria-label="Desplazar a la derecha"
        >
          <ChevronRight size={24} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
};

const CategorySeparatorBanner = ({ index, storeSettings }: { index: number; storeSettings?: StoreSettings }) => {
  // Arreglo de imágenes atmosféricas de alta gama por defecto
  const fallbackBanners = [
    { 
      image: "https://images.unsplash.com/photo-1603006905003-be475563bc59?q=80&w=2070&auto=format&fit=crop", 
      title: "ESENCIA NATURAL", 
      subtitle: "Aromas que transforman tu espacio" 
    },
    { 
      image: "https://images.unsplash.com/photo-1596433809252-260c2745ce7f?q=80&w=2070&auto=format&fit=crop", 
      title: "MOMENTOS ÚNICOS", 
      subtitle: "Luz y calidez en cada detalle" 
    },
    { 
      image: "https://images.unsplash.com/photo-1602615576820-ea14cf3e476a?q=80&w=2070&auto=format&fit=crop", 
      title: "RITUALES DE CALMA", 
      subtitle: "Diseño premium hecho a mano" 
    }
  ];

  const activeBanners = storeSettings?.atmosphericBanners && storeSettings.atmosphericBanners.length > 0
    ? storeSettings.atmosphericBanners
    : fallbackBanners;

  // Lógica de ritmo: Solo mostramos un banner cada 2 filas para no saturar la vista
  if (index % 2 !== 0) return null; 

  const banner = activeBanners[(index / 2) % activeBanners.length];

  return (
    <div className="relative w-full h-[25vh] sm:h-[35vh] overflow-hidden my-16 sm:my-24 bg-stone-950 group">
      <img
        src={banner.image}
        alt={banner.title}
        className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-[20000ms] ease-out"
        loading="lazy"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 bg-gradient-to-t from-stone-950/60 to-transparent">
        <h3 className="text-white text-2xl sm:text-4xl font-serif tracking-widest mb-3 drop-shadow-lg">
          {banner.title}
        </h3>
        <p className="text-stone-300 text-[9px] sm:text-[10px] uppercase tracking-[0.4em] drop-shadow-md">
          {banner.subtitle}
        </p>
      </div>
    </div>
  );
};

export default function PublicCatalog({ 
  products, 
  rawMaterials = [], 
  offers = [], 
  campaigns = [], 
  onAddProduct, 
  onUpdateProduct, 
  onDeleteProduct,
  onRegisterSale,
  onBackToAdmin,
  isCustomer,
  lastSync,
  onRefresh,
  storeSettings,
  isSettingsLoaded = true,
  onValidateCoupon,
  onLogin,
  currentUser,
  isAdmin = false,
  courses = [],
  onAddSubscriber,
  sales = []
}: PublicCatalogProps) {
  const [activeTab, setActiveTab] = useState<'inicio' | 'productos' | 'workshops' | 'mayorista' | 'politicas' | 'contacto'>('inicio');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isAdminMode, setIsAdminMode] = useState(isAdmin);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const productsGridRef = useRef<HTMLDivElement>(null);

  const popularProducts = useMemo(() => {
    if (!sales || sales.length === 0) return products.slice(0, 5); // Fallback si no hay ventas
    
    const salesCount: Record<string, number> = {};
    sales.forEach(sale => {
      if (sale.status !== 'cancelado') {
        sale.items.forEach(item => {
          salesCount[item.productId] = (salesCount[item.productId] || 0) + item.quantity;
        });
      }
    });

    return [...products]
      .sort((a, b) => (salesCount[b.id] || 0) - (salesCount[a.id] || 0))
      .slice(0, 5); // Tomamos el Top 5
  }, [products, sales]);

  const scrollToProducts = useCallback(() => {
    setActiveTab('productos');
    setTimeout(() => {
      productsGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  const [currentSlide, setCurrentSlide] = useState(0);
  const heroSlides = useMemo(() => {
    if (!isSettingsLoaded) return [];

    if (storeSettings?.heroSlides && storeSettings.heroSlides.length > 0) {
      return storeSettings.heroSlides;
    }
    return [
      {
        id: '1',
        image: "https://images.unsplash.com/photo-1602928321679-560bb453f190?q=80&w=2000&auto=format&fit=crop",
        title: "Colección Esencial",
        subtitle: "Aromas que transforman tus espacios en refugios de paz"
      },
      {
        id: '2',
        image: "https://images.unsplash.com/photo-1596433809252-260c27459d1f?q=80&w=2000&auto=format&fit=crop",
        title: "Nuevas Fragancias",
        subtitle: "Descubre las notas de temporada"
      },
      {
        id: '3',
        image: "https://images.unsplash.com/photo-1608528577891-eb055944f2e7?q=80&w=2000&auto=format&fit=crop",
        title: "Velas Artesanales",
        subtitle: "Hechas a mano con cera de soja"
      }
    ];
  }, [storeSettings?.heroSlides, isSettingsLoaded]);

  useEffect(() => {
    if (heroSlides.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('janlu_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error loading cart from localStorage", e);
      return [];
    }
  });

  const [stockErrorId, setStockErrorId] = useState<string | null>(null);

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('janlu_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('janlu_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = useCallback((productId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Evita que se abra el modal del producto al hacer clic en el corazón
    setFavorites(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]);
  }, []);

  useEffect(() => {
    localStorage.setItem('janlu_cart', JSON.stringify(cart));
  }, [cart]);

  const [isCartOpen, setIsCartOpen] = useState(false);

  // Sensor de Scroll para el Menú Flotante
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 1. Registrar cambios de pestaña en el historial del celular
  useEffect(() => {
    // Evitamos duplicar el historial si el usuario ya está en esa pestaña
    if (window.history.state?.tab !== activeTab) {
      // Usamos el formato #catalog?tab=... que es compatible con tu App.tsx
      window.history.pushState({ tab: activeTab }, '', `#catalog?tab=${activeTab}`);
    }
  }, [activeTab]);

  // 2. Escuchar el botón "Atrás" físico del celular (Evento popstate)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // Por precaución, si van hacia atrás, cerramos el carrito y cualquier producto ampliado
      setIsCartOpen(false);
      setSelectedProduct(null);

      // Leemos a qué pestaña querían volver
      if (e.state && e.state.tab) {
        setActiveTab(e.state.tab);
      } else {
        // Si retrocedieron hasta el inicio de la navegación, forzamos la vitrina
        setActiveTab('inicio');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'details' | 'success'>('cart');
  const [customerDetails, setCustomerDetails] = useState({ name: '', email: '', phone: '' });
  const [deliveryMethod, setDeliveryMethod] = useState<'retiro' | 'envio'>('retiro');
  const [paymentMethod, setPaymentMethod] = useState<'transferencia' | 'efectivo' | 'mercadopago' | 'acordar'>('transferencia');
  const [confirmAction, setConfirmAction] = useState<{ type: 'product', id: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const [generatedCoupon, setGeneratedCoupon] = useState<{code: string, expiry: string} | null>(null);

  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationData, setRegistrationData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    birthDate: ''
  });

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // (ELIMINADO) Auto-navegación inteligente: La vista previa ahora se maneja vía Overlay flontante en el buscador.

  const getSocialLink = (platform: 'instagram' | 'facebook' | 'tiktok', value?: string) => {
    if (!value) return '#';
    const cleanValue = value.trim();
    if (cleanValue.startsWith('http')) return cleanValue;
    const handle = cleanValue.replace(/^@/, '');
    
    if (platform === 'instagram') return `https://www.instagram.com/${handle}`;
    if (platform === 'facebook') return `https://www.facebook.com/${handle}`;
    if (platform === 'tiktok') return `https://www.tiktok.com/@${handle}`;
    return cleanValue;
  };

  // Navegación Inteligente: Limpia la búsqueda y filtros al cambiar de pestaña manualmente
  const handleNavigation = (tab: 'inicio' | 'productos' | 'workshops' | 'mayorista' | 'politicas' | 'contacto') => {
    setActiveTab(tab);
    setSearchTerm(''); // Vaciamos la barra de búsqueda
    setSelectedCategory('all'); // Reiniciamos las categorías
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || !onValidateCoupon) return;
    setIsValidatingCoupon(true);
    setCheckoutError(null);
    try {
      const result = await onValidateCoupon(couponCode.trim(), customerDetails.email);
      if (result.valid) {
        setAppliedCoupon({ code: couponCode.trim(), discount: result.discount || 0 });
        setCouponCode('');
      } else {
        setCheckoutError(result.error || 'Cupón inválido');
      }
    } catch (error) {
      setCheckoutError('Error al validar el cupón');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const triggerHapticFeedback = () => {
    if (typeof window !== 'undefined' && navigator && navigator.vibrate) {
      navigator.vibrate(50); // Micro-vibración sólida de 50ms
    }
  };

  const handleUpdateCart = (product: Product, variant: Variant, qty: number) => {
    const currentStock = getVariantStock(variant, rawMaterials);
    if (qty > currentStock) {
      setStockErrorId(variant.id);
      setTimeout(() => setStockErrorId(null), 500);
      return;
    }

    triggerHapticFeedback(); // 👈 INYECCIÓN DE VIBRACIÓN

    setCart(prev => {
      const existing = prev.find(item => item.product?.id === product.id && item.variant?.id === variant.id);
      if (qty <= 0) {
        return prev.filter(item => item !== existing);
      }
      if (existing) {
        return prev.map(item => 
          item === existing 
            ? { ...item, quantity: qty }
            : item
        );
      }
      return [...prev, { product, variant, quantity: qty, customDescription: variant.name }];
    });
  };

  const handleEnrollCourse = (course: Course) => {
    if (course.enrolledCount >= course.maxQuota) {
      alert('Lo sentimos, este curso ya no tiene cupos disponibles.');
      return;
    }
    
    const existingCartItem = cart.find(i => i.course?.id === course.id);
    if (existingCartItem) {
      updateCartQuantity(undefined, undefined, existingCartItem.quantity + 1, course.id);
    } else {
      setCart([...cart, { course: course, isCourse: true, quantity: 1, customDescription: `Inscripción: ${course.title}` }]);
    }
    setIsCartOpen(true);
  };

  const categories = useMemo(() => {
    if (!Array.isArray(products)) return [];
    return Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
  }, [products]);

  const activeOffers = useMemo(() => {
    if (!Array.isArray(offers)) return [];
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    return offers.filter(offer => {
      if (!offer.isActive) return false;
      if (offer.expiresAt) {
        const [year, month, day] = offer.expiresAt.split('-').map(Number);
        const expirationDate = new Date(year, month - 1, day, 23, 59, 59, 999);
        if (now > expirationDate) return false;
      }
      if (offer.validDays && offer.validDays.length > 0) {
        if (!offer.validDays.includes(currentDay)) return false;
      }
      if (offer.startTime && currentTime < offer.startTime) return false;
      if (offer.endTime && currentTime > offer.endTime) return false;

      return true;
    });
  }, [offers]);

  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    const filtered = products.filter(product => {
      const name = (product.name || '').toLowerCase();
      const description = (product.description || '').toLowerCase();
      const category = (product.category || '').toLowerCase();
      
      // .trim() elimina espacios vacíos accidentales del teclado
      const searchTerm = debouncedSearchTerm.toLowerCase().trim();

      // 1. Buscamos en el nombre, descripción o categoría principal
      let matchesSearch = name.includes(searchTerm) || 
                          description.includes(searchTerm) ||
                          category.includes(searchTerm);

      // 2. ESCÁNER PROFUNDO: Si no lo encontró, buscamos dentro de los nombres de todas sus variantes
      if (!matchesSearch && product.variants && Array.isArray(product.variants)) {
        matchesSearch = product.variants.some(variant => 
          (variant.name || '').toLowerCase().includes(searchTerm) ||
          (variant.sku || '').toLowerCase().includes(searchTerm)
        );
      }

      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const isVisible = product.showInCatalog === true || product.showInCatalog === undefined;
      
      return matchesSearch && matchesCategory && (isAdminMode || isVisible);
    });

    return filtered.sort((a, b) => {
      const orderA = a.sortOrder ?? Infinity;
      const orderB = b.sortOrder ?? Infinity;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [products, debouncedSearchTerm, selectedCategory, isAdminMode]);

  const formatCurrency = useCallback((amount: number) => { 
    return new Intl.NumberFormat('es-AR', { 
      style: 'currency', 
      currency: 'ARS', 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(amount); 
  }, []);

  const formatStock = useCallback((stock: number) => { 
    if (stock <= 0) return '0'; 
    if (stock >= 20) return '+20'; 
    if (stock >= 10) return '+10'; 
    if (stock >= 5) return '+5'; 
    return stock.toString(); 
  }, []);

  const activeCampaign = useMemo(() => {
    if (!Array.isArray(campaigns)) return null;
    return campaigns.find(c => {
      if (!c.isActive) return false;
      let expirationDate: Date;
      if (c.expiresAt.includes('-') && !c.expiresAt.includes('T')) {
        const [year, month, day] = c.expiresAt.split('-').map(Number);
        expirationDate = new Date(year, month - 1, day, 23, 59, 59, 999);
      } else {
        expirationDate = new Date(c.expiresAt);
      }
      return expirationDate > new Date();
    });
  }, [campaigns]);

  const getEffectivePrice = useCallback((product: Product, variant: Variant, qty: number = 1) => {
    const productOffers = activeOffers.filter(offer => 
      !offer.productIds || offer.productIds.length === 0 || offer.productIds.includes(product.id)
    );
    
    const discountOffer = productOffers.find(o => o.type === 'discount' && o.discountPercentage);
    if (discountOffer && discountOffer.discountPercentage) {
      return roundFinancial(variant.price * (1 - discountOffer.discountPercentage / 100));
    }

    const comboOffer = productOffers.find(o => o.type === 'combo' && o.fixedPrice && o.productIds.length === 1);
    if (comboOffer && comboOffer.fixedPrice) {
      return comboOffer.fixedPrice;
    }

    const bogoOffer = productOffers.find(o => o.type === 'bogo');
    if (bogoOffer && qty >= 2) {
      const paidQuantity = qty - Math.floor(qty / 2);
      return (variant.price * paidQuantity) / qty;
    }

    if (activeCampaign && activeCampaign.discount) {
      return roundFinancial(variant.price * (1 - activeCampaign.discount / 100));
    }

    return variant.price;
  }, [activeOffers, activeCampaign]);

  const removeFromCart = (productId?: string, variantId?: string, courseId?: string) => {
    setCart(prev => prev.filter(item => {
      if (courseId) return item.course?.id !== courseId;
      return !(item.product?.id === productId && item.variant?.id === variantId);
    }));
  };

  const updateCartQuantity = (productId: string | undefined, variantId: string | undefined, newQuantity: number, courseId?: string) => {
    // Detectamos si la acción es sumar cantidad
    const currentItem = cart.find(i => 
      (courseId && i.course?.id === courseId) || 
      (productId && variantId && i.product?.id === productId && i.variant?.id === variantId)
    );

    if (currentItem && newQuantity > currentItem.quantity) {
      triggerHapticFeedback();
    }

    setCart(prev => prev.map(item => {
      if (courseId && item.course?.id === courseId) {
        return { ...item, quantity: Math.max(1, newQuantity) };
      }
      if (productId && variantId && item.product?.id === productId && item.variant?.id === variantId) {
        const currentStock = getVariantStock(item.variant!, rawMaterials);
        if (newQuantity > currentStock) {
          setStockErrorId(item.variant!.id);
          setTimeout(() => setStockErrorId(null), 500);
          return { ...item, quantity: currentStock };
        }
        return { ...item, quantity: Math.max(1, newQuantity) };
      }
      return item;
    }));
  };

  const cartTotal = cart.reduce((sum, item) => {
    if (item.course) return sum + (item.course.price * item.quantity);
    if (item.product && item.variant) return sum + (getEffectivePrice(item.product, item.variant, item.quantity) * item.quantity);
    return sum;
  }, 0);
  const stackingPolicy = storeSettings?.discountStackingPolicy || 'stack';

  const finalTotal = useMemo(() => {
    if (!appliedCoupon) return cartTotal;

    if (stackingPolicy === 'best_offer') {
      return cart.reduce((sum, item) => {
        if (item.course) {
          const originalPrice = item.course.price;
          const couponPrice = originalPrice * (1 - appliedCoupon.discount / 100);
          const bestPrice = Math.min(originalPrice, couponPrice);
          return sum + (bestPrice * item.quantity);
        }
        if (item.product && item.variant) {
          const originalPrice = item.variant.price;
          const effectivePrice = getEffectivePrice(item.product, item.variant, item.quantity);
          const couponPrice = originalPrice * (1 - appliedCoupon.discount / 100);
          const bestPrice = Math.min(effectivePrice, couponPrice);
          return sum + (bestPrice * item.quantity);
        }
        return sum;
      }, 0);
    } else {
      return roundFinancial(cartTotal * (1 - appliedCoupon.discount / 100));
    }
  }, [cart, cartTotal, appliedCoupon, stackingPolicy, getEffectivePrice]);
  
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const hasExceededStock = cart.some(item => {
    if (item.course) {
      return item.quantity > (item.course.maxQuota - item.course.enrolledCount);
    }
    if (item.variant) {
      return item.quantity > getVariantStock(item.variant, rawMaterials || []);
    }
    return false;
  });

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setCheckoutStep('details');
  };

  const submitOrder = async () => {
    if (!customerDetails.name.trim()) {
      setCheckoutError('Por favor ingresa tu nombre.');
      return;
    }
    if (!currentUser && !customerDetails.phone.trim()) {
      setCheckoutError('Por favor ingresa tu número de teléfono.');
      return;
    }
    if (deliveryMethod === 'envio' && !customerDetails.email.trim()) {
      setCheckoutError('Por favor ingresa tu email para el envío.');
      return;
    }

    setIsSubmitting(true);
    setCheckoutError(null);
    setGeneratedCoupon(null); 

    try {
      const saleItems = cart.map(item => {
        if (item.course) {
          return {
            productId: item.course.id,
            variantId: 'course',
            productName: item.course.title,
            variantName: 'Inscripción',
            quantity: item.quantity,
            price: item.course.price,
            isCourse: true,
            courseId: item.course.id
          };
        }
        return {
          productId: item.product!.id,
          variantId: item.variant!.id,
          productName: item.product!.name,
          variantName: item.variant!.name,
          quantity: item.quantity,
          price: getEffectivePrice(item.product!, item.variant!, item.quantity)
        };
      });

      const newSaleData = {
        customerId: 'guest',
        customerName: isRegistering ? `${registrationData.firstName} ${registrationData.lastName}` : customerDetails.name,
        customerEmail: isRegistering ? registrationData.email : customerDetails.email,
        customerPhone: isRegistering ? registrationData.phone : customerDetails.phone,
        deliveryMethod,
        items: saleItems,
        totalAmount: finalTotal,
        amountPaid: 0,
        paymentPercentage: 0,
        paymentMethod: paymentMethod,
        status: 'presupuesto' as SaleStatus,
        paymentStatus: 'pending' as any,
        balanceDue: finalTotal,
        appliedCouponCode: appliedCoupon?.code,
        isRegistering,
        registrationData: isRegistering ? { ...registrationData } : undefined
      };

      let serverGeneratedCoupon = null;

      if (onRegisterSale) {
        const saleResult = await onRegisterSale(newSaleData as any);
        
        if (saleResult && typeof saleResult === 'object' && saleResult.generatedCoupon) {
           serverGeneratedCoupon = saleResult.generatedCoupon;
           setGeneratedCoupon(serverGeneratedCoupon);
        }
      }

      // Notificación automática por WhatsApp al Administrador
      const storePhone = storeSettings?.whatsappNumber?.replace(/\D/g, '');
      if (storePhone) {
        let message = `*✨ 𝐉𝐀𝐍𝐋𝐔 - 𝐀𝐫𝐨𝐦𝐚𝐬 & 𝐃𝐢𝐬𝐞𝐧̃𝐨 ✨*\n`;
        message += `--------------------------------------\n\n`;
        message += `¡Hola! Acabo de realizar un nuevo pedido en la tienda online. 🛍️\n\n`;
        message += `*Mis Datos:*\n`;
        message += `Nombre: ${customerDetails.name}\n`;
        if (customerDetails.phone) message += `Tel: ${customerDetails.phone}\n`;
        
        message += `\n*Mi Pedido:*\n`;
        cart.forEach(item => {
          if (item.product && item.variant) {
            message += `- ${item.quantity}x ${item.product.name} (${item.variant.name})\n`;
          } else if (item.course) {
            message += `- ${item.quantity}x Taller: ${item.course.title}\n`;
          }
        });
        
        message += `\n*Resumen:*\n`;
        message += `Total a pagar: ${formatCurrency(finalTotal)}\n`;
        message += `Método de pago: ${paymentMethod.toUpperCase()}\n`;
        message += `Método de entrega: ${deliveryMethod.toUpperCase()}\n`;

        const encodedMessage = encodeURIComponent(message);
        // Abrimos WhatsApp en una nueva pestaña
        window.open(`https://wa.me/${storePhone}?text=${encodedMessage}`, '_blank');
      }

      setCheckoutStep('success');
      localStorage.removeItem('janlu_cart');
      setCart([]);
    } catch (error) {
      console.error('Error submitting order:', error);
      setCheckoutError('Hubo un error al procesar tu pedido. Por favor intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  {/* ✨ CLASES AGREGADAS PARA EVITAR SCROLL HORIZONTAL */}
  return (
    <div className="min-h-screen bg-[#faf9f8] text-stone-900 font-sans selection:bg-stone-200 overflow-x-hidden w-full max-w-[100vw]">
      {/*  Top Bar */} 
      <div className="bg-stone-950 text-stone-100 text-[10px] sm:text-xs font-medium uppercase tracking-widest text-center py-2 px-4 min-h-[32px] sm:min-h-[36px] flex items-center justify-center transition-opacity duration-500"> 
        {storeSettings?.topBarText || ""} 
      </div>

      {/* Header */}
        {/* Header Inteligente: Transparente en Inicio, Sticky y Oscuro en otras pestañas */}
        <div 
          className={`w-full z-50 transition-all duration-500 px-4 sm:px-8 flex justify-between items-center text-white ${
            activeTab === 'inicio'
              ? isScrolled 
                ? 'fixed top-0 left-0 bg-stone-950/85 backdrop-blur-md shadow-lg py-3 sm:py-4' 
                : 'absolute top-8 sm:top-10 bg-transparent py-4 sm:py-6'
              : 'sticky top-0 bg-stone-950 shadow-md py-4 sm:py-5'
          }`}
        >
          {/* PublicCampaignBanner se mantiene pero el header ahora es absoluto */}
          <div className="absolute top-0 left-0 w-full">
             <PublicCampaignBanner campaign={activeCampaign} onScrollToProducts={scrollToProducts} />
          </div>
          <div className="flex items-center justify-between w-full mt-8 sm:mt-10">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => handleNavigation('inicio')}>
              <h1 className="text-3xl font-cinzel font-bold text-white tracking-tight">JANLU</h1>
              {isAdminMode && (
                <span className="ml-2 px-2 py-0.5 bg-stone-100 text-stone-500 text-[10px] uppercase tracking-widest rounded-full">
                  Admin
                </span>
              )}
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center justify-center flex-1 px-8 space-x-8">
              {[
                { id: 'inicio', label: 'Inicio' },
                { id: 'productos', label: 'Productos' },
                { id: 'workshops', label: 'Workshops' },
                { id: 'mayorista', label: 'Mayorista' },
                { id: 'politicas', label: 'Políticas' },
                { id: 'contacto', label: 'Contacto' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleNavigation(tab.id as any)}
                  className={`text-[10px] uppercase tracking-[0.2em] transition-all relative py-2 ${
                    activeTab === tab.id 
                      ? 'text-white font-bold after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-white' 
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            
            {/* Actions */}
            <div className="flex items-center space-x-3 sm:space-x-6">
              {isAdmin && (
                <button 
                  onClick={() => setIsAdminMode(!isAdminMode)}
                  className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                    isAdminMode 
                      ? 'bg-stone-900 text-white' 
                      : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                  }`}
                  title={isAdminMode ? 'Modo Admin Activado' : 'Modo Admin Desactivado'}
                >
                  <Shield size={12} />
                  <span className="hidden sm:inline">{isAdminMode ? 'Admin On' : 'Admin Off'}</span>
                </button>
              )}
              {onBackToAdmin && (
                <button 
                  onClick={onBackToAdmin}
                  className="flex items-center gap-1.5 text-stone-500 hover:text-stone-900 transition-colors"
                  title={isAdmin ? "Ir al Dashboard" : "Cerrar Sesión"}
                >
                  {isAdmin ? <LayoutDashboard size={18} /> : <LogOut size={18} />}
                  <span className="hidden sm:inline text-xs uppercase tracking-widest font-medium">
                    {isAdmin ? "Dashboard" : "Salir"}
                  </span>
                </button>
              )}
              <button 
                onClick={() => setIsCartOpen(true)}
                className="relative text-white hover:text-stone-200 transition-colors ml-2 mr-4 sm:mr-6"
              >
                <ShoppingBag size={20} strokeWidth={1.5} />
                {cartItemsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-stone-900 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {cartItemsCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation (Transparente) */}
          <div className="md:hidden border-t border-white/10 overflow-x-auto hide-scrollbar">
            <nav className="flex items-center px-4 py-3 space-x-6 min-w-max">
              {isAdmin && onBackToAdmin && (
                <button
                  onClick={onBackToAdmin}
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] transition-all py-1 text-white font-bold"
                >
                  <LayoutDashboard size={12} />
                  Dashboard
                </button>
              )}
              {[
                { id: 'inicio', label: 'Inicio' },
                { id: 'productos', label: 'Productos' },
                { id: 'workshops', label: 'Workshops' },
                { id: 'mayorista', label: 'Mayorista' },
                { id: 'politicas', label: 'Políticas' },
                { id: 'contacto', label: 'Contacto' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleNavigation(tab.id as any)}
                  className={`text-[10px] uppercase tracking-[0.2em] transition-all relative py-1 ${
                    activeTab === tab.id 
                      ? 'text-white font-bold after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-white' 
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

      <main>


        {activeTab === 'inicio' && (
          <>
            {/* Hero Carousel */}
            {heroSlides.length > 0 && (
              <div className="relative w-full h-[65vh] sm:h-[85vh] overflow-hidden bg-stone-950">
                {heroSlides.map((slide, index) => (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                      index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
                    }`}
                  >
                    {/* Imagen con efecto de Zoom Lento (Ken Burns) */}
                    <img
                      src={(slide as any).image || slide}
                      alt={`Janlu Colección ${index + 1}`}
                      loading={index === 0 ? "eager" : "lazy"}
                      className={`w-full h-full object-cover transition-transform duration-[10000ms] ease-out ${
                        index === currentSlide ? 'scale-110' : 'scale-100'
                      }`}
                    />
                    
                    {/* Gradiente oscuro difuminado para que el menú blanco siempre se lea */}
                    <div className="absolute top-0 left-0 right-0 h-32 sm:h-48 bg-gradient-to-b from-stone-950/80 via-stone-950/30 to-transparent z-10 pointer-events-none"></div>
                    
                    {/* Gradiente oscuro en la parte inferior para legibilidad */}
                    <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-900/30 to-transparent"></div>

                    {/* Textos y Botón Call to Action */}
                    <div className="absolute inset-0 flex flex-col items-center justify-end pb-20 sm:pb-32 text-center px-6">
                      <h2 className="text-white text-4xl sm:text-6xl font-serif tracking-tight mb-4 drop-shadow-md">
                        COLECCIÓN EXCLUSIVA
                      </h2>
                      <p className="text-stone-200 text-[10px] sm:text-xs tracking-[0.3em] uppercase mb-8 max-w-lg drop-shadow-sm">
                        Donde empieza la calma · Velas aromáticas premium hechas para inspirar cada momento
                      </p>
                      <button
                        onClick={scrollToProducts}
                        className="bg-white text-stone-900 px-8 py-3.5 text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase hover:bg-stone-100 transition-colors shadow-lg"
                      >
                        Descubrir la colección
                      </button>
                    </div>
                  </div>
                ))}

                {/* Indicadores de diapositiva (Dots) */}
                <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center gap-3">
                  {heroSlides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`transition-all duration-500 rounded-full ${
                        index === currentSlide 
                          ? 'w-8 h-1.5 bg-white' 
                          : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
                      }`}
                      aria-label={`Ir a diapositiva ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}

        {/* Buscador Minimalista con Vista Previa Overlay */}
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 mt-10 mb-8 z-50 relative">
          <div className="relative group flex items-center z-50">
            <input
              type="text"
              placeholder="Buscar fragancias, velas, talleres..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
              className="w-full pl-12 pr-4 py-3 bg-transparent border-b border-stone-300 focus:border-stone-900 focus:outline-none transition-colors text-stone-800 text-sm sm:text-base font-serif placeholder:text-stone-400 placeholder:font-sans placeholder:tracking-wide"
            />
            <Search 
              className="absolute left-2 text-stone-400 group-focus-within:text-stone-900 transition-colors" 
              size={20} 
              strokeWidth={1.5}
            />
            {searchTerm.trim().length > 0 && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 bg-stone-100 dark:bg-stone-800 rounded-full transition-colors z-10"
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}

            {/* Panel de Vista Previa Inteligente (Overlay) */}
            {isSearchFocused && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col z-50 animate-in slide-in-from-top-2 fade-in duration-200 max-h-[60vh]">
                {(() => {
                  const isSearchEmpty = searchTerm.trim().length === 0;
                  const favoriteProducts = products.filter(p => favorites.includes(p.id));
                  
                  // Si está vacío muestra favoritos (o destacados), si escribe muestra coincidencias
                  const previewProducts = isSearchEmpty
                    ? (favoriteProducts.length > 0 ? favoriteProducts : products.filter(p => p.showInCatalog !== false)).slice(0, 4)
                    : filteredProducts.slice(0, 4);

                  const previewTitle = isSearchEmpty
                    ? (favoriteProducts.length > 0 ? "Tus Favoritos" : "Productos Destacados")
                    : "Resultados Sugeridos";

                  return (
                    <>
                      {previewProducts.length > 0 ? (
                        <div className="p-4 sm:p-6 overflow-y-auto">
                          <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-4 block">
                            {previewTitle}
                          </span>
                          <div className="grid gap-4">
                            {previewProducts.map(product => (
                              <div 
                                key={product.id} 
                                className="flex items-center gap-4 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/50 p-2 rounded-xl transition-colors group"
                                onClick={() => {
                                  setActiveTab('productos');
                                  setIsSearchFocused(false);
                                  setTimeout(() => {
                                    const el = document.getElementById(`product-${product.id}`);
                                    if(el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }, 300);
                                }}
                              >
                                {product.photoUrl ? (
                                  <img src={product.photoUrl} alt={product.name} className="w-14 h-14 object-cover rounded-lg bg-stone-100" />
                                ) : (
                                  <div className="w-14 h-14 bg-stone-100 dark:bg-stone-800 rounded-lg flex items-center justify-center">
                                    <Flame size={20} className="text-stone-400" />
                                  </div>
                                )}
                                <div className="flex flex-col flex-1">
                                  <span className="font-bold text-sm text-stone-900 dark:text-stone-100 group-hover:text-indigo-600 transition-colors">{product.name}</span>
                                  <span className="text-xs text-stone-500">{formatCurrency(product.variants?.[0]?.price || 0)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-8 text-center flex flex-col items-center text-stone-500">
                          <Search size={32} className="mb-3 text-stone-300 opacity-50" />
                          <span className="text-sm font-medium">No encontramos resultados para "{searchTerm}"</span>
                        </div>
                      )}

                      {/* El botón de 'Ver todos los resultados' solo aparece si el cliente tipeó algo */}
                      {!isSearchEmpty && filteredProducts.length > 0 && (
                        <button
                          onClick={() => { 
                            setActiveTab('productos'); 
                            setIsSearchFocused(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="w-full py-4 bg-stone-50 dark:bg-stone-950 text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors border-t border-stone-200 dark:border-stone-800"
                        >
                          Ver los {filteredProducts.length} resultados para "{searchTerm}"
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Carrusel Matemático de Productos Más Populares */}
        <div className="mt-16 mb-8 w-full max-w-7xl mx-auto">
          <ProductSlider 
            title="Los Favoritos de Janlu"
            products={popularProducts}
            isAdminMode={isAdminMode}
            onEdit={setEditingProduct}
            onDelete={onDeleteProduct ? (id) => setConfirmAction({ type: 'product', id }) : undefined}
            onUpdateCart={handleUpdateCart}
            activeOffers={activeOffers}
            activeCampaign={activeCampaign}
            formatCurrency={formatCurrency}
            getEffectivePrice={getEffectivePrice}
            formatStock={formatStock}
            cart={cart}
            rawMaterials={rawMaterials}
            storeSettings={storeSettings}
            onProductClick={(p) => { setSelectedProduct(p); setIsModalOpen(true); }}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
          />
        </div>

        {/* Banner de Ofertas Alta Gama - Alto Contraste con Live Dot */}
        {activeOffers.length > 0 && (
          <div className="w-full bg-stone-950 border-y border-stone-800 py-3 sm:py-3.5 shadow-md z-40 relative">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
               <div className="flex items-center gap-3">
                 <span className="relative flex h-2 w-2">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                 </span>
                 <Tag className="text-stone-400" size={15} />
               </div>
               <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] sm:text-xs uppercase tracking-[0.25em] text-stone-300">
                 {activeOffers.map(offer => (
                    <span key={offer.id} className="flex items-center gap-2">
                      <span className="font-bold text-white tracking-[0.3em]">{offer.title}</span>
                      <span className="text-rose-400 font-bold bg-rose-950/50 px-2 py-0.5 rounded-sm">
                        {offer.discountPercentage}% OFF
                      </span>
                    </span>
                 ))}
               </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {categories.map((cat, index) => {
            const categoryProducts = products.filter(p => p.category === cat && (isAdminMode || (p.showInCatalog !== false)));
            if (categoryProducts.length === 0) return null;

            return (
              <div key={cat} className="w-full">
                <ProductSlider
                  title={cat}
                  products={categoryProducts.slice(0, 8)}
                  isAdminMode={isAdminMode}
                  onEdit={setEditingProduct}
                  onDelete={onDeleteProduct ? (id) => setConfirmAction({ type: 'product', id }) : undefined}
                  onUpdateCart={handleUpdateCart}
                  activeOffers={activeOffers}
                  activeCampaign={activeCampaign}
                  formatCurrency={formatCurrency}
                  getEffectivePrice={getEffectivePrice}
                  formatStock={formatStock}
                  cart={cart}
                  rawMaterials={rawMaterials}
                  storeSettings={storeSettings}
                  onProductClick={(p) => {
                    setSelectedProduct(p);
                    setIsModalOpen(true);
                  }}
                  favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                  onViewAll={() => {
                    setSelectedCategory(cat);
                    setActiveTab('productos');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
                <CategorySeparatorBanner index={index} storeSettings={storeSettings} />
              </div>
            );
          })}
        </div>
      </>
    )}

        {activeTab === 'productos' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Menú Editorial de Familias Olfativas */}
        <div className="w-full max-w-5xl mx-auto px-4 mt-12 mb-16 z-20 relative">
          <div className="flex flex-col items-center justify-center space-y-8">
            <h3 className="text-[9px] sm:text-[10px] text-stone-400 uppercase tracking-[0.4em] font-bold flex items-center gap-3">
              <Wind size={12} /> Explorar por Colección <Wind size={12} />
            </h3>
            <div className="flex flex-wrap justify-center gap-x-10 gap-y-6">
              <button
                onClick={() => { setSelectedCategory('all'); setSearchTerm(''); }}
                className={`text-[10px] sm:text-xs uppercase tracking-[0.25em] transition-all duration-300 pb-2 border-b border-transparent ${selectedCategory === 'all' ? 'text-stone-900 border-stone-900 font-bold scale-105' : 'text-stone-400 hover:text-stone-600 hover:border-stone-300'}`}
              >
                Colección Completa
              </button>
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => { setSelectedCategory(category); setSearchTerm(''); }}
                  className={`text-[10px] sm:text-xs uppercase tracking-[0.25em] transition-all duration-300 pb-2 border-b border-transparent ${selectedCategory === category ? 'text-stone-900 border-stone-900 font-bold scale-105' : 'text-stone-400 hover:text-stone-600 hover:border-stone-300'}`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

            {isAdminMode && onAddProduct && (
              <div className="mb-8 flex justify-end">
                <button
                  onClick={() => setIsAddingProduct(true)}
                  className="px-6 py-2 bg-stone-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-colors"
                >
                  Nuevo Producto
                </button>
              </div>
            )}

            <div ref={productsGridRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-10 sm:gap-y-12 py-4">
              {filteredProducts.map((product, index) => (
                <ProductCard
                  key={`${product.id}-${index}`}
                  product={product}
                  isAdminMode={isAdminMode}
                  onEdit={setEditingProduct}
                  onDelete={onDeleteProduct ? (id) => setConfirmAction({ type: 'product', id }) : undefined}
                  onUpdateCart={handleUpdateCart}
                  activeOffers={activeOffers}
                  activeCampaign={activeCampaign}
                  formatCurrency={formatCurrency}
                  getEffectivePrice={getEffectivePrice}
                  formatStock={formatStock}
                  cart={cart}
                  rawMaterials={rawMaterials}
                  storeSettings={storeSettings}
                  onClick={() => {
                    setSelectedProduct(product);
                    setIsModalOpen(true);
                  }}
                  stockErrorId={stockErrorId}
                  isFavorite={favorites.includes(product.id)}
                  onToggleFavorite={(e) => toggleFavorite(product.id, e)}
                />
              ))}
            </div>
            
            {filteredProducts.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mb-6">
                  <Search size={32} className="text-stone-300 dark:text-stone-600" />
                </div>
                <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100 mb-2">
                  No encontramos coincidencias
                </h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 mb-8 max-w-md">
                  No hay productos que coincidan con la búsqueda "{searchTerm}" en la categoría actual.
                </p>
                <button
                  onClick={() => { setSearchTerm(''); setSelectedCategory('all'); }}
                  className="px-6 py-3 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-bold uppercase tracking-widest rounded-xl hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white transition-colors"
                >
                  Limpiar todos los filtros
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'workshops' && (
          <div className="max-w-7xl mx-auto px-4 py-12 animate-in fade-in duration-500">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-serif text-stone-900 dark:text-white mb-4 tracking-tight">Janlu Academy</h2>
              <p className="text-stone-500 dark:text-stone-400 max-w-2xl mx-auto text-sm sm:text-base">
                Sumérgete en el arte de la cerería. Aprende nuestras técnicas exclusivas, conoce los secretos detrás de nuestros aromas y crea tus propias velas premium en nuestros workshops presenciales.
              </p>
            </div>

            {courses && courses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {courses.map(course => {
                  const availableSpots = course.maxQuota - course.enrolledCount;
                  const isSoldOut = availableSpots <= 0;

                  return (
                    <div key={course.id} className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 group flex flex-col">
                      
                      {/* Imagen y Etiqueta VIP */}
                      <div className="aspect-[4/3] bg-stone-100 dark:bg-stone-800 relative overflow-hidden">
                        {course.imageUrl ? (
                          <img src={course.imageUrl} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-stone-100 dark:bg-stone-800">
                            <GraduationCap size={48} className="text-stone-300 dark:text-stone-600" />
                          </div>
                        )}
                        <div className="absolute top-4 left-4 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 shadow-sm">
                          Workshop Presencial
                        </div>
                      </div>

                      {/* Cuerpo de la Tarjeta */}
                      <div className="p-6 sm:p-8 flex flex-col flex-1">
                        <h3 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 dark:text-white mb-3 line-clamp-2 leading-tight">{course.title}</h3>
                        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6 line-clamp-3 leading-relaxed">{course.description}</p>

                        {/* Detalles Logísticos */}
                        <div className="space-y-3 mb-8 bg-stone-50 dark:bg-stone-800/50 p-4 rounded-2xl">
                          <div className="flex items-center text-sm text-stone-700 dark:text-stone-300 font-medium">
                            <Calendar size={18} className="mr-3 text-indigo-500" />
                            <span>{new Date(course.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                          </div>
                          <div className="flex items-center text-sm text-stone-700 dark:text-stone-300 font-medium">
                            <Clock size={18} className="mr-3 text-indigo-500" />
                            <span>{new Date(course.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</span>
                          </div>
                          <div className="flex items-center text-sm text-stone-700 dark:text-stone-300 font-medium">
                            <MapPin size={18} className="mr-3 text-indigo-500" />
                            <span className="truncate">{course.location || 'Janlu Atelier'}</span>
                          </div>
                        </div>
                        
                        {/* Acordeón del Temario */}
                        <div className="mb-8 border-t border-stone-100 dark:border-stone-800 pt-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedCourseId(expandedCourseId === course.id ? null : course.id);
                            }}
                            className="flex items-center justify-between w-full group/btn"
                          >
                            <div className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-white group-hover/btn:text-indigo-600 transition-colors">
                              <BookOpen size={16} className="text-indigo-500" />
                              Programa del Workshop
                            </div>
                            <div className="text-stone-400 group-hover/btn:text-indigo-600 transition-colors">
                              {expandedCourseId === course.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </button>

                          {/* Contenido Expandible */}
                          {expandedCourseId === course.id && (
                            <div className="mt-4 text-sm text-stone-500 dark:text-stone-400 animate-in slide-in-from-top-2 fade-in duration-200">
                              <ul className="space-y-3">
                                <li className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                                  <span>Teoría de las ceras: Diferencias, temperaturas de fusión y quemado óptimo.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                                  <span>Arquitectura del aroma: Puntos de inflamación y cálculo de porcentajes.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                                  <span>Elección de pabilos según el diámetro del envase (Testing de quemado).</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></div>
                                  <span>Práctica final: Creación de tu propia vela de lujo paso a paso.</span>
                                </li>
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Footer de Precio y Acción */}
                        <div className="mt-auto pt-4 flex items-center justify-between border-t border-stone-100 dark:border-stone-800">
                          <div className="flex flex-col">
                            <span className="text-2xl font-bold text-stone-900 dark:text-white tracking-tight">{formatCurrency(course.price)}</span>
                            {isSoldOut ? (
                               <span className="text-xs font-bold text-rose-500 uppercase tracking-widest mt-1">Agotado</span>
                            ) : (
                               <span className={`text-xs font-bold uppercase tracking-widest mt-1 ${availableSpots <= 3 ? 'text-rose-500 animate-pulse' : 'text-emerald-600'}`}>
                                 Quedan {availableSpots} lugares
                               </span>
                            )}
                          </div>

                          <button
                            onClick={() => handleEnrollCourse(course)}
                            disabled={isSoldOut}
                            className={`px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
                              isSoldOut 
                                ? 'bg-stone-100 dark:bg-stone-800 text-stone-400 cursor-not-allowed' 
                                : 'bg-stone-900 dark:bg-indigo-600 text-white hover:bg-indigo-600 dark:hover:bg-indigo-500 shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5'
                            }`}
                          >
                            {isSoldOut ? 'Sin Cupo' : 'Inscribirse'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-24 bg-stone-50 dark:bg-stone-900/50 rounded-3xl border border-dashed border-stone-200 dark:border-stone-800 max-w-3xl mx-auto">
                <GraduationCap size={48} className="mx-auto text-stone-300 dark:text-stone-700 mb-6" />
                <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-white mb-2">Preparando nuevas fechas</h3>
                <p className="text-stone-500 dark:text-stone-400">Actualmente no tenemos workshops programados con cupos abiertos. ¡Mantente atento a nuestras redes sociales!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'mayorista' && (
          <div className="max-w-3xl mx-auto px-4 py-20 text-center">
            <h2 className="text-4xl font-serif text-stone-900 mb-6">Ventas Mayoristas</h2>
            <div className="h-px w-20 bg-stone-900 mx-auto mb-8"></div>
            <div className="text-stone-600 mb-10 leading-relaxed whitespace-pre-wrap">
              {storeSettings?.wholesaleInfo || (
                <>
                  ¿Tenés un local o emprendimiento y querés sumar nuestros productos? 
                  Ofrecemos precios especiales para compras por mayor con un monto mínimo de inversión.
                </>
              )}
            </div>
            <a 
              href={`https://wa.me/${storeSettings?.whatsappNumber?.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-10 py-4 bg-stone-900 text-white text-xs font-bold uppercase tracking-[0.2em] hover:bg-stone-800 transition-all shadow-xl"
            >
              <Phone size={18} />
              Consultar por WhatsApp
            </a>
          </div>
        )}

        {activeTab === 'politicas' && (
          <div className="max-w-4xl mx-auto px-4 py-20">
            <h2 className="text-4xl font-serif text-stone-900 mb-12 text-center">Nuestras Políticas</h2>
            
            <div className="grid md:grid-cols-2 gap-12">
              <div className="bg-stone-50 p-10 rounded-3xl">
                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-stone-900 mb-6">
                  <ShieldCheck size={24} />
                </div>
                <h3 className="text-xl font-serif text-stone-900 mb-4">Cambios y Devoluciones</h3>
                <p className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap">
                  {storeSettings?.returnsInfo || 'Contás con un plazo de 15 días corridos desde que recibís tu compra para realizar cambios. Los productos deben estar en su empaque original, sin uso y en perfectas condiciones.'}
                </p>
              </div>

              <div className="bg-stone-50 p-10 rounded-3xl">
                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-stone-900 mb-6">
                  <Truck size={24} />
                </div>
                <h3 className="text-xl font-serif text-stone-900 mb-4">Política de Envíos</h3>
                <p className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap">
                  {storeSettings?.shippingInfo || 'Realizamos envíos a todo el país a través de operadores logísticos confiables. El tiempo de entrega estimado es de 3 a 7 días hábiles, dependiendo de tu ubicación.'}
                </p>
              </div>

              <div className="bg-stone-50 p-10 rounded-3xl md:col-span-2">
                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-stone-900 mb-6">
                  <Package size={24} />
                </div>
                <h3 className="text-xl font-serif text-stone-900 mb-4">Ventas Mayoristas</h3>
                <p className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap">
                  {storeSettings?.wholesaleInfo || 'Ofrecemos precios especiales para compras mayoristas. Contactanos para más información y conocer los requisitos mínimos de compra.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'contacto' && (
          <div className="max-w-5xl mx-auto px-4 py-20">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-4xl font-serif text-stone-900 mb-6">Contacto</h2>
                <p className="text-stone-600 mb-10 leading-relaxed">
                  Estamos para ayudarte. Si tenés alguna duda sobre nuestros productos o tu pedido, 
                  no dudes en escribirnos por cualquiera de nuestros canales.
                </p>
                
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-stone-50 rounded-full flex items-center justify-center text-stone-900">
                      <Phone size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-stone-400">WhatsApp</p>
                      <p className="text-stone-900 font-medium">{storeSettings?.whatsappNumber || 'No configurado'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-stone-50 rounded-full flex items-center justify-center text-stone-900">
                      <Mail size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-stone-400">Email</p>
                      <p className="text-stone-900 font-medium">{storeSettings?.email || 'No configurado'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-stone-50 rounded-full flex items-center justify-center text-stone-900">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-stone-400">Ubicación</p>
                      <p className="text-stone-900 font-medium">{storeSettings?.workshopAddress || 'Buenos Aires, Argentina'}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-12 flex gap-4">
                  {storeSettings?.email && (
                    <a href={`mailto:${storeSettings.email}`} className="w-12 h-12 bg-stone-900 text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                      <Mail size={20} />
                    </a>
                  )}
                  {storeSettings?.instagramUrl && (
                    <a href={getSocialLink('instagram', storeSettings.instagramUrl)} target="_blank" rel="noopener noreferrer" className="w-12 h-12 bg-stone-900 text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                      <Instagram size={20} />
                    </a>
                  )}
                  {storeSettings?.facebookUrl && (
                    <a href={getSocialLink('facebook', storeSettings.facebookUrl)} target="_blank" rel="noopener noreferrer" className="w-12 h-12 bg-stone-900 text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                      <Facebook size={20} />
                    </a>
                  )}
                </div>
              </div>
              
              <div className="bg-stone-50 p-10 rounded-3xl aspect-square flex flex-col items-center justify-center text-center">
                <Wind size={64} className="text-stone-200 mb-6" />
                <h3 className="text-2xl font-serif text-stone-900 mb-4">¿Hablamos?</h3>
                <p className="text-stone-500 text-sm mb-8">Hacé clic en el botón para iniciar un chat directo con nosotros.</p>
                <a 
                  href={`https://wa.me/${storeSettings?.whatsappNumber?.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-3 bg-stone-900 text-white text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all"
                >
                  Enviar Mensaje
                </a>
              </div>
            </div>
          </div>
        )}


      </main>

      {/* FOOTER INMERSIVO (Estilo Alta Gama) */}
      <footer className="bg-stone-950 text-stone-300 pt-20 pb-10 px-6 sm:px-12 mt-24 border-t border-stone-800">
        <div className="max-w-7xl mx-auto">
          {/* Top: Suscripción a Newsletter */}
          <div className="flex flex-col items-center text-center mb-20">
            <h3 className="text-white text-2xl sm:text-3xl font-serif mb-4">Únete a nuestro universo</h3>
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-stone-400 mb-8 max-w-md leading-relaxed">
              Recibe novedades, beneficios exclusivos y consejos para el cuidado de tus velas.
            </p>
            {subscribed ? (
              <p className="text-emerald-400 text-[10px] sm:text-xs tracking-widest uppercase flex items-center gap-2">
                <CheckCircle size={14} /> ¡Gracias por suscribirte!
              </p>
            ) : (
              <div className="flex w-full max-w-md border-b border-stone-600 pb-2 transition-colors focus-within:border-white group">
                <input 
                  type="email" 
                  id="newsletter-email"
                  placeholder="Tu correo electrónico" 
                  className="bg-transparent w-full text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none"
                />
                <button 
                  onClick={() => {
                    const emailInput = document.getElementById('newsletter-email') as HTMLInputElement;
                    if (emailInput && emailInput.value && onAddSubscriber) {
                      onAddSubscriber(emailInput.value);
                      setSubscribed(true);
                    }
                  }}
                  className="text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-white transition-colors"
                >
                  Suscribirse
                </button>
              </div>
            )}
          </div>

          {/* Middle: Grid de Navegación */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-12 sm:gap-8 mb-16 text-center sm:text-left">
            <div className="sm:col-span-1 flex flex-col items-center sm:items-start">
              <h4 className="text-white text-2xl font-serif tracking-widest mb-4">JANLU</h4>
              <p className="text-[10px] text-stone-500 tracking-[0.2em] uppercase leading-relaxed">
                Aromas & Diseño.<br/>Donde empieza la calma.
              </p>
            </div>
            
            <div className="flex flex-col items-center sm:items-start">
              <h5 className="text-white text-[10px] font-bold uppercase tracking-[0.2em] mb-6">Explorar</h5>
              <ul className="space-y-4 text-xs text-stone-400">
                <li><button onClick={() => handleNavigation('inicio')} className="hover:text-white transition-colors">Inicio</button></li>
                <li><button onClick={() => handleNavigation('productos')} className="hover:text-white transition-colors">Nuestros Productos</button></li>
                <li><button onClick={() => handleNavigation('workshops')} className="hover:text-white transition-colors">Academy & Workshops</button></li>
              </ul>
            </div>

            <div className="flex flex-col items-center sm:items-start">
              <h5 className="text-white text-[10px] font-bold uppercase tracking-[0.2em] mb-6">Soporte</h5>
              <ul className="space-y-4 text-xs text-stone-400">
                <li><button onClick={() => handleNavigation('contacto')} className="hover:text-white transition-colors">Atención al Cliente</button></li>
                <li><button onClick={() => handleNavigation('politicas')} className="hover:text-white transition-colors">Envíos y Retiros</button></li>
                <li><button onClick={() => handleNavigation('politicas')} className="hover:text-white transition-colors">Términos y Condiciones</button></li>
              </ul>
            </div>

            <div className="flex flex-col items-center sm:items-start">
              <h5 className="text-white text-[10px] font-bold uppercase tracking-[0.2em] mb-6">Síguenos</h5>
              <ul className="space-y-4 text-xs text-stone-400">
                {storeSettings?.instagramUrl && <li><a href={getSocialLink('instagram', storeSettings.instagramUrl)} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-2"><Instagram size={14}/> Instagram</a></li>}
                {storeSettings?.facebookUrl && <li><a href={getSocialLink('facebook', storeSettings.facebookUrl)} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-2"><Facebook size={14}/> Facebook</a></li>}
                {storeSettings?.tiktokUrl && <li><a href={getSocialLink('tiktok', storeSettings.tiktokUrl)} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-2">TikTok</a></li>}
              </ul>
            </div>
          </div>

          {/* Bottom: Copyright */}
          <div className="text-center pt-8 border-t border-stone-800/50">
            <p className="text-[8px] sm:text-[9px] text-stone-600 tracking-[0.3em] uppercase">
              © {new Date().getFullYear()} JANLU VELAS. TODOS LOS DERECHOS RESERVADOS.
            </p>
          </div>
        </div>
      </footer>

      {/* Admin Modals */}
      {isAdminMode && (isAddingProduct || editingProduct) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-stone-950 rounded-3xl shadow-2xl w-full max-w-4xl my-8 relative">
            <button 
              onClick={() => { setIsAddingProduct(false); setEditingProduct(null); }}
              className="absolute top-6 right-6 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 z-10 bg-white dark:bg-stone-900 rounded-full p-2 shadow-sm"
            >
              <X size={24} />
            </button>
            <div className="p-8">
              <ProductForm
                product={editingProduct || undefined}
                rawMaterials={rawMaterials}
                onSave={async (product) => {
                  if (editingProduct && onUpdateProduct) {
                    await onUpdateProduct(product);
                  } else if (onAddProduct) {
                    await onAddProduct(product);
                  }
                  setIsAddingProduct(false);
                  setEditingProduct(null);
                }}
                onCancel={() => {
                  setIsAddingProduct(false);
                  setEditingProduct(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 🛒 CARRITO DE COMPRAS (PREMIUM DRAWER) */}
      <div 
        className={`fixed inset-0 z-[120] transition-all duration-500 ${
          isCartOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      >
        {/* Fondo oscuro con desenfoque de cristal (Glassmorphism) */}
        <div 
          className={`absolute inset-0 bg-stone-950/40 backdrop-blur-sm transition-opacity duration-500 ease-in-out ${
            isCartOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setIsCartOpen(false)}
        />

        {/* Panel lateral del carrito (Drawer) */}
        <div 
          className={`absolute top-0 right-0 h-full w-full sm:w-[420px] bg-[#faf9f8] shadow-2xl flex flex-col transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isCartOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Cabecera del Carrito */}
          <div className="flex items-center justify-between p-6 sm:px-8 sm:py-6 border-b border-stone-200/50 shrink-0">
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-serif text-stone-900 tracking-tight">
                {checkoutStep === 'cart' && 'Tu Carrito'}
                {checkoutStep === 'details' && 'Mis Datos'}
                {checkoutStep === 'success' && '¡Pedido Exitoso!'}
              </h2>
              {checkoutStep === 'cart' && (
                <span className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} {cart.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'Ítem' : 'Ítems'}
                </span>
              )}
            </div>
            <button 
              onClick={() => {
                setIsCartOpen(false);
                if (checkoutStep === 'success') {
                  setCheckoutStep('cart');
                }
                setGeneratedCoupon(null);
              }}
              className="p-2 text-stone-400 hover:text-stone-900 transition-transform duration-300 hover:rotate-90 bg-white rounded-full shadow-sm hover:shadow-md"
            >
              <X size={18} />
            </button>
          </div>

          {/* Área de Productos con Scroll Independiente */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
            {checkoutStep === 'cart' && (
              cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                  <ShoppingBag size={48} strokeWidth={1} className="mb-4 text-stone-300" />
                  <p className="text-xs uppercase tracking-[0.2em] font-bold text-stone-500">Tu carrito está vacío</p>
                  <button onClick={() => setIsCartOpen(false)} className="mt-8 text-[10px] uppercase tracking-widest border-b border-stone-400 pb-1 hover:text-stone-900 transition-colors">Volver a la tienda</button>
                </div>
              ) : (
                <div className="space-y-6">
                  {cart.map((item) => {
                    const originalPrice = item.variant?.price || item.course?.price || 0;
                    const currentPrice = item.product && item.variant ? getEffectivePrice(item.product, item.variant, item.quantity) : originalPrice;
                    const discountPercentage = originalPrice > currentPrice ? Math.round((1 - (currentPrice / originalPrice)) * 100) : 0;

                    return (
                      <div key={item.course ? item.course.id : `${item.product?.id}-${item.variant?.id}`} className="flex gap-4">
                        <div className="w-20 h-20 rounded-xl bg-stone-50 border border-stone-100 overflow-hidden shrink-0">
                          {item.course ? (
                            item.course.imageUrl ? (
                              <img src={item.course.imageUrl} alt={item.course.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-300">
                                <GraduationCap size={24} />
                              </div>
                            )
                          ) : item.product?.photoUrl ? (
                            <img src={item.product.photoUrl} alt={item.product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-300">
                              <Flame size={24} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-stone-900 line-clamp-1">
                                {item.course ? item.course.title : item.product?.name}
                              </h4>
                              <input
                                type="text"
                                value={item.customDescription}
                                onChange={(e) => {
                                  const newDescription = e.target.value;
                                  setCart(prev => prev.map(i => {
                                    if (item.course && i.course?.id === item.course.id) {
                                      return { ...i, customDescription: newDescription };
                                    }
                                    if (item.product && i.product?.id === item.product.id && item.variant?.id === item.variant?.id) {
                                      return { ...i, customDescription: newDescription };
                                    }
                                    return i;
                                  }));
                                }}
                                className="text-xs text-stone-500 border-none p-0 focus:ring-0 w-full bg-transparent"
                              />
                              <p className="text-[10px] text-stone-400 mt-0.5">
                                {item.course 
                                  ? formatCurrency(item.course.price)
                                  : item.product && item.variant ? `${formatCurrency(getEffectivePrice(item.product, item.variant, item.quantity))} c/u` : ''}
                              </p>
                            </div>
                            <button 
                              onClick={() => removeFromCart(item.product?.id, item.variant?.id, item.course?.id)}
                              className="text-stone-400 hover:text-rose-500 p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="mt-auto flex items-center justify-between">
                            <div className="flex items-center space-x-2 bg-white rounded-lg p-1 border border-stone-200">
                              <button 
                                onClick={() => updateCartQuantity(item.product?.id, item.variant?.id, item.quantity - 1, item.course?.id)}
                                className="w-6 h-6 flex items-center justify-center rounded bg-stone-50 text-stone-600 shadow-sm hover:text-rose-600"
                              >
                                <Minus size={12} />
                              </button>
                              <input 
                                type="number"
                                min="1"
                                step="any"
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  updateCartQuantity(item.product?.id, item.variant?.id, isNaN(val) ? 1 : val, item.course?.id);
                                }}
                                className={`w-10 text-center text-sm bg-transparent border-none focus:ring-0 p-0 transition-all duration-300 transform ${stockErrorId === item.variant?.id ? 'text-rose-600 scale-125 font-bold animate-pulse' : 'font-medium text-stone-900'}`}
                              />
                              <button 
                                onClick={() => updateCartQuantity(item.product?.id, item.variant?.id, item.quantity + 1, item.course?.id)}
                                className="w-6 h-6 flex items-center justify-center rounded bg-stone-50 text-stone-600 shadow-sm hover:text-rose-600"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-stone-400 mb-0.5">Subtotal</p>
                              <div className="flex flex-col items-end">
                                {discountPercentage > 0 ? (
                                  <>
                                    <span className="text-[10px] text-stone-400 line-through">{formatCurrency(originalPrice * item.quantity)}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="bg-rose-100 text-rose-600 text-[9px] font-bold px-1.5 py-0.5 rounded-sm">
                                        -{discountPercentage}%
                                      </span>
                                      <span className="text-sm font-bold text-stone-900">{formatCurrency(currentPrice * item.quantity)}</span>
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-sm font-bold text-stone-900">{formatCurrency(currentPrice * item.quantity)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Sección de Cupones Alta Gama */}
                  <div className="mt-8 pt-6 border-t border-stone-200">
                    <label className="block text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-stone-500 font-bold mb-4">
                      ¿Tenés un código de invitación o descuento?
                    </label>
                    <div className="flex gap-3 items-end">
                      <div className="flex-1 relative group">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          placeholder="INGRESAR CÓDIGO"
                          className="w-full bg-transparent border-b border-stone-300 pb-2 text-sm sm:text-base font-medium text-stone-800 placeholder:text-stone-300 focus:border-stone-900 focus:outline-none transition-colors uppercase tracking-widest"
                        />
                      </div>
                      <button
                        onClick={handleApplyCoupon}
                        disabled={isValidatingCoupon || !couponCode.trim()}
                        className="px-6 py-2.5 bg-stone-900 text-stone-100 text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-stone-800 disabled:opacity-30 transition-all duration-300"
                      >
                        {isValidatingCoupon ? 'Validando...' : 'Aplicar'}
                      </button>
                    </div>
                    {checkoutError && <p className="text-rose-500 text-[10px] uppercase tracking-widest mt-3 font-medium">{checkoutError}</p>}
                    {appliedCoupon && (
                      <div className="flex items-center gap-2 mt-3 text-emerald-600 text-[10px] uppercase tracking-widest font-bold">
                        <CheckCircle size={14} />
                        <span>Cupón {appliedCoupon.code} aplicado ({appliedCoupon.discount}% OFF)</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            {checkoutStep === 'details' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-stone-500 mb-2">Nombre de contacto *</label>
                  <input
                    type="text"
                    value={customerDetails.name}
                    onChange={(e) => setCustomerDetails(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 focus:border-stone-900 transition-all text-sm"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>

                {!currentUser && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-stone-500 mb-2">Teléfono / WhatsApp *</label>
                    <input
                      type="tel"
                      value={customerDetails.phone}
                      onChange={(e) => setCustomerDetails(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 focus:border-stone-900 transition-all text-sm"
                      placeholder="Ej. +54 9 11 1234 5678"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-stone-500 mb-3">Método de Entrega *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setDeliveryMethod('retiro')}
                      className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                        deliveryMethod === 'retiro' 
                          ? 'border-stone-900 bg-stone-50 text-stone-900' 
                          : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300'
                      }`}
                    >
                      <ShoppingBag size={20} />
                      <span className="text-xs font-bold uppercase tracking-wider text-center">Retiro por taller</span>
                    </button>
                    <button
                      onClick={() => setDeliveryMethod('envio')}
                      className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                        deliveryMethod === 'envio' 
                          ? 'border-stone-900 bg-stone-50 text-stone-900' 
                          : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300'
                      }`}
                    >
                      <Package size={20} />
                      <span className="text-xs font-bold uppercase tracking-wider text-center">Envío</span>
                    </button>
                  </div>
                  {deliveryMethod === 'retiro' && storeSettings?.workshopAddress && (
                    <div className="mt-3 p-4 bg-white border border-stone-200 rounded-xl animate-in fade-in slide-in-from-top-1 duration-300">
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mb-1">Dirección de retiro:</p>
                      <p className="text-sm text-stone-900 font-medium">{storeSettings.workshopAddress}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-stone-500 mb-3">Forma de Pago *</label>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={() => setPaymentMethod('transferencia')}
                      className={`p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                        paymentMethod === 'transferencia' 
                          ? 'border-stone-900 bg-stone-50 text-stone-900' 
                          : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethod === 'transferencia' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-400'}`}>
                        <ArrowRightLeft size={16} />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold uppercase tracking-wider">Transferencia</p>
                        <p className="text-[10px] text-stone-500 tracking-wide mt-0.5">Pago bancario</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setPaymentMethod('efectivo')}
                      className={`p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                        paymentMethod === 'efectivo' 
                          ? 'border-stone-900 bg-stone-50 text-stone-900' 
                          : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethod === 'efectivo' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-400'}`}>
                        <ShoppingCart size={16} />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold uppercase tracking-wider">Efectivo</p>
                        <p className="text-[10px] text-stone-500 tracking-wide mt-0.5">
                          {storeSettings?.cashDiscountPercentage 
                            ? `${storeSettings.cashDiscountPercentage}% OFF pagando físico` 
                            : 'Al entregar/retirar'}
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => setPaymentMethod('acordar')}
                      className={`p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                        paymentMethod === 'acordar' 
                          ? 'border-stone-900 bg-stone-50 text-stone-900' 
                          : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethod === 'acordar' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-400'}`}>
                        <Phone size={16} />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold uppercase tracking-wider">Acordar</p>
                        <p className="text-[10px] text-stone-500 tracking-wide mt-0.5">Coordinar por WhatsApp</p>
                      </div>
                    </button>
                  </div>
                </div>

                {deliveryMethod === 'envio' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-stone-500 mb-2">Email *</label>
                    <input
                      type="email"
                      value={customerDetails.email}
                      onChange={(e) => setCustomerDetails(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-900 focus:border-stone-900 transition-all text-sm"
                      placeholder="Ej. juan@email.com"
                    />
                  </div>
                )}

                {/* Banner de Registro */}
                <div className="mt-8 border-t border-stone-200/50 pt-6">
                  <div className={`p-5 rounded-2xl border-2 transition-all duration-300 ${
                    isRegistering 
                      ? 'border-stone-200 bg-white' 
                      : 'border-amber-100 bg-amber-50/50 hover:border-amber-200'
                  }`}>
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center shrink-0 text-amber-500 border border-stone-100">
                        <Gift size={18} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-stone-900 font-serif text-lg leading-tight">
                          Regístrate y obtén un descuento
                        </h4>
                        <p className="text-stone-500 text-xs mt-1">
                          Únete a nuestra comunidad y recibe un cupón exclusivo.
                        </p>
                        
                        <button
                          onClick={() => setIsRegistering(!isRegistering)}
                          className="mt-4 flex items-center gap-2 text-stone-900 font-bold text-xs uppercase tracking-wider hover:text-stone-600 transition-colors"
                        >
                          <div className={`w-8 h-4 rounded-full relative transition-colors duration-200 ${isRegistering ? 'bg-stone-900' : 'bg-stone-300'}`}>
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-200 ${isRegistering ? 'left-4' : 'left-1'}`} />
                          </div>
                          {isRegistering ? 'Sí, quiero registrarme' : 'Quiero registrarme'}
                        </button>
                      </div>
                    </div>

                    {isRegistering && (
                      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="sm:col-span-1">
                          <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1">Nombre *</label>
                          <input
                            type="text"
                            value={registrationData.firstName}
                            onChange={(e) => setRegistrationData(prev => ({ ...prev, firstName: e.target.value }))}
                            className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-all text-sm"
                            placeholder="Tu nombre"
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1">Apellido *</label>
                          <input
                            type="text"
                            value={registrationData.lastName}
                            onChange={(e) => setRegistrationData(prev => ({ ...prev, lastName: e.target.value }))}
                            className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-all text-sm"
                            placeholder="Tu apellido"
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1">Teléfono *</label>
                          <input
                            type="tel"
                            value={registrationData.phone}
                            onChange={(e) => setRegistrationData(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-all text-sm"
                            placeholder="Ej. +54 9 11 ..."
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1">Email *</label>
                          <input
                            type="email"
                            value={registrationData.email}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRegistrationData(prev => ({ ...prev, email: val }));
                              if (deliveryMethod === 'envio') {
                                setCustomerDetails(prev => ({ ...prev, email: val }));
                              }
                            }}
                            className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-all text-sm"
                            placeholder="tu@email.com"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1">Fecha de Nacimiento *</label>
                          <input
                            type="date"
                            value={registrationData.birthDate}
                            onChange={(e) => setRegistrationData(prev => ({ ...prev, birthDate: e.target.value }))}
                            className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-all text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {checkoutError && (
                  <div className="p-4 bg-rose-50 text-rose-700 rounded-xl text-sm flex items-start gap-3 border border-rose-100">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <p className="font-medium">{checkoutError}</p>
                  </div>
                )}
              </div>
            )}

            {checkoutStep === 'success' && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4 border border-emerald-100">
                  <CheckCircle size={32} />
                </div>
                <h3 className="text-3xl font-serif text-stone-900">¡Pedido Recibido!</h3>
                <p className="text-stone-500 max-w-sm mb-6 text-sm">
                  Gracias por tu compra. Hemos recibido tu pedido y nos pondremos en contacto contigo pronto por WhatsApp.
                </p>

                {generatedCoupon && (
                  <div className="bg-stone-950 text-stone-50 p-6 rounded-2xl shadow-xl w-full max-w-sm animate-in zoom-in-95 duration-500">
                    <div className="flex justify-center mb-4 text-amber-400">
                      <Gift size={24} />
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-80 mb-2">Tu regalo de bienvenida</p>
                    <p className="text-xs mb-6 text-stone-400">Guarda este código para tu próxima compra:</p>
                    
                    <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between mb-4">
                      <span className="font-mono text-xl font-bold tracking-widest text-amber-400">{generatedCoupon.code}</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(generatedCoupon.code);
                          alert('¡Código copiado!');
                        }}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
                        title="Copiar código"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                    
                    <p className="text-[10px] text-stone-500 uppercase tracking-widest flex items-center justify-center gap-1.5 font-bold">
                      <Timer size={12} />
                      Válido hasta: {generatedCoupon.expiry}
                    </p>
                  </div>
                )}

                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    setCheckoutStep('cart');
                    setGeneratedCoupon(null);
                  }}
                  className="mt-8 px-8 py-4 bg-stone-100 text-stone-900 rounded-full font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-stone-200 transition-colors"
                >
                  Volver a la tienda
                </button>
              </div>
            )}
          </div>

          {/* Footer del Carrito (Subtotales y Checkout) */}
          {cart.length > 0 && checkoutStep !== 'success' && (
            <div className="border-t border-stone-200/50 bg-white p-6 sm:p-8 shrink-0">
              <div className="flex justify-between items-end mb-6">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-500">Subtotal {appliedCoupon && '(con desc.)'}</span>
                </div>
                <span className="text-2xl font-serif text-stone-900">{formatCurrency(finalTotal)}</span>
              </div>
              
              {checkoutStep === 'cart' && (
                <button 
                  onClick={() => setCheckoutStep('details')}
                  disabled={hasExceededStock}
                  className="w-full bg-stone-900 text-white py-4 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] hover:bg-stone-800 transition-colors shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 group"
                >
                  {hasExceededStock ? 'Modifica las cantidades' : 'Iniciar Compra'}
                  {!hasExceededStock && <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />}
                </button>
              )}

              {checkoutStep === 'details' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setCheckoutStep('cart')}
                    className="px-6 py-4 bg-white text-stone-500 border border-stone-200 rounded-none font-bold text-[10px] sm:text-xs uppercase tracking-[0.2em] hover:bg-stone-50 hover:text-stone-900 transition-colors"
                  >
                    Volver
                  </button>
                  <button
                    onClick={submitOrder}
                    disabled={isSubmitting}
                    className="flex-1 bg-stone-900 text-white py-4 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] hover:bg-stone-800 transition-colors shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 group"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        Enviar Pedido
                        <ShoppingBag size={14} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </div>
              )}
              
              {checkoutStep === 'cart' && (
                <p className="text-center mt-4 text-[9px] text-stone-400 tracking-widest uppercase">Pagos seguros e información en el siguiente paso</p>
              )}
            </div>
          )}
        </div>
      </div>

      {storeSettings?.whatsappNumber && (
        <a
          href={`https://wa.me/${storeSettings.whatsappNumber.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center group"
          aria-label="Contactar por WhatsApp"
        >
          <Phone size={24} fill="currentColor" className="group-hover:animate-pulse" />
        </a>
      )}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onUpdateCart={handleUpdateCart}
          activeOffers={activeOffers}
          activeCampaign={activeCampaign}
          formatCurrency={formatCurrency}
          getEffectivePrice={getEffectivePrice}
          formatStock={formatStock}
          cart={cart}
          rawMaterials={rawMaterials}
          storeSettings={storeSettings}
        />
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-stone-200 dark:border-stone-800">
            <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-4">
              Eliminar Producto
            </h3>
            <p className="text-stone-600 dark:text-stone-400 mb-6">
              ¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (onDeleteProduct) {
                    onDeleteProduct(confirmAction.id);
                  }
                  setConfirmAction(null);
                }}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors font-medium"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
