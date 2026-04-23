import React, { useState } from 'react';
import { ChevronDown, ChevronUp, LayoutDashboard, ShoppingCart, Package, FileText, GraduationCap, ShieldAlert } from 'lucide-react';

export default function HelpView() {
  const [openSection, setOpenSection] = useState<string | null>('ventas');

  return (
    <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-8 bg-[#faf9f8]">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="mb-8">
          <h2 className="text-3xl font-serif font-bold text-stone-900 tracking-tight">Manual de Operaciones</h2>
          <p className="text-stone-500 mt-2">Guía paso a paso para la administración del ecosistema Janlu Velas.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          
          {/* Módulo Ventas */}
          <div className="border-b border-stone-200">
            <button onClick={() => setOpenSection(openSection === 'ventas' ? null : 'ventas')} className="w-full flex items-center justify-between p-6 hover:bg-stone-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><ShoppingCart size={24} /></div>
                <h3 className="text-lg font-bold text-stone-800">1. Ventas y Cobranzas</h3>
              </div>
              {openSection === 'ventas' ? <ChevronUp className="text-stone-400" /> : <ChevronDown className="text-stone-400" />}
            </button>
            {openSection === 'ventas' && (
              <div className="p-6 pt-0 text-stone-600 space-y-4 bg-stone-50/50">
                <p><strong>Cobros Parciales:</strong> Puedes registrar múltiples pagos para un mismo pedido (ej. Efectivo + Transferencia). El sistema calculará el saldo pendiente automáticamente.</p>
                <p><strong>Pérdida de Internet (Reversión):</strong> Si el internet falla justo al cobrar, el sistema lo detectará, deshará la operación en pantalla y te devolverá el saldo pendiente para evitar descuadres en caja.</p>
                <p><strong>Pedidos Serie 900.000:</strong> Si ves un número de pedido muy alto (ej. 945821), significa que ocurrió durante una caída de red. El sistema usa estos números de contingencia para evitar duplicar pedidos.</p>
              </div>
            )}
          </div>

          {/* Módulo Inventario */}
          <div className="border-b border-stone-200">
            <button onClick={() => setOpenSection(openSection === 'inventario' ? null : 'inventario')} className="w-full flex items-center justify-between p-6 hover:bg-stone-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Package size={24} /></div>
                <h3 className="text-lg font-bold text-stone-800">2. Inventario y Stock Físico</h3>
              </div>
              {openSection === 'inventario' ? <ChevronUp className="text-stone-400" /> : <ChevronDown className="text-stone-400" />}
            </button>
            {openSection === 'inventario' && (
              <div className="p-6 pt-0 text-stone-600 space-y-4 bg-stone-50/50">
                <p><strong>Inventario Relacional:</strong> Al vender una vela, el sistema no descuenta "1 vela", sino que lee su receta y descuenta automáticamente los gramos exactos de cera, pabilo y envases de la Materia Prima.</p>
                <p><strong>Stock Comprometido:</strong> Al crear un pedido, el stock se reserva. Solo desaparece definitivamente cuando el pedido se marca como "Entregado". Si cancelas el pedido, los insumos vuelven al stock disponible.</p>
              </div>
            )}
          </div>

          {/* Módulo Presupuestos */}
          <div className="border-b border-stone-200">
            <button onClick={() => setOpenSection(openSection === 'presupuestos' ? null : 'presupuestos')} className="w-full flex items-center justify-between p-6 hover:bg-stone-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><FileText size={24} /></div>
                <h3 className="text-lg font-bold text-stone-800">3. Presupuestos (Mayoristas)</h3>
              </div>
              {openSection === 'presupuestos' ? <ChevronUp className="text-stone-400" /> : <ChevronDown className="text-stone-400" />}
            </button>
            {openSection === 'presupuestos' && (
              <div className="p-6 pt-0 text-stone-600 space-y-4 bg-stone-50/50">
                <p><strong>Regla de Oro:</strong> Si un cliente aún está "pensando" la compra, NO utilices Ventas. Usa Presupuestos. Las cotizaciones fijan el precio para enviarlo al cliente, pero <strong>no descuentan stock</strong> hasta que lo apruebes y conviertas en Venta.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
