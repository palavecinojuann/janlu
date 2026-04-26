import React, { useState } from 'react';
import { 
  LayoutDashboard, ShoppingCart, FileText, Users, GraduationCap, 
  Package, Scan, Globe, Factory, Wrench, DollarSign, Tag, 
  PieChart, Shield, Activity, Settings, ChevronDown, ChevronUp, BookOpen 
} from 'lucide-react';

interface FaqItem {
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

export default function HelpView() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleOpen = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const manualSections: FaqItem[] = [
    {
      icon: <LayoutDashboard size={24} className="text-indigo-500" />,
      title: "1. Inicio (Centro de Comando)",
      content: (
        <ul className="space-y-3 text-sm text-stone-600 dark:text-stone-300">
          <li><strong className="text-stone-900 dark:text-white">Métricas y Metas:</strong> Visualiza ingresos del día, mes y crecimiento. Haz clic en la barra de progreso para establecer tu meta de facturación mensual.</li>
          <li><strong className="text-stone-900 dark:text-white">Alertas de Stock:</strong> El semáforo te avisa si insumos o productos caen a 5 unidades o menos.</li>
          <li><strong className="text-stone-900 dark:text-white">Fidelización:</strong> Panel de cumpleaños de la semana. Un clic te permite enviar un saludo y regalo por WhatsApp.</li>
        </ul>
      )
    },
    {
      icon: <ShoppingCart size={24} className="text-emerald-500" />,
      title: "2. Ventas y Presupuestos",
      content: (
        <ul className="space-y-3 text-sm text-stone-600 dark:text-stone-300">
          <li><strong className="text-stone-900 dark:text-white">Flujo de Ventas:</strong> Las ventas online entran aquí. Los estados (Nuevo, Preparando, Entregado) gestionan el stock. El stock se "reserva" al vender y se "consume" al entregar.</li>
          <li><strong className="text-stone-900 dark:text-white">Pagos Parciales:</strong> Puedes registrar señas y ver el saldo pendiente en rojo. Emite recibos para WhatsApp con el ícono de imagen.</li>
          <li><strong className="text-stone-900 dark:text-white">Presupuestos:</strong> Cotiza eventos o mayoristas. Los presupuestos no descuentan mercadería física hasta que los apruebes y conviertas en venta.</li>
        </ul>
      )
    },
    {
      icon: <Users size={24} className="text-blue-500" />,
      title: "3. Clientes y Cupones",
      content: (
        <ul className="space-y-3 text-sm text-stone-600 dark:text-stone-300">
          <li><strong className="text-stone-900 dark:text-white">Base de Clientes (CRM):</strong> El teléfono es el DNI del cliente. Agrupa su historial y muestra su Nivel (Bronce a Platino) según su volumen de compras.</li>
          <li><strong className="text-stone-900 dark:text-white">Módulo Cupón:</strong> Crea códigos de descuento (porcentaje o monto fijo). Puedes hacerlos de uso único o configurar descuentos automáticos (como transferencia).</li>
        </ul>
      )
    },
    {
      icon: <GraduationCap size={24} className="text-rose-500" />,
      title: "4. Workshops (Cursos Janlu)",
      content: (
        <ul className="space-y-3 text-sm text-stone-600 dark:text-stone-300">
          <li><strong className="text-stone-900 dark:text-white">Gestión de Cursos:</strong> Crea talleres fijando un límite de cupos. Al llenarse, la web bloquea la inscripción automáticamente.</li>
          <li><strong className="text-stone-900 dark:text-white">Temario Dinámico:</strong> Escribe los puntos a enseñar separados por "Enter" y la tienda armará un acordeón de diseño premium. Genera el "Boarding Pass" VIP para alumnos inscritos.</li>
        </ul>
      )
    },
    {
      icon: <Package size={24} className="text-amber-500" />,
      title: "5. Inventario y Producción",
      content: (
        <ul className="space-y-3 text-sm text-stone-600 dark:text-stone-300">
          <li><strong className="text-stone-900 dark:text-white">Productos e Insumos:</strong> Gestión dual. Creas lo que vendes (Velas) y lo que usas (Cera, Pabilo, Esencia).</li>
          <li><strong className="text-stone-900 dark:text-white">Motor de Recetas:</strong> Asigna insumos a una vela. Al venderla, se descuentan gramos exactos para calcular tu utilidad neta real.</li>
          <li><strong className="text-stone-900 dark:text-white">Módulo Producción:</strong> Crea "Órdenes de Trabajo". Tomas materia prima de tu stock, la cocinas, y la conviertes en productos terminados listos para vender.</li>
        </ul>
      )
    },
    {
      icon: <Scan size={24} className="text-teal-500" />,
      title: "6. Escanear y Catálogo Online",
      content: (
        <ul className="space-y-3 text-sm text-stone-600 dark:text-stone-300">
          <li><strong className="text-stone-900 dark:text-white">Escanear:</strong> Transforma tu PC o celular en un Punto de Venta (POS). Lee los códigos QR/Barras de tus etiquetas para agregar productos al carrito al instante.</li>
          <li><strong className="text-stone-900 dark:text-white">Catálogo Online:</strong> Un acceso directo a tu tienda pública para previsualizar cómo los clientes ven tus productos, banners y ofertas activas.</li>
        </ul>
      )
    },
    {
      icon: <DollarSign size={24} className="text-green-600" />,
      title: "7. Finanzas y Estadísticas",
      content: (
        <ul className="space-y-3 text-sm text-stone-600 dark:text-stone-300">
          <li><strong className="text-stone-900 dark:text-white">Finanzas:</strong> Lleva el control de caja. Registra ingresos extra o egresos (gastos de taller, servicios) para tener un flujo de caja real mensual.</li>
          <li><strong className="text-stone-900 dark:text-white">Estadísticas:</strong> Gráficos avanzados de rendimiento. Descubre tus productos más vendidos, tu tasa de ganancia neta y el valor del stock inmovilizado en tu taller.</li>
        </ul>
      )
    },
    {
      icon: <Wrench size={24} className="text-orange-500" />,
      title: "8. Herramientas Avanzadas",
      content: (
        <ul className="space-y-3 text-sm text-stone-600 dark:text-stone-300">
          <li><strong className="text-stone-900 dark:text-white">Calculadora de Volumen:</strong> Herramienta matemática para saber exactamente cuánta cera y fragancia necesitas para rellenar un envase nuevo.</li>
          <li><strong className="text-stone-900 dark:text-white">Actualizador Masivo:</strong> Si hay inflación, puedes subir el precio de todos tus productos o categorías a la vez por un porcentaje, en un solo clic.</li>
        </ul>
      )
    },
    {
      icon: <Shield size={24} className="text-purple-600" />,
      title: "9. Administración y Configuración",
      content: (
        <ul className="space-y-3 text-sm text-stone-600 dark:text-stone-300">
          <li><strong className="text-stone-900 dark:text-white">Administradores:</strong> Invita a colaboradores o socios dándoles acceso al panel.</li>
          <li><strong className="text-stone-900 dark:text-white">Auditoría:</strong> El "ojo que todo lo ve". Registra quién, a qué hora y qué modificó dentro del sistema (ideal para seguridad).</li>
          <li><strong className="text-stone-900 dark:text-white">Configuraciones:</strong> El motor de tu tienda. Aquí cambias tu número de WhatsApp para recibir pedidos, enlaces de redes sociales, el mensaje del banner superior y los descuentos fijos de tu web.</li>
        </ul>
      )
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto min-h-0 bg-[#faf9f8] dark:bg-stone-950 p-4 md:p-8 rounded-3xl">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-indigo-100 dark:bg-indigo-900/50 p-3 rounded-xl">
            <BookOpen className="text-indigo-600 dark:text-indigo-400" size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-serif font-bold text-stone-900 dark:text-white tracking-tight">
              Manual de Operaciones
            </h2>
            <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">
              Guía técnica y operativa completa del Ecosistema Janlu Velas.
            </p>
          </div>
        </div>

        <div className="space-y-4 pb-12">
          {manualSections.map((section, index) => (
            <div 
              key={index} 
              className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md"
            >
              <button
                onClick={() => toggleOpen(index)}
                className="w-full px-6 py-5 flex items-center justify-between bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-stone-50 dark:bg-stone-800 rounded-lg">
                    {section.icon}
                  </div>
                  <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 text-left">
                    {section.title}
                  </h3>
                </div>
                {openIndex === index ? (
                  <ChevronUp className="text-stone-400" size={20} />
                ) : (
                  <ChevronDown className="text-stone-400" size={20} />
                )}
              </button>
              
              <div 
                className={`transition-all duration-300 ease-in-out ${
                  openIndex === index ? 'max-h-[600px] opacity-100 border-t border-stone-100 dark:border-stone-800' : 'max-h-0 opacity-0'
                } overflow-hidden`}
              >
                <div className="p-6 bg-stone-50/50 dark:bg-stone-900/50">
                  {section.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
