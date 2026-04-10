import React from 'react';
import { Home, CheckCircle, Circle, Grid, ShoppingCart, Wallet, Ticket, User, DollarSign, BarChart2, Users, Settings, HelpCircle, ChevronRight, Instagram, Facebook, MessageCircle, FileText, Briefcase, Wrench, Shield, ScanBarcode, X, GraduationCap, Mail } from 'lucide-react';
import { UserProfile, StoreSettings } from '../types';

interface JanluSidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onNavigateToCatalog: () => void;
  onClose: () => void;
  userProfile: UserProfile | null;
  isAdmin?: boolean;
  storeSettings?: StoreSettings;
}

export default function JanluSidebar({ 
  currentView, 
  onNavigate, 
  onNavigateToCatalog,
  onClose, 
  userProfile, 
  isAdmin,
  storeSettings
}: JanluSidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Inicio', icon: Home },
    { id: 'sell', label: 'Ventas', icon: CheckCircle },
    { id: 'quotes', label: 'Presupuestos', icon: FileText },
    { id: 'customers', label: 'Clientes', icon: User },
    { id: 'courses', label: 'Workshops', icon: GraduationCap },
    { id: 'inventory', label: 'Inventario', icon: Grid },
    { id: 'scanner', label: 'Escanear', icon: ScanBarcode },
    { id: 'catalog', label: 'Catálogo Online', icon: ShoppingCart, badge: 'WEB' },
    { id: 'production', label: 'Producción', icon: Briefcase },
    { id: 'tools', label: 'Herramientas', icon: Wrench },
    { id: 'finance', label: 'Finanzas', icon: Wallet },
    { id: 'coupon', label: 'Cupón', icon: Ticket, badge: 'NUEVO' },
    { id: 'stats', label: 'Estadísticas', icon: BarChart2 },
    ...(userProfile?.role === 'admin' ? [
      { id: 'admin-users', label: 'Administradores', icon: Users },
      { id: 'audit-logs', label: 'Auditoría', icon: Shield }
    ] : []),
    { id: 'settings', label: 'Configuraciones', icon: Settings },
    { id: 'help', label: 'Ayuda', icon: HelpCircle },
  ];

  const handleNavigation = (id: string) => {
    if (id === 'catalog') {
      onNavigateToCatalog();
    } else if (id === 'sell') {
      onNavigate('sales');
    } else if (id === 'quotes') {
      onNavigate('quotes');
    } else if (id === 'customers') {
      onNavigate('customers');
    } else if (id === 'inventory') {
      onNavigate('inventory');
    } else if (id === 'scanner') {
      onNavigate('scanner');
    } else if (id === 'production') {
      onNavigate('production');
    } else if (id === 'courses') {
      onNavigate('courses');
    } else if (id === 'tools') {
      onNavigate('tools');
    } else if (id === 'finance') {
      onNavigate('finance');
    } else if (id === 'dashboard') {
      onNavigate('dashboard');
    } else if (id === 'stats') {
      onNavigate('stats');
    } else if (id === 'coupon') {
      onNavigate('coupon');
    } else if (id === 'admin-users') {
      onNavigate('admin-users');
    } else if (id === 'audit-logs') {
      onNavigate('audit-logs');
    } else if (id === 'settings') {
      onNavigate('settings');
    } else if (id === 'help') {
      onNavigate('help');
    } else {
      // Default or unimplemented
      alert('Función próximamente');
    }
    onClose();
  };

  return (
    <div className="flex flex-col h-full bg-[#2b323c] text-white font-sans w-72 md:w-64 lg:w-72 shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex justify-between items-center p-2 -mx-2 rounded-lg">
          <div 
            className="flex flex-col items-start cursor-pointer group"
            onClick={() => handleNavigation('dashboard')}
          >
            <h2 className="text-3xl font-cinzel font-bold text-white leading-none tracking-normal group-hover:text-emerald-400 transition-colors">JANLU</h2>
            <p className="font-lato text-[8px] uppercase tracking-[0.3em] text-stone-400 mt-1 ml-0.5 group-hover:text-emerald-300 transition-colors">Aromas & Diseño</p>
          </div>
          <button 
            onClick={onClose}
            className="lg:hidden p-2 text-stone-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex justify-between items-center mt-2 px-2">
          <span className="text-sm text-stone-400">{userProfile?.name || 'Juan Palavecino'}</span>
          <button className="bg-[#1db992] text-[#2b323c] text-xs font-bold px-3 py-1 rounded-full hover:bg-[#159f7d] transition-colors">
            PRO
          </button>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            // Map our internal views to the sidebar items for active state
            let isActive = false;
            if (item.id === 'dashboard' && currentView === 'dashboard') isActive = true;
            if (item.id === 'inventory' && currentView === 'inventory') isActive = true;
            if (item.id === 'production' && currentView === 'production') isActive = true;
            if (item.id === 'courses' && currentView === 'courses') isActive = true;
            if (item.id === 'tools' && currentView === 'tools') isActive = true;
            if (item.id === 'finance' && currentView === 'finance') isActive = true;
            if (item.id === 'stats' && currentView === 'stats') isActive = true;
            if (item.id === 'coupon' && currentView === 'coupon') isActive = true;
            if (item.id === 'settings' && currentView === 'settings') isActive = true;
            if (item.id === 'help' && currentView === 'help') isActive = true;
            if (item.id === 'sell' && currentView === 'sales') isActive = true;
            if (item.id === 'quotes' && currentView === 'quotes') isActive = true;
            if (item.id === 'customers' && currentView === 'customers') isActive = true;

            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.id)}
                className={`w-full flex items-center px-6 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white border-l-4 border-[#1db992]'
                    : 'text-stone-300 hover:bg-white/10 hover:text-white border-l-4 border-transparent'
                }`}
              >
                <Icon className="mr-4 h-5 w-5 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    item.badge === 'BETA' 
                      ? 'border-stone-500 text-stone-400' 
                      : 'border-[#1db992] text-[#1db992]'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Banner */}
      <div className="p-4 bg-[#2b323c] border-t border-white/10 flex flex-col gap-3 shrink-0">
        <p className="text-xs text-stone-400 font-medium uppercase tracking-wider text-center">Nuestras Redes</p>
        <div className="flex justify-center gap-4">
          {storeSettings?.email && (
            <a href={`mailto:${storeSettings.email}`} className="p-2 bg-white/5 rounded-full hover:bg-[#128a6d] hover:text-[#2b323c] transition-colors text-stone-300" title="Email">
              <Mail size={20} />
            </a>
          )}
          {storeSettings?.instagramUrl && (
            <a href={storeSettings.instagramUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 rounded-full hover:bg-[#128a6d] hover:text-[#2b323c] transition-colors text-stone-300" title="Instagram">
              <Instagram size={20} />
            </a>
          )}
          {storeSettings?.facebookUrl && (
            <a href={storeSettings.facebookUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 rounded-full hover:bg-[#128a6d] hover:text-[#2b323c] transition-colors text-stone-300" title="Facebook">
              <Facebook size={20} />
            </a>
          )}
          {storeSettings?.whatsappNumber && (
            <a href={`https://wa.me/${storeSettings.whatsappNumber.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 rounded-full hover:bg-[#128a6d] hover:text-[#2b323c] transition-colors text-stone-300" title="WhatsApp">
              <MessageCircle size={20} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
