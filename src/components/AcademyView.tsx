import React, { useState, useEffect } from 'react';
import { GraduationCap, QrCode, Package, Timer, CheckCircle2, ShoppingBag } from 'lucide-react';
import { UserProfile } from '../types';

interface AcademyViewProps {
  profile: UserProfile;
  onPurchaseKit: () => void;
}

export default function AcademyView({ profile, onPurchaseKit }: AcademyViewProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const isNewStudent = profile.isAcademyStudent && !profile.starterKitPurchased;

  useEffect(() => {
    if (!isNewStudent || !profile.academyJoinDate) return;

    const interval = setInterval(() => {
      const expiresAt = new Date(profile.academyJoinDate!).getTime() + (24 * 60 * 60 * 1000);
      const now = new Date().getTime();
      const distance = expiresAt - now;

      if (distance < 0) {
        setTimeLeft('OFERTA EXPIRADA');
        clearInterval(interval);
        return;
      }

      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [isNewStudent, profile.academyJoinDate]);

  return (
    <div className="flex-1 overflow-y-auto min-h-0 space-y-8 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Janlu Academy</h2>
        <div className="flex items-center space-x-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl">
          <GraduationCap size={20} />
          <span className="font-bold text-sm">Portal del Estudiante</span>
        </div>
      </div>

      {isNewStudent && (
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <Package size={240} />
          </div>
          
          <div className="relative z-10 max-w-lg">
            <div className="inline-flex items-center space-x-2 bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
              <Timer size={14} />
              <span>Oferta de Bienvenida: {timeLeft}</span>
            </div>
            
            <h3 className="text-3xl font-bold mb-4 leading-tight">¡Felicidades por completar el curso!</h3>
            <p className="text-amber-50 mb-8 leading-relaxed">
              Como nuevo graduado de Janlu Academy, tienes acceso exclusivo al <strong>Kit de Inicio Profesional</strong> con un 40% de descuento. Todo lo que necesitas para lanzar tu marca hoy mismo.
            </p>
            
            <button 
              onClick={onPurchaseKit}
              className="flex items-center space-x-3 bg-white text-orange-600 px-8 py-4 rounded-2xl font-bold hover:bg-amber-50 transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              <ShoppingBag size={20} />
              <span>Comprar Kit de Inicio ($15.000)</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center mb-4">
            <QrCode size={24} />
          </div>
          <h4 className="font-bold text-stone-800 dark:text-stone-100 mb-2">Registro por QR</h4>
          <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            Escanea el código al finalizar tu curso presencial para activar tu perfil de Colaborador.
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center mb-4">
            <GraduationCap size={24} />
          </div>
          <h4 className="font-bold text-stone-800 dark:text-stone-100 mb-2">Cursos Disponibles</h4>
          <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            Accede a material exclusivo, guías de aromas y técnicas avanzadas de vertido.
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center mb-4">
            <CheckCircle2 size={24} />
          </div>
          <h4 className="font-bold text-stone-800 dark:text-stone-100 mb-2">Certificación</h4>
          <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            Al completar el kit de inicio, recibirás tu sello de "Artesano Certificado Janlu".
          </p>
        </div>
      </div>
    </div>
  );
}
