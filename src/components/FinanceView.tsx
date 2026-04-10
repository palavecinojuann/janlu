import React, { useState, useMemo } from 'react';
import { FinancialDocument, Sale } from '../types';
import { Upload, FileText, Eye, Trash2, Plus, Search, Filter, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface FinanceViewProps {
  financialDocs: FinancialDocument[];
  sales: Sale[];
  onAddDoc: (doc: FinancialDocument) => void;
  onDeleteDoc: (id: string) => void;
}

export default function FinanceView({ financialDocs, sales, onAddDoc, onDeleteDoc }: FinanceViewProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [newDoc, setNewDoc] = useState<Partial<FinancialDocument>>({
    type: 'sale',
    date: new Date().toISOString().split('T')[0],
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'purchase'>('all');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'thisMonth' | 'lastMonth' | 'thisYear'>('thisMonth');

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.transactionId || !newDoc.amount) {
      alert('Por favor complete todos los campos obligatorios (ID Transacción y Monto)');
      return;
    }

    const doc: FinancialDocument = {
      id: uuidv4(),
      transactionId: newDoc.transactionId,
      type: newDoc.type as 'sale' | 'purchase',
      amount: Number(newDoc.amount),
      url: newDoc.url || '',
      date: newDoc.date || new Date().toISOString().split('T')[0],
      note: newDoc.note,
    };

    onAddDoc(doc);
    setIsUploading(false);
    setNewDoc({ type: 'sale', date: new Date().toISOString().split('T')[0] });
  };

  const combinedDocs = useMemo(() => {
    const saleDocs: FinancialDocument[] = [];
    
    sales.forEach(sale => {
      if (sale.status === 'cancelado') return;
      
      if (sale.paymentHistory && sale.paymentHistory.length > 0) {
        sale.paymentHistory.forEach((ph, idx) => {
          if (ph.amount !== 0) {
            saleDocs.push({
              id: `sale-h-${sale.id}-${idx}`,
              transactionId: `Pedido #${sale.orderNumber || sale.id.substring(0, 8)}`,
              type: 'sale',
              amount: ph.amount,
              url: sale.receiptUrl || '',
              date: ph.date.split('T')[0],
              note: `Pago de ${sale.customerName}${ph.notes ? `: ${ph.notes}` : ''}`
            });
          }
        });
      } else if (sale.amountPaid > 0) {
        saleDocs.push({
          id: `sale-${sale.id}`,
          transactionId: `Pedido #${sale.orderNumber || sale.id.substring(0, 8)}`,
          type: 'sale',
          amount: sale.amountPaid,
          url: sale.receiptUrl || '',
          date: sale.date.split('T')[0],
          note: `Pago de ${sale.customerName}${sale.paymentNotes ? `: ${sale.paymentNotes}` : ''}`
        });
      }
    });

    return [...financialDocs, ...saleDocs];
  }, [financialDocs, sales]);

  const filteredDocs = useMemo(() => {
    return combinedDocs.filter(doc => {
      const matchesSearch = doc.transactionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            doc.note?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || doc.type === filterType;
      
      let matchesPeriod = true;
      if (filterPeriod !== 'all') {
        const docDate = new Date(doc.date);
        const now = new Date();
        if (filterPeriod === 'thisMonth') {
          matchesPeriod = docDate.getMonth() === now.getMonth() && docDate.getFullYear() === now.getFullYear();
        } else if (filterPeriod === 'lastMonth') {
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          matchesPeriod = docDate.getMonth() === lastMonth.getMonth() && docDate.getFullYear() === lastMonth.getFullYear();
        } else if (filterPeriod === 'thisYear') {
          matchesPeriod = docDate.getFullYear() === now.getFullYear();
        }
      }

      return matchesSearch && matchesType && matchesPeriod;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [combinedDocs, searchTerm, filterType, filterPeriod]);

  const totals = useMemo(() => {
    return filteredDocs.reduce(
      (acc, doc) => {
        if (doc.type === 'sale') {
          acc.income += doc.amount;
        } else {
          acc.expense += doc.amount;
        }
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [filteredDocs]);

  const netBalance = totals.income - totals.expense;

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      <div className="flex-none flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-stone-800 dark:text-stone-100">Finanzas</h2>
        <button
          onClick={() => setIsUploading(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={20} className="mr-2" />
          Cargar Comprobante
        </button>
      </div>

      {/* Totals Cards */}
      <div className="flex-none grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-stone-950 p-6 rounded-2xl border border-stone-200 dark:border-stone-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400">Ingresos (Cobros)</h3>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <TrendingUp size={20} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white break-words">${totals.income.toLocaleString()}</p>
        </div>
        
        <div className="bg-white dark:bg-stone-950 p-6 rounded-2xl border border-stone-200 dark:border-stone-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400">Egresos (Gastos)</h3>
            <div className="p-2 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg">
              <TrendingDown size={20} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white break-words">${totals.expense.toLocaleString()}</p>
        </div>

        <div className="bg-white dark:bg-stone-950 p-6 rounded-2xl border border-stone-200 dark:border-stone-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400">Balance Neto</h3>
            <div className={`p-2 rounded-lg ${netBalance >= 0 ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
              <DollarSign size={20} />
            </div>
          </div>
          <p className={`text-xl sm:text-2xl font-bold break-words ${netBalance >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600 dark:text-red-400'}`}>
            ${netBalance.toLocaleString()}
          </p>
        </div>
      </div>

      {isUploading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-4 text-stone-800 dark:text-stone-100">Nuevo Comprobante</h3>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Tipo</label>
                <select
                  value={newDoc.type}
                  onChange={(e) => setNewDoc({ ...newDoc, type: e.target.value as 'sale' | 'purchase' | 'expense' })}
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-800 rounded-lg bg-white dark:bg-stone-950"
                >
                  <option value="sale">Cobro de Colaborador / Venta</option>
                  <option value="purchase">Gasto de Insumo / Compra</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">ID Transacción / Pedido</label>
                <input
                  type="text"
                  value={newDoc.transactionId}
                  onChange={(e) => setNewDoc({ ...newDoc, transactionId: e.target.value })}
                  placeholder="Ej: SALE-123"
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-800 rounded-lg bg-white dark:bg-stone-950"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Monto ($)</label>
                <input
                  type="number"
                  value={newDoc.amount || ''}
                  onChange={(e) => setNewDoc({ ...newDoc, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-800 rounded-lg bg-white dark:bg-stone-950"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">URL del Documento (Opcional)</label>
                <input
                  type="url"
                  value={newDoc.url || ''}
                  onChange={(e) => setNewDoc({ ...newDoc, url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-800 rounded-lg bg-white dark:bg-stone-950"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Nota (Opcional)</label>
                <textarea
                  value={newDoc.note || ''}
                  onChange={(e) => setNewDoc({ ...newDoc, note: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-200 dark:border-stone-800 rounded-lg bg-white dark:bg-stone-950"
                  rows={2}
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploading(false)}
                  className="flex-1 px-4 py-2 border border-stone-200 dark:border-stone-800 rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex-1 bg-white dark:bg-stone-950 rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-col min-h-0">
        <div className="flex-none p-4 border-b border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center w-full sm:w-auto flex-1 bg-stone-50 dark:bg-stone-900 px-3 py-2 rounded-lg">
            <Search className="text-stone-400 mr-2" size={20} />
            <input
              type="text"
              placeholder="Buscar por ID o nota..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm outline-none"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="text-stone-400" size={20} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'sale' | 'purchase' | 'expense')}
              className="px-3 py-2 bg-stone-50 dark:bg-stone-900 border-none rounded-lg text-sm outline-none cursor-pointer"
            >
              <option value="all">Todos los tipos</option>
              <option value="sale">Ingresos (Cobros)</option>
              <option value="purchase">Egresos (Gastos)</option>
            </select>
            
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value as 'all' | 'thisMonth' | 'lastMonth' | 'thisYear')}
              className="px-3 py-2 bg-stone-50 dark:bg-stone-900 border-none rounded-lg text-sm outline-none cursor-pointer"
            >
              <option value="all">Todo el tiempo</option>
              <option value="thisMonth">Este mes</option>
              <option value="lastMonth">Mes pasado</option>
              <option value="thisYear">Este año</option>
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10 bg-stone-50 dark:bg-stone-900/50 shadow-sm">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">ID Transacción</th>
                <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Monto</th>
                <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-stone-50 dark:hover:bg-stone-900/30 transition-colors">
                  <td className="px-6 py-4 text-sm text-stone-600 dark:text-stone-400">{doc.date}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      doc.type === 'sale' 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {doc.type === 'sale' 
                        ? (doc.id.startsWith('sale-') ? 'Venta' : 'Cobro') 
                        : 'Gasto'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-stone-800 dark:text-stone-200">{doc.transactionId}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-stone-900 dark:text-stone-100">${doc.amount.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          title="Ver documento"
                        >
                          <Eye size={18} />
                        </a>
                      )}
                      {!doc.id.startsWith('sale-') && (
                        <button
                          onClick={() => onDeleteDoc(doc.id)}
                          className="p-2 text-stone-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-stone-500">
                    <FileText size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No se encontraron comprobantes</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
