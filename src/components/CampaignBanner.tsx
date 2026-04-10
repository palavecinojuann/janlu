import React, { useState, useEffect } from 'react';
import { Timer, Zap } from 'lucide-react';
import { Campaign } from '../types';

interface CampaignBannerProps {
  campaigns: Campaign[];
}

export default function CampaignBanner({ campaigns }: CampaignBannerProps) {
  const activeCampaign = campaigns.find(c => {
    if (!c.isActive) return false;
    
    let expirationDate: Date;
    if (c.expiresAt.includes('-') && !c.expiresAt.includes('T')) {
      const [year, month, day] = c.expiresAt.split('-').map(Number);
      expirationDate = new Date(year, month - 1, day, 23, 59, 59, 999);
    } else {
      expirationDate = new Date(c.expiresAt);
    }
    
    return expirationDate > new Date();
  });

  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!activeCampaign) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      let expirationDate: Date;
      
      if (activeCampaign.expiresAt.includes('-') && !activeCampaign.expiresAt.includes('T')) {
        const [year, month, day] = activeCampaign.expiresAt.split('-').map(Number);
        expirationDate = new Date(year, month - 1, day, 23, 59, 59, 999);
      } else {
        expirationDate = new Date(activeCampaign.expiresAt);
      }
      
      const distance = expirationDate.getTime() - now;

      if (distance < 0) {
        setTimeLeft('EXPIRADO');
        clearInterval(interval);
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCampaign]);

  if (!activeCampaign) return null;

  return (
    <div className="flex-none bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-1 px-6 rounded-xl shadow-lg mb-6 flex flex-col md:flex-row items-center justify-between animate-pulse">
      <div className="flex items-center space-x-4 mb-1 md:mb-0">
        <div className="bg-white/20 p-0.5 rounded-full">
          <Zap className="text-yellow-300 fill-yellow-300" size={14} />
        </div>
        <div>
          <h3 className="font-bold text-xs leading-tight">{activeCampaign.title}</h3>
          <p className="text-indigo-100 text-[9px]">¡Usa el código para un {activeCampaign.discount}% de descuento!</p>
        </div>
      </div>
      
      <div className="flex items-center space-x-3 bg-black/20 px-2 py-0 rounded-lg border border-white/10">
        <Timer size={12} className="text-indigo-200" />
        <span className="font-mono font-bold text-sm tracking-wider">{timeLeft}</span>
      </div>
    </div>
  );
}
