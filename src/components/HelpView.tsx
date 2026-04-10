import React from 'react';
import { BookOpen, Home, CheckCircle, FileText, User, Grid, ShoppingCart, Briefcase, Wrench, Wallet, Ticket, BarChart2, Users, Settings, ScanBarcode, Shield } from 'lucide-react';

export default function HelpView() {
  const sections = [
    {
      id: 'dashboard',
      title: 'Inicio (Dashboard)',
      icon: Home,
      color: 'text-blue-500',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      content: (
        <div className="space-y-2 text-stone-600 dark:text-stone-300">
          <p>El panel principal ofrece un resumen rápido y en tiempo real del estado de tu negocio.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Métricas Clave:</strong> Visualiza ingresos totales, ventas del mes actual, cantidad de productos con bajo stock (que requieren tu atención) y órdenes de producción pendientes.</li>
            <li><strong>Gráficos de Tendencia:</strong> Observa la evolución de tus ventas de los últimos 7 días mediante un gráfico interactivo para identificar los días de mayor movimiento.</li>
            <li><strong>Actividad Reciente:</strong> Un registro cronológico detallado de las últimas acciones realizadas en el sistema, como nuevas ventas, ingresos de stock, creación de productos y actualizaciones de inventario.</li>
            <li><strong>Accesos Rápidos:</strong> Botones directos para crear una nueva venta o agregar un nuevo producto sin tener que navegar por el menú.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'sales',
      title: 'Ventas',
      icon: CheckCircle,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      content: (
        <div className="space-y-2 text-stone-600 dark:text-stone-300">
          <p>Módulo integral para registrar, gestionar y hacer seguimiento de todas las ventas realizadas.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Nueva Venta:</strong> Permite registrar una transacción seleccionando productos del inventario, asignando un cliente (opcional para llevar historial), aplicando cupones de descuento, y definiendo el método de pago y estado (pagado o pendiente). Al confirmar, el stock de los productos se descuenta automáticamente del inventario.</li>
            <li><strong>Historial de Ventas:</strong> Lista completa de todas las ventas ordenadas por fecha. Puedes filtrar por estado de pago, buscar por cliente o número de comprobante.</li>
            <li><strong>Gestión de Pagos:</strong> Permite cambiar el estado de una venta de "Pendiente" a "Pagado" una vez que recibes el dinero.</li>
            <li><strong>Edición y Eliminación:</strong> Si eliminas una venta por error o cancelación, el sistema restaura automáticamente el stock de los productos involucrados.</li>
            <li><strong>Comprobantes:</strong> Genera un recibo en formato PDF listo para imprimir o enviar digitalmente al cliente, con el detalle de los productos, totales y datos de tu negocio.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'quotes',
      title: 'Presupuestos',
      icon: FileText,
      color: 'text-amber-500',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      content: (
        <div className="space-y-2 text-stone-600 dark:text-stone-300">
          <p>Crea cotizaciones formales para tus clientes sin afectar el stock actual de tu inventario.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Nuevo Presupuesto:</strong> Funciona de manera idéntica a una venta, permitiendo agregar productos, descuentos y cliente, pero sin descontar inventario. Puedes definir una fecha de validez para la oferta.</li>
            <li><strong>Convertir a Venta (Aprobar):</strong> Con un solo clic, puedes transformar un presupuesto que el cliente ha aceptado en una venta real. En ese momento exacto es cuando el sistema descontará el stock correspondiente.</li>
            <li><strong>Seguimiento:</strong> Mantén un registro de los presupuestos enviados, pendientes de respuesta o rechazados.</li>
            <li><strong>Compartir:</strong> Genera un documento PDF profesional o un enlace web para enviar la cotización al cliente por correo o WhatsApp.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'customers',
      title: 'Clientes',
      icon: User,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
      content: (
        <div className="space-y-2 text-stone-600 dark:text-stone-300">
          <p>Directorio centralizado y gestión de las relaciones con tu cartera de clientes (CRM básico).</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Registro Detallado:</strong> Guarda información clave como nombre, email, teléfono, dirección completa y notas adicionales o preferencias del cliente.</li>
            <li><strong>Historial de Compras:</strong> Al seleccionar un cliente, puedes ver su perfil completo, incluyendo todas las ventas concretadas y presupuestos solicitados a lo largo del tiempo.</li>
            <li><strong>Análisis de Valor:</strong> El sistema calcula automáticamente el total gastado por cada cliente, ayudándote a identificar a tus mejores compradores.</li>
            <li><strong>Búsqueda y Filtros:</strong> Encuentra rápidamente clientes por nombre o datos de contacto para asociarlos ágilmente a nuevas transacciones.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'inventory',
      title: 'Inventario (Productos e Insumos)',
      icon: Grid,
      color: 'text-purple-500',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      content: (
        <div className="space-y-2 text-stone-600 dark:text-stone-300">
          <p>El núcleo de tu negocio, dividido en dos secciones principales para un control total.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Materias Primas (Insumos):</strong> Registra los materiales que utilizas para fabricar. Define su unidad de medida base (kg, litros, metros, unidades), costo unitario, stock actual y stock mínimo para alertas. Puedes registrar ingresos de stock (compras a proveedores).</li>
            <li><strong>Productos Terminados:</strong> Artículos listos para la venta. Puedes crear productos simples o con variantes (ej. diferentes tamaños, colores o aromas de un mismo producto). Define precio de venta, categoría y visibilidad en el catálogo.</li>
            <li><strong>Ítems Duales (Producto e Insumo):</strong> Funcionalidad avanzada que permite marcar un Insumo para que también se venda directamente como Producto (aparecerá en el catálogo con su propio precio y margen), o marcar un Producto para que funcione como Insumo (para usarlo dentro de otras recetas). El stock se mantiene sincronizado automáticamente en tiempo real entre ambos módulos, sin importar por dónde se venda o consuma.</li>
            <li><strong>Recetas (Fórmulas de Producción):</strong> A cada variante de producto le puedes asignar una receta exacta, indicando qué materias primas y en qué cantidades precisas se consumen para fabricar una unidad de ese producto.</li>
            <li><strong>Ajustes de Stock:</strong> Herramienta para corregir discrepancias de inventario por mermas, roturas o conteos físicos.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'scanner',
      title: 'Escanear Código',
      icon: ScanBarcode,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
      content: (
        <div className="space-y-2 text-stone-600 dark:text-stone-300">
          <p>Herramienta para buscar productos e insumos rápidamente usando la cámara de tu dispositivo o un lector de códigos.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Búsqueda Rápida:</strong> Apunta la cámara al código de barras o QR de un producto o insumo y el sistema lo buscará automáticamente en toda tu base de datos.</li>
            <li><strong>Acceso Directo:</strong> Si el ítem es encontrado, serás redirigido inmediatamente a su pantalla de edición correspondiente (ya sea producto o materia prima) para actualizar stock, precios o cualquier otro detalle sin tener que buscarlo manualmente.</li>
            <li><strong>Botón Flotante:</strong> Puedes acceder al escáner en cualquier momento desde el botón flotante ubicado en la esquina inferior derecha de la pantalla.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'catalog',
      title: 'Catálogo Online',
      icon: ShoppingCart,
      color: 'text-pink-500',
      bgColor: 'bg-pink-100 dark:bg-pink-900/30',
      content: (
        <div className="space-y-2 text-stone-600 dark:text-stone-300">
          <p>Tu vitrina virtual pública para que los clientes vean tus productos y realicen pedidos.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Visibilidad Controlada:</strong> Solo los productos e insumos (marcados para venta) que tengan activada la opción "Mostrar en Catálogo" aparecerán aquí.</li>
            <li><strong>Categorización y Búsqueda:</strong> Los clientes pueden filtrar los productos por categorías o usar el buscador integrado.</li>
            <li><strong>Carrito de Compras:</strong> Los clientes pueden ir agregando productos a su carrito, ajustando cantidades y viendo el total estimado.</li>
            <li><strong>Pedidos por WhatsApp:</strong> Al finalizar, el cliente envía el detalle completo de su pedido (productos, cantidades, total y sus datos) directamente a tu número de WhatsApp configurado, facilitando el cierre de la venta.</li>
            <li><strong>Compartir Fácilmente:</strong> Copia el enlace único de tu catálogo para enviarlo por redes sociales, ponerlo en tu biografía de Instagram o enviarlo por mensaje.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'production',
      title: 'Producción',
      icon: Briefcase,
      color: 'text-orange-500',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
      content: (
        <div className="space-y-2 text-stone-600 dark:text-stone-300">
          <p>Controla el proceso de fabricación de tus productos y el consumo exacto de insumos.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Nueva Orden de Producción:</strong> Selecciona qué producto y variante vas a fabricar y la cantidad deseada. El sistema calculará automáticamente el consumo estimado de todas las materias primas necesarias basándose en la receta configurada.</li>
            <li><strong>Estado Pendiente (Planificación):</strong> Al crear una orden, queda en estado "Pendiente". El stock de materia prima se marca visualmente como "comprometido" para esa orden, pero no se descuenta físicamente del inventario general todavía.</li>
            <li><strong>Completar Orden:</strong> Al finalizar la fabricación y marcar la orden como "Completada", el sistema realiza dos acciones automáticas: descuenta las materias primas consumidas del inventario y suma la cantidad fabricada al stock del producto terminado.</li>
            <li><strong>Edición Inteligente:</strong> Puedes editar órdenes pendientes o incluso completadas. Si editas una orden ya completada (ej. cambiaste la cantidad fabricada), el sistema ajustará inteligentemente los inventarios, revirtiendo los movimientos anteriores y aplicando los nuevos cálculos de forma transparente.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'tools',
      title: 'Herramientas',
      icon: Wrench,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
      content: (
        <div className="space-y-2 text-stone-600 dark:text-stone-300">
          <p>Utilidades avanzadas para la gestión de precios, costos y operaciones masivas.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Simulador de Costos:</strong> Permite proyectar cómo afectaría un aumento porcentual en el costo de las materias primas al costo final de tus productos fabricados. Puedes guardar estas simulaciones y, si lo decides, aplicar los nuevos costos directamente al inventario con un solo clic.</li>
            <li><strong>Calculadora de Precios:</strong> Herramienta de asistencia que te ayuda a definir el precio de venta ideal basándose en el costo del producto y el margen de ganancia (porcentaje) que deseas obtener.</li>
            <li><strong>Actualización Masiva:</strong> Funciones para modificar precios, costos o stock de múltiples productos o insumos al mismo tiempo, ahorrando horas de trabajo manual.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'finance',
      title: 'Finanzas',
      icon: Wallet,
      color: 'text-teal-500',
      bgColor: 'bg-teal-100 dark:bg-teal-900/30',
      content: (
        <div className="space-y-2 text-stone-600 dark:text-stone-300">
          <p>Control integral de ingresos, egresos y la salud financiera de tu negocio.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Registro de Movimientos:</strong> Registra manualmente gastos operativos (compras de insumos, pago de servicios, sueldos, alquiler) e ingresos extraordinarios. Las ventas registradas en el sistema se reflejan aquí de forma automática como ingresos.</li>
            <li><strong>Categorización:</strong> Clasifica tus movimientos en categorías personalizables para entender exactamente en qué áreas estás gastando más dinero.</li>
            <li><strong>Balance y Flujo de Caja:</strong> Visualiza el balance general (Ingresos vs Egresos) del mes actual o periodos anteriores para conocer la rentabilidad real de tu operación.</li>
            <li><strong>Comprobantes:</strong> Adjunta fotos o PDFs de facturas y tickets a tus registros de gastos para llevar un control contable ordenado.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'coupon',
      title: 'Cupones y Ofertas',
      icon: Ticket,
      color: 'text-rose-500',
      bgColor: 'bg-rose-100 dark:bg-rose-900/30',
      content: (
        <div className="space-y-2 text-stone-600 dark:text-stone-300">
          <p>Gestión de estrategias de marketing, descuentos y promociones especiales.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Crear Cupones de Descuento:</strong> Define códigos promocionales (ej. "VERANO20", "BIENVENIDA"), establece el tipo de descuento (porcentaje o un monto fijo de dinero), y configura una fecha de expiración o límite de usos.</li>
            <li><strong>Ofertas por Producto:</strong> Aplica descuentos directos a productos específicos durante un tiempo determinado. Estas ofertas se destacarán visualmente en el catálogo online.</li>
            <li><strong>Aplicación en Ventas:</strong> Usa los códigos de cupón al registrar una nueva venta manual o permite que los clientes los ingresen en el catálogo online para aplicar el descuento automáticamente al total de su compra.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'stats',
      title: 'Estadísticas y Reportes',
      icon: BarChart2,
      color: 'text-fuchsia-500',
      bgColor: 'bg-fuchsia-100 dark:bg-fuchsia-900/30',
      content: (
        <div className="space-y-2 text-stone-600 dark:text-stone-300">
          <p>Análisis profundo y visual del rendimiento de tu negocio para la toma de decisiones.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Análisis de Ventas:</strong> Gráficos detallados de ingresos por día, semana o mes. Compara periodos para ver el crecimiento.</li>
            <li><strong>Productos Más Vendidos:</strong> Ranking de los artículos que generan más ingresos y los que tienen mayor volumen de salida, ayudándote a enfocar tus esfuerzos de producción y marketing.</li>
            <li><strong>Rendimiento de Clientes:</strong> Identifica a tus clientes más frecuentes y los que generan mayor valor (ticket promedio más alto).</li>
            <li><strong>Reportes Financieros:</strong> Desglose visual de gastos por categoría y evolución del margen de ganancia a lo largo del tiempo.</li>
          </ul>
        </div>
      )
    }
  ];

  return (
    <div className="flex-1 p-4 lg:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-3">
            <BookOpen className="text-indigo-500" size={32} />
            Centro de Ayuda
          </h1>
          <p className="text-stone-500 dark:text-stone-400 mt-2">
            Guía completa sobre cómo utilizar cada módulo del sistema para gestionar tu negocio de manera eficiente.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {sections.map((section) => (
            <div 
              key={section.id}
              className="bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`p-3 rounded-xl ${section.bgColor} ${section.color}`}>
                    <section.icon size={24} />
                  </div>
                  <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100">
                    {section.title}
                  </h2>
                </div>
                <div className="pl-16">
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
