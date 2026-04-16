import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, RawMaterial, Offer, Variant, Campaign, Sale, SaleStatus, StoreSettings, Course } from '../types';
import { Search, Filter, Wind, Droplet, Flame, ShoppingBag, Instagram, Facebook, Phone, Lock, Unlock, Plus, Edit2, Trash2, X, Tag, Clock, Calendar, ShoppingCart, Minus, ChevronRight, ChevronLeft, AlertTriangle, Package, LayoutDashboard, ArrowRightLeft, Upload, CheckCircle, Timer, Zap, LogOut, Loader2, Gift, Shield, Music2, ShieldCheck, Truck, Mail, MapPin, GraduationCap, Copy } from 'lucide-react';
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
  onRegisterSale?: (sale: Omit<Sale, 'id' | 'date'>) => void;
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
  onClick?: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
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
  onClick
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

  // Usamos un useMemo modificado para saber la cantidad EXACTA de la variante actual en el carrito
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
        {product.photoUrl ? (
          <img 
            src={product.photoUrl} 
            alt={product.name} 
            className={`w-full h-full object-cover transition-transform duration-700 ease-out ${isOutOfStock ? 'grayscale' : ''}`}
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-stone-300 transition-colors">
            <Flame size={48} strokeWidth={1} />
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
        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center backdrop-blur-[2px]">
            <span className="text-stone-900 text-xs font-bold px-4 py-2 uppercase tracking-widest border border-stone-900 bg-white/80">
              Agotado
            </span>
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
{/* ✨ BARRA DE COMPRA RÁPIDA (Optimizada para Móvil y PC) */}
        {!isOutOfStock && (
          <div 
            className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 transition-transform duration-300 ease-out z-20 translate-y-0 md:translate-y-full md:group-hover:translate-y-0 bg-white/95 md:bg-stone-900/10 backdrop-blur-sm md:backdrop-blur-none border-t border-stone-100 md:border-none"
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
                className="w-full py-4 sm:py-3 bg-stone-900 text-white text-sm sm:text-xs font-bold uppercase tracking-widest hover:bg-stone-800 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
              >
                <ShoppingBag className="w-5 h-5 sm:w-4 sm:h-4" />
                <span>Agregar</span>
              </button>
            ) : (
              <div className="w-full flex items-center justify-between bg-white border-2 border-stone-900 overflow-hidden shadow-lg h-14 sm:h-12 rounded-xl sm:rounded-none">
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
            
            {/* Mensajito visual para celular para indicar qué medida se agrega */}
            <p className="md:hidden text-[9px] text-stone-400 text-center uppercase tracking-widest mt-2 font-bold">
              Agrega: {localVariant?.name}
            </p>
          </div>
        )}
      </div>
      
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
};

const PublicCampaignBanner = ({ campaign }: { campaign: Campaign | null }) => {
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
    </div>
  );
};

