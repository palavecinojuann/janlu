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
            className="bg-[#faf9f8] text-stone-900 p-16 w-[800px] mx-auto flex flex-col justify-between min-h-[1422px]"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            <div>
              {/* PASO 2: Cabecera y Logo Escalado */}
              <div className="flex flex-col items-center justify-center mb-12">
                <h1 className="text-[5.5rem] font-serif font-bold text-stone-900 leading-none tracking-tight">JANLU</h1>
                <p className="text-lg uppercase tracking-[0.4em] text-stone-500 mt-4">Aromas & Diseño</p>
              </div>

              {/* PASO 3: Línea Divisoria Minimalista */}
              <div className="w-full h-px bg-stone-200/60 my-10"></div>

              {/* PASO 3: Mensaje de Agradecimiento Escalado */}
              <div className="mb-12 text-center">
                <p className="text-4xl font-serif text-center mb-4 text-stone-900">¡Gracias por tu compra, {sale.customerName.split(' ')[0]}!</p>
                <p className="text-xl text-stone-600 text-center mx-auto max-w-lg">Tu pedido ha sido registrado con éxito. Estamos preparando cada detalle para vos.</p>
              </div>

              <div className="w-full h-px bg-stone-200/60 my-10"></div>

              {/* PASO 4: Escalar Productos y Totales */}
              <div className="space-y-8">
                <h3 className="text-sm uppercase tracking-[0.2em] font-bold text-stone-400 mb-6">Resumen de Compra</h3>
                {sale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-stone-400">{item.quantity}x</span>
                        <span className="text-xl font-medium text-stone-800">{item.productName}</span>
                      </div>
                      <p className="text-base text-stone-400 ml-10">{item.variantName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-medium text-stone-900">{formatCurrency(item.price * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="w-full h-px bg-stone-200/60 my-12"></div>

              {/* Totales Escalados */}
              <div className="space-y-5">
                {sale.discount && sale.discount > 0 && (
                  <div className="flex justify-between text-lg text-stone-500">
                    <span className="uppercase tracking-widest">Subtotal</span>
                    <span>{formatCurrency(sale.totalAmount / (1 - sale.discount / 100))}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center py-4">
                  <span className="text-sm uppercase tracking-[0.2em] font-bold text-stone-400">TOTAL FINAL</span>
                  <span className="text-3xl font-bold text-stone-900">{formatCurrency(sale.totalAmount)}</span>
                </div>

                <div className="flex justify-between items-center text-lg text-stone-500">
                  <span className="uppercase tracking-widest">Monto Abonado</span>
                  <span className="font-medium text-emerald-600">{formatCurrency(sale.amountPaid)}</span>
                </div>

                {sale.totalAmount > sale.amountPaid && (
                  <div className="flex justify-between items-center pt-6 border-t border-stone-100">
                    <span className="text-base uppercase tracking-[0.2em] font-bold text-rose-500">Saldo Pendiente</span>
                    <span className="text-2xl font-bold text-rose-600">{formatCurrency(sale.totalAmount - sale.amountPaid)}</span>
                  </div>
                )}
              </div>

              {/* Cupón si existe */}
              {sale.generatedCouponCode && (
                <div className="mt-16 p-10 rounded-3xl bg-white border border-stone-100 text-center shadow-sm">
                  <p className="text-xs uppercase tracking-[0.3em] text-stone-400 mb-4 font-bold">Tu regalo de bienvenida</p>
                  <p className="text-5xl font-mono font-bold text-stone-900 mb-2">{sale.generatedCouponCode}</p>
                  <p className="text-base text-stone-500 uppercase tracking-widest">15% OFF en tu próxima compra</p>
                </div>
              )}
            </div>

            {/* PASO 5: Escalar el Pie de Página */}
            <div className="mt-16 text-center pb-8">
              <div className="flex justify-center gap-10 mb-10 opacity-40">
                {storeSettings?.instagramUrl && <Instagram size={24} />}
                {storeSettings?.facebookUrl && <Facebook size={24} />}
              </div>
              <p className="text-xl italic text-stone-500">Gracias por elegir la luz de Janlu.</p>
              <p className="text-base uppercase tracking-[0.3em] text-stone-400 mt-4">Orden #{sale.orderNumber || sale.id.slice(0,6)}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
