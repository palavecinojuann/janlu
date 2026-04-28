import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Product, Customer, Sale, SaleItem, PaymentMethod, SaleStatus, Offer, Variant, Campaign, RawMaterial, StoreSettings, Course } from '../types';
import { Plus, Trash2, ShoppingBag, Tag, ScanBarcode } from 'lucide-react';
import { getVariantStock } from '../utils/stockUtils';
import BarcodeScanner from './BarcodeScanner';

interface SaleFormProps {
  products: Product[];
  rawMaterials: RawMaterial[];
  customers: Customer[];
  offers?: Offer[];
  campaigns?: Campaign[];
  storeSettings?: StoreSettings;
  courses?: Course[];
  onSave: (sale: Omit<Sale, 'id' | 'date'>) => void;
  onCancel: () => void;
  onValidateCoupon?: (code: string, customerEmail?: string) => Promise<{ valid: boolean; discount?: number; error?: string }>;
}

export default function SaleForm({ products, rawMaterials, customers, offers = [], campaigns = [], storeSettings, courses = [], onSave, onCancel, onValidateCoupon }: SaleFormProps) {
  const [customerId, setCustomerId] = useState<string>('');
  const [customCustomerName, setCustomCustomerName] = useState<string>('');
  
  const [items, setItems] = useState<SaleItem[]>([]);
  
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [itemType, setItemType] = useState<'product' | 'course'>('product');

  const [appliedCouponCode, setAppliedCouponCode] = useState<string>('');
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [couponError, setCouponError] = useState<string>('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const [paymentPercentage, setPaymentPercentage] = useState<string>('100');
  const [amountPaid, setAmountPaid] = useState<string>('0');
  const [paymentMode, setPaymentMode] = useState<'percentage' | 'amount'>('percentage');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [status, setStatus] = useState<SaleStatus>('entregado');
  const [deliveryDate, setDeliveryDate] = useState<string>('');

  const [packagingCost, setPackagingCost] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [laborCost, setLaborCost] = useState<number>(0);
  const [paymentGatewayFee, setPaymentGatewayFee] = useState<number>(0);
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [cashGiven, setCashGiven] = useState<string>('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

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

  const activeCampaign = useMemo(() => {
    if (!Array.isArray(campaigns)) return null;
    return campaigns.find(c => c.isActive && new Date(c.expiresAt) > new Date());
  }, [campaigns]);

  const selectedCustomer = useMemo(() => customers.find(c => c.id === customerId), [customers, customerId]);

  const getEffectivePrice = (product: Product, variant: Variant, qty: number = 1) => {
    const productOffers = activeOffers.filter(offer => offer.productIds?.includes(product.id));
    
    // 0. Check for customer-specific assigned offers
    if (selectedCustomer?.assignedOffers) {
      const assignedOffer = selectedCustomer.assignedOffers.find(ao => ao.isActive && ao.offerId && productOffers.some(po => po.id === ao.offerId));
      if (assignedOffer) {
        const fullOffer = offers.find(o => o.id === assignedOffer.offerId);
        if (fullOffer && fullOffer.type === 'discount' && fullOffer.discountPercentage) {
          return variant.price * (1 - fullOffer.discountPercentage / 100);
        }
      }
    }

    // 1. Check for product-specific discount offers
    const discountOffer = productOffers.find(o => o.type === 'discount' && o.discountPercentage);
    if (discountOffer && discountOffer.discountPercentage) {
      return variant.price * (1 - discountOffer.discountPercentage / 100);
    }

    // 2. Check for product-specific combo offers (fixed price for single product)
    const comboOffer = productOffers.find(o => o.type === 'combo' && o.fixedPrice && o.productIds.length === 1);
    if (comboOffer && comboOffer.fixedPrice) {
      return comboOffer.fixedPrice;
    }

    // 3. Check for BOGO (2x1) - If quantity >= 2, apply 50% discount to the unit price for that quantity
    const bogoOffer = productOffers.find(o => o.type === 'bogo');
    if (bogoOffer && qty >= 2) {
      const paidQuantity = qty - Math.floor(qty / 2);
      return (variant.price * paidQuantity) / qty;
    }

    // 4. Check for global campaign discount
    if (activeCampaign && activeCampaign.discount) {
      return variant.price * (1 - activeCampaign.discount / 100);
    }

    return variant.price;
  };

  const selectedProduct = useMemo(() => products.find(p => p.id === selectedProductId), [products, selectedProductId]);
  const selectedVariant = useMemo(() => selectedProduct?.variants.find(v => v.id === selectedVariantId), [selectedProduct, selectedVariantId]);

  const effectivePrice = useMemo(() => {
    if (!selectedProduct || !selectedVariant) return 0;
    return getEffectivePrice(selectedProduct, selectedVariant, quantity);
  }, [selectedProduct, selectedVariant, quantity, activeOffers, activeCampaign]);

  const stackingPolicy = storeSettings?.discountStackingPolicy || 'stack';

  const totalAmount = useMemo(() => {
    const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    
    if (couponDiscount <= 0) return Number(subtotal.toFixed(2));

    if (stackingPolicy === 'best_offer') {
      // For each item, take the best discount between its current price (which might have offers) 
      // and the original price with the coupon applied
      const bestTotal = items.reduce((acc, item) => {
        const product = products.find(p => p.id === item.productId);
        const variant = product?.variants.find(v => v.id === item.variantId);
        if (!variant) return acc + (item.price * item.quantity);

        const originalPrice = variant.price;
        const currentPrice = item.price; // This already has automatic offers applied via getEffectivePrice when added
        const couponPrice = originalPrice * (1 - couponDiscount / 100);
        
        const bestPrice = Math.min(currentPrice, couponPrice);
        return acc + (bestPrice * item.quantity);
      }, 0);
      return Number(bestTotal.toFixed(2));
    } else {
      // Stacking: apply coupon to the already discounted subtotal
      const finalAmount = subtotal * (1 - couponDiscount / 100);
      return Number(finalAmount.toFixed(2));
    }
  }, [items, couponDiscount, stackingPolicy, products]);

  const handleValidateCoupon = async () => {
    if (!appliedCouponCode || !onValidateCoupon) return;
    
    setIsValidatingCoupon(true);
    setCouponError('');
    try {
      const result = await onValidateCoupon(appliedCouponCode, selectedCustomer?.email);
      if (result.valid) {
        setCouponDiscount(result.discount || 0);
        setCouponError('');
      } else {
        setCouponDiscount(0);
        setCouponError(result.error || 'Cupón inválido');
      }
    } catch (error) {
      setCouponError('Error al validar cupón');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handlePaymentPercentageChange = (val: string) => {
    setPaymentPercentage(val);
    const numVal = parseFloat(val) || 0;
    const calculatedAmount = Number(((totalAmount * numVal) / 100).toFixed(2));
    setAmountPaid(calculatedAmount.toString());
  };

  const handleAmountPaidChange = (val: string) => {
    setAmountPaid(val);
    const numVal = parseFloat(val) || 0;
    const calculatedPercentage = totalAmount > 0 ? Number(((numVal / totalAmount) * 100).toFixed(2)) : 100;
    setPaymentPercentage(calculatedPercentage.toString());
  };
  
  const handleScanSuccess = (scannedCode: string) => {
    setIsScannerOpen(false); // Cerramos la cámara al leer el código

    let foundProduct = null;
    let foundVariant = null;

    // Buscamos a qué producto y variante corresponde el código QR
    for (const product of products) {
      const variant = product.variants.find(v => v.sku === scannedCode || v.id === scannedCode);
      if (variant) {
        foundProduct = product;
        foundVariant = variant;
        break;
      }
    }

    if (foundProduct && foundVariant) {
      const price = getEffectivePrice(foundProduct, foundVariant);
      // Creamos el ítem para sumar a la cuenta
      const newItem: SaleItem = {
        id: uuidv4(),
        productId: foundProduct.id,
        variantId: foundVariant.id,
        productName: foundProduct.name,
        variantName: foundVariant.name,
        quantity: 1,
        price: price,
        total: price
      };

      // Lo inyectamos en el estado de la venta (si ya existe, sumamos 1 a la cantidad)
      setItems(prev => {
        const existingItemIndex = prev.findIndex(i => i.productId === newItem.productId && i.variantId === newItem.variantId);
        if (existingItemIndex >= 0) {
          const newItems = [...prev];
          newItems[existingItemIndex].quantity += 1;
          newItems[existingItemIndex].total = newItems[existingItemIndex].quantity * newItems[existingItemIndex].price;
          return newItems;
        }
        return [...prev, newItem];
      });
      
      // Micro-vibración para confirmar lectura si se usa en celular
      if (navigator.vibrate) navigator.vibrate(100);
    } else {
      alert('Código no reconocido: ' + scannedCode);
    }
  };

  const handleAddItem = () => {
    if (itemType === 'course') {
      const course = courses.find(c => c.id === selectedCourseId);
      if (!course) return;
      if (course.enrolledCount >= course.maxQuota) {
        alert('Cupo insuficiente para este curso.');
        return;
      }
      const newItem: SaleItem = {
        id: uuidv4(),
        productName: course.title,
        variantName: 'Inscripción',
        quantity: 1,
        price: course.price,
        total: course.price,
        isCourse: true,
        courseId: course.id
      };
      setItems(prev => [...prev, newItem]);
      setSelectedCourseId('');
      return;
    }

    if (!selectedProduct || !selectedVariant || quantity <= 0) return;
    
    // Check stock
    if (quantity > selectedVariant.stock) {
      alert(`Stock insuficiente. Solo hay ${selectedVariant.stock} disponibles.`);
      return;
    }

    const newItem: SaleItem = {
      id: uuidv4(),
      productId: selectedProduct.id,
      variantId: selectedVariant.id,
      productName: selectedProduct.name,
      variantName: selectedVariant.name,
      quantity,
      price: effectivePrice,
      total: effectivePrice * quantity
    };

    setItems(prev => [...prev, newItem]);
    setSelectedProductId('');
    setSelectedVariantId('');
    setQuantity(1);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Agrega al menos un producto a la venta.');
      return;
    }

    let finalCustomerName = 'Consumidor Final';
    if (customerId) {
      const c = customers.find(c => c.id === customerId);
      if (c) finalCustomerName = c.name;
    } else if (customCustomerName) {
      finalCustomerName = customCustomerName;
    }

    const pPercentage = parseFloat(paymentPercentage) || 0;
    let paymentStatus: Sale['paymentStatus'] = 'pending';
    if (pPercentage >= 100) paymentStatus = 'verified';
    else if (pPercentage > 0) paymentStatus = 'partial_paid';
    else if (paymentMethod === 'on_pickup') paymentStatus = 'pending_at_pickup';

    onSave({
      customerId: customerId || 'guest',
      customerName: finalCustomerName,
      items,
      totalAmount,
      amountPaid: parseFloat(amountPaid) || 0,
      paymentPercentage: pPercentage,
      paymentMethod,
      paymentStatus,
      status,
      deliveryDate: deliveryDate || undefined,
      packagingCost,
      shippingCost,
      laborCost,
      paymentGatewayFee,
      paymentNotes,
      appliedCouponCode: appliedCouponCode || undefined,
      discount: couponDiscount || undefined
    });
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('es-AR', { 
    style: 'currency', 
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);

  return (
    <div className="flex-1 overflow-y-auto min-h-0 max-w-4xl mx-auto w-full space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Registrar Venta</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Selection */}
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800">
          <h3 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-4">Cliente</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Seleccionar Cliente Registrado</label>
              <select
                value={customerId}
                onChange={e => { setCustomerId(e.target.value); setCustomCustomerName(''); }}
                className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              >
                <option value="">-- Consumidor Final / Nuevo --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {!customerId && (
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">O ingresar nombre (opcional)</label>
                <input
                  type="text"
                  value={customCustomerName}
                  onChange={e => setCustomCustomerName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600"
                />
              </div>
            )}
          </div>
        </div>

        {/* Add Items */}
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-stone-800 dark:text-stone-100">Items de la Venta</h3>
            <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setItemType('product')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${itemType === 'product' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
              >
                Productos
              </button>
              <button
                type="button"
                onClick={() => setItemType('course')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${itemType === 'course' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
              >
                Workshops
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-6 bg-stone-50 dark:bg-stone-800/50 p-4 rounded-xl border border-stone-200 dark:border-stone-700">
            {itemType === 'product' ? (
              <>
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 uppercase">Producto</label>
                  <select
                    value={selectedProductId}
                    onChange={e => { setSelectedProductId(e.target.value); setSelectedVariantId(''); }}
                    className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                  >
                    <option value="">Seleccionar...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 uppercase">Variante</label>
                  <select
                    value={selectedVariantId}
                    onChange={e => setSelectedVariantId(e.target.value)}
                    disabled={!selectedProductId}
                    className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm disabled:opacity-50 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                  >
                    <option value="">Seleccionar...</option>
                    {selectedProduct?.variants.map(v => {
                      const currentEffectivePrice = getEffectivePrice(selectedProduct, v);
                      const hasOffer = currentEffectivePrice < v.price;
                      const currentStock = getVariantStock(v, rawMaterials);
                      return (
                        <option key={v.id} value={v.id} disabled={currentStock <= 0}>
                          {v.name} ({currentStock} disp.) - {formatCurrency(currentEffectivePrice)} {hasOffer ? `(Oferta: ${formatCurrency(v.price)})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 uppercase">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedVariant?.stock || 1}
                    step="any"
                    value={quantity}
                    onChange={e => setQuantity(parseFloat(e.target.value) || 1)}
                    onFocus={(e) => e.target.select()}
                    disabled={!selectedVariantId}
                    className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm disabled:opacity-50 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </>
            ) : (
              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 uppercase">Workshop / Curso</label>
                <select
                  value={selectedCourseId}
                  onChange={e => setSelectedCourseId(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                >
                  <option value="">Seleccionar Workshop...</option>
                  {courses.filter(c => c.isActive).map(c => (
                    <option key={c.id} value={c.id} disabled={c.enrolledCount >= c.maxQuota}>
                      {c.title} ({c.maxQuota - c.enrolledCount} cupos) - {formatCurrency(c.price)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="md:col-span-1 flex gap-2">
              <button
                type="button"
                onClick={handleAddItem}
                disabled={itemType === 'product' ? (!selectedVariantId || quantity <= 0) : !selectedCourseId}
                className="flex-1 flex items-center justify-center px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                <Plus size={16} className="mr-1" /> Agregar
              </button>
              {itemType === 'product' && (
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="flex items-center justify-center px-4 py-2 bg-stone-900 dark:bg-indigo-600 text-white rounded-lg hover:bg-stone-800 dark:hover:bg-indigo-700 transition-colors text-sm font-medium"
                  title="Escanear QR"
                >
                  <ScanBarcode size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Items List */}
          {items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">
                    <th className="pb-2 font-medium">Producto</th>
                    <th className="pb-2 font-medium text-center">Cant.</th>
                    <th className="pb-2 font-medium text-right">Precio Unit.</th>
                    <th className="pb-2 font-medium text-right">Subtotal</th>
                    <th className="pb-2 font-medium text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 text-sm text-stone-900 dark:text-stone-100">
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-xs text-stone-500 dark:text-stone-400">{item.variantName}</div>
                      </td>
                      <td className="py-3 text-sm text-stone-900 dark:text-stone-100 text-center">{item.quantity}</td>
                      <td className="py-3 text-sm text-stone-900 dark:text-stone-100 text-right">{formatCurrency(item.price)}</td>
                      <td className="py-3 text-sm font-medium text-stone-900 dark:text-stone-100 text-right">{formatCurrency(item.price * item.quantity)}</td>
                      <td className="py-3 text-right">
                        <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 p-1"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {couponDiscount > 0 && (
                    <tr className="border-t border-stone-100 dark:border-stone-800">
                      <td colSpan={3} className="py-2 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                        Descuento ({couponDiscount}%):
                      </td>
                      <td className="py-2 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                        -{formatCurrency(items.reduce((acc, item) => acc + (item.price * item.quantity), 0) * (couponDiscount / 100))}
                      </td>
                      <td></td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-stone-200 dark:border-stone-700">
                    <td colSpan={3} className="py-4 text-right font-bold text-stone-800 dark:text-stone-200">Total:</td>
                    <td className="py-4 text-right font-bold text-indigo-600 dark:text-indigo-400 text-lg">{formatCurrency(totalAmount)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-stone-500 dark:text-stone-400 text-sm border-2 border-dashed border-stone-200 dark:border-stone-700 rounded-xl">
              <ShoppingBag className="mx-auto h-8 w-8 text-stone-300 dark:text-stone-600 mb-2" />
              No hay productos en la venta.
            </div>
          )}
        </div>

        {/* Coupon Section */}
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800">
          <h3 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2">
            <Tag size={20} className="text-indigo-500" />
            Cupón de Descuento
          </h3>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Código de Cupón / N° Cliente</label>
              <input
                type="text"
                value={appliedCouponCode}
                onChange={e => setAppliedCouponCode(e.target.value.toUpperCase())}
                placeholder="Ej: BIENVENIDA o N° Cliente"
                className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
            <button
              type="button"
              onClick={handleValidateCoupon}
              disabled={isValidatingCoupon || !appliedCouponCode}
              className="px-6 py-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              {isValidatingCoupon ? 'Validando...' : 'Aplicar'}
            </button>
          </div>
          {couponError && <p className="mt-2 text-sm text-rose-500">{couponError}</p>}
          {couponDiscount > 0 && <p className="mt-2 text-sm text-emerald-600 font-medium">¡Cupón aplicado! {couponDiscount}% de descuento.</p>}
        </div>

        {/* Payment Details */}
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800">
          <h3 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-4">Estado y Detalles de Pago</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Estado del Pedido</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as SaleStatus)}
                className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              >
                <option value="nuevo">Nuevo / Verificar Pago</option>
                <option value="en_preparacion">En Preparación</option>
                <option value="listo_para_entregar">Listo para Entregar</option>
                <option value="entregado">Entregado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Fecha Estimada Entrega</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Método de Pago</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('efectivo')}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${
                    paymentMethod === 'efectivo' 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400' 
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50 dark:bg-stone-900 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800'
                  }`}
                >
                  Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('transferencia')}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${
                    paymentMethod === 'transferencia' 
                      ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400' 
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50 dark:bg-stone-900 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800'
                  }`}
                >
                  Transferencia
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('qr')}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${
                    paymentMethod === 'qr' 
                      ? 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-900/30 dark:border-sky-800 dark:text-sky-400' 
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50 dark:bg-stone-900 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800'
                  }`}
                >
                  QR / MP
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('mixto')}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${
                    paymentMethod === 'mixto' 
                      ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-400' 
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50 dark:bg-stone-900 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800'
                  }`}
                >
                  Mixto
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('tarjeta')}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${
                    paymentMethod === 'tarjeta' 
                      ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-400' 
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50 dark:bg-stone-900 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800'
                  }`}
                >
                  Tarjeta
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('on_pickup')}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors border ${
                    paymentMethod === 'on_pickup' 
                      ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400' 
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50 dark:bg-stone-900 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-800'
                  }`}
                >
                  Al retirar
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Porcentaje Pagado (%)</label>
              <input
                type="text"
                inputMode="decimal"
                value={paymentPercentage}
                onChange={e => {
                  setPaymentMode('percentage');
                  const val = e.target.value.replace(',', '.');
                  // Allow empty string or valid number
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    handlePaymentPercentageChange(val);
                  }
                }}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Monto Pagado ($)</label>
              <input
                type="text"
                inputMode="decimal"
                value={amountPaid}
                onChange={e => {
                  setPaymentMode('amount');
                  const val = e.target.value.replace(',', '.');
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    handleAmountPaidChange(val);
                  }
                }}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Notas de Pago (Opcional)</label>
            <textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Ej: 50% Transferencia, 50% Efectivo"
              className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 resize-none h-20"
            />
          </div>

          {paymentMethod === 'efectivo' && (
            <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-1">Paga con billete de:</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-500">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Ej: 10000"
                      value={cashGiven}
                      onChange={(e) => {
                        const val = e.target.value.replace(',', '.');
                        if (val === '' || /^\d*\.?\d*$/.test(val)) {
                          setCashGiven(val);
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      className="w-full pl-8 pr-3 py-2 border border-emerald-200 dark:border-emerald-700/50 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                    />
                  </div>
                </div>
                <div className="flex-1 text-right">
                  <span className="block text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-1">Vuelto a entregar:</span>
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {parseFloat(cashGiven) >= (parseFloat(amountPaid) || 0) 
                      ? formatCurrency(parseFloat(cashGiven) - (parseFloat(amountPaid) || 0)) 
                      : '$ 0,00'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl flex justify-between items-center border border-stone-100 dark:border-stone-700">
            <span className="text-sm font-medium text-stone-600 dark:text-stone-400">Saldo Pendiente:</span>
            <span className="text-lg font-bold text-amber-600 dark:text-amber-500">{formatCurrency(Math.max(0, totalAmount - amountPaid))}</span>
          </div>
        </div>

        {/* Additional Costs */}
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800">
          <h3 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-4">Costos Adicionales (Opcional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Packaging ($)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={packagingCost}
                onChange={e => setPackagingCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-600"
                placeholder="Cajas, papel..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Envío ($)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={shippingCost}
                onChange={e => setShippingCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Mano de Obra ($)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={laborCost}
                onChange={e => setLaborCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Comisión Pasarela ($)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={paymentGatewayFee}
                onChange={e => setPaymentGatewayFee(e.target.value === '' ? '' : parseFloat(e.target.value))}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button type="button" onClick={onCancel} className="px-6 py-2.5 border border-stone-300 dark:border-stone-700 rounded-xl text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">Cancelar</button>
          <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">Confirmar Venta</button>
        </div>
      </form>

      {isScannerOpen && (
        <BarcodeScanner
          onScan={handleScanSuccess}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </div>
  );
}
