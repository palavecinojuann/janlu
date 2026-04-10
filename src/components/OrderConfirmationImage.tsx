import React, { useRef, useState } from 'react';
import { Sale, StoreSettings } from '../types';
import { toPng } from 'html-to-image';
import { v4 as uuidv4 } from 'uuid';
import { Share2, Loader2, CheckCircle, Package, Instagram, Facebook, Image as ImageIcon, Copy, X, Sparkles } from 'lucide-react';

interface OrderConfirmationImageProps {
  sale: Sale;
  storeSettings: StoreSettings | null;
  customerPhone?: string;
}

export default function OrderConfirmationImage({ sale, storeSettings, customerPhone }: OrderConfirmationImageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const formatCurrency = (value: number) => new Intl.NumberFormat('es-AR', { 
    style: 'currency', 
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

  const handleGeneratePreview = async () => {
    if (!wrapperRef.current || !containerRef.current) return;
    setIsGenerating(true);

    try {
      // Calculate required dimensions
      const contentHeight = containerRef.current.scrollHeight;
      const targetWidth = 800; // Fixed width to ensure readability
      const minHeight = targetWidth * (16 / 9); // 1422px for 9:16 ratio
      
      // If content is shorter than 9:16, we use 9:16 height
      // If content is taller, we use the content height (it will be taller than 9:16)
      const targetHeight = Math.max(minHeight, contentHeight);

      // Apply dimensions to wrapper
      wrapperRef.current.style.width = `${targetWidth}px`;
      wrapperRef.current.style.height = `${targetHeight}px`;
      wrapperRef.current.style.display = 'flex';
      wrapperRef.current.style.alignItems = 'center';
      wrapperRef.current.style.justifyContent = 'center';
      wrapperRef.current.style.backgroundColor = '#faf9f6';

      // 1. Generate image with html-to-image
      const base64Image = await toPng(wrapperRef.current, {
        pixelRatio: 2, // Higher resolution
        backgroundColor: '#faf9f6',
        width: targetWidth,
        height: targetHeight,
        style: {
          transform: 'none',
          margin: '0'
        }
      });

      setPreviewUrl(base64Image);
      setShowModal(true);
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Hubo un error al generar la imagen. Por favor intenta de nuevo.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!previewUrl) return;
    try {
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Error copying image:', err);
      alert('No se pudo copiar la imagen. Tu navegador podría no soportar esta función.');
    }
  };

  const handleSend = async () => {
    if (!previewUrl) return;
    setIsUploading(true);

    try {
      // 1. Generate WhatsApp URL
      let message = `¡Hola ${sale.customerName}!\n\n`;
      message += `Tu orden #${sale.orderNumber || sale.id.slice(0,6)} ha sido registrada correctamente.\n\n`;
      message += `Pactaremos detalles de envío y pago por este chat.\n\n`;
      message += `Gracias por elegir JANLU aromas & diseño.`;

      const encodedMessage = encodeURIComponent(message);
      
      let whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
      if (customerPhone) {
        const cleanPhone = customerPhone.replace(/\D/g, '');
        whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
      }
      
      window.open(whatsappUrl, '_blank');
      setShowModal(false);
    } catch (error) {
      console.error('Error sharing image:', error);
      alert('Hubo un error al abrir WhatsApp. Por favor intenta de nuevo.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleGeneratePreview}
        disabled={isGenerating}
        className="p-2 text-stone-400 dark:text-stone-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
        title="Generar Etiqueta"
      >
        {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
      </button>

      {/* Modal for Preview */}
      {showModal && previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl max-w-xl w-full p-6 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100">Etiqueta Generada</h3>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                disabled={isUploading}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto mb-6 bg-stone-100 dark:bg-stone-800 rounded-xl p-4 flex justify-center items-start">
              <img src={previewUrl} alt="Confirmación de Orden" className="max-w-full h-auto shadow-sm rounded-lg" />
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleCopy}
                disabled={isUploading}
                className="w-full flex items-center justify-center gap-2 bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-bold py-3 rounded-xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
              >
                {isCopied ? <CheckCircle size={18} className="text-emerald-500" /> : <Copy size={18} />}
                {isCopied ? '¡Copiada!' : 'Copiar Imagen'}
              </button>
              <button
                onClick={handleSend}
                disabled={isUploading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
                {isUploading ? 'Enviando...' : 'Enviar por WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Off-screen container for the image generation */}
      <div className="fixed top-0 left-[-9999px] z-[-1]">
        <div ref={wrapperRef}>
          <div 
            ref={containerRef} 
            className="w-[800px] min-h-[1422px] p-16 font-sans flex flex-col justify-between"
            style={{ fontFamily: "'Inter', sans-serif", backgroundColor: '#faf9f6', color: '#292524' }}
          >
          <div>
            {/* Header */}
            <div className="flex flex-col items-center justify-center mb-10 pb-8" style={{ borderBottom: '3px solid #e7e5e4' }}>
              <h1 className="text-8xl font-cinzel font-bold leading-none tracking-normal" style={{ color: '#1c1917' }}>JANLU</h1>
              <p className="font-lato text-xl uppercase tracking-[0.4em] mt-4 ml-1" style={{ color: '#57534e' }}>Aromas & Diseño</p>
              <div className="inline-flex items-center gap-3 px-8 py-3 rounded-full text-2xl font-bold tracking-widest uppercase mt-8" style={{ backgroundColor: '#d1fae5', color: '#065f46' }}>
                <CheckCircle size={32} />
                ¡Pedido Confirmado!
              </div>
              <p className="text-2xl mt-6 font-mono font-bold" style={{ color: '#78716c' }}>Orden #{sale.orderNumber || sale.id.slice(0,6)}</p>
            </div>

            {/* Body */}
            <div className="mb-10 text-center px-6">
              <p className="text-4xl font-bold mb-4" style={{ color: '#1c1917' }}>¡Gracias, {sale.customerName}!</p>
              <p className="text-2xl leading-relaxed" style={{ color: '#57534e' }}>Tu pedido ha sido registrado con éxito. Estamos preparando cada detalle para vos.</p>
            </div>

            {/* Details */}
            <div className="rounded-[40px] p-10 mb-8 shadow-sm border border-stone-100" style={{ backgroundColor: '#ffffff' }}>
              <h3 className="font-bold mb-8 uppercase text-xl tracking-[0.2em] pb-5 flex items-center gap-3 border-b border-stone-50" style={{ color: '#1c1917' }}>
                <Package size={28} className="text-stone-400" />
                Resumen de Compra
              </h3>
              <div className="space-y-6">
                {sale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xl items-start">
                    <div className="flex-1 pr-6">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-3xl" style={{ color: '#1c1917' }}>{item.quantity}x</span>
                        <span className="font-medium text-2xl" style={{ color: '#44403c' }}>{item.productName}</span>
                      </div>
                      <div className="text-lg mt-1 ml-12 text-stone-500">{item.variantName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg text-stone-600 font-bold">{formatCurrency(item.price)} c/u</div>
                      <div className="font-black text-3xl" style={{ color: '#1c1917' }}>{formatCurrency(item.price * item.quantity)}</div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 pt-8 flex flex-col gap-3 border-t-2 border-stone-50">
                {sale.discount && sale.discount > 0 && sale.discount < 100 ? (
                  <>
                    <div className="flex justify-between items-center text-stone-500">
                      <span className="font-bold uppercase text-base tracking-widest">Subtotal</span>
                      <span className="font-bold text-2xl">{formatCurrency(sale.totalAmount / (1 - sale.discount / 100))}</span>
                    </div>
                    <div className="flex justify-between items-center text-emerald-600">
                      <span className="font-bold uppercase text-base tracking-widest">Descuento {sale.appliedCouponCode ? `(${sale.appliedCouponCode})` : ''}</span>
                      <span className="font-bold text-2xl">-{sale.discount}%</span>
                    </div>
                    <div className="flex justify-between items-center text-stone-900 border-t-2 border-stone-50 pt-4 mt-2">
                      <span className="font-bold uppercase text-lg tracking-widest">Total</span>
                      <span className="font-bold text-4xl">{formatCurrency(sale.totalAmount)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center text-stone-900">
                    <span className="font-bold uppercase text-lg tracking-widest">Total</span>
                    <span className="font-bold text-4xl">{formatCurrency(sale.totalAmount)}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center text-emerald-600 mt-2">
                  <span className="font-bold uppercase text-lg tracking-widest">Monto Abonado</span>
                  <span className="font-bold text-2xl">{formatCurrency(sale.amountPaid)}</span>
                </div>

                {sale.paymentHistory && sale.paymentHistory.length > 0 && (
                  <div className="mt-6 pt-5 border-t-2 border-stone-50">
                    <span className="text-base uppercase tracking-widest text-stone-400 mb-4 block font-bold">Historial de Pagos</span>
                    <div className="space-y-4">
                      {sale.paymentHistory.map((ph, i) => (
                        <div key={i} className="flex justify-between items-center text-lg">
                          <div className="flex flex-col">
                            <span className="text-stone-700 font-bold">
                              {ph.amount > 0 ? 'Pago' : 'Ajuste'}
                            </span>
                            <span className="text-sm text-stone-400">
                              {new Date(ph.date).toLocaleDateString()} - {ph.method || ''}
                            </span>
                          </div>
                          <span className={`font-bold ${ph.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {ph.amount > 0 ? '+' : ''}{formatCurrency(ph.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sale.totalAmount > sale.amountPaid ? (
                  <div className="flex justify-between items-center pt-6 mt-2 border-t-2 border-stone-50">
                    <span className="font-black uppercase text-xl tracking-widest text-stone-900">Saldo Pendiente</span>
                    <span className="text-6xl font-black text-rose-600">{formatCurrency(sale.totalAmount - sale.amountPaid)}</span>
                  </div>
                ) : (
                  <div className="flex justify-center items-center pt-6 mt-2 bg-emerald-50 rounded-3xl py-6 border border-emerald-100">
                    <span className="text-xl font-black uppercase tracking-[0.2em] text-emerald-700">✨ Pedido Totalmente Abonado ✨</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            {/* COUPON SECTION - GIFT CARD STYLE */}
            {sale.generatedCouponCode && (
              <div className="mb-8 p-6 rounded-3xl text-center bg-white border border-indigo-100 shadow-lg shadow-indigo-50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600"></div>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Sparkles size={24} className="text-indigo-500" />
                  <p className="text-base uppercase tracking-[0.3em] font-black text-indigo-600">Regalo de Bienvenida</p>
                  <Sparkles size={24} className="text-indigo-500" />
                </div>
                
                <div className="bg-indigo-600 text-white py-6 px-10 rounded-3xl inline-block mb-4 shadow-md shadow-indigo-200">
                  <p className="text-6xl font-black tracking-[0.15em] font-mono">{sale.generatedCouponCode}</p>
                </div>
                
                <p className="text-xl text-indigo-900 font-bold uppercase tracking-[0.2em]">15% OFF EN TU PRÓXIMA COMPRA</p>
                <p className="text-sm text-stone-400 mt-4 leading-tight">
                  Código único, de un solo uso y caducidad automática.<br/>
                  Válido para tu siguiente pedido en la web.
                </p>
              </div>
            )}

            {/* CTA */}
            <div className="p-10 rounded-[40px] text-center mb-10" style={{ backgroundColor: '#1c1917', color: '#ffffff', boxShadow: '0 15px 25px -5px rgba(0, 0, 0, 0.3)' }}>
              <p className="font-bold text-2xl leading-relaxed">Coordinaremos la entrega y detalles finales por este chat.</p>
            </div>

            {/* Footer */}
            <div className="text-center space-y-6 pt-10" style={{ color: '#78716c', borderTop: '3px solid #e7e5e4' }}>
              <div className="flex flex-col items-center justify-center">
                <p className="text-5xl font-cinzel font-bold leading-none tracking-normal" style={{ color: '#292524' }}>JANLU</p>
                <p className="font-lato text-base uppercase tracking-[0.4em] mt-4 ml-1" style={{ color: '#78716c' }}>Aromas & Diseño</p>
              </div>
              <div className="flex justify-center gap-10 text-lg font-medium">
                {storeSettings?.instagramUrl && (
                  <span className="flex items-center gap-3">
                    <Instagram size={24} className="text-stone-400" />
                    @{storeSettings.instagramUrl.split('/').pop()}
                  </span>
                )}
                {storeSettings?.facebookUrl && (
                  <span className="flex items-center gap-3">
                    <Facebook size={24} className="text-stone-400" />
                    {storeSettings.facebookUrl.split('/').pop()}
                  </span>
                )}
              </div>
              <p className="italic text-xl font-medium mt-8" style={{ color: '#a8a29e' }}>¡Gracias por confiar en nosotros! ✨</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
);
}
