import React, { useState, useMemo } from 'react';
import { Product, Customer, Quote, QuoteItem, PriceModifier, Offer, Variant, Campaign, StoreSettings } from '../types';
import { Plus, Trash2, ShoppingBag, Tag } from 'lucide-react';

interface QuoteFormProps {
  products: Product[];
  customers: Customer[];
  offers?: Offer[];
  campaigns?: Campaign[];
  storeSettings?: StoreSettings;
  onSave: (quote: Omit<Quote, 'id' | 'date'>) => void;
  onCancel: () => void;
}

export default function QuoteForm({ products, customers, offers = [], campaigns = [], storeSettings, onSave, onCancel }: QuoteFormProps) {
  const [customerId, setCustomerId] = useState<string>('');
  const [customCustomerName, setCustomCustomerName] = useState<string>('');
  const [validUntilDays, setValidUntilDays] = useState<number>(15);
  
  const [items, setItems] = useState<QuoteItem[]>([]);
  
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [quantity, setQuantity] = useState<number>(1);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') return products;
    return products.filter(p => p.category === selectedCategory);
  }, [products, selectedCategory]);

  // Global Modifier
  const [globalModifierType, setGlobalModifierType] = useState<'none' | 'desc_%' | 'desc_$' | 'rec_%' | 'rec_$'>('none');
  const [globalModifierValue, setGlobalModifierValue] = useState<number>(0);

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

  const getEffectivePrice = (product: Product, variant: Variant, qty: number = 1) => {
    const productOffers = activeOffers.filter(offer => offer.productIds?.includes(product.id));
    
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

  const handleAddItem = () => {
    if (!selectedProduct || !selectedVariant || quantity <= 0) return;

    const newItem: QuoteItem = {
      productId: selectedProduct.id,
      variantId: selectedVariant.id,
      productName: selectedProduct.name,
      variantName: selectedVariant.name,
      quantity,
      unitPrice: effectivePrice,
      finalPrice: effectivePrice * quantity
    };

    setItems(prev => [...prev, newItem]);
    setSelectedProductId('');
    setSelectedVariantId('');
    setQuantity(1);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemModifierChange = (index: number, modType: string, modValue: number) => {
    setItems(prev => {
      const newItems = [...prev];
      const item = { ...newItems[index] };
      
      let modifier: PriceModifier | undefined = undefined;
      if (modType !== 'none' && modValue > 0) {
        modifier = {
          type: modType.includes('%') ? 'percentage' : 'fixed',
          isDiscount: modType.includes('desc'),
          value: modValue
        };
      }
      
      item.modifier = modifier;
      
      // Calculate final price
      let baseTotal = item.unitPrice * item.quantity;
      if (modifier) {
        let modAmount = modifier.type === 'percentage' ? (baseTotal * modifier.value) / 100 : modifier.value;
        item.finalPrice = modifier.isDiscount ? Math.max(0, baseTotal - modAmount) : baseTotal + modAmount;
      } else {
        item.finalPrice = baseTotal;
      }
      
      newItems[index] = item;
      return newItems;
    });
  };

  const subtotal = useMemo(() => items.reduce((acc, item) => acc + item.finalPrice, 0), [items]);

  const globalModifier = useMemo((): PriceModifier | undefined => {
    if (globalModifierType === 'none' || globalModifierValue <= 0) return undefined;
    return {
      type: globalModifierType.includes('%') ? 'percentage' : 'fixed',
      isDiscount: globalModifierType.includes('desc'),
      value: globalModifierValue
    };
  }, [globalModifierType, globalModifierValue]);

  const totalAmount = useMemo(() => {
    if (!globalModifier) return subtotal;
    let modAmount = globalModifier.type === 'percentage' ? (subtotal * globalModifier.value) / 100 : globalModifier.value;
    return globalModifier.isDiscount ? Math.max(0, subtotal - modAmount) : subtotal + modAmount;
  }, [subtotal, globalModifier]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Agrega al menos un producto al presupuesto.');
      return;
    }

    let finalCustomerName = 'Consumidor Final';
    if (customerId) {
      const c = customers.find(c => c.id === customerId);
      if (c) finalCustomerName = c.name;
    } else if (customCustomerName) {
      finalCustomerName = customCustomerName;
    }

    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + validUntilDays);

    onSave({
      customerId: customerId || 'guest',
      customerName: finalCustomerName,
      items,
      subtotal,
      globalModifier,
      totalAmount,
      validUntil: validUntilDate.toISOString()
    });
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('es-AR', { 
    style: 'currency', 
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);

  const formatPercent = (value: number) => new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value) + '%';

  return (
    <div className="flex-1 overflow-y-auto min-h-0 max-w-5xl mx-auto w-full space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Nuevo Presupuesto</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Selection */}
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800">
          <h3 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-4">Datos del Presupuesto</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Cliente Registrado</label>
              <select
                value={customerId}
                onChange={e => { setCustomerId(e.target.value); setCustomCustomerName(''); }}
                className="w-full px-3 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-stone-900 dark:text-stone-100"
              >
                <option value="">-- Consumidor Final / Nuevo --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {!customerId && (
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Nombre (opcional)</label>
                <input
                  type="text"
                  value={customCustomerName}
                  onChange={e => setCustomCustomerName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full px-3 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-stone-900 dark:text-stone-100"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Validez (Días)</label>
              <input
                type="number"
                min="1"
                value={validUntilDays}
                onChange={e => setValidUntilDays(parseInt(e.target.value) || 15)}
                className="w-full px-3 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-stone-900 dark:text-stone-100"
              />
            </div>
          </div>
        </div>

        {/* Add Items */}
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800">
          <h3 className="text-lg font-semibold text-stone-800 dark:text-stone-100 mb-4">Productos</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mb-6 bg-stone-50 dark:bg-stone-950 p-4 rounded-xl border border-stone-200 dark:border-stone-800">
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 uppercase">Categoría</label>
              <select
                value={selectedCategory}
                onChange={e => { setSelectedCategory(e.target.value); setSelectedProductId(''); setSelectedVariantId(''); }}
                className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-stone-900 dark:text-stone-100"
              >
                <option value="all">Todas</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 uppercase">Producto</label>
              <select
                value={selectedProductId}
                onChange={e => { setSelectedProductId(e.target.value); setSelectedVariantId(''); }}
                className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-stone-900 dark:text-stone-100"
              >
                <option value="">Seleccionar...</option>
                {filteredProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 uppercase">Variante</label>
              <select
                value={selectedVariantId}
                onChange={e => setSelectedVariantId(e.target.value)}
                disabled={!selectedProductId}
                className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm disabled:opacity-50 text-stone-900 dark:text-stone-100"
              >
                <option value="">Seleccionar...</option>
                {selectedProduct?.variants.map(v => {
                  const currentEffectivePrice = getEffectivePrice(selectedProduct, v);
                  const hasOffer = currentEffectivePrice < v.price;
                  return (
                    <option key={v.id} value={v.id}>
                      {v.name} - {formatCurrency(currentEffectivePrice)} {hasOffer ? `(Oferta: ${formatCurrency(v.price)})` : ''}
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
                step="any"
                value={quantity}
                onChange={e => setQuantity(parseFloat(e.target.value) || 1)}
                disabled={!selectedVariantId}
                className="w-full px-3 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm disabled:opacity-50 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div className="md:col-span-1">
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!selectedVariantId || quantity <= 0}
                className="w-full flex items-center justify-center px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                <Plus size={16} className="mr-1" /> Agregar
              </button>
            </div>
          </div>

          {/* Items List */}
          {items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">
                    <th className="pb-2 font-medium">Producto</th>
                    <th className="pb-2 font-medium text-center">Cant.</th>
                    <th className="pb-2 font-medium text-right">Precio Unit.</th>
                    <th className="pb-2 font-medium text-center">Modificador</th>
                    <th className="pb-2 font-medium text-right">Subtotal</th>
                    <th className="pb-2 font-medium text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                  {items.map((item, idx) => {
                    const currentModType = item.modifier 
                      ? `${item.modifier.isDiscount ? 'desc' : 'rec'}_${item.modifier.type === 'percentage' ? '%' : '$'}`
                      : 'none';
                    const currentModValue = item.modifier?.value || 0;

                    return (
                      <tr key={idx}>
                        <td className="py-3 text-sm text-stone-900 dark:text-stone-100">
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-stone-500 dark:text-stone-400">{item.variantName}</div>
                        </td>
                        <td className="py-3 text-sm text-stone-900 dark:text-stone-100 text-center">{item.quantity}</td>
                        <td className="py-3 text-sm text-stone-900 dark:text-stone-100 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-3 text-sm text-stone-900 dark:text-stone-100 text-center">
                          <div className="flex items-center justify-center space-x-2">
                            <select 
                              value={currentModType}
                              onChange={(e) => handleItemModifierChange(idx, e.target.value, currentModValue)}
                              className="px-2 py-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded text-xs outline-none text-stone-900 dark:text-stone-100"
                            >
                              <option value="none">Ninguno</option>
                              <option value="desc_%">Desc. %</option>
                              <option value="desc_$">Desc. $</option>
                              <option value="rec_%">Rec. %</option>
                              <option value="rec_$">Rec. $</option>
                            </select>
                            {currentModType !== 'none' && (
                              <input 
                                type="number" 
                                min="0"
                                value={currentModValue}
                                onChange={(e) => handleItemModifierChange(idx, currentModType, parseFloat(e.target.value) || 0)}
                                className="w-16 px-2 py-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded text-xs outline-none text-stone-900 dark:text-stone-100"
                              />
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-sm font-medium text-stone-900 dark:text-stone-100 text-right">{formatCurrency(item.finalPrice)}</td>
                        <td className="py-3 text-right">
                          <button type="button" onClick={() => handleRemoveItem(idx)} className="text-rose-400 hover:text-rose-600 p-1"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-stone-500 dark:text-stone-400 text-sm border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-xl">
              <ShoppingBag className="mx-auto h-8 w-8 text-stone-300 dark:text-stone-600 mb-2" />
              No hay productos en el presupuesto.
            </div>
          )}
        </div>

        {/* Totals & Global Modifiers */}
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="flex-1 w-full">
              <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-100 mb-2">Descuento / Recargo Global</h3>
              <div className="flex items-center space-x-2">
                <select 
                  value={globalModifierType}
                  onChange={(e) => setGlobalModifierType(e.target.value as 'none' | 'desc_%' | 'desc_$' | 'rec_%' | 'rec_$')}
                  className="px-3 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-lg text-sm outline-none text-stone-900 dark:text-stone-100"
                >
                  <option value="none">Ninguno</option>
                  <option value="desc_%">Descuento %</option>
                  <option value="desc_$">Descuento $</option>
                  <option value="rec_%">Recargo %</option>
                  <option value="rec_$">Recargo $</option>
                </select>
                {globalModifierType !== 'none' && (
                  <input 
                    type="number" 
                    min="0"
                    value={globalModifierValue}
                    onChange={(e) => setGlobalModifierValue(parseFloat(e.target.value) || 0)}
                    className="w-24 px-3 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-lg text-sm outline-none text-stone-900 dark:text-stone-100"
                  />
                )}
              </div>
            </div>

            <div className="w-full md:w-64 space-y-2">
              <div className="flex justify-between text-stone-500 dark:text-stone-400 text-sm">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {globalModifier && (
                <div className="flex justify-between text-stone-500 dark:text-stone-400 text-sm">
                  <span>{globalModifier.isDiscount ? 'Descuento' : 'Recargo'}:</span>
                  <span>
                    {globalModifier.isDiscount ? '-' : '+'}
                    {globalModifier.type === 'percentage' 
                      ? formatPercent(globalModifier.value) 
                      : formatCurrency(globalModifier.value)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-stone-900 dark:text-stone-100 font-bold text-xl pt-2 border-t border-stone-100 dark:border-stone-800">
                <span>Total:</span>
                <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button type="button" onClick={onCancel} className="px-6 py-2.5 border border-stone-300 dark:border-stone-700 rounded-xl text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">Cancelar</button>
          <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">Guardar Presupuesto</button>
        </div>
      </form>
    </div>
  );
}
