import React, { useState } from 'react';
import { Copy, Check, Share2, Award } from 'lucide-react';
import { UserProfile } from '../types';

interface ReferralCardProps {
  profile: UserProfile;
}

export default function ReferralCard({ profile }: ReferralCardProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(profile.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Share2 size={20} />
          </div>
          <h3 className="font-bold text-stone-800 dark:text-stone-100">Programa de Referidos</h3>
        </div>
        <div className="flex items-center space-x-1 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full text-sm font-bold">
          <Award size={16} />
          <span>{profile.referralPoints} pts</span>
        </div>
      </div>

      <p className="text-sm text-stone-600 dark:text-stone-400 mb-6 leading-relaxed">
        Comparte tu código único con amigos. Ellos obtienen un descuento y tú sumas puntos para canjear por productos.
      </p>

      <div className="flex items-center space-x-2">
        <div className="flex-1 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl px-4 py-3 font-mono font-bold text-stone-800 dark:text-stone-100 text-center tracking-widest">
          {profile.referralCode}
        </div>
        <button
          onClick={copyToClipboard}
          className={`p-3 rounded-xl transition-all ${
            copied 
              ? 'bg-emerald-500 text-white' 
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {copied ? <Check size={20} /> : <Copy size={20} />}
        </button>
      </div>
    </div>
  );
}
