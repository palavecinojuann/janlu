import React, { useState, useRef, useMemo } from 'react';
import { Quote, Product, Customer } from '../types';
import { FileText, Plus, Download, Trash2, Eye, X, MessageCircle, Copy, CheckCircle } from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';

interface QuoteListProps {
  quotes: Quote[];
  products: Product[];
  customers: Customer[];
  onNewQuote: () => void;
  onDelete: (id: string) => void;
  onApprove: (quote: Quote) => void;
}

export default function QuoteList({ quotes, products, customers, onNewQuote, onDelete, onApprove }: QuoteListProps) {
  const [quoteToPreview, setQuoteToPreview] = useState<Quote | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'delete', quote: Quote } | null>(null);

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

  const handleDownloadImage = async (quote: Quote) => {
    setIsGenerating(true);
    
    // Wait for fonts to load
    await new Promise(resolve => setTimeout(resolve, 100));

    if (printRef.current) {
      const parent = printRef.current.parentElement;
      const originalOverflow = parent ? parent.style.overflow : '';
      const originalHeight = parent ? parent.style.height : '';
      
      if (parent) {
        parent.style.overflow = 'visible';
        parent.style.height = 'auto';
      }

      try {
        const image = await toPng(printRef.current, {
          pixelRatio: 2, // Higher resolution
          backgroundColor: '#ffffff',
          height: printRef.current.scrollHeight,
          style: {
            transform: 'none',
            margin: '0'
          }
        });
        
        const link = document.createElement('a');
        link.href = image;
        link.download = `Presupuesto_JANLU_${quote.customerName.replace(/\s+/g, '_')}.png`;
        link.click();
      } catch (error) {
        console.error("Error generating image:", error);
        alert("Hubo un error al generar la imagen.");
      } finally {
        if (parent) {
          parent.style.overflow = originalOverflow;
          parent.style.height = originalHeight;
        }
      }
    }
    setIsGenerating(false);
  };

  const handleCopyImage = async () => {
    if (!printRef.current) return;
    setIsGenerating(true);
    
    // Wait for fonts to load
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const parent = printRef.current.parentElement;
    const originalOverflow = parent ? parent.style.overflow : '';
    const originalHeight = parent ? parent.style.height : '';
    
    if (parent) {
      parent.style.overflow = 'visible';
      parent.style.height = 'auto';
    }

    try {
      const blob = await toBlob(printRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        height: printRef.current.scrollHeight,
        style: {
          transform: 'none',
          margin: '0'
        }
      });
      
      if (blob) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob
            })
          ]);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
          // Fallback for clipboard
          const textarea = document.createElement('textarea');
          textarea.value = 'No se pudo copiar la imagen automáticamente.';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          alert('Tu navegador no permite copiar imágenes automáticamente. Se ha copiado un mensaje de error en su lugar.');
        }
      }
    } catch (err) {
      console.error('Error copying image:', err);
      alert('No se pudo copiar la imagen. Tu navegador podría no soportar esta función.');
    } finally {
      if (parent) {
        parent.style.overflow = originalOverflow;
        parent.style.height = originalHeight;
      }
      setIsGenerating(false);
    }
  };

  const handleWhatsApp = (quote: Quote) => {
    const customer = customers.find(c => c.id === quote.customerId);
    if (!customer || !customer.phone) {
      alert("El cliente no tiene un número de teléfono registrado.");
      return;
    }

    let message = `¡Hola ${customer.name}! 👋\n\nTe comparto el detalle de tu presupuesto de *JANLU*:\n\n`;
    quote.items.forEach(item => {
      message += `- ${item.quantity}x ${item.productName} (${item.variantName}): ${formatCurrency(item.finalPrice)}\n`;
    });
    
    if (quote.globalModifier) {
      const modText = quote.globalModifier.isDiscount ? 'Descuento' : 'Recargo';
      const modValue = quote.globalModifier.type === 'percentage' ? formatPercent(quote.globalModifier.value) : formatCurrency(quote.globalModifier.value);
      message += `\n${modText} Global: ${modValue}`;
    }

    message += `\n\n*Total: ${formatCurrency(quote.totalAmount)}*\n`;
    message += `_Válido hasta: ${new Date(quote.validUntil).toLocaleDateString()}_\n\n`;
    message += `¡Cualquier duda me avisas! ✨`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0 space-y-6">
        <div className="flex-none flex justify-between items-center">
          <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Presupuestos</h2>
          <button
            onClick={onNewQuote}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <Plus size={18} className="mr-2" />
            Nuevo Presupuesto
          </button>
        </div>

        <div className="flex-1 bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 flex flex-col min-h-0">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse relative">
              <thead className="sticky top-0 z-10 bg-stone-50 dark:bg-stone-950 shadow-sm">
                <tr className="border-b border-stone-100 dark:border-stone-800 text-stone-500 dark:text-stone-400 text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">#</th>
                  <th className="p-4 font-medium">Fecha</th>
                  <th className="p-4 font-medium">Cliente</th>
                  <th className="p-4 font-medium">Válido hasta</th>
                  <th className="p-4 font-medium">Total</th>
                  <th className="p-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {quotes.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-stone-500 dark:text-stone-400">No hay presupuestos registrados.</td></tr>
                ) : (
                  [...quotes].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((quote, idx) => {
                    const isValid = new Date(quote.validUntil) >= new Date();
                    return (
                      <tr key={`${quote.id}-${idx}`} className="hover:bg-stone-50 dark:hover:bg-stone-800/50 group">
                        <td className="p-4 text-sm font-bold text-stone-900 dark:text-stone-100">#{quote.quoteNumber || '---'}</td>
                        <td className="p-4 text-sm text-stone-900 dark:text-stone-300">{new Date(quote.date).toLocaleDateString()}</td>
                        <td className="p-4 text-sm font-medium text-stone-900 dark:text-stone-100">{quote.customerName}</td>
                        <td className="p-4 text-sm">
                          <span className={isValid ? 'text-stone-600 dark:text-stone-400' : 'text-rose-500 dark:text-rose-400 font-medium'}>
                            {new Date(quote.validUntil).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="p-4 text-sm font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(quote.totalAmount)}</td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => setConfirmAction({ type: 'approve', quote })}
                              className="p-2 text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                              title="Aprobar y convertir en Venta"
                            >
                              <CheckCircle size={16} />
                            </button>
                            <button
                              onClick={() => handleWhatsApp(quote)}
                              className="p-2 text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                              title="Enviar por WhatsApp"
                            >
                              <MessageCircle size={16} />
                            </button>
                            <button
                              onClick={() => setQuoteToPreview(quote)}
                              className="p-2 text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                              title="Ver Presupuesto"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => setConfirmAction({ type: 'delete', quote })}
                              className="p-2 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
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
      </div>

      {/* Modal de Vista Previa */}
      {quoteToPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-stone-200 dark:border-stone-800">
            
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-6 border-b border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 rounded-t-2xl gap-4">
              <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100">Vista Previa de Presupuesto</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setConfirmAction({ type: 'approve', quote: quoteToPreview })}
                  className="flex items-center px-3 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-xs sm:text-sm font-medium"
                >
                  <CheckCircle size={16} className="mr-1 sm:mr-2" />
                  Aprobar
                </button>
                <button
                  onClick={handleCopyImage}
                  disabled={isGenerating}
                  className="flex items-center px-3 py-2 bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors text-xs sm:text-sm font-medium disabled:opacity-50"
                >
                  {isCopied ? <CheckCircle size={16} className="mr-1 sm:mr-2 text-emerald-500" /> : <Copy size={16} className="mr-1 sm:mr-2" />}
                  {isCopied ? 'Copiado' : 'Copiar'}
                </button>
                <button
                  onClick={() => handleDownloadImage(quoteToPreview)}
                  disabled={isGenerating}
                  className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-xs sm:text-sm font-medium disabled:opacity-50"
                >
                  <Download size={16} className="mr-1 sm:mr-2" />
                  {isGenerating ? 'Gen...' : 'Descargar'}
                </button>
                <button
                  onClick={() => setQuoteToPreview(null)}
                  className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors ml-auto sm:ml-0"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-8 overflow-auto bg-stone-100 dark:bg-stone-950 flex-1 flex justify-center items-start">
              <div className="origin-top transform scale-[0.4] sm:scale-[0.6] md:scale-75 lg:scale-100">
                <div 
                  ref={printRef} 
                  className="p-6 sm:p-10 w-[800px] font-sans shrink-0 shadow-lg"
                  style={{ backgroundColor: '#ffffff', color: '#000000' }}
                >
                  <div className="flex justify-between items-start pb-6 mb-8" style={{ borderBottom: '2px solid #000000' }}>
                  <div className="flex flex-col items-center">
                    <h1 className="text-5xl font-cinzel font-bold leading-none tracking-normal" style={{ color: '#000000' }}>JANLU</h1>
                    <p className="font-lato text-[11px] uppercase tracking-[0.3em] mt-1 ml-1" style={{ color: '#57534e' }}>Aromas & Diseño</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-2xl font-bold" style={{ color: '#1c1917' }}>PRESUPUESTO #{quoteToPreview.quoteNumber || '---'}</h2>
                    <p className="text-sm mt-1" style={{ color: '#78716c' }}>Fecha: {new Date(quoteToPreview.date).toLocaleDateString()}</p>
                    <p className="text-sm" style={{ color: '#78716c' }}>Válido hasta: {new Date(quoteToPreview.validUntil).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="mb-8 p-4 rounded-lg" style={{ backgroundColor: '#f5f5f4', border: '1px solid #e7e5e4' }}>
                  <h3 className="text-xs uppercase tracking-widest mb-1" style={{ color: '#78716c' }}>Cliente</h3>
                  <p className="text-xl font-bold" style={{ color: '#1c1917' }}>{quoteToPreview.customerName}</p>
                </div>

                <table className="w-full text-left border-collapse mb-8">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider" style={{ borderBottom: '2px solid #1c1917', color: '#1c1917' }}>
                      <th className="py-3 font-bold">Cant.</th>
                      <th className="py-3 font-bold">Descripción</th>
                      <th className="py-3 font-bold text-right">Precio Unit.</th>
                      <th className="py-3 font-bold text-right">Desc/Rec</th>
                      <th className="py-3 font-bold text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody style={{ borderBottom: '1px solid #e7e5e4' }}>
                    {quoteToPreview.items.map((item, idx) => {
                      const hasMod = item.modifier && item.modifier.value > 0;
                      const modText = hasMod 
                        ? `${item.modifier!.isDiscount ? '-' : '+'}${item.modifier!.type === 'percentage' ? formatPercent(item.modifier!.value) : formatCurrency(item.modifier!.value)}`
                        : '-';

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f5f5f4' }}>
                          <td className="py-4 text-sm font-medium" style={{ color: '#1c1917' }}>{item.quantity}</td>
                          <td className="py-4 text-sm" style={{ color: '#1c1917' }}>
                            <div className="font-bold">{item.productName}</div>
                            <div className="text-xs" style={{ color: '#78716c' }}>{item.variantName}</div>
                          </td>
                          <td className="py-4 text-sm text-right" style={{ color: '#1c1917' }}>{formatCurrency(item.unitPrice)}</td>
                          <td className="py-4 text-sm text-right" style={{ color: '#57534e' }}>{modText}</td>
                          <td className="py-4 text-sm font-bold text-right" style={{ color: '#1c1917' }}>{formatCurrency(item.finalPrice)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="w-1/2 ml-auto space-y-2">
                  <div className="flex justify-between text-sm" style={{ color: '#57534e' }}>
                    <span>Subtotal:</span>
                    <span>{formatCurrency(quoteToPreview.subtotal)}</span>
                  </div>
                  {quoteToPreview.globalModifier && (
                    <div className="flex justify-between text-sm" style={{ color: '#57534e' }}>
                      <span>{quoteToPreview.globalModifier.isDiscount ? 'Descuento Global' : 'Recargo Global'}:</span>
                      <span>
                        {quoteToPreview.globalModifier.isDiscount ? '-' : '+'}
                        {quoteToPreview.globalModifier.type === 'percentage' 
                          ? formatPercent(quoteToPreview.globalModifier.value) 
                          : formatCurrency(quoteToPreview.globalModifier.value)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-2xl pt-4" style={{ borderTop: '2px solid #000000', color: '#000000' }}>
                    <span>TOTAL:</span>
                    <span>{formatCurrency(quoteToPreview.totalAmount)}</span>
                  </div>
                </div>

                <div className="mt-16 pt-8 text-center" style={{ borderTop: '1px solid #e7e5e4' }}>
                  <p className="text-sm italic" style={{ color: '#78716c' }}>Los precios están sujetos a modificaciones sin previo aviso luego de la fecha de validez.</p>
                  <p className="text-sm font-bold mt-2" style={{ color: '#1c1917' }}>¡Gracias por elegir JANLU!</p>
                  <p className="text-sm mt-1" style={{ color: '#78716c' }}>@janluvelas</p>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-stone-200 dark:border-stone-800">
            <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100 mb-4">
              {confirmAction.type === 'approve' ? 'Aprobar Presupuesto' : 'Eliminar Presupuesto'}
            </h3>
            <p className="text-stone-600 dark:text-stone-400 mb-6">
              {confirmAction.type === 'approve' 
                ? '¿Estás seguro de que deseas aprobar este presupuesto y convertirlo en una venta?' 
                : '¿Estás seguro de que deseas eliminar este presupuesto? Esta acción no se puede deshacer.'}
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
                  if (confirmAction.type === 'approve') {
                    onApprove(confirmAction.quote);
                    setQuoteToPreview(null);
                  } else {
                    onDelete(confirmAction.quote.id);
                  }
                  setConfirmAction(null);
                }}
                className={`px-4 py-2 text-white rounded-xl transition-colors font-medium ${
                  confirmAction.type === 'approve' 
                    ? 'bg-emerald-600 hover:bg-emerald-700' 
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {confirmAction.type === 'approve' ? 'Aprobar' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
