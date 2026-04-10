import React, { useState } from 'react';
import { Sale, Customer } from '../types';
import { Truck, Printer, Search, X } from 'lucide-react';
import ShippingLabel from './ShippingLabel';

interface DispatchViewProps {
  sales: Sale[];
  customers: Customer[];
}

export default function DispatchView({ sales, customers }: DispatchViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [notes, setNotes] = useState('');
  const [customAddress, setCustomAddress] = useState('');

  // Filter sales that are pending delivery or in progress
  const pendingSales = sales.filter(sale => 
    (sale.status === 'listo_para_entregar' || sale.status === 'en_preparacion') &&
    (sale.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
     sale.id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handlePrint = () => {
    window.print();
  };

  const openModal = (sale: Sale) => {
    setSelectedSale(sale);
    const customer = customers.find(c => c.id === sale.customerId);
    setCustomAddress(customer?.address || '');
    setNotes('');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      <div className="flex-none flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-stone-800 dark:text-stone-100">Despachos</h2>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input
            type="text"
            placeholder="Buscar pedido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-stone-200 dark:border-stone-800 rounded-lg bg-white dark:bg-stone-950 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-2 pb-4">
        {pendingSales.map((sale) => {
          const customer = customers.find(c => c.id === sale.customerId);
          return (
            <div key={sale.id} className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">{sale.id}</p>
                  <h3 className="font-semibold text-stone-800 dark:text-stone-100">{sale.customerName}</h3>
                </div>
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${
                  sale.status === 'listo_para_entregar' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {sale.status === 'listo_para_entregar' ? 'Pendiente' : 'En Proceso'}
                </span>
              </div>
              
              <div className="space-y-2 mb-6">
                <p className="text-sm text-stone-600 dark:text-stone-400 flex items-center">
                  <Truck size={14} className="mr-2 opacity-50" />
                  {customer?.address || 'Dirección no especificada'}
                </p>
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  Items: {sale.items.reduce((acc, item) => acc + item.quantity, 0)}
                </p>
              </div>

              <button
                onClick={() => openModal(sale)}
                className="w-full flex items-center justify-center px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors font-medium text-sm"
              >
                <Printer size={18} className="mr-2" />
                Generar Etiqueta
              </button>
            </div>
          );
        })}
        {pendingSales.length === 0 && (
          <div className="col-span-full py-12 text-center text-stone-500">
            <Truck size={48} className="mx-auto mb-4 opacity-20" />
            <p>No hay pedidos pendientes de despacho</p>
          </div>
        )}
      </div>

      {/* Label Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 w-full max-w-lg shadow-xl print:shadow-none print:p-0 print:rounded-none relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setSelectedSale(null)}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 print:hidden"
            >
              <X size={24} />
            </button>
            
            <div className="mb-6 print:hidden">
              <h3 className="text-lg font-semibold text-stone-800 dark:text-stone-100">Vista Previa de Etiqueta</h3>
              <p className="text-sm text-stone-500">Asegúrese de que los datos sean correctos antes de imprimir.</p>
            </div>

            <div className="mb-6 space-y-4 print:hidden">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Dirección de Envío (Personalizada)
                </label>
                <input
                  type="text"
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  placeholder="Ej: Calle Falsa 123"
                  className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Notas / Instrucciones Manuales
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Llamar por teléfono al llegar, casa al fondo..."
                  rows={2}
                  className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white resize-none"
                />
              </div>
            </div>

            <div className="flex justify-center mb-6">
              <ShippingLabel 
                sale={selectedSale} 
                customer={customers.find(c => c.id === selectedSale.customerId)} 
                notes={notes}
                customAddress={customAddress}
              />
            </div>

            <div className="flex space-x-3 print:hidden">
              <button
                onClick={() => setSelectedSale(null)}
                className="flex-1 px-4 py-2 border border-stone-200 dark:border-stone-800 rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                Cerrar
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center"
              >
                <Printer size={20} className="mr-2" />
                Imprimir Etiqueta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
