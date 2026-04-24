import React, { useState, useMemo, useEffect } from 'react';
import { Sale, Product, Customer, SaleStatus, StoreSettings } from '../types';
import { ShoppingCart, Plus, Printer, Eye, X, FileText, Link as LinkIcon, MessageCircle, AlertTriangle, CheckCircle, Search, Upload, Loader2, CreditCard, Calendar, Clock, DollarSign, Package } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import OrderConfirmationImage from './OrderConfirmationImage';
import { v4 as uuidv4 } from 'uuid';
import imageCompression from 'browser-image-compression';
import { useInventoryContext } from '../contexts/InventoryContext';

interface SaleListProps {
  sales: Sale[];
  products: Product[];
  customers: Customer[];
  storeSettings: StoreSettings | null;
  onNewSale: () => void;
  onUpdateSale?: (sale: Sale) => void;
  onAttachReceipt?: (saleId: string, url: string) => void;
  initialStatusFilter?: string;
}

export default function SaleList({ sales, products, customers, storeSettings, onNewSale, onUpdateSale, onAttachReceipt, initialStatusFilter }: SaleListProps) {
  const { fetchMoreSales, hasMoreSales } = useInventoryContext();
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  // 🚀 OPTIMISTIC UI: Creamos una copia local de las ventas para que reaccione al instante
  const [localSales, setLocalSales] = useState<Sale[]>(sales);

  // Mantenemos sincronizada la copia local con la base de datos principal
  useEffect(() => {
    setLocalSales(sales);
  }, [sales]);

  const [previewSaleId, setPreviewSaleId] = useState<string | null>(null);
  const saleToPreview = localSales.find(s => s.id === previewSaleId) || null;
  const [attachingReceiptId, setAttachingReceiptId] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [rejectingSaleId, setRejectingSaleId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [cancellingSaleId, setCancellingSaleId] = useState<string | null>(null);
  const [editingPaymentSaleId, setEditingPaymentSaleId] = useState<string | null>(null);
  const [editPaymentPercentage, setEditPaymentPercentage] = useState<number>(100);
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('efectivo');
  const [editPaymentStatus, setEditPaymentStatus] = useState<string>('verified');
  const [editAmountPaid, setEditAmountPaid] = useState<number>(0);
  const [editPaymentMode, setEditPaymentMode] = useState<'percentage' | 'amount'>('percentage');
  const [editPaymentNotes, setEditPaymentNotes] = useState<string>('');
  const [editPaymentDate, setEditPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [originalAmountPaid, setOriginalAmountPaid] = useState<number>(0);

  // Estados para el Modal de Pagos
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [saleForPayment, setSaleForPayment] = useState<Sale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'transferencia' | 'efectivo' | 'mercadopago'>('transferencia');

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter || 'all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [deliveryTimeframeFilter, setDeliveryTimeframeFilter] = useState<string>('all');
  const [printAddress, setPrintAddress] = useState('');
  const [printNotes, setPrintNotes] = useState('');

  const [editingDeliverySaleId, setEditingDeliverySaleId] = useState<string | null>(null);
  const [editDeliveryDate, setEditDeliveryDate] = useState<string>('');
  const [editDeliveryTimeRange, setEditDeliveryTimeRange] = useState<string>('');

  const handleUpdateDelivery = () => {
    if (!editingDeliverySaleId || !onUpdateSale) return;
    const sale = localSales.find(s => s.id === editingDeliverySaleId);
    if (sale) {
      const updatedSale = {
        ...sale,
        deliveryDate: editDeliveryDate,
        deliveryTimeRange: editDeliveryTimeRange
      };
      
      // 🚀 Actualización Optimista de Entrega
      setLocalSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));
      onUpdateSale(updatedSale);
      setEditingDeliverySaleId(null);
    }
  };

  const handlePreview = (sale: Sale) => {
    const customer = customers.find(c => c.id === sale.customerId);
    setPrintAddress(customer?.address || '');
    setPrintNotes('');
    setPreviewSaleId(sale.id);
  };

  // Usamos localSales en lugar de sales para que la vista cambie al instante
  const filteredSales = useMemo(() => {
    return localSales.filter(sale => {
    const searchLower = searchTerm.toLowerCase();
    const orderMatch = sale.orderNumber?.toString().includes(searchLower);
    const customerMatch = sale.customerName?.toLowerCase().includes(searchLower);
    const itemMatch = sale.items.some(item => 
      item.productName.toLowerCase().includes(searchLower) || 
      item.variantName.toLowerCase().includes(searchLower)
    );
    const matchesSearch = orderMatch || customerMatch || itemMatch;

    let matchesDate = true;
    const saleDate = new Date(sale.date);
    saleDate.setHours(0, 0, 0, 0);

    if (dateFrom) {
      const from = new Date(dateFrom + 'T00:00:00');
      if (saleDate < from) matchesDate = false;
    }
    if (dateTo) {
      const to = new Date(dateTo + 'T00:00:00');
      if (saleDate > to) matchesDate = false;
    }

    let matchesStatus = true;
    if (statusFilter !== 'all') {
      matchesStatus = sale.status === statusFilter;
    }

    let matchesPaymentStatus = true;
    if (paymentStatusFilter !== 'all') {
      matchesPaymentStatus = sale.paymentStatus === paymentStatusFilter;
    }

    let matchesDeliveryTimeframe = true;
    if (deliveryTimeframeFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (!sale.deliveryDate) {
        matchesDeliveryTimeframe = false;
      } else {
        const deliveryDate = new Date(sale.deliveryDate);
        deliveryDate.setHours(0, 0, 0, 0);
        
        const diffTime = deliveryDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (deliveryTimeframeFilter === 'overdue') {
          matchesDeliveryTimeframe = diffDays < 0 && sale.status !== 'entregado' && sale.status !== 'cancelado';
        } else if (deliveryTimeframeFilter === 'today') {
          matchesDeliveryTimeframe = diffDays === 0;
        } else if (deliveryTimeframeFilter === 'this_week') {
          matchesDeliveryTimeframe = diffDays > 0 && diffDays <= 7;
        } else if (deliveryTimeframeFilter === 'next_week') {
          matchesDeliveryTimeframe = diffDays > 7 && diffDays <= 14;
        } else if (deliveryTimeframeFilter === 'later') {
          matchesDeliveryTimeframe = diffDays > 14;
        }
      }
    }

    return matchesSearch && matchesDate && matchesStatus && matchesPaymentStatus && matchesDeliveryTimeframe;
    });
  }, [localSales, searchTerm, dateFrom, dateTo, statusFilter, paymentStatusFilter, deliveryTimeframeFilter]);

  const handleAttachReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attachingReceiptId || !onAttachReceipt) return;

    if (receiptFile) {
      setIsUploadingReceipt(true);
      try {
        let fileToProcess = receiptFile;
        
        if (receiptFile.type.startsWith('image/')) {
          const options = {
            maxSizeMB: 0.1, // Max 100KB
            maxWidthOrHeight: 800,
            useWebWorker: true
          };
          fileToProcess = await imageCompression(receiptFile, options);
        } else if (receiptFile.size > 100 * 1024) {
          alert('El archivo es demasiado grande. Por favor, selecciona un archivo de menos de 100KB o usa un enlace.');
          setIsUploadingReceipt(false);
          return;
        }

        const reader = new FileReader();
        const base64Url = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(fileToProcess);
        });
        onAttachReceipt(attachingReceiptId, base64Url);
        setAttachingReceiptId(null);
        setReceiptFile(null);
        setReceiptUrl('');
      } catch (error: any) {
        console.error('Error uploading receipt:', error);
        const errorMessage = error.message || 'Error desconocido';
        const errorCode = error.code || 'unknown';
        alert(`Error al procesar el comprobante (${errorCode}): ${errorMessage}. Por favor, intenta de nuevo.`);
      } finally {
        setIsUploadingReceipt(false);
      }
    } else if (receiptUrl) {
      onAttachReceipt(attachingReceiptId, receiptUrl);
      setAttachingReceiptId(null);
      setReceiptFile(null);
      setReceiptUrl('');
    }
  };

  const handleRejectPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (rejectingSaleId && onUpdateSale) {
      const sale = localSales.find(s => s.id === rejectingSaleId);
      if (sale) {
        const updatedSale = {
          ...sale,
          paymentStatus: 'rejected' as any,
          rejectionReason: rejectionReason
        };
        // 🚀 Actualización Optimista
        setLocalSales(prev => prev.map(s => s.id === sale.id ? updatedSale : s));
        onUpdateSale(updatedSale);
      }
      setRejectingSaleId(null);
      setRejectionReason('');
    }
  };

  const handleCancelSale = () => {
    if (cancellingSaleId && onUpdateSale) {
      const sale = localSales.find(s => s.id === cancellingSaleId);
      if (sale) {
        const updatedSale = {
          ...sale,
          status: 'cancelado' as SaleStatus,
        };
        // 🚀 Actualización Optimista
        setLocalSales(prev => prev.map(s => s.id === sale.id ? updatedSale : s));
        onUpdateSale(updatedSale);
      }
      setCancellingSaleId(null);
    }
  };

  const handleRegisterPayment = () => {
    if (!saleForPayment || !paymentAmount || !onUpdateSale) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    const newPayment = {
      amount,
      method: paymentMethod,
      date: new Date().toISOString()
    };

    const newAmountPaid = (saleForPayment.amountPaid || 0) + amount;
    
    const updatedSale: Sale = {
      ...saleForPayment,
      amountPaid: newAmountPaid,
      paymentHistory: [...(saleForPayment.paymentHistory || []), newPayment]
    };

    // 🚀 Actualización Optimista de Pagos
    setLocalSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));
    onUpdateSale(updatedSale);
    setIsPaymentModalOpen(false);
    setSaleForPayment(null);
    setPaymentAmount('');
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('es-AR', { 
    style: 'currency', 
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);

  const handleEditPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPaymentSaleId && onUpdateSale) {
      const sale = localSales.find(s => s.id === editingPaymentSaleId);
      if (sale) {
        const amountAdded = editAmountPaid - sale.amountPaid;
        const newHistory = [...(sale.paymentHistory || [])];
        
        if (amountAdded !== 0 || editPaymentStatus !== sale.paymentStatus || editPaymentMethod !== sale.paymentMethod) {
          newHistory.push({
            date: new Date(editPaymentDate + 'T12:00:00').toISOString(),
            amount: amountAdded,
            method: editPaymentMethod as any,
            status: editPaymentStatus as any,
            notes: editPaymentNotes
          });
        }

        const updatedSale = {
          ...sale,
          paymentPercentage: editPaymentPercentage,
          paymentMethod: editPaymentMethod as any,
          paymentStatus: editPaymentStatus as any,
          amountPaid: editAmountPaid,
          paymentNotes: editPaymentNotes,
          paymentHistory: newHistory
        };
        
        // 🚀 Actualización Optimista de Edición de Pagos
        setLocalSales(prev => prev.map(s => s.id === sale.id ? updatedSale : s));
        onUpdateSale(updatedSale);
        setEditingPaymentSaleId(null);
      }
    }
  };

  const handleWhatsApp = (sale: Sale) => {
    const customer = customers.find(c => c.id === sale.customerId);
    if (!customer || !customer.phone) {
      alert("El cliente no tiene un número de teléfono registrado.");
      return;
    }

    let message = `¡Hola ${customer.name}! 👋\n\n`;
    
    if (sale.status === 'cancelado') {
      message += `Te escribimos por tu pedido en *JANLU*.\n\nTe informamos que tu pedido ha sido *cancelado*.\nSi tienes alguna duda, por favor contactanos.`;
    } else if (sale.paymentStatus === 'rejected') {
      message += `Te escribimos por tu pedido en *JANLU*.\n\nLamentablemente tuvimos un inconveniente con el pago.\nMotivo: ${sale.rejectionReason || 'No especificado'}\n\nPor favor, contactanos para resolverlo.`;
    } else {
      message += `Te comparto el detalle de tu compra en *JANLU*:\n\n`;
      sale.items.forEach(item => {
        message += `- ${item.quantity}x ${item.productName} (${item.variantName}): ${formatCurrency(item.price)}\n`;
      });

      message += `\n\n*Total: ${formatCurrency(sale.totalAmount)}*\n`;
      message += `_Abonado: ${formatCurrency(sale.amountPaid)}_\n`;
      
      if (sale.balanceDue && sale.balanceDue > 0) {
        message += `_Saldo pendiente: ${formatCurrency(sale.balanceDue)}_\n`;
      } else if (sale.amountPaid < sale.totalAmount) {
        message += `_Saldo pendiente: ${formatCurrency(sale.totalAmount - sale.amountPaid)}_\n`;
      }

      message += `\n¡Gracias por elegirnos! ✨`;
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleExportCSV = () => {
    const headers = [
      'Número de Pedido',
      'Fecha de Emisión',
      'Fecha de Entrega',
      'Estado',
      'Cliente',
      'Artículos'
    ];

    const rows = filteredSales.map(sale => {
      const orderNumber = sale.orderNumber ? `#${sale.orderNumber}` : '-';
      const issueDate = new Date(sale.date).toLocaleDateString('es-AR');
      const deliveryDate = sale.deliveryDate ? new Date(sale.deliveryDate).toLocaleDateString('es-AR') : '-';
      
      const statusLabels: Record<string, string> = {
        presupuesto: 'Presupuesto',
        nuevo: 'Nuevo',
        en_preparacion: 'En Preparación',
        listo_para_entregar: 'Listo p/ Entregar',
        entregado: 'Entregado',
        cancelado: 'Cancelada'
      };
      const status = statusLabels[sale.status || 'nuevo'] || 'Nuevo';
      
      const customer = sale.customerName || 'Consumidor Final';
      
      const itemsDesc = sale.items.map(item => `${item.quantity}x ${item.productName} (${item.variantName})`).join(' | ');

      return [
        orderNumber,
        issueDate,
        deliveryDate,
        status,
        `"${customer}"`,
        `"${itemsDesc}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ventas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {/* Vista Normal */}
      <div className="flex-1 w-full flex flex-col min-h-0 space-y-6 print:hidden">
        <div className="flex-none flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Ventas</h2>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  placeholder="Buscar pedido, cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
                />
                <Search className="absolute left-3 top-2.5 text-stone-400" size={18} />
              </div>
              <div className="flex space-x-3 w-full sm:w-auto">
                <button
                  onClick={handleExportCSV}
                  className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors text-sm font-medium"
                >
                  <FileText size={18} className="mr-2" />
                  Exportar
                </button>
                <button
                  onClick={onNewSale}
                  className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  <Plus size={18} className="mr-2" />
                  Nueva Venta
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-stone-500 dark:text-stone-400">Fecha:</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
                title="Fecha desde"
              />
              <span className="text-stone-400">-</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
                title="Fecha hasta"
              />
            </div>

            <div className="h-6 w-px bg-stone-200 dark:bg-stone-700 hidden md:block"></div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            >
              <option value="all">Todos los estados</option>
              <option value="presupuesto">Presupuestos</option>
              <option value="nuevo">Nuevo</option>
              <option value="en_preparacion">En preparación</option>
              <option value="listo_para_entregar">Listo para entregar</option>
              <option value="entregado">Entregado</option>
              <option value="cancelado">Cancelada</option>
            </select>

            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            >
              <option value="all">Pagos: Todos</option>
              <option value="pending">Pendiente</option>
              <option value="verified">Verificado</option>
              <option value="partial_paid">Pago Parcial</option>
              <option value="pending_at_pickup">Abonar al retirar</option>
              <option value="rejected">Rechazado</option>
            </select>

            <select
              value={deliveryTimeframeFilter}
              onChange={(e) => setDeliveryTimeframeFilter(e.target.value)}
              className="px-3 py-1.5 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            >
              <option value="all">Plazos: Todos</option>
              <option value="overdue">Atrasados</option>
              <option value="today">Hoy</option>
              <option value="this_week">Esta semana (1-7 días)</option>
              <option value="next_week">Próxima semana (8-14 días)</option>
              <option value="later">Más adelante (+14 días)</option>
            </select>
          </div>
        </div>

        <div className="w-full bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[1200px] relative">
              <thead className="sticky top-0 z-10 bg-stone-50 dark:bg-stone-950 shadow-sm">
                <tr className="border-b border-stone-100 dark:border-stone-800 text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">Pedido</th>
                  <th className="p-4 font-medium">Fecha</th>
                  <th className="p-4 font-medium">Cliente</th>
                  <th className="p-4 font-medium">Artículos</th>
                  <th className="p-4 font-medium">Total</th>
                  <th className="p-4 font-medium">Pagado</th>
                  <th className="p-4 font-medium">Método</th>
                  <th className="p-4 font-medium">Pago</th>
                  <th className="p-4 font-medium">Estado Pedido</th>
                  <th className="p-4 font-medium">Plazo Entrega</th>
                  <th className="p-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {filteredSales.length === 0 ? (
                  <tr><td colSpan={11} className="p-8 text-center text-stone-500 dark:text-stone-400">No hay ventas registradas.</td></tr>
                ) : (
                  [...filteredSales].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((sale, idx) => {
                    const totalItems = sale.items.reduce((acc, item) => acc + item.quantity, 0);
                    const isFullyPaid = sale.paymentPercentage >= 100;
                    const methodLabels: Record<string, string> = {
                      efectivo: 'Efectivo',
                      transferencia: 'Transferencia',
                      tarjeta: 'Tarjeta',
                      qr: 'QR',
                      transfer_full: 'Transferencia (100%)',
                      transfer_partial: 'Transferencia (Seña)',
                      on_pickup: 'Abonar al retirar',
                      mixto: 'Mixto (Transf. + Efvo)'
                    };
                    const statusLabels: Record<string, string> = {
                      presupuesto: 'Presupuesto',
                      nuevo: 'Nuevo',
                      en_preparacion: 'En Preparación',
                      listo_para_entregar: 'Listo p/ Entregar',
                      entregado: 'Entregado',
                      cancelado: 'Cancelada'
                    };
                    const statusColors: Record<string, string> = {
                      presupuesto: 'bg-indigo-100 text-indigo-800',
                      nuevo: 'bg-stone-100 text-stone-800',
                      en_preparacion: 'bg-blue-100 text-blue-800',
                      listo_para_entregar: 'bg-teal-100 text-teal-800',
                      entregado: 'bg-emerald-100 text-emerald-800',
                      cancelado: 'bg-rose-100 text-rose-800 line-through opacity-70'
                    };
                    const saleStatus = sale.status || 'nuevo';

                    const getDeliveryBadge = () => {
                      if (saleStatus === 'entregado') return <span className="text-stone-400 text-xs">Entregado</span>;
                      if (!sale.deliveryDate) return <span className="text-stone-400 text-xs">Sin fecha</span>;
                      
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      // Add timezone offset to avoid off-by-one day issues with YYYY-MM-DD
                      const delivery = new Date(sale.deliveryDate + 'T00:00:00');
                      delivery.setHours(0, 0, 0, 0);
                      
                      if (saleStatus === 'listo_para_entregar') {
                        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">Listo p/ Entregar</span>;
                      }

                      const diffTime = delivery.getTime() - today.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                      if (diffDays < 0) {
                        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">Atrasado ({Math.abs(diffDays)}d)</span>;
                      } else if (diffDays <= 3) {
                        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Por vencer ({diffDays}d)</span>;
                      } else {
                        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">En tiempo ({diffDays}d)</span>;
                      }
                    };

                    const getPaymentStatusBadge = () => {
                      if (sale.paymentStatus === 'rejected') {
                        return (
                          <div className="flex flex-col items-start gap-1">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
                              <AlertTriangle size={12} className="mr-1" /> Rechazado
                            </span>
                            {sale.rejectionReason && (
                              <span className="text-[10px] text-rose-600 dark:text-rose-400 max-w-[120px] truncate" title={sale.rejectionReason}>
                                {sale.rejectionReason}
                              </span>
                            )}
                          </div>
                        );
                      }
                      if (sale.paymentStatus === 'pending_at_pickup') {
                        return (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                            Paga al retirar
                          </span>
                        );
                      }
                      if (sale.paymentMethod === 'transfer_partial' && !isFullyPaid) {
                        return (
                          <div className="flex flex-col items-start gap-1">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              Seña
                            </span>
                            <span className="text-[10px] text-stone-500 dark:text-stone-400">
                              Falta: {formatCurrency(sale.totalAmount - sale.amountPaid)}
                            </span>
                          </div>
                        );
                      }
                      if (sale.paymentStatus === 'partial_paid') {
                        return (
                          <div className="flex flex-col items-start gap-1">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              Seña Pagada
                            </span>
                            <span className="text-[10px] text-stone-500 dark:text-stone-400">
                              Falta: {formatCurrency(sale.totalAmount - sale.amountPaid)}
                            </span>
                          </div>
                        );
                      }
                      if (isFullyPaid) {
                        return (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <CheckCircle size={12} className="mr-1" /> Pagado 100%
                          </span>
                        );
                      }
                      if (sale.paymentStatus === 'verified') {
                        return (
                          <div className="flex flex-col items-start gap-1">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                              <CheckCircle size={12} className="mr-1" /> Verificado
                            </span>
                            <span className="text-[10px] text-stone-500 dark:text-stone-400">
                              Falta: {formatCurrency(sale.totalAmount - sale.amountPaid)}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          Pendiente
                        </span>
                      );
                    };

                    return (
                      <tr key={`${sale.id}-${idx}`} className="hover:bg-stone-50 dark:hover:bg-stone-800/50 group">
                        <td className="p-4 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                          {sale.orderNumber ? `#${sale.orderNumber}` : '-'}
                        </td>
                        <td className="p-4 text-sm text-stone-900 dark:text-stone-100">{new Date(sale.date).toLocaleString()}</td>
                        <td className="p-4 text-sm font-medium text-stone-900 dark:text-stone-100">
                          <div>{sale.customerName}</div>
                          {sale.generatedCouponCode && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">
                                Cupón: {sale.generatedCouponCode}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-sm text-stone-600 dark:text-stone-400">
                          <div className="font-medium">{totalItems} unid.</div>
                          <div className="text-xs text-stone-400 dark:text-stone-500 truncate max-w-[150px]">
                            {sale.items.map(i => i.productName).join(', ')}
                          </div>
                        </td>
                        <td className="p-4 text-sm font-medium text-stone-900 dark:text-stone-100">{formatCurrency(sale.totalAmount)}</td>
                        <td className="p-4 text-sm text-stone-600 dark:text-stone-400">
                          {formatCurrency(sale.amountPaid)} <span className="text-xs text-stone-400 dark:text-stone-500">({sale.paymentPercentage.toFixed(2)}%)</span>
                        </td>
                        <td className="p-4 text-sm text-stone-600 dark:text-stone-400 capitalize">
                          <div className="flex items-center gap-1">
                            {methodLabels[sale.paymentMethod || 'efectivo'] || sale.paymentMethod}
                            {sale.paymentNotes && (
                              <span title={sale.paymentNotes} className="text-stone-400 cursor-help">
                                <FileText size={14} />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          {getPaymentStatusBadge()}
                        </td>
                        <td className="p-4">
                          {onUpdateSale && sale.status !== 'cancelado' ? (
                            <select
                              value={saleStatus}
                              onChange={(e) => {
                                const newStatus = e.target.value as SaleStatus;
                                const updatedSale = { ...sale, status: newStatus };
                                
                                // 🚀 Actualización Optimista: Repintamos la UI al instante
                                setLocalSales(prev => prev.map(s => s.id === sale.id ? updatedSale : s));
                                
                                // Enviamos el cambio a Firebase en segundo plano
                                if (onUpdateSale) {
                                  onUpdateSale(updatedSale);
                                }
                              }}
                              className={`text-xs font-medium rounded-full px-2.5 py-1 border-none cursor-pointer focus:ring-2 focus:ring-indigo-500 outline-none ${statusColors[saleStatus]} dark:bg-stone-800 dark:text-stone-200`}
                            >
                              {Object.entries(statusLabels).map(([key, label]) => (
                                <option key={key} value={key} className="bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100">{label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[saleStatus]} dark:bg-stone-800 dark:text-stone-200`}>
                              {statusLabels[saleStatus]}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col items-start gap-1">
                            <div className="flex items-center gap-2">
                              {sale.deliveryDate && <span className="text-xs text-stone-600 dark:text-stone-400">{new Date(sale.deliveryDate + 'T00:00:00').toLocaleDateString()}</span>}
                              {onUpdateSale && sale.status !== 'cancelado' && (
                                <button
                                  onClick={() => {
                                    setEditingDeliverySaleId(sale.id);
                                    setEditDeliveryDate(sale.deliveryDate || '');
                                    setEditDeliveryTimeRange(sale.deliveryTimeRange || '');
                                  }}
                                  className="p-1 text-stone-400 hover:text-indigo-600 transition-colors"
                                  title="Editar Fecha de Entrega"
                                >
                                  <Calendar size={14} />
                                </button>
                              )}
                            </div>
                            {sale.deliveryTimeRange && (
                              <span className="text-[10px] text-stone-500 dark:text-stone-500 flex items-center gap-1">
                                <Clock size={10} /> {sale.deliveryTimeRange}
                              </span>
                            )}
                            {getDeliveryBadge()}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end space-x-2 transition-opacity">
                            {sale.status === 'nuevo' && sale.paymentStatus !== 'rejected' && onUpdateSale && (
                              <button
                                onClick={() => setRejectingSaleId(sale.id)}
                                className="p-2 text-stone-400 dark:text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                title="Rechazar Pago"
                              >
                                <X size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => handleWhatsApp(sale)}
                              className="p-2 text-stone-400 dark:text-stone-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                              title="Enviar por WhatsApp"
                            >
                              <MessageCircle size={16} />
                            </button>
                            {sale.status !== 'cancelado' && (
                              <OrderConfirmationImage 
                                sale={sale} 
                                storeSettings={storeSettings} 
                                customerPhone={customers.find(c => c.id === sale.customerId)?.phone}
                              />
                            )}
                            {sale.receiptUrl ? (
                              <a
                                href={sale.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                title="Ver Comprobante"
                              >
                                <FileText size={16} />
                              </a>
                            ) : sale.status !== 'cancelado' && (
                              <button
                                onClick={() => setAttachingReceiptId(sale.id)}
                                className="p-2 text-stone-400 dark:text-stone-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                title="Adjuntar Comprobante"
                              >
                                <LinkIcon size={16} />
                              </button>
                            )}
                            <button
                              onClick={() => handlePreview(sale)}
                              className="p-2 text-stone-400 dark:text-stone-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                              title="Ver Etiqueta"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => {
                                setPreviewSaleId(sale.id);
                                setTimeout(() => window.print(), 500);
                              }}
                              className="p-2 text-stone-400 hover:text-indigo-600 transition-colors"
                              title="Imprimir Etiqueta de Envío"
                            >
                              <Package size={16} />
                            </button>
                            {sale.status !== 'cancelado' && onUpdateSale && (
                              <button
                                onClick={() => {
                                  setEditingPaymentSaleId(sale.id);
                                  setOriginalAmountPaid(sale.amountPaid);
                                  setAdjustmentAmount(0);
                                  setEditPaymentDate(new Date().toISOString().split('T')[0]);
                                  setEditPaymentPercentage(sale.paymentPercentage);
                                  setEditPaymentMethod(sale.paymentMethod || 'efectivo');
                                  setEditPaymentStatus(sale.paymentStatus || 'verified');
                                  setEditAmountPaid(sale.amountPaid);
                                  setEditPaymentMode(sale.paymentPercentage === 100 ? 'percentage' : 'amount');
                                  setEditPaymentNotes(sale.paymentNotes || '');
                                }}
                                className="p-2 text-stone-400 dark:text-stone-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                title="Editar Pago"
                              >
                                <CreditCard size={16} />
                              </button>
                            )}
                            {sale.status !== 'cancelado' && onUpdateSale && (
                              <button
                                onClick={() => setCancellingSaleId(sale.id)}
                                className="p-2 text-stone-400 dark:text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                title="Dar de baja (Cancelar)"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {hasMoreSales && (
            <div className="flex justify-center mt-6 pb-6">
              <button
                onClick={async () => {
                  setIsLoadingHistory(true);
                  try {
                    await fetchMoreSales();
                  } finally {
                    setIsLoadingHistory(false);
                  }
                }}
                disabled={isLoadingHistory}
                className="flex items-center gap-2 px-6 py-3 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-medium rounded-xl transition-all shadow-sm disabled:opacity-50"
              >
                {isLoadingHistory ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Cargando historial...
                  </>
                ) : (
                  <>
                    <Clock size={18} />
                    Cargar ventas anteriores
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Adjuntar Comprobante */}
      {attachingReceiptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100">Adjuntar Comprobante</h3>
              <button onClick={() => { setAttachingReceiptId(null); setReceiptFile(null); setReceiptUrl(''); }} className="text-stone-400 hover:text-stone-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleAttachReceipt} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Subir Archivo (Imagen o PDF)</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-stone-300 dark:border-stone-700 border-dashed rounded-xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-colors">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-stone-400" />
                    <div className="flex text-sm text-stone-600 dark:text-stone-400 justify-center">
                      <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-stone-900 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                        <span>Seleccionar archivo</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*,application/pdf" onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setReceiptFile(e.target.files[0]);
                            setReceiptUrl('');
                          }
                        }} />
                      </label>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-500">
                      {receiptFile ? receiptFile.name : 'PNG, JPG, PDF hasta 5MB'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-stone-200 dark:border-stone-800"></div>
                <span className="flex-shrink-0 mx-4 text-stone-400 text-sm">O usa una URL</span>
                <div className="flex-grow border-t border-stone-200 dark:border-stone-800"></div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">URL del Comprobante</label>
                <input
                  type="url"
                  placeholder="https://ejemplo.com/comprobante.pdf"
                  className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  value={receiptUrl}
                  onChange={(e) => { setReceiptUrl(e.target.value); setReceiptFile(null); }}
                  disabled={!!receiptFile}
                />
              </div>
              <button 
                type="submit" 
                disabled={isUploadingReceipt || (!receiptUrl && !receiptFile)}
                className="w-full flex items-center justify-center bg-indigo-600 text-white font-bold py-2 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {isUploadingReceipt ? <Loader2 size={20} className="animate-spin mr-2" /> : null}
                {isUploadingReceipt ? 'Subiendo...' : 'Guardar Comprobante'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Rechazar Pago */}
      {rejectingSaleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-rose-100 dark:border-rose-900/50">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center text-rose-600 dark:text-rose-400">
                <AlertTriangle size={24} className="mr-2" />
                <h3 className="text-lg font-bold">Rechazar Pago</h3>
              </div>
              <button onClick={() => setRejectingSaleId(null)} className="text-stone-400 hover:text-stone-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleRejectPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Motivo del rechazo</label>
                <textarea
                  required
                  placeholder="Ej: El comprobante está borroso, el monto transferido es incorrecto ($15.000 en lugar de $25.000), etc."
                  className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 min-h-[100px] resize-none"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
              <div className="flex space-x-3">
                <button 
                  type="button" 
                  onClick={() => setRejectingSaleId(null)}
                  className="flex-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold py-2 rounded-xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-rose-600 text-white font-bold py-2 rounded-xl hover:bg-rose-700 transition-colors"
                >
                  Confirmar Rechazo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cancelar Venta */}
      {cancellingSaleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-rose-100 dark:border-rose-900/50">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center text-rose-600 dark:text-rose-400">
                <AlertTriangle size={24} className="mr-2" />
                <h3 className="text-lg font-bold">Dar de baja Venta</h3>
              </div>
              <button onClick={() => setCancellingSaleId(null)} className="text-stone-400 hover:text-stone-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <p className="text-stone-600 dark:text-stone-400">
                ¿Estás seguro de que deseas dar de baja esta venta? 
                Esta acción devolverá los productos y/o insumos al stock. La venta quedará registrada como "Cancelada".
              </p>
              <div className="flex space-x-3">
                <button 
                  type="button" 
                  onClick={() => setCancellingSaleId(null)}
                  className="flex-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold py-2 rounded-xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                >
                  Volver
                </button>
                <button 
                  onClick={handleCancelSale}
                  className="flex-1 bg-rose-600 text-white font-bold py-2 rounded-xl hover:bg-rose-700 transition-colors"
                >
                  Confirmar Baja
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vista de Impresión (Etiqueta) */}
      {saleToPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm print:block print:static print:bg-transparent print:backdrop-blur-none p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col print:shadow-none print:p-0 print:max-h-none print:block">
            
            {/* Modal Header - Hidden on Print */}
            <div className="flex justify-between items-center p-6 border-b border-stone-100 dark:border-stone-800 print:hidden">
              <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100">Vista Previa de Etiqueta</h3>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => window.print()}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  <Printer size={16} className="mr-2" />
                  Imprimir
                </button>
                <button
                  onClick={() => setPreviewSaleId(null)}
                  className="p-2 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body - This is what gets printed */}
            <div className="p-8 overflow-y-auto bg-stone-50 dark:bg-stone-950/50 print:bg-white print:p-0 print:overflow-visible flex-1">
              <div className="bg-white dark:bg-stone-900 border-4 border-black dark:border-stone-700 p-8 max-w-xl mx-auto rounded-xl shadow-sm print:shadow-none print:border-4 print:border-black print:m-0 print:max-w-none">
                <div className="flex flex-col items-center justify-center mb-8 border-b-2 border-black dark:border-stone-700 pb-6 print:border-black">
                  <h1 className="text-6xl font-cinzel font-bold text-stone-900 dark:text-stone-100 print:text-black leading-none tracking-normal">JANLU</h1>
                  <p className="font-lato text-sm uppercase tracking-[0.3em] text-stone-600 dark:text-stone-400 print:text-stone-600 mt-2 ml-1">Aromas & Diseño</p>
                </div>

                <div className="mb-8 flex justify-between items-start">
                  <div className="flex-1 pr-4">
                    <h2 className="text-xs uppercase tracking-widest text-gray-500 dark:text-stone-400 print:text-gray-500 mb-1">Destinatario</h2>
                    <p className="text-3xl font-bold font-lato text-stone-900 dark:text-stone-100 print:text-black">{saleToPreview.customerName}</p>
                    <p className="text-sm text-gray-500 dark:text-stone-400 print:text-gray-500 mt-2">Fecha de orden: {new Date(saleToPreview.date).toLocaleDateString()}</p>
                    
                    <div className="mt-4 space-y-3">
                      <div className={!printAddress ? "print:hidden" : ""}>
                        <h3 className="text-xs uppercase tracking-widest text-gray-500 dark:text-stone-400 print:text-gray-500 mb-1">Dirección de Entrega</h3>
                        <textarea
                          value={printAddress}
                          onChange={(e) => setPrintAddress(e.target.value)}
                          placeholder="Agregar dirección..."
                          className="w-full bg-stone-100 dark:bg-stone-800 border-none rounded-lg p-2 text-sm text-stone-900 dark:text-stone-100 resize-none focus:ring-2 focus:ring-indigo-500 print:hidden"
                          rows={2}
                        />
                        <div className="hidden print:block text-sm text-black whitespace-pre-wrap font-medium">
                          {printAddress}
                        </div>
                      </div>
                      <div className={!printNotes ? "print:hidden" : ""}>
                        <h3 className="text-xs uppercase tracking-widest text-gray-500 dark:text-stone-400 print:text-gray-500 mb-1">Notas / Instrucciones</h3>
                        <textarea
                          value={printNotes}
                          onChange={(e) => setPrintNotes(e.target.value)}
                          placeholder="Ej: Llamar al llegar, casa al fondo..."
                          className="w-full bg-stone-100 dark:bg-stone-800 border-none rounded-lg p-2 text-sm text-stone-900 dark:text-stone-100 resize-none focus:ring-2 focus:ring-indigo-500 print:hidden"
                          rows={2}
                        />
                        <div className="hidden print:block text-sm text-black whitespace-pre-wrap font-medium">
                          {printNotes}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end">
                    {saleToPreview.orderNumber && (
                      <>
                        <h2 className="text-xs uppercase tracking-widest text-gray-500 dark:text-stone-400 print:text-gray-500 mb-1">Pedido N°</h2>
                        <p className="text-3xl font-bold font-lato text-indigo-600 dark:text-indigo-400 print:text-black mb-2">#{saleToPreview.orderNumber}</p>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="text-xs uppercase tracking-widest text-gray-500 dark:text-stone-400 print:text-gray-500 mb-4 border-b border-gray-200 dark:border-stone-700 print:border-gray-200 pb-2">Contenido del Paquete</h2>
                  <ul className="space-y-6">
                    {saleToPreview.items.map((item, idx) => {
                      const product = products.find(p => p.id === item.productId);
                      return (
                        <li key={idx} className="flex items-start">
                          <div className="bg-black dark:bg-stone-100 text-white dark:text-stone-900 print:bg-black print:text-white font-bold rounded-md w-8 h-8 flex items-center justify-center shrink-0 mr-4 mt-1">
                            {item.quantity}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-bold text-xl font-lato text-stone-900 dark:text-stone-100 print:text-black">{item.productName}</p>
                                <p className="text-md text-gray-600 dark:text-stone-300 print:text-gray-600 font-medium mb-1">Variante: {item.variantName}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-stone-900 dark:text-stone-100 print:text-black">
                                  {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(item.price)} c/u
                                </p>
                                <p className="text-base font-black text-stone-900 dark:text-stone-100 print:text-black">
                                  {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(item.price * item.quantity)}
                                </p>
                              </div>
                            </div>
                            {product?.description && (
                              <p className="text-sm text-gray-500 dark:text-stone-400 print:text-gray-500 italic">{product.description}</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-stone-700 print:border-gray-200">
                  <h2 className="text-xs uppercase tracking-widest text-gray-500 dark:text-stone-400 print:text-gray-500 mb-4">Detalles de Pago</h2>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm mb-2">
                      <span className="text-stone-500 dark:text-stone-400 print:text-gray-500">Fecha de orden:</span>
                      <span className="text-stone-700 dark:text-stone-300 print:text-gray-700">{new Date(saleToPreview.date).toLocaleDateString()}</span>
                    </div>
                    {saleToPreview.paymentHistory && saleToPreview.paymentHistory.length > 0 && (
                      <div className="pt-2 pb-2 border-y border-stone-100 dark:border-stone-800 print:border-gray-100 my-2">
                        <span className="text-xs uppercase tracking-widest text-gray-500 dark:text-stone-400 print:text-gray-500 mb-2 block">Historial de Pagos</span>
                        {saleToPreview.paymentHistory.map((ph, i) => (
                          <div key={i} className="flex justify-between items-center text-sm mb-1">
                            <div className="flex flex-col">
                              <span className="text-stone-700 dark:text-stone-300 print:text-gray-700 font-medium">
                                {ph.amount > 0 ? 'Pago recibido' : 'Ajuste de pago'}
                              </span>
                              <span className="text-[10px] text-stone-500 dark:text-stone-400 print:text-gray-500">
                                {new Date(ph.date).toLocaleDateString()} - {ph.method ? (ph.method.charAt(0).toUpperCase() + ph.method.slice(1)) : ''}
                              </span>
                            </div>
                            <span className={`font-bold ${ph.amount > 0 ? 'text-emerald-600 print:text-emerald-700' : 'text-rose-600 print:text-rose-700'}`}>
                              {ph.amount > 0 ? '+' : ''}${ph.amount.toLocaleString('es-AR')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {saleToPreview.discount && saleToPreview.discount > 0 && saleToPreview.discount < 100 && (
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="text-stone-500 dark:text-stone-400 print:text-gray-500">Subtotal:</span>
                        <span className="text-stone-700 dark:text-stone-300 print:text-gray-700">${(saleToPreview.totalAmount / (1 - saleToPreview.discount / 100)).toLocaleString('es-AR')}</span>
                      </div>
                    )}
                    {saleToPreview.discount && saleToPreview.discount > 0 && (
                      <div className="flex justify-between items-center text-sm mb-1">
                        <span className="text-emerald-600 dark:text-emerald-400 print:text-emerald-700 font-medium">Descuento {saleToPreview.appliedCouponCode ? `(${saleToPreview.appliedCouponCode})` : ''}:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 print:text-emerald-700">-{saleToPreview.discount}%</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-stone-600 dark:text-stone-300 print:text-gray-600 font-medium">Total del Pedido:</span>
                      <span className="font-bold text-stone-900 dark:text-stone-100 print:text-black">${saleToPreview.totalAmount.toLocaleString('es-AR')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-stone-600 dark:text-stone-300 print:text-gray-600 font-medium">Monto Abonado:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 print:text-emerald-700">${saleToPreview.amountPaid.toLocaleString('es-AR')}</span>
                    </div>
                    {saleToPreview.totalAmount > saleToPreview.amountPaid ? (
                      <>
                        <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-100 dark:border-stone-800 print:border-gray-100">
                          <span className="text-stone-800 dark:text-stone-200 print:text-black font-bold">Pendiente de Pago:</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400 print:text-rose-700 text-lg">${(saleToPreview.totalAmount - saleToPreview.amountPaid).toLocaleString('es-AR')}</span>
                        </div>
                        {/* Botón de Registrar Pago */}
                        {saleToPreview.status !== 'cancelado' && (
                          <button 
                            onClick={() => { setSaleForPayment(saleToPreview); setIsPaymentModalOpen(true); }}
                            className="mt-4 w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 print:hidden"
                          >
                            <DollarSign size={16} /> Registrar Pago
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-100 dark:border-stone-800 print:border-gray-100">
                        <span className="text-stone-800 dark:text-stone-200 print:text-black font-bold">Estado:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 print:text-emerald-700 uppercase text-sm tracking-wider">Pagado en su totalidad</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-12 pt-6 border-t-2 border-black dark:border-stone-700 print:border-black text-center flex flex-col items-center">
                  <div className="mb-4">
                    <QRCodeSVG 
                      value={`${window.location.origin}/#sales?search=${saleToPreview.orderNumber || saleToPreview.id}`} 
                      size={80} 
                      level="M" 
                      includeMargin={false} 
                    />
                  </div>
                  <p className="font-cinzel font-bold text-lg text-stone-900 dark:text-stone-100 print:text-black">¡Gracias por tu compra!</p>
                  <p className="text-sm text-gray-500 dark:text-stone-400 print:text-gray-500 mt-1">@janluvelas</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Editar Pago */}
      {editingPaymentSaleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100">Editar Pago</h3>
              <button onClick={() => setEditingPaymentSaleId(null)} className="text-stone-400 hover:text-stone-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleEditPaymentSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Estado de Pago</label>
                  <select
                    className="w-full bg-stone-100 dark:bg-stone-800 border-none rounded-xl p-3 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-indigo-500"
                    value={editPaymentStatus}
                    onChange={(e) => setEditPaymentStatus(e.target.value)}
                    required
                  >
                    <option value="pending_at_pickup">Abona al retirar</option>
                    <option value="pending">Pendiente</option>
                    <option value="verified">Pagado / Verificado</option>
                    <option value="partial_paid">Pago Parcial</option>
                    <option value="rejected">Rechazado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Método de Pago</label>
                  <select
                    className="w-full bg-stone-100 dark:bg-stone-800 border-none rounded-xl p-3 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-indigo-500"
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value)}
                    required
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="qr">QR</option>
                    <option value="on_pickup">Abona al retirar</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Fecha de la Operación</label>
                <input
                  type="date"
                  className="w-full bg-stone-100 dark:bg-stone-800 border-none rounded-xl p-3 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-indigo-500"
                  value={editPaymentDate}
                  onChange={(e) => setEditPaymentDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Monto Abonado</label>
                  <div className="flex bg-stone-100 dark:bg-stone-800 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setEditPaymentMode('percentage')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${editPaymentMode === 'percentage' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'}`}
                    >
                      Porcentaje
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPaymentMode('amount')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${editPaymentMode === 'amount' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300'}`}
                    >
                      Monto Fijo
                    </button>
                  </div>
                </div>

                {editPaymentMode === 'percentage' ? (
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={editPaymentPercentage}
                      onChange={(e) => {
                        const newPercentage = Number(e.target.value);
                        setEditPaymentPercentage(newPercentage);
                        const sale = localSales.find(s => s.id === editingPaymentSaleId);
                        if (sale) {
                          const newAmount = (sale.totalAmount * newPercentage) / 100;
                          setEditAmountPaid(newAmount);
                          setAdjustmentAmount(newAmount - originalAmountPaid);
                        }
                      }}
                      className="flex-1 h-2 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="text-lg font-bold text-stone-900 dark:text-stone-100 w-16 text-right">
                      {editPaymentPercentage}%
                    </span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 uppercase">Ajuste (+/-)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 font-medium">$</span>
                        <input
                          type="number"
                          step="100"
                          value={adjustmentAmount}
                          onChange={(e) => {
                            const adj = Number(e.target.value);
                            setAdjustmentAmount(adj);
                            const newTotal = originalAmountPaid + adj;
                            setEditAmountPaid(newTotal);
                            const sale = localSales.find(s => s.id === editingPaymentSaleId);
                            if (sale) {
                              setEditPaymentPercentage(sale.totalAmount > 0 ? (newTotal / sale.totalAmount) * 100 : 100);
                            }
                          }}
                          className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl py-3 pl-8 pr-4 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-indigo-500 font-bold text-lg"
                          placeholder="Ej: 5000 o -2000"
                        />
                      </div>
                      <p className="text-[10px] text-stone-500 mt-1">Ingresa un valor positivo para sumar o negativo para restar.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 uppercase">Total Abonado Resultante</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500 font-medium">$</span>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={editAmountPaid}
                          onChange={(e) => {
                            const total = Number(e.target.value);
                            setEditAmountPaid(total);
                            setAdjustmentAmount(total - originalAmountPaid);
                            const sale = localSales.find(s => s.id === editingPaymentSaleId);
                            if (sale) {
                              setEditPaymentPercentage(sale.totalAmount > 0 ? (total / sale.totalAmount) * 100 : 100);
                            }
                          }}
                          className="w-full bg-stone-100 dark:bg-stone-800 border-none rounded-xl py-3 pl-8 pr-4 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-indigo-500 font-medium"
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500 dark:text-stone-400">Total de la venta:</span>
                  <span className="font-medium text-stone-900 dark:text-stone-100">
                    {localSales.find(s => s.id === editingPaymentSaleId)?.totalAmount ? formatCurrency(localSales.find(s => s.id === editingPaymentSaleId)!.totalAmount) : '$0'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500 dark:text-stone-400">Monto abonado:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(editAmountPaid)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Notas de Pago (Opcional)</label>
                <textarea
                  value={editPaymentNotes}
                  onChange={(e) => setEditPaymentNotes(e.target.value)}
                  placeholder="Ej: 50% Transferencia, 50% Efectivo"
                  className="w-full bg-stone-100 dark:bg-stone-800 border-none rounded-xl p-3 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-indigo-500 resize-none h-20"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingPaymentSaleId(null)}
                  className="px-4 py-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Fecha de Entrega */}
      {editingDeliverySaleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                <Calendar className="text-indigo-600" size={20} />
                Plazo de Entrega
              </h3>
              <button onClick={() => setEditingDeliverySaleId(null)} className="text-stone-400 hover:text-stone-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Fecha Pactada</label>
                <input
                  type="date"
                  value={editDeliveryDate}
                  onChange={(e) => setEditDeliveryDate(e.target.value)}
                  className="w-full bg-stone-100 dark:bg-stone-800 border-none rounded-xl p-3 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Rango Horario (Opcional)</label>
                <input
                  type="text"
                  value={editDeliveryTimeRange}
                  onChange={(e) => setEditDeliveryTimeRange(e.target.value)}
                  placeholder="Ej: 14:00 - 18:00"
                  className="w-full bg-stone-100 dark:bg-stone-800 border-none rounded-xl p-3 text-stone-900 dark:text-stone-100 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setEditingDeliverySaleId(null)}
                  className="px-4 py-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateDelivery}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Registro de Pago Parcial/Total */}
      {isPaymentModalOpen && saleForPayment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl max-w-md w-full p-6 relative">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-serif font-bold text-stone-900 dark:text-stone-100">Registrar Pago</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-stone-400 hover:text-stone-600"><X size={24} /></button>
            </div>
            
            <div className="mb-6 bg-stone-50 dark:bg-stone-800 p-4 rounded-2xl border border-stone-100 dark:border-stone-700">
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-1">Saldo Pendiente</p>
              <p className="text-2xl font-bold text-rose-600">
                ${(saleForPayment.totalAmount - (saleForPayment.amountPaid || 0)).toLocaleString('es-AR')}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">Monto a registrar ($)</label>
                <input 
                  type="number" 
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Ej: 15000"
                  className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:ring-2 focus:ring-stone-900 dark:focus:ring-indigo-500 outline-none dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">Método de Pago</label>
                <select 
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-4 py-3 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:ring-2 focus:ring-stone-900 dark:focus:ring-indigo-500 outline-none dark:text-white"
                >
                  <option value="transferencia">Transferencia</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="mercadopago">MercadoPago</option>
                </select>
              </div>
            </div>

            <button 
              onClick={handleRegisterPayment}
              disabled={!paymentAmount}
              className="mt-8 w-full bg-stone-900 dark:bg-indigo-600 hover:bg-stone-800 dark:hover:bg-indigo-700 text-white py-4 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              Confirmar Pago
            </button>
          </div>
        </div>
      )}
      {/* 🖨️ Plantilla de Etiqueta de Envío */}
      {saleToPreview && (
        <div className="hidden print:block absolute inset-0 bg-white z-[9999]">
           <style type="text/css" media="print">
            {`
              @page { size: auto; margin: 0; }
              body * { visibility: hidden; }
              #print-shipping-container, #print-shipping-container * { visibility: visible; }
              #print-shipping-container { position: absolute; left: 0; top: 0; width: 100%; max-width: 100mm; padding: 20px; background: white; }
            `}
          </style>
          <div id="print-shipping-container" className="border-2 border-stone-900 p-4 rounded-lg">
            <div className="border-b-2 border-stone-900 pb-4 mb-4 flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-serif font-bold tracking-widest uppercase">JANLU</h1>
                <p className="text-[9px] text-stone-500 tracking-[0.3em]">AROMAS & DISEÑO</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">PEDIDO #{saleToPreview.orderNumber}</p>
                <p className="text-[10px] text-stone-500">{new Date(saleToPreview.date).toLocaleDateString('es-AR')}</p>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Destinatario</h3>
              <p className="text-lg font-bold text-stone-900 uppercase">{saleToPreview.customerName}</p>
              <p className="text-sm text-stone-800 mt-1">{customers.find(c => c.id === saleToPreview.customerId)?.address || 'Retiro en Local / Sin Dirección'}</p>
              <p className="text-sm text-stone-800 mt-1">Tel: {customers.find(c => c.id === saleToPreview.customerId)?.phone}</p>
            </div>

            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Contenido del Paquete</h3>
              <ul className="text-xs text-stone-800 space-y-1">
                {saleToPreview.items.map((item, idx) => (
                  <li key={idx} className="border-b border-stone-100 pb-1">
                    • <span className="font-bold">{item.quantity}x</span> {item.productName} ({item.variantName})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
