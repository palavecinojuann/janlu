import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Loader2, MessageCircle, X, Download } from 'lucide-react';

interface AcademyWelcomeCardProps {
  studentName: string;
  courseName: string;
  studentPhone: string;
  onClose: () => void;
}

export default function AcademyWelcomeCard({ studentName, courseName, studentPhone, onClose }: AcademyWelcomeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const generateCard = async () => {
    if (!cardRef.current) return;
    setIsGenerating(true);
    try {
      const dataUrl = await toPng(cardRef.current, { quality: 1, pixelRatio: 2 });
      setPreviewUrl(dataUrl);
    } catch (err) {
      console.error('Error al generar la tarjeta:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWhatsApp = () => {
    const text = `¡Hola ${studentName}! 🎓✨ Te damos la bienvenida oficial a la Janlu Academy. Tu lugar en el workshop *${courseName}* ya está confirmado. Podés ingresar a nuestra web para acceder a tu Portal del Estudiante. ¡Te esperamos!`;
    const phone = studentPhone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-stone-100 dark:bg-stone-900 rounded-3xl max-w-sm w-full p-6 relative flex flex-col items-center">
        <button onClick={onClose} className="absolute top-4 right-4 text-stone-400 hover:text-stone-900 dark:hover:text-white bg-white/50 rounded-full p-1"><X size={20} /></button>
        
        {/* El "Lienzo" de la Tarjeta (Lo que se convierte a imagen) */}
        <div className="w-full bg-white rounded-2xl shadow-xl overflow-hidden mb-6 relative" ref={cardRef}>
          <div className="bg-stone-950 p-6 text-center border-b-4 border-indigo-500">
            <h2 className="text-3xl font-serif text-white tracking-widest uppercase">JANLU</h2>
            <p className="text-[10px] text-stone-400 uppercase tracking-[0.3em] mt-1">Academy</p>
          </div>
          <div className="p-8 text-center flex flex-col items-center bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2">Pase Oficial</span>
            <h3 className="text-2xl font-serif text-stone-900 leading-tight mb-2">¡Bienvenido/a,<br/>{studentName}!</h3>
            <div className="h-px w-12 bg-stone-200 my-4"></div>
            <p className="text-sm text-stone-500 mb-1">Tu lugar está confirmado en:</p>
            <p className="text-md font-bold text-stone-900">{courseName}</p>
          </div>
        </div>

        {/* Controles */}
        {!previewUrl ? (
          <button onClick={generateCard} disabled={isGenerating} className="w-full py-3 bg-stone-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-colors">
            {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
            Generar Tarjeta
          </button>
        ) : (
          <div className="w-full flex gap-3 flex-col">
            {previewUrl && (
              <div className="mb-4 rounded-xl overflow-hidden shadow-md">
                <img src={previewUrl} alt="Preview" className="w-full h-auto" />
              </div>
            )}
            <button onClick={handleWhatsApp} className="w-full py-3 bg-[#25D366] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#1ebd57] transition-colors">
              <MessageCircle size={20} />
              Enviar por WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