const ProductSlider: React.FC<{ title: string; products: Product[]; isAdminMode: boolean; onEdit: (p: Product) => void; onDelete?: (id: string) => void; onUpdateCart: (p: Product, v: Variant, q: number) => void; activeOffers: Offer[]; activeCampaign: Campaign | null; formatCurrency: (n: number) => string; getEffectivePrice: (p: Product, v: Variant, q: number) => number; formatStock: (s: number) => string; cart: CartItem[]; rawMaterials: RawMaterial[]; storeSettings?: StoreSettings; onProductClick: (p: Product) => void; }> = ({ 
  title, products, isAdminMode, onEdit, onDelete, onUpdateCart, activeOffers, activeCampaign, formatCurrency, getEffectivePrice, formatStock, cart, rawMaterials, storeSettings, onProductClick 
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
        <div className="h-px flex-1 bg-stone-100 mx-6 hidden sm:block"></div>
        <button className="text-[10px] uppercase tracking-[0.2em] text-stone-400 hover:text-stone-900 transition-colors">Ver todo</button>
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
  onAddSubscriber
}: PublicCatalogProps) {
  const [activeTab, setActiveTab] = useState<'inicio' | 'productos' | 'workshops' | 'mayorista' | 'politicas' | 'contacto'>('inicio');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isAdminMode, setIsAdminMode] = useState(isAdmin);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const productsGridRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    localStorage.setItem('janlu_cart', JSON.stringify(cart));
  }, [cart]);

  const [isCartOpen, setIsCartOpen] = useState(false);
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

  const handleUpdateCart = (product: Product, variant: Variant, qty: number) => {
    const currentStock = getVariantStock(variant, rawMaterials);
    if (qty > currentStock) {
      alert(`Solo hay ${currentStock} unidades disponibles de ${variant.name}.`);
      return;
    }

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

    setCart(prev => {
      const existing = prev.find(item => item.course?.id === course.id);
      if (existing) {
        return prev;
      }
      return [...prev, { course, isCourse: true, quantity: 1, customDescription: `Inscripción: ${course.title}` }];
    });
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
      const name = product.name || '';
      const description = product.description || '';
      const matchesSearch = name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || 
                            description.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { 
      style: 'currency', 
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatStock = (stock: number) => {
    if (stock <= 0) return '0';
    if (stock >= 20) return '+20';
    if (stock >= 10) return '+10';
    if (stock >= 5) return '+5';
    return stock.toString();
  };

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

  const getEffectivePrice = (product: Product, variant: Variant, qty: number = 1) => {
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
  };

  const removeFromCart = (productId?: string, variantId?: string, courseId?: string) => {
    setCart(prev => prev.filter(item => {
      if (courseId) return item.course?.id !== courseId;
      return !(item.product?.id === productId && item.variant?.id === variantId);
    }));
  };

  const updateCartQuantity = (productId: string | undefined, variantId: string | undefined, newQuantity: number, courseId?: string) => {
    setCart(prev => prev.map(item => {
      if (courseId && item.course?.id === courseId) {
        return { ...item, quantity: Math.max(1, newQuantity) };
      }
      if (productId && variantId && item.product?.id === productId && item.variant?.id === variantId) {
        const currentStock = getVariantStock(item.variant!, rawMaterials);
        if (newQuantity > currentStock) {
          alert(`Solo hay ${currentStock} unidades disponibles de ${item.variant!.name}.`);
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
    setGeneratedCoupon(null); // Borramos cualquier cupón fantasma de pruebas anteriores

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
        // Obtenemos la VERDADERA respuesta del servidor
        const saleResult = await onRegisterSale(newSaleData as any);
        
        // Si el servidor decidió crear un cupón de verdad, lo atrapamos
        if (saleResult && typeof saleResult === 'object' && saleResult.generatedCoupon) {
           serverGeneratedCoupon = saleResult.generatedCoupon;
           setGeneratedCoupon(serverGeneratedCoupon);
        }
      }

      let message = `Hola Janlu Velas, mi nombre es ${customerDetails.name}.\nQuiero hacer el siguiente pedido:\n\n`;
      
      cart.forEach(item => {
        if (item.course) {
          message += `${item.quantity}x Inscripción: ${item.course.title} - ${formatCurrency(item.course.price * item.quantity)}\n`;
        } else if (item.product && item.variant) {
          const effectivePrice = getEffectivePrice(item.product, item.variant, item.quantity);
          message += `${item.quantity}x ${item.product.name} (${item.variant.name}) - ${formatCurrency(effectivePrice * item.quantity)}\n`;
        }
      });

      if (appliedCoupon) {
        message += `\nSubtotal: ${formatCurrency(cartTotal)}\n`;
        if (stackingPolicy === 'best_offer') {
          message += `Cupón aplicado: ${appliedCoupon.code} (Se aplica solo si es mejor que la oferta actual)\n`;
        } else {
          message += `Cupón aplicado: ${appliedCoupon.code} (-${appliedCoupon.discount}%)\n`;
        }
      }
      
      message += `\nTotal: ${formatCurrency(finalTotal)}.\n`;
      message += `Método de entrega: ${deliveryMethod === 'retiro' ? 'Retiro por el taller' : 'Envío'}\n`;
      message += `Forma de pago elegida: ${
        paymentMethod === 'transferencia' ? 'Transferencia o Depósito' :
        paymentMethod === 'efectivo' ? `Efectivo ${storeSettings?.cashDiscountPercentage ? `(${storeSettings.cashDiscountPercentage}% de descuento)` : ''}` :
        paymentMethod === 'mercadopago' ? 'Mercado Pago' : 'Acordar con el vendedor'
      }\n`;

      if (deliveryMethod === 'envio') {
        message += `Email de contacto: ${customerDetails.email}\n`;
      }
      
      // Solo agregamos el mensaje de WhatsApp si el SERVIDOR confirmó el cupón
      if (serverGeneratedCoupon) {
        message += `\n🎉 Me registré en la comunidad.\nMi código de regalo generado es: ${serverGeneratedCoupon.code} (Válido hasta: ${serverGeneratedCoupon.expiry})`;
      }

      message += `\n\nMe comunico para coordinar el pago y la entrega.`;

      const encodedMessage = encodeURIComponent(message);
      const whatsappNumber = storeSettings?.whatsappNumber ? storeSettings.whatsappNumber.replace(/[^0-9]/g, '') : '';

      if (whatsappNumber) {
        window.open(`https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${encodedMessage}`, '_blank');
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

  return (
    <div className="min-h-screen bg-white text-stone-900 font-sans selection:bg-stone-200 overflow-x-hidden">
      {/* Top Bar */}
      <div className="bg-stone-950 text-stone-100 text-[10px] sm:text-xs font-medium uppercase tracking-widest text-center py-2 px-4">
        {storeSettings?.topBarText || "20% OFF CON TRANSFERENCIA | ENVÍO GRATIS EN COMPRAS SUPERIORES A $50.000"}
      </div>

      {/* Header */}
      <header className="bg-white sticky top-0 z-50 border-b border-stone-100">
        <PublicCampaignBanner campaign={activeCampaign} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between w-full">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => setActiveTab('inicio')}>
            <h1 className="text-3xl font-cinzel font-bold text-stone-900 tracking-tight">JANLU</h1>
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
                onClick={() => setActiveTab(tab.id as any)}
                className={`text-[10px] uppercase tracking-[0.2em] transition-all relative py-2 ${
                  activeTab === tab.id 
                    ? 'text-stone-900 font-bold after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-stone-900' 
                    : 'text-stone-400 hover:text-stone-900'
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
              className="relative text-stone-900 hover:text-stone-600 transition-colors ml-2"
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

        {/* Mobile Navigation (Scrollable Tabs) */}
        <div className="md:hidden border-t border-stone-100 overflow-x-auto hide-scrollbar">
          <nav className="flex items-center px-4 py-3 space-x-6 min-w-max">
            {isAdmin && onBackToAdmin && (
              <button
                onClick={onBackToAdmin}
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] transition-all py-1 text-indigo-600 font-bold"
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
                onClick={() => setActiveTab(tab.id as any)}
                className={`text-[10px] uppercase tracking-[0.2em] transition-all relative py-1 ${
                  activeTab === tab.id 
                    ? 'text-stone-900 font-bold after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-stone-900' 
                    : 'text-stone-400 hover:text-stone-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main>
        {activeTab === 'inicio' && (
          <>
            {/* Hero Carousel */}
            <div className="relative w-full h-[60vh] sm:h-[70vh] bg-stone-100 overflow-hidden group">
              {!isSettingsLoaded ? (
                <div className="absolute inset-0 bg-stone-200 animate-pulse flex items-center justify-center">
                  <div className="text-stone-400 flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin" size={32} />
                    <span className="text-xs uppercase tracking-widest font-bold">Cargando Janlu...</span>
                  </div>
                </div>
              ) : (
                heroSlides.map((slide, index) => (
                  <div 
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
                  >
                    <img 
                      src={slide.image || "https://images.unsplash.com/photo-1602928321679-560bb453f190?q=80&w=2000&auto=format&fit=crop"} 
                      alt={slide.title} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/20 flex flex-col items-center justify-center text-center px-4">
                      <h2 className="text-4xl md:text-6xl font-serif text-white mb-4 drop-shadow-lg transform transition-transform duration-1000 translate-y-0 opacity-100">
                        {slide.title}
                      </h2>
                      <p className="text-stone-100 text-sm md:text-base max-w-xl uppercase tracking-widest drop-shadow-md mb-8">
                        {slide.subtitle}
                      </p>
                      {slide.buttonText && (
                        <button 
                          onClick={() => {
                            if (slide.buttonLink?.startsWith('category:')) {
                              const category = slide.buttonLink.split(':')[1];
                              setSelectedCategory(category);
                              setActiveTab('productos');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            } else if (slide.buttonLink === '#') {
                              setActiveTab('productos');
                              setSelectedCategory('all');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            } else if (slide.buttonLink) {
                              window.location.href = slide.buttonLink;
                            }
                          }}
                          className="px-8 py-4 bg-white text-stone-900 text-xs font-bold uppercase tracking-[0.2em] hover:bg-stone-100 transition-all shadow-xl"
                        >
                          {slide.buttonText}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
              
              {/* Carousel Controls */}
              {isSettingsLoaded && heroSlides.length > 1 && (
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 z-20">
                  {heroSlides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`w-2 h-2 rounded-full transition-all ${index === currentSlide ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/80'}`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Offers Section */}
            {activeOffers.length > 0 && (
              <div className="w-full bg-stone-900 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                  <div className="absolute -top-24 -left-24 w-96 h-96 bg-rose-500 rounded-full blur-[100px]" />
                  <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-500 rounded-full blur-[100px]" />
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10">
                  {activeOffers.map((offer, index) => (
                    <div key={offer.id} className={`${index > 0 ? 'mt-8 pt-8 border-t border-white/10' : ''}`}>
                      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="text-center md:text-left flex-1">
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.2em] mb-2 border border-rose-500/30">
                            <Tag size={7} className="sm:w-2 sm:h-2" />
                            Oferta Especial
                          </div>
                          <h3 className="text-2xl sm:text-4xl font-cinzel font-bold text-white mb-2 tracking-tight leading-tight">
                            {offer.title}
                          </h3>
                          <p className="text-stone-400 text-xs sm:text-base max-w-xl mb-4 leading-relaxed">
                            {offer.description}
                          </p>
                          <div className="flex flex-wrap justify-center md:justify-start gap-4 sm:gap-6 items-center">
                            {offer.type === 'discount' && offer.discountPercentage && (
                              <div className="text-3xl sm:text-5xl font-bold text-emerald-400">
                                {offer.discountPercentage}% <span className="text-xs sm:text-base uppercase tracking-widest text-white/50">OFF</span>
                              </div>
                            )}
                            {offer.type !== 'discount' && offer.fixedPrice && (
                              <div className="text-3xl sm:text-5xl font-bold text-emerald-400">
                                {formatCurrency(offer.fixedPrice)}
                              </div>
                            )}
                            {offer.type === 'bogo' && (
                              <div className="text-3xl sm:text-5xl font-bold text-emerald-400">
                                2x1 <span className="text-xs sm:text-base uppercase tracking-widest text-white/50">PROMO</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {offer.expiresAt && (
                          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-5 sm:p-8 border border-white/10 shadow-2xl flex flex-col items-center w-full md:w-auto min-w-[200px]">
                            <p className="text-stone-400 text-[8px] uppercase tracking-[0.3em] mb-3 font-bold">Termina en:</p>
                            <CountdownTimer expiresAt={offer.expiresAt} />
                            <div className="mt-6 w-full">
                              <button 
                                onClick={() => setActiveTab('productos')}
                                className="w-full px-8 py-3 bg-white text-stone-900 rounded-full font-bold text-xs hover:bg-stone-100 transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest"
                              >
                                <ShoppingBag size={14} />
                                Ver Productos
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Categories Sliders */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
              {categories.map(cat => (
                <ProductSlider
                  key={cat}
                  title={cat}
                  products={products.filter(p => p.category === cat && (isAdminMode || (p.showInCatalog !== false)))}
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
                />
              ))}
            </div>
          </>
        )}

        {activeTab === 'productos' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
              <div>
                <h2 className="text-3xl font-serif text-stone-900 mb-2">Nuestra Colección</h2>
                <p className="text-stone-500 text-sm uppercase tracking-widest">{filteredProducts.length} productos disponibles</p>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 text-[10px] uppercase tracking-widest border transition-all ${
                    selectedCategory === 'all' 
                      ? 'bg-stone-900 text-white border-stone-900' 
                      : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'
                  }`}
                >
                  Todos
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 text-[10px] uppercase tracking-widest border transition-all ${
                      selectedCategory === cat 
                        ? 'bg-stone-900 text-white border-stone-900' 
                        : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
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
                />
              ))}
            </div>
            
            {filteredProducts.length === 0 && (
              <div className="text-center py-20">
                <Wind size={48} className="mx-auto text-stone-200 mb-4" />
                <p className="text-stone-500 font-serif text-xl">No encontramos productos en esta selección.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'workshops' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {(() => {
              const activeCourses = courses?.filter(c => c.isActive) || [];
              
              if (activeCourses.length === 0) {
                return (
                  <div className="max-w-3xl mx-auto px-4 py-32 text-center flex flex-col items-center justify-center">
                    <Calendar size={64} className="text-stone-300 mb-6" strokeWidth={1} />
                    <h3 className="text-3xl sm:text-4xl font-serif text-stone-900 mb-4">Próximos Encuentros en Camino</h3>
                    <p className="text-stone-500 text-sm max-w-md mx-auto leading-relaxed mb-8">
                      Actualmente estamos diseñando nuestros próximos workshops. Mantente atento a esta sección o síguenos en nuestras redes para enterarte antes que nadie.
                    </p>
                    <button
                      onClick={() => setActiveTab('productos')}
                      className="px-8 py-3 border border-stone-900 text-stone-900 text-xs font-bold uppercase tracking-[0.2em] hover:bg-stone-900 hover:text-white transition-all"
                    >
                      Ver Productos
                    </button>
                  </div>
                );
              }

              return (
                <>
                  <div className="mb-12">
                    <h2 className="text-3xl font-serif text-stone-900 mb-2">Workshops y Cursos</h2>
                    <p className="text-stone-500 text-sm uppercase tracking-widest">Capacitaciones y experiencias presenciales</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {activeCourses.map((course) => (
                      <div key={course.id} className="bg-white border border-stone-100 overflow-hidden group">
                        <div className="aspect-[16/9] bg-stone-50 relative overflow-hidden">
                          {course.imageUrl ? (
                            <img
                              src={course.imageUrl}
                              alt={course.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-200">
                              <GraduationCap size={48} strokeWidth={1} />
                            </div>
                          )}
                          {course.enrolledCount >= course.maxQuota && (
                            <div className="absolute inset-0 bg-stone-900/60 flex items-center justify-center">
                              <span className="bg-white text-stone-900 px-4 py-1.5 text-xs font-bold uppercase tracking-widest">Agotado</span>
                            </div>
                          )}
                        </div>
                        <div className="p-6 space-y-4">
                          <h3 className="text-xl font-serif text-stone-900 leading-tight">{course.title}</h3>
                          <p className="text-stone-500 text-sm line-clamp-2 leading-relaxed">{course.description}</p>
                          
                          <div className="space-y-2 pt-2">
                            <div className="flex items-center gap-2 text-xs text-stone-600 uppercase tracking-wider">
                              <Calendar size={14} className="text-stone-400" />
                              <span>{new Date(course.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-stone-600 uppercase tracking-wider">
                              <Clock size={14} className="text-stone-400" />
                              <span>{new Date(course.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-stone-600 uppercase tracking-wider">
                              <MapPin size={14} className="text-stone-400" />
                              <span>{course.location}</span>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-stone-50 flex items-center justify-between">
                            <div>
                              <span className="text-[10px] text-stone-400 uppercase tracking-widest block mb-1">Inversión</span>
                              <span className="text-xl font-serif text-stone-900">{formatCurrency(course.price)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-stone-400 uppercase tracking-widest block mb-1">Cupos</span>
                              <span className={`text-sm font-medium ${course.maxQuota - course.enrolledCount <= 3 ? 'text-red-600' : 'text-stone-600'}`}>
                                {course.enrolledCount >= course.maxQuota 
                                  ? 'Sin lugares' 
                                  : `Quedan ${course.maxQuota - course.enrolledCount} lugares`}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleEnrollCourse(course)}
                            disabled={course.enrolledCount >= course.maxQuota}
                            className={`w-full py-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${
                              course.enrolledCount >= course.maxQuota
                                ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                                : 'bg-stone-900 text-white hover:bg-stone-800 shadow-sm'
                            }`}
                          >
                            {course.enrolledCount >= course.maxQuota ? 'AGOTADO' : 'INSCRIBIRME AL WORKSHOP'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
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

        {/* Newsletter Section */}
        <section className="bg-stone-900 text-stone-50 py-20 px-6 mt-20">
          <div className="max-w-2xl mx-auto text-center">
            <Mail size={24} className="mx-auto mb-6 text-stone-400" strokeWidth={1.5} />
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Únete a nuestro universo</h2>
            <p className="text-stone-400 text-sm md:text-base leading-relaxed mb-8">
              Déjanos tu email y sé la primera en enterarte sobre nuevos aromas, ediciones limitadas y fechas de nuestros próximos workshops.
            </p>
            
            {subscribed ? (
              <div className="bg-stone-800/50 border border-stone-700 p-6 animate-in fade-in zoom-in duration-300">
                <p className="text-[#C5D92D] font-bold tracking-widest uppercase text-xs">
                  ¡Gracias por unirte! Revisa tu bandeja de entrada pronto.
                </p>
              </div>
            ) : (
              <form 
                className="flex flex-col sm:flex-row gap-2 mt-8"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const emailInput = form.elements.namedItem('email') as HTMLInputElement;
                  if (emailInput && emailInput.value && onAddSubscriber) {
                    await onAddSubscriber(emailInput.value);
                  }
                  setSubscribed(true);
                }}
              >
                <input 
                  type="email" 
                  name="email"
                  required
                  placeholder="Tu correo electrónico" 
                  className="flex-1 bg-stone-800 border-none text-white placeholder:text-stone-500 px-6 py-4 rounded-none focus:ring-1 focus:ring-[#C5D92D] outline-none transition-all"
                />
                <button 
                  type="submit"
                  className="bg-[#C5D92D] text-stone-900 font-bold uppercase tracking-widest px-8 py-4 hover:bg-[#b5c928] transition-colors"
                >
                  Suscribirme
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* Footer Boutique */}
      <footer className="bg-stone-50 py-16 mt-20 border-t border-stone-100">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex flex-col items-center justify-center mb-8">
            <h2 className="text-3xl font-cinzel font-bold text-stone-900 tracking-tight">JANLU</h2>
            <p className="text-[10px] uppercase tracking-[0.3em] text-stone-400 mt-1">Aromas & Diseño</p>
          </div>
          
          <div className="flex justify-center space-x-8 mb-8">
            {storeSettings?.email && (
              <a href={`mailto:${storeSettings.email}`} className="text-stone-400 hover:text-stone-900 transition-colors">
                <Mail size={20} />
              </a>
            )}
            {storeSettings?.instagramUrl && (
              <a href={getSocialLink('instagram', storeSettings.instagramUrl)} target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-stone-900 transition-colors">
                <Instagram size={20} />
              </a>
            )}
            {storeSettings?.facebookUrl && (
              <a href={getSocialLink('facebook', storeSettings.facebookUrl)} target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-stone-900 transition-colors">
                <Facebook size={20} />
              </a>
            )}
            {storeSettings?.tiktokUrl && (
              <a href={getSocialLink('tiktok', storeSettings.tiktokUrl)} target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-stone-900 transition-colors">
                <Music2 size={20} />
              </a>
            )}
          </div>

          <p className="text-xs text-stone-400 uppercase tracking-widest">
            &copy; {new Date().getFullYear()} JANLU Aromas & Diseño. Todos los derechos reservados.
          </p>
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

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[120] flex justify-end">
          <div className="bg-white w-full max-w-md h-[100dvh] shadow-2xl flex flex-col animate-in slide-in-from-right">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <h2 className="text-xl font-serif font-medium text-stone-900 flex items-center">
                {checkoutStep === 'cart' && <><ShoppingCart className="mr-2 text-rose-500" /> Mi Pedido</>}
                {checkoutStep === 'details' && <><ShoppingCart className="mr-2 text-rose-500" /> Mis Datos</>}
                {checkoutStep === 'success' && <><CheckCircle className="mr-2 text-emerald-500" /> ¡Pedido Exitoso!</>}
              </h2>
              <button 
                onClick={() => {
                  setIsCartOpen(false);
                  if (checkoutStep === 'success') {
                    setCheckoutStep('cart');
                  }
                  setGeneratedCoupon(null);
                }}
                className="p-2 text-stone-400 hover:text-stone-600 bg-stone-50 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              {checkoutStep === 'cart' && (
                cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-stone-400">
                    <ShoppingBag size={48} className="mb-4 opacity-20" />
                    <p>Tu carrito está vacío</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {cart.map((item) => (
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
                                className="text-xs text-stone-500 border-none p-0 focus:ring-0 w-full"
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
                            <div className="flex items-center space-x-2 bg-stone-50 rounded-lg p-1 border border-stone-200">
                              <button 
                                onClick={() => updateCartQuantity(item.product?.id, item.variant?.id, item.quantity - 1, item.course?.id)}
                                className="w-6 h-6 flex items-center justify-center rounded bg-white text-stone-600 shadow-sm hover:text-rose-600"
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
                                className="w-10 text-center text-sm font-medium text-stone-900 bg-transparent border-none focus:ring-0 p-0"
                              />
                              <button 
                                onClick={() => updateCartQuantity(item.product?.id, item.variant?.id, item.quantity + 1, item.course?.id)}
                                className="w-6 h-6 flex items-center justify-center rounded bg-white text-stone-600 shadow-sm hover:text-rose-600"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-stone-400 mb-0.5">Subtotal</p>
                              <p className="font-bold text-emerald-600">
                                {item.course 
                                  ? formatCurrency(item.course.price * item.quantity)
                                  : item.product && item.variant ? formatCurrency(getEffectivePrice(item.product, item.variant, item.quantity) * item.quantity) : ''}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 pt-6 border-t border-stone-100">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                          <input
                            type="text"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            placeholder="¿Tienes un cupón?"
                            className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                          />
                        </div>
                        <button
                          onClick={handleApplyCoupon}
                          disabled={isValidatingCoupon || !couponCode.trim()}
                          className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-900 transition-colors disabled:opacity-50"
                        >
                          {isValidatingCoupon ? <Loader2 size={16} className="animate-spin" /> : 'Aplicar'}
                        </button>
                      </div>
                      {appliedCoupon && (
                        <div className="mt-2 flex items-center justify-between p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                          <div className="flex items-center gap-2 text-emerald-700 text-xs font-medium">
                            <CheckCircle size={14} />
                            <span>Cupón aplicado: {appliedCoupon.code}</span>
                          </div>
                          <button 
                            onClick={() => setAppliedCoupon(null)}
                            className="text-emerald-700 hover:text-rose-500"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}

              {checkoutStep === 'details' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">Nombre de contacto *</label>
                    <input
                      type="text"
                      value={customerDetails.name}
                      onChange={(e) => setCustomerDetails(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                      placeholder="Ej. Juan Pérez"
                    />
                  </div>

                  {!currentUser && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="block text-sm font-medium text-stone-700 mb-1">Número de Teléfono / WhatsApp *</label>
                      <input
                        type="tel"
                        value={customerDetails.phone}
                        onChange={(e) => setCustomerDetails(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        placeholder="Ej. +54 9 11 1234 5678"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-3">Método de Entrega *</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setDeliveryMethod('retiro')}
                        className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                          deliveryMethod === 'retiro' 
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                            : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        <ShoppingBag size={24} />
                        <span className="text-sm font-medium text-center">Retiro por el taller</span>
                      </button>
                      <button
                        onClick={() => setDeliveryMethod('envio')}
                        className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                          deliveryMethod === 'envio' 
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                            : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        <Package size={24} />
                        <span className="text-sm font-medium text-center">Envío</span>
                      </button>
                    </div>
                    {deliveryMethod === 'retiro' && storeSettings?.workshopAddress && (
                      <div className="mt-3 p-3 bg-stone-50 border border-stone-200 rounded-lg animate-in fade-in slide-in-from-top-1 duration-300">
                        <p className="text-xs text-stone-500 font-medium uppercase mb-1">Dirección de retiro:</p>
                        <p className="text-sm text-stone-800">{storeSettings.workshopAddress}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-3">Forma de Pago preferida *</label>
                    <div className="grid grid-cols-1 gap-3">
                      <button
                        onClick={() => setPaymentMethod('transferencia')}
                        className={`p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                          paymentMethod === 'transferencia' 
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                            : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethod === 'transferencia' ? 'bg-indigo-600 text-white' : 'bg-stone-100 text-stone-400'}`}>
                          <ArrowRightLeft size={20} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold">Transferencia o Depósito</p>
                          <p className="text-xs opacity-80">
                            Pago mediante transferencia bancaria
                          </p>
                        </div>
                      </button>

                      <button
                        onClick={() => setPaymentMethod('efectivo')}
                        className={`p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                          paymentMethod === 'efectivo' 
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                            : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethod === 'efectivo' ? 'bg-indigo-600 text-white' : 'bg-stone-100 text-stone-400'}`}>
                          <ShoppingCart size={20} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold">Efectivo</p>
                          <p className="text-xs opacity-80">
                            {storeSettings?.cashDiscountPercentage 
                              ? `Obtén un ${storeSettings.cashDiscountPercentage}% OFF pagando en billete físico` 
                              : 'Pago al momento de la entrega/retiro'}
                          </p>
                        </div>
                      </button>

                      <button
                        onClick={() => setPaymentMethod('acordar')}
                        className={`p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                          paymentMethod === 'acordar' 
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                            : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethod === 'acordar' ? 'bg-indigo-600 text-white' : 'bg-stone-100 text-stone-400'}`}>
                          <Phone size={20} />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold">Acordar con el vendedor</p>
                          <p className="text-xs opacity-80">Nos comunicaremos para coordinar</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {deliveryMethod === 'envio' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="block text-sm font-medium text-stone-700 mb-1">Email *</label>
                      <input
                        type="email"
                        value={customerDetails.email}
                        onChange={(e) => setCustomerDetails(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        placeholder="Ej. juan@email.com"
                      />
                    </div>
                  )}

                  {/* Banner de Registro */}
                  <div className="mt-8 border-t border-stone-100 pt-6">
                    <div className={`p-5 rounded-2xl border-2 transition-all duration-300 ${
                      isRegistering 
                        ? 'border-indigo-200 bg-indigo-50/30' 
                        : 'border-amber-100 bg-amber-50/50 hover:border-amber-200'
                    }`}>
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0 text-amber-500">
                          <Gift size={24} />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-stone-900 font-bold text-lg leading-tight">
                            ¡Regístrate y obtén un descuento especial!
                          </h4>
                          <p className="text-stone-600 text-sm mt-1">
                            Únete a nuestra comunidad y recibe un cupón exclusivo para tu próxima compra.
                          </p>
                          
                          <button
                            onClick={() => setIsRegistering(!isRegistering)}
                            className="mt-4 flex items-center gap-2 text-indigo-600 font-bold text-sm hover:text-indigo-700 transition-colors"
                          >
                            <div className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${isRegistering ? 'bg-indigo-600' : 'bg-stone-300'}`}>
                              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-200 ${isRegistering ? 'left-6' : 'left-1'}`} />
                            </div>
                            {isRegistering ? 'Sí, quiero registrarme' : 'Quiero registrarme'}
                          </button>
                        </div>
                      </div>

                      {isRegistering && (
                        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                          <div className="sm:col-span-1">
                            <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Nombre *</label>
                            <input
                              type="text"
                              value={registrationData.firstName}
                              onChange={(e) => setRegistrationData(prev => ({ ...prev, firstName: e.target.value }))}
                              className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                              placeholder="Tu nombre"
                            />
                          </div>
                          <div className="sm:col-span-1">
                            <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Apellido *</label>
                            <input
                              type="text"
                              value={registrationData.lastName}
                              onChange={(e) => setRegistrationData(prev => ({ ...prev, lastName: e.target.value }))}
                              className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                              placeholder="Tu apellido"
                            />
                          </div>
                          <div className="sm:col-span-1">
                            <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Teléfono *</label>
                            <input
                              type="tel"
                              value={registrationData.phone}
                              onChange={(e) => setRegistrationData(prev => ({ ...prev, phone: e.target.value }))}
                              className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                              placeholder="Ej. +54 9 11 ..."
                            />
                          </div>
                          <div className="sm:col-span-1">
                            <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Email *</label>
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
                              className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                              placeholder="tu@email.com"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Fecha de Nacimiento *</label>
                            <input
                              type="date"
                              value={registrationData.birthDate}
                              onChange={(e) => setRegistrationData(prev => ({ ...prev, birthDate: e.target.value }))}
                              className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {checkoutError && (
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-lg text-sm flex items-start gap-2">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      <p>{checkoutError}</p>
                    </div>
                  )}
                </div>
              )}

              {checkoutStep === 'success' && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
                    <CheckCircle size={40} />
                  </div>
                  <h3 className="text-2xl font-serif font-medium text-stone-900">¡Pedido Recibido!</h3>
                  <p className="text-stone-600 max-w-sm mb-4">
                    Gracias por tu compra. Hemos recibido tu pedido y nos pondremos en contacto contigo pronto por WhatsApp.
                  </p>

                  {generatedCoupon && (
                    <div className="bg-stone-900 text-white p-6 rounded-2xl shadow-xl shadow-stone-900/20 w-full max-w-sm animate-in zoom-in-95 duration-500">
                      <div className="flex justify-center mb-2 text-amber-400">
                        <Gift size={28} />
                      </div>
                      <p className="text-[10px] uppercase tracking-widest font-bold opacity-80 mb-1">Tu regalo de bienvenida</p>
                      <p className="text-sm mb-4">Guarda este código para tu próxima compra:</p>
                      
                      <div className="bg-white/10 border border-white/20 p-4 rounded-xl flex items-center justify-between mb-4">
                        <span className="font-mono text-2xl font-bold tracking-widest text-amber-400">{generatedCoupon.code}</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(generatedCoupon.code);
                            alert('¡Código copiado!');
                          }}
                          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                          title="Copiar código"
                        >
                          <Copy size={18} />
                        </button>
                      </div>
                      
                      <p className="text-[10px] text-stone-400 uppercase tracking-widest flex items-center justify-center gap-1">
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
                    className="mt-8 px-6 py-3 bg-stone-100 text-stone-900 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-stone-200 transition-colors"
                  >
                    Volver al catálogo
                  </button>
                </div>
              )}
            </div>

            {cart.length > 0 && checkoutStep !== 'success' && (
              <div className="p-6 border-t border-stone-100 bg-stone-50 shrink-0">
                <div className="space-y-2 mb-6">
                  <div className="flex items-center justify-between text-stone-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>
                  {appliedCoupon && (
                    <div className="flex items-center justify-between text-emerald-600 font-medium">
                      <div className="flex items-center gap-1">
                        <Tag size={14} />
                        <span>Descuento Cupón ({appliedCoupon.code})</span>
                      </div>
                      <span>-{formatCurrency(cartTotal - finalTotal)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-stone-200">
                    <span className="text-stone-900 font-bold">Total</span>
                    <span className="text-2xl font-bold text-stone-900">
                      {formatCurrency(finalTotal)}
                    </span>
                  </div>
                </div>
                
                {checkoutStep === 'cart' && (
                  <button
                    disabled={hasExceededStock}
                    onClick={() => setCheckoutStep('details')}
                    className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {hasExceededStock ? 'Modifica las cantidades' : 'Continuar para Enviar'}
                    {!hasExceededStock && <ChevronRight size={18} />}
                  </button>
                )}

                {checkoutStep === 'details' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setCheckoutStep('cart')}
                      className="px-4 py-4 bg-white text-stone-600 border border-stone-200 rounded-xl font-medium hover:bg-stone-50 transition-colors"
                    >
                      Volver
                    </button>
                    <button
                      onClick={submitOrder}
                      disabled={isSubmitting}
                      className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          Enviar Pedido por WhatsApp
                          <ShoppingBag size={18} />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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

