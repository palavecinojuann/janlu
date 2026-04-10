import React, { useState } from 'react';
import { Plus, Trash2, Calendar, Percent, Tag, Clock } from 'lucide-react';
import { Campaign } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface AdminCampaignPanelProps {
  campaigns: Campaign[];
  onAdd: (campaign: Campaign) => void;
  onDelete: (id: string) => void;
}

export default function AdminCampaignPanel({ campaigns, onAdd, onDelete }: AdminCampaignPanelProps) {
  const [newCampaign, setNewCampaign] = useState({
    title: '',
    discount: 10,
    durationHours: 24,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + newCampaign.durationHours);

    onAdd({
      id: uuidv4(),
      title: newCampaign.title,
      discount: newCampaign.discount,
      expiresAt: expiresAt.toISOString(),
      isActive: true,
    });
    setNewCampaign({ title: '', discount: 10, durationHours: 24 });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-8">
      <div className="flex-none bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800">
        <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-6 flex items-center">
          <Plus className="mr-2 text-indigo-600" size={20} />
          Crear Campaña Relámpago (FOMO)
        </h3>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-500 uppercase">Título de Campaña</label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
              <input
                type="text"
                required
                value={newCampaign.title}
                onChange={e => setNewCampaign({ ...newCampaign, title: e.target.value })}
                className="w-full pl-10 pr-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Ej: Sorteo de Verano"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-500 uppercase">Descuento (%)</label>
            <div className="relative">
              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
              <input
                type="number"
                required
                min="1"
                max="90"
                step="any"
                value={newCampaign.discount}
                onChange={e => setNewCampaign({ ...newCampaign, discount: parseFloat(e.target.value) })}
                className="w-full pl-10 pr-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-stone-500 uppercase">Duración (Horas)</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
              <input
                type="number"
                required
                min="1"
                value={newCampaign.durationHours}
                onChange={e => setNewCampaign({ ...newCampaign, durationHours: parseInt(e.target.value) })}
                className="w-full pl-10 pr-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="md:col-span-3 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg"
          >
            Lanzar Campaña Ahora
          </button>
        </form>
      </div>

      <div className="flex-1 bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 flex flex-col min-h-0">
        <div className="flex-none p-6 border-b border-stone-100 dark:border-stone-800">
          <h3 className="font-bold text-stone-800 dark:text-stone-100">Campañas Activas</h3>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800">
          {campaigns.length === 0 ? (
            <div className="p-8 text-center text-stone-500 italic">No hay campañas activas</div>
          ) : (
            campaigns.map(c => (
              <div key={c.id} className="p-4 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-800 dark:text-stone-100">{c.title}</h4>
                    <p className="text-xs text-stone-500">Expira: {new Date(c.expiresAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold">-{c.discount}%</span>
                  <button 
                    onClick={() => onDelete(c.id)}
                    className="p-2 text-stone-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
