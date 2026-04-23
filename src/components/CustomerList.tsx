import React, { useState, useMemo } from 'react';
import { useInventoryContext } from '../contexts/InventoryContext';
import { Customer, Sale, Offer, AssignedOffer } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { Users, Plus, Trash2, Edit2, Search, X, MessageCircle, Instagram, Tag, Calendar as CalendarIcon, Check, AlertCircle, Gift } from 'lucide-react';

interface CustomerListProps {
  customers: Customer[];
  sales: Sale[];
  offers: Offer[];
  onAdd: (c: Customer) => void;
  onUpdate: (c: Customer) => void;
  onDelete: (id: string) => void;
}

export default function CustomerList({ customers: initialCustomers, sales, offers, onAdd, onUpdate, onDelete }: CustomerListProps) {
  const { customers, generateCoupon } = useInventoryContext();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [managingOffersId, setManagingOffersId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{name: string, surname: string, email: string, phone: string, address: string, instagram: string, birthDate: string, registeredAt: string, customerType: 'retail' | 'wholesale'}>({ 
    name: '', 
    surname: '',
    email: '', 
    phone: '', 
    address: '', 
    instagram: '', 
    birthDate: '',
    registeredAt: new Date().toISOString().split('T')[0],
    customerType: 'retail' 
  });
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.surname || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.instagram || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [customers, searchTerm]);

  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const duplicateEmail = formData.email ? customers.find(c => c.id !== editingId && c.email && c.email.toLowerCase() === formData.email.toLowerCase()) : null;
    const duplicatePhone = formData.phone ? customers.find(c => c.id !== editingId && c.phone && c.phone === formData.phone) : null;

    if (duplicateEmail) {
      alert(`Ya existe un cliente con el correo electrónico ${formData.email} (${duplicateEmail.name} ${duplicateEmail.surname || ''}).`);
      return;
    }
    if (duplicatePhone) {
      alert(`Ya existe un cliente con el teléfono ${formData.phone} (${duplicatePhone.name} ${duplicatePhone.surname || ''}).`);
      return;
    }

    if (editingId) {
      const existing = customers.find(c => c.id === editingId);
      if (existing) {
        onUpdate({ ...existing, ...formData });
      }
    } else {
      onAdd({
        id: uuidv4(),
        ...formData,
        registeredAt: formData.registeredAt ? new Date(formData.registeredAt + 'T12:00:00Z').toISOString() : new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
    }
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({ 
      name: '', 
      surname: '', 
      email: '', 
      phone: '', 
      address: '', 
      instagram: '', 
      birthDate: '', 
      registeredAt: new Date().toISOString().split('T')[0],
      customerType: 'retail' 
    });
  };

  const handleEdit = (c: Customer) => {
    setFormData({ 
      name: c.name, 
      surname: c.surname || '',
      email: c.email, 
      phone: c.phone, 
      address: c.address || '', 
      instagram: c.instagram || '',
      birthDate: c.birthDate || '',
      registeredAt: c.registeredAt ? c.registeredAt.split('T')[0] : new Date().toISOString().split('T')[0],
      customerType: c.customerType || 'retail'
    });
    setEditingId(c.id);
    setIsFormOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      <div className="flex-none flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Clientes</h2>
        
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="text"
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          <button
            onClick={() => {
              setIsFormOpen(!isFormOpen);
              setEditingId(null);
              setFormData({ 
                name: '', 
                surname: '', 
                email: '', 
                phone: '', 
                address: '', 
                instagram: '', 
                birthDate: '', 
                registeredAt: new Date().toISOString().split('T')[0],
                customerType: 'retail' 
              });
            }}
            className={`flex items-center px-4 py-2 text-white rounded-xl transition-colors text-sm font-medium whitespace-nowrap ${
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
                Nuevo Cliente
              </>
            )}
          </button>
        </div>
      </div>

      {isFormOpen && (
        <div className="flex-none bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800">
          <h3 className="text-lg font-semibold mb-4 text-stone-800 dark:text-stone-100">{editingId ? 'Editar Cliente' : 'Registrar Cliente'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Nombre *</label>
              <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Apellido</label>
              <input type="text" value={formData.surname} onChange={e => setFormData({...formData, surname: e.target.value})} className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Tipo de Cliente</label>
              <select value={formData.customerType} onChange={e => setFormData({...formData, customerType: e.target.value as 'retail' | 'wholesale'})} className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100">
                <option value="retail">Minorista</option>
                <option value="wholesale">Mayorista</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Fecha de Nacimiento</label>
              <input type="date" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Fecha de Registro</label>
              <input type="date" value={formData.registeredAt} onChange={e => setFormData({...formData, registeredAt: e.target.value})} className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Email</label>
              <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Teléfono</label>
              <input type="tel" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Dirección de Envío</label>
              <input type="text" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100" placeholder="Calle, Altura, Ciudad" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Instagram (@)</label>
              <input type="text" value={formData.instagram || ''} onChange={e => setFormData({...formData, instagram: e.target.value})} className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100" placeholder="usuario" />
            </div>
            <div className="md:col-span-4 flex justify-end space-x-3 mt-2">
              <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-medium transition-colors">Guardar</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex-1 bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 flex flex-col min-h-0">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10 bg-stone-50 dark:bg-stone-950/50 shadow-sm">
              <tr className="border-b border-stone-100 dark:border-stone-800 text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">
                <th className="p-4 font-medium">Nº Cliente</th>
                <th className="p-4 font-medium">Nombre</th>
                <th className="p-4 font-medium">Tipo</th>
                <th className="p-4 font-medium">Contacto</th>
                <th className="p-4 font-medium">Fecha Registro</th>
                <th className="p-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {filteredCustomers.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-stone-500 dark:text-stone-400">No se encontraron clientes.</td></tr>
              ) : (
                filteredCustomers.map(c => {
                  const customerCoupons = sales
                    .filter(s => s.customerName === c.name || (s.registrationData?.phone === c.phone))
                    .map(s => s.generatedCouponCode)
                    .filter(Boolean);

                  return (
                    <tr key={c.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/50 group">
                      <td className="p-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 uppercase tracking-wider border border-stone-200 dark:border-stone-700">
                          {c.customerNumber || 'S/N'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-stone-900 dark:text-stone-100">{c.name} {c.surname}</div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {c.birthDate && (
                            <div className="text-[10px] text-stone-400 font-bold uppercase tracking-wider flex items-center gap-1">
                              🎂 {parseLocalDate(c.birthDate)?.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                            </div>
                          )}
                          {c.registeredAt && (
                            <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1">
                              📅 Reg: {new Date(c.registeredAt).toLocaleDateString('es-AR', { timeZone: 'UTC' })}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${c.customerType === 'wholesale' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-300'}`}>
                          {c.customerType === 'wholesale' ? 'Mayorista' : 'Minorista'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-stone-600 dark:text-stone-400">
                        <div>{c.email || '-'}</div>
                        <div className="text-xs text-stone-400 mt-0.5">{c.address || 'Sin dirección'}</div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-stone-400 dark:text-stone-500">{c.phone || '-'}</span>
                          {c.phone && (
                            <a 
                              href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-emerald-500 hover:text-emerald-600 transition-colors"
                            >
                              <MessageCircle size={14} />
                            </a>
                          )}
                          {c.instagram && (
                            <a 
                              href={`https://instagram.com/${c.instagram.replace('@', '')}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-pink-500 hover:text-pink-600 transition-colors"
                            >
                              <Instagram size={14} />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-stone-600 dark:text-stone-400">{new Date(c.createdAt).toLocaleDateString()}</div>
                        {customerCoupons.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {customerCoupons.map((code, i) => (
                              <span key={i} className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">
                                {code}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setManagingOffersId(c.id); }} 
                            className="p-2 text-stone-400 dark:text-stone-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg"
                            title="Gestionar Ofertas"
                          >
                            <Tag size={16} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleEdit(c); }} 
                            className="p-2 text-stone-400 dark:text-stone-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`¿Generar un cupón VUELVE de 20% de descuento exclusivo por 30 días para ${c.name}?`)) {
                                if (generateCoupon) {
                                  generateCoupon(c.id, 20);
                                  alert('¡Cupón de retención generado con éxito!\nVe a la pestaña "Cupones" para copiar el código exacto y enviárselo al cliente.');
                                }
                              }
                            }}
                            className="p-2 text-stone-400 hover:text-rose-500 bg-rose-50/0 hover:bg-rose-50 rounded-lg transition-all"
                            title="Persuasión: Generar Cupón 20% OFF para que vuelva a comprar"
                          >
                            <Gift size={18} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onDelete(c.id); }} className="p-2 text-stone-400 dark:text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg"><Trash2 size={16} /></button>
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

      {managingOffersId && (
        <OfferManagementModal 
          customer={customers.find(c => c.id === managingOffersId)!}
          offers={offers}
          onClose={() => setManagingOffersId(null)}
          onUpdate={(updatedCustomer) => {
            onUpdate(updatedCustomer);
            setManagingOffersId(null);
          }}
        />
      )}
    </div>
  );
}

interface OfferManagementModalProps {
  customer: Customer;
  offers: Offer[];
  onClose: () => void;
  onUpdate: (c: Customer) => void;
}

function OfferManagementModal({ customer, offers, onClose, onUpdate }: OfferManagementModalProps) {
  const [assignedOffers, setAssignedOffers] = useState<AssignedOffer[]>(customer.assignedOffers || []);

  const handleToggleOffer = (offer: Offer) => {
    const existing = assignedOffers.find(ao => ao.offerId === offer.id);
    if (existing) {
      setAssignedOffers(assignedOffers.map(ao => 
        ao.offerId === offer.id ? { ...ao, isActive: !ao.isActive } : ao
      ));
    } else {
      const newAssigned: AssignedOffer = {
        id: uuidv4(),
        offerId: offer.id,
        title: offer.title,
        assignedAt: new Date().toISOString(),
        isActive: true,
        expiresAt: offer.expiresAt
      };
      setAssignedOffers([...assignedOffers, newAssigned]);
    }
  };

  const handleRemoveOffer = (offerId: string) => {
    setAssignedOffers(assignedOffers.filter(ao => ao.offerId !== offerId));
  };

  const handleSave = () => {
    onUpdate({ ...customer, assignedOffers });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-stone-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-stone-50 dark:bg-stone-950/50">
          <div>
            <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100">Gestionar Ofertas</h3>
            <p className="text-sm text-stone-500 dark:text-stone-400">{customer.name} {customer.surname} ({customer.customerNumber || 'S/N'})</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
              <Tag size={14} />
              Ofertas Disponibles
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {offers.filter(o => o.isActive).map(offer => {
                const assigned = assignedOffers.find(ao => ao.offerId === offer.id);
                return (
                  <button
                    key={offer.id}
                    onClick={() => handleToggleOffer(offer)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      assigned?.isActive
                        ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800'
                        : 'bg-white border-stone-200 dark:bg-stone-950 dark:border-stone-800 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-semibold text-stone-900 dark:text-stone-100">{offer.title}</div>
                      {assigned?.isActive && <Check size={16} className="text-indigo-600" />}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">{offer.description}</div>
                    {offer.expiresAt && (
                      <div className="text-[10px] text-rose-500 font-bold mt-2 flex items-center gap-1">
                        <CalendarIcon size={10} />
                        Expira: {new Date(offer.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {assignedOffers.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-stone-100 dark:border-stone-800">
              <h4 className="text-sm font-bold uppercase tracking-wider text-stone-400">Ofertas Asignadas</h4>
              <div className="space-y-2">
                {assignedOffers.map(ao => (
                  <div key={ao.id} className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800 rounded-xl">
                    <div>
                      <div className="font-medium text-stone-900 dark:text-stone-100">{ao.title}</div>
                      <div className="text-[10px] text-stone-400 uppercase tracking-wider">Asignada el {new Date(ao.assignedAt).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ao.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                        {ao.isActive ? 'Activa' : 'Inactiva'}
                      </span>
                      <button 
                        onClick={() => handleRemoveOffer(ao.offerId)}
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-stone-100 dark:border-stone-800 flex justify-end gap-3 bg-stone-50 dark:bg-stone-950/50">
          <button onClick={onClose} className="px-4 py-2 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-xl font-medium transition-colors">Cancelar</button>
          <button onClick={handleSave} className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium shadow-lg shadow-indigo-200 dark:shadow-none transition-all">Guardar Cambios</button>
        </div>
      </div>
    </div>
  );
}
