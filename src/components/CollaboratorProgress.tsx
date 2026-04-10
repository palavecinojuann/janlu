import React from 'react';
import { Trophy, Star, Target } from 'lucide-react';
import { UserProfile } from '../types';

interface CollaboratorProgressProps {
  profile: UserProfile;
  monthlySales: number;
  discount: number;
}

export default function CollaboratorProgress({ profile, monthlySales, discount }: CollaboratorProgressProps) {
  const levels = [
    { name: 'bronce', min: 0, max: 10, color: 'text-orange-600', bg: 'bg-orange-600' },
    { name: 'plata', min: 10, max: 30, color: 'text-stone-400', bg: 'bg-stone-400' },
    { name: 'oro', min: 30, max: 50, color: 'text-amber-500', bg: 'bg-amber-500' },
    { name: 'platino', min: 50, max: 100, color: 'text-indigo-400', bg: 'bg-indigo-400' },
  ];

  const currentLevel = levels.find(l => l.name === profile.level) || levels[0];
  const nextLevel = levels[levels.indexOf(currentLevel) + 1];
  
  const progress = nextLevel 
    ? Math.min(100, (monthlySales / nextLevel.min) * 100)
    : 100;

  const salesToNext = nextLevel ? nextLevel.min - monthlySales : 0;

  return (
    <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg bg-stone-50 dark:bg-stone-800 ${currentLevel.color}`}>
            <Trophy size={20} />
          </div>
          <div>
            <h3 className="font-bold text-stone-800 dark:text-stone-100 uppercase tracking-wider text-sm">Nivel {profile.level}</h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">Descuento activo: {discount}%</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-stone-900 dark:text-stone-100">{monthlySales}</p>
          <p className="text-[10px] text-stone-500 dark:text-stone-400 uppercase font-bold">Ventas Mes</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between text-xs font-bold uppercase tracking-tighter">
          <span className="text-stone-400">Progreso de Nivel</span>
          {nextLevel && (
            <span className="text-indigo-600 dark:text-indigo-400">Faltan {salesToNext} ventas para {nextLevel.name}</span>
          )}
        </div>
        
        <div className="h-3 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden border border-stone-200 dark:border-stone-700">
          <div 
            className={`h-full transition-all duration-1000 ease-out ${currentLevel.bg}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid grid-cols-4 gap-1">
          {levels.map(l => (
            <div key={l.name} className="flex flex-col items-center">
              <div className={`w-1 h-1 rounded-full mb-1 ${monthlySales >= l.min ? l.bg : 'bg-stone-200 dark:bg-stone-700'}`} />
              <span className={`text-[8px] uppercase font-bold ${profile.level === l.name ? l.color : 'text-stone-400'}`}>{l.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
