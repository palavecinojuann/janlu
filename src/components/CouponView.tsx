import React, { useState } from 'react';
import { Offer, Product, Coupon } from '../types';
import { Plus, Trash2, Tag, Percent, Edit2, X, Image as ImageIcon, Box, Calendar, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface CouponViewProps {
  offers: Offer[];
  coupons: Coupon[];
  products: Product[];
  onAddOffer: (offer: Offer) => void;
  onUpdateOffer: (offer: Offer) => void;
  onDeleteOffer: (id: string) => void;
  onUpdateCoupon: (coupon: Coupon) => void;
  onDeleteCoupon: (id: string) => void;
}

export default function CouponView({ 
  offers, 
  coupons, 
  products, 
  onAddOffer, 
  onUpdateOffer, 
  onDeleteOffer,
  onUpdateCoupon,
  onDeleteCoupon
}: CouponViewProps) {
  const [activeTab, setActiveTab] = useState<'offers' | 'coupons'>('offers');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'offer' | 'coupon', id: string } | null>(null);
  
  const [formData, setFormData] = useState<Partial<Offer>>({
    title: '',
    description: '',
    type: 'discount',
    discountPercentage: 0,
    fixedPrice: 0,
    productIds: [],
    imageUrl: '',
    isActive: true,
    validDays: [0, 1, 2, 3, 4, 5, 6],
    startTime: '',
    endTime: '',
    expiresAt: '',
  });

  const [couponFormData, setCouponFormData] = useState<Partial<Coupon>>({
    code: '',
    discountPercentage: 0,
    expiresAt: '',
    isUsed: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (activeTab === 'offers') {
      if (editingId) {
        const existing = offers.find(o => o.id === editingId);
        if (existing) {
          onUpdateOffer({ ...existing, ...formData as Offer });
        }
      } else {
        onAddOffer({
          ...formData as Offer,
          id: uuidv4(),
        });
      }
    } else {
      if (editingCouponId) {
        const existing = coupons.find(c => c.id === editingCouponId);
        if (existing) {
          onUpdateCoupon({ ...existing, ...couponFormData as Coupon });
        }
      }
    }
    
    setIsFormOpen(false);
    setEditingId(null);
    setEditingCouponId(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'discount',
      discountPercentage: 0,
      fixedPrice: 0,
      productIds: [],
      imageUrl: '',
      isActive: true,
      validDays: [0, 1, 2, 3, 4, 5, 6],
      startTime: '',
      endTime: '',
      expiresAt: '',
    });
    setCouponFormData({
      code: '',
      discountPercentage: 0,
      expiresAt: '',
      isUsed: false,
    });
  };

  const handleEdit = (offer: Offer) => {
    setFormData({
      ...offer,
      validDays: offer.validDays || [0, 1, 2, 3, 4, 5, 6],
    });
    setEditingId(offer.id);
    setIsFormOpen(true);
  };

  const handleEditCoupon = (coupon: Coupon) => {
    setCouponFormData({
      ...coupon,
    });
    setEditingCouponId(coupon.id);
    setIsFormOpen(true);
  };

  const handleRelaunchOffer = (offer: Offer) => {
    // Extend expiration by 30 days and reactivate
    const newExpires = new Date();
    newExpires.setDate(newExpires.getDate() + 30);
    onUpdateOffer({
      ...offer,
      isActive: true,
      expiresAt: newExpires.toISOString().split('T')[0]
    });
  };

  const handleRelaunchCoupon = (coupon: Coupon) => {
    // Extend expiration by 30 days and mark as not used
    const newExpires = new Date();
    newExpires.setDate(newExpires.getDate() + 30);
    onUpdateCoupon({
      ...coupon,
      isUsed: false,
      expiresAt: newExpires.toISOString().split('T')[0]
    });
  };

  const toggleProductSelection = (productId: string) => {
    setFormData(prev => {
      const currentIds = prev.productIds || [];
      if (currentIds.includes(productId)) {
        return { ...prev, productIds: currentIds.filter(id => id !== productId) };
      } else {
        return { ...prev, productIds: [...currentIds, productId] };
      }
    });
  };

  const toggleDaySelection = (day: number) => {
    setFormData(prev => {
      const currentDays = prev.validDays || [];
      if (currentDays.includes(day)) {
        return { ...prev, validDays: currentDays.filter(d => d !== day) };
      } else {
        return { ...prev, validDays: [...currentDays, day] };
      }
    });
  };

  const daysOfWeek = [
    { id: 1, label: 'Lun' },
    { id: 2, label: 'Mar' },
    { id: 3, label: 'Mié' },
    { id: 4, label: 'Jue' },
    { id: 5, label: 'Vie' },
    { id: 6, label: 'Sáb' },
    { id: 0, label: 'Dom' },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      <div className="flex-none flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Cupones y Ofertas</h2>
          <p className="text-stone-500 text-sm mt-1">Gestiona descuentos, combos y promociones para tu catálogo online.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingId(null);
            setEditingCouponId(null);
            setIsFormOpen(!isFormOpen);
          }}
          className={`flex items-center px-4 py-2 text-white rounded-xl transition-colors text-sm font-medium ${
            isFormOpen
              ? 'bg-stone-500 hover:bg-stone-600 dark:bg-stone-700 dark:hover:bg-stone-600'
              : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {isFormOpen ? (
            <>
              <X size={18} className="mr-2" />
              Cancelar
            </>
          ) : (
            <>
              <Plus size={18} className="mr-2" />
              {activeTab === 'offers' ? 'Nueva Oferta' : 'Nuevo Cupón'}
            </>
          )}
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex-none flex space-x-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl w-fit">
        <button
          onClick={() => { setActiveTab('offers'); setIsFormOpen(false); }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'offers'
              ? 'bg-white dark:bg-stone-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
          }`}
        >
          Ofertas y Combos
        </button>
        <button
          onClick={() => { setActiveTab('coupons'); setIsFormOpen(false); }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'coupons'
              ? 'bg-white dark:bg-stone-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
          }`}
        >
          Cupones de Descuento
        </button>
      </div>

      {isFormOpen && (
        <div className="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100">
              {activeTab === 'offers' 
                ? (editingId ? 'Editar Oferta' : 'Crear Nueva Oferta')
                : (editingCouponId ? 'Editar Cupón' : 'Crear Nuevo Cupón')}
            </h3>
            <button onClick={() => setIsFormOpen(false)} className="text-stone-400 hover:text-stone-600">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {activeTab === 'offers' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Título de la Oferta</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Ej: Promo Día de la Madre"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Descripción</label>
                    <textarea
                      required
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                      placeholder="Describe los detalles de la oferta..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Tipo de Oferta</label>
                      <select
                        value={formData.type}
                        onChange={e => setFormData({ ...formData, type: e.target.value as 'discount' | 'combo' | 'bogo' })}
                        className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="discount">Descuento (%)</option>
                        <option value="combo">Combo (Precio Fijo)</option>
                        <option value="bogo">2x1 / 3x2 (BOGO)</option>
                      </select>
                    </div>

                    {formData.type === 'discount' && (
                      <div>
                        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Descuento (%)</label>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          required
                          step="any"
                          value={formData.discountPercentage || ''}
                          onChange={e => setFormData({ ...formData, discountPercentage: parseFloat(e.target.value) })}
                          className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    )}

                    {(formData.type === 'combo' || formData.type === 'bogo') && (
                      <div>
                        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Precio Fijo (Opcional)</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.fixedPrice || ''}
                          onChange={e => setFormData({ ...formData, fixedPrice: parseFloat(e.target.value) || 0 })}
                          className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                          placeholder="Ej: 5000"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">URL de Imagen (Opcional)</label>
                    <div className="relative">
                      <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                      <input
                        type="url"
                        value={formData.imageUrl || ''}
                        onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="https://ejemplo.com/imagen.jpg"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-stone-200 dark:border-stone-800">
                    <h4 className="text-sm font-semibold text-stone-800 dark:text-stone-100 mb-3">Disponibilidad</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">Días válidos</label>
                        <div className="flex flex-wrap gap-2">
                          {daysOfWeek.map(day => (
                            <button
                              key={day.id}
                              type="button"
                              onClick={() => toggleDaySelection(day.id)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                (formData.validDays || []).includes(day.id)
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
                              }`}
                            >
                              {day.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Hora Inicio (Opcional)</label>
                          <input
                            type="time"
                            value={formData.startTime || ''}
                            onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                            className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Hora Fin (Opcional)</label>
                          <input
                            type="time"
                            value={formData.endTime || ''}
                            onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                            className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Fecha de Expiración (Opcional)</label>
                        <input
                          type="date"
                          value={formData.expiresAt || ''}
                          onChange={e => setFormData({ ...formData, expiresAt: e.target.value })}
                          className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center mt-4">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 bg-stone-100 border-stone-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="isActive" className="ml-2 text-sm font-medium text-stone-700 dark:text-stone-300">
                      Oferta Activa (visible en catálogo)
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                    Productos Incluidos ({formData.productIds?.length || 0})
                    <span className="text-xs text-stone-500 font-normal ml-2">(Opcional, si no seleccionas aplica a todos)</span>
                  </label>
                  <div className="bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl p-4 h-[320px] overflow-y-auto">
                    {products.length === 0 ? (
                      <p className="text-stone-500 text-sm text-center py-8">No hay productos disponibles.</p>
                    ) : (
                      <div className="space-y-2">
                        {products.map(product => (
                          <div 
                            key={product.id}
                            onClick={() => toggleProductSelection(product.id)}
                            className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors border ${
                              formData.productIds?.includes(product.id)
                                ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800'
                                : 'bg-white border-stone-200 dark:bg-stone-900 dark:border-stone-800 hover:border-indigo-300'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 ${
                              formData.productIds?.includes(product.id)
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-stone-300 dark:border-stone-600'
                            }`}>
                              {formData.productIds?.includes(product.id) && <Plus size={14} className="rotate-45" />}
                            </div>
                            {product.photoUrl ? (
                              <img src={product.photoUrl} alt={product.name} className="w-10 h-10 rounded object-cover mr-3" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-stone-100 dark:bg-stone-800 flex items-center justify-center mr-3">
                                <Box size={16} className="text-stone-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">{product.name}</p>
                              <p className="text-xs text-stone-500 truncate">{product.category}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-md mx-auto">
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Código del Cupón</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingCouponId}
                    value={couponFormData.code}
                    onChange={e => setCouponFormData({ ...couponFormData, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                    placeholder="Ej: BIENVENIDA20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Descuento (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    required
                    value={couponFormData.discountPercentage || ''}
                    onChange={e => setCouponFormData({ ...couponFormData, discountPercentage: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Fecha de Expiración</label>
                  <input
                    type="date"
                    required
                    value={couponFormData.expiresAt || ''}
                    onChange={e => setCouponFormData({ ...couponFormData, expiresAt: e.target.value })}
                    className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="flex items-center mt-4">
                  <input
                    type="checkbox"
                    id="isUsed"
                    checked={couponFormData.isUsed}
                    onChange={e => setCouponFormData({ ...couponFormData, isUsed: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 bg-stone-100 border-stone-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="isUsed" className="ml-2 text-sm font-medium text-stone-700 dark:text-stone-300">
                    Marcar como usado
                  </label>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-6 py-2 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800 rounded-xl font-medium transition-colors mr-3"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium transition-colors"
              >
                {activeTab === 'offers' 
                  ? (editingId ? 'Guardar Cambios' : 'Crear Oferta')
                  : (editingCouponId ? 'Guardar Cambios' : 'Crear Cupón')}
              </button>
            </div>
          </form>
        </div>
      )}

      {!isFormOpen && (
        <div className="flex-1 overflow-y-auto min-h-0">
          {activeTab === 'offers' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
              {offers.length === 0 ? (
                <div className="col-span-full bg-white dark:bg-stone-900 p-8 rounded-2xl border border-stone-100 dark:border-stone-800 text-center">
                  <Tag className="mx-auto h-12 w-12 text-stone-300 dark:text-stone-600 mb-4" />
                  <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 mb-1">No hay ofertas activas</h3>
                  <p className="text-stone-500">Crea tu primera oferta, combo o descuento para mostrar en el catálogo.</p>
                </div>
              ) : (
                offers.map(offer => {
                  const isExpired = offer.expiresAt ? (() => {
                    const [year, month, day] = offer.expiresAt.split('-').map(Number);
                    const expirationDate = new Date(year, month - 1, day, 23, 59, 59, 999);
                    return new Date() > expirationDate;
                  })() : false;

                  return (
                    <div key={offer.id} className={`bg-white dark:bg-stone-900 rounded-2xl border overflow-hidden flex flex-col ${
                      offer.isActive && !isExpired ? 'border-stone-200 dark:border-stone-800' : 'border-stone-200 dark:border-stone-800 opacity-60'
                    }`}>
                      {offer.imageUrl && (
                        <div className="h-40 w-full overflow-hidden relative">
                          <img src={offer.imageUrl} alt={offer.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          {isExpired && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <span className="bg-rose-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
                                Expirada
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="p-5 flex-1 flex flex-col relative">
                        {!offer.imageUrl && isExpired && (
                          <div className="absolute top-5 right-5">
                            <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">
                              Expirada
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                            offer.type === 'discount' ? 'bg-rose-100 text-rose-700' :
                            offer.type === 'combo' ? 'bg-amber-100 text-amber-700' :
                            'bg-emerald-100 text-emerald-700'
                          }`}>
                            {offer.type === 'discount' ? 'Descuento' : offer.type === 'combo' ? 'Combo' : '2x1 / 3x2'}
                          </span>
                          <div className="flex space-x-1">
                            <button 
                              onClick={() => handleRelaunchOffer(offer)} 
                              className="p-1.5 text-stone-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Relanzar (Extender 30 días)"
                            >
                              <RefreshCw size={16} />
                            </button>
                            <button onClick={() => handleEdit(offer)} className="p-1.5 text-stone-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => setConfirmAction({ type: 'offer', id: offer.id })} 
                              className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        
                        <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-1">{offer.title}</h3>
                        <p className="text-sm text-stone-500 mb-4 line-clamp-2 flex-1">{offer.description}</p>
                        
                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-stone-100 dark:border-stone-800">
                          <div className="text-sm font-medium text-stone-700 dark:text-stone-300">
                            {offer.productIds?.length || 0} productos
                          </div>
                          <div className="text-lg font-bold text-indigo-600">
                            {offer.type === 'discount' && offer.discountPercentage ? `${offer.discountPercentage}% OFF` : ''}
                            {offer.type !== 'discount' && offer.fixedPrice ? `$${offer.fixedPrice}` : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/50">
                      <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Código</th>
                      <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Descuento</th>
                      <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Expiración</th>
                      <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {coupons.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-stone-500">
                          <Tag className="mx-auto h-12 w-12 text-stone-300 dark:text-stone-600 mb-4" />
                          <p>No hay cupones generados aún.</p>
                        </td>
                      </tr>
                    ) : (
                      coupons.map(coupon => {
                        const isExpired = new Date(coupon.expiresAt) < new Date();
                        return (
                          <tr key={coupon.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                            <td className="px-6 py-4">
                              <span className="font-mono font-bold text-stone-800 dark:text-stone-100 bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded">
                                {coupon.code}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                                {coupon.discountPercentage}%
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-stone-600 dark:text-stone-400">
                              {coupon.expiresAt}
                            </td>
                            <td className="px-6 py-4">
                              {coupon.isUsed ? (
                                <span className="flex items-center text-stone-500 text-xs">
                                  <CheckCircle size={14} className="mr-1 text-green-500" />
                                  Usado
                                </span>
                              ) : isExpired ? (
                                <span className="flex items-center text-red-500 text-xs">
                                  <AlertCircle size={14} className="mr-1" />
                                  Expirado
                                </span>
                              ) : (
                                <span className="flex items-center text-green-600 text-xs font-medium">
                                  <RefreshCw size={14} className="mr-1" />
                                  Disponible
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end items-center space-x-2">
                                <button
                                  onClick={() => handleRelaunchCoupon(coupon)}
                                  className="p-2 text-stone-400 hover:text-indigo-600 transition-colors"
                                  title="Relanzar (Extender 30 días y marcar como no usado)"
                                >
                                  <RefreshCw size={16} />
                                </button>
                                <button
                                  onClick={() => handleEditCoupon(coupon)}
                                  className="p-2 text-stone-400 hover:text-indigo-600 transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => setConfirmAction({ type: 'coupon', id: coupon.id })}
                                  className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Modal de Confirmación */}
      {confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-stone-200 dark:border-stone-800">
            <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-4">
              {confirmAction.type === 'offer' ? 'Eliminar Oferta' : 'Eliminar Cupón'}
            </h3>
            <p className="text-stone-600 dark:text-stone-400 mb-6">
              {confirmAction.type === 'offer' 
                ? '¿Estás seguro de que deseas eliminar esta oferta? Esta acción no se puede deshacer.' 
                : '¿Estás seguro de que deseas eliminar este cupón? Esta acción no se puede deshacer.'}
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
                  if (confirmAction.type === 'offer') {
                    onDeleteOffer(confirmAction.id);
                  } else {
                    onDeleteCoupon(confirmAction.id);
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
