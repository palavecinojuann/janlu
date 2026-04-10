import React, { useState, useMemo } from 'react';
import { Sale, Quote, FinancialDocument, Product, RawMaterial } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Calendar, TrendingUp, TrendingDown, DollarSign, ShoppingBag, ArrowRight, Activity, PieChart as PieChartIcon } from 'lucide-react';
import { format, subMonths, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO, differenceInDays, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface StatsViewProps {
  sales: Sale[];
  quotes: Quote[];
  financialDocs: FinancialDocument[];
  products: Product[];
}

type Period = 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'custom';
type ComparePeriod = 'previous' | 'sameLastYear' | 'none';

export default function StatsView({ sales, quotes, financialDocs, products }: StatsViewProps) {
  const [period, setPeriod] = useState<Period>('thisMonth');
  const [comparePeriod, setComparePeriod] = useState<ComparePeriod>('previous');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Calculate date ranges
  const dateRanges = useMemo(() => {
    const now = new Date();
    let start: Date, end: Date;
    let compStart: Date | null = null, compEnd: Date | null = null;

    switch (period) {
      case 'thisMonth':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'lastMonth':
        start = startOfMonth(subMonths(now, 1));
        end = endOfMonth(subMonths(now, 1));
        break;
      case 'thisYear':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      case 'lastYear':
        start = startOfYear(subYears(now, 1));
        end = endOfYear(subYears(now, 1));
        break;
      case 'custom':
        start = customStart ? new Date(customStart) : startOfMonth(now);
        end = customEnd ? new Date(customEnd) : endOfMonth(now);
        break;
      default:
        start = startOfMonth(now);
        end = endOfMonth(now);
    }

    const daysDiff = differenceInDays(end, start);

    if (comparePeriod === 'previous') {
      compStart = addDays(start, -(daysDiff + 1));
      compEnd = addDays(end, -(daysDiff + 1));
    } else if (comparePeriod === 'sameLastYear') {
      compStart = subYears(start, 1);
      compEnd = subYears(end, 1);
    }

    return { start, end, compStart, compEnd };
  }, [period, comparePeriod, customStart, customEnd]);

  // Helper to filter items by date
  const filterByDate = (items: any[], dateField: string, start: Date, end: Date) => {
    return items.filter(item => {
      const d = new Date(item[dateField]);
      return d >= start && d <= end;
    });
  };

  // Calculate metrics for a period
  const calculateMetrics = (start: Date, end: Date) => {
    const validSales = sales.filter(s => s.status !== 'cancelado');
    const periodSales = filterByDate(validSales, 'date', start, end);
    const periodDocs = filterByDate(financialDocs, 'date', start, end);
    const periodQuotes = filterByDate(quotes, 'date', start, end);

    const revenue = periodSales.reduce((acc, s) => acc + s.amountPaid, 0);
    const expenses = periodDocs.filter(d => d.type === 'purchase').reduce((acc, d) => acc + d.amount, 0);
    
    // Calculate COGS (Cost of Goods Sold) for sales
    const cogs = periodSales.reduce((acc, sale) => {
      const saleCost = sale.items.reduce((itemAcc, item) => {
        const product = products.find(p => p.id === item.productId);
        const variant = product?.variants.find(v => v.id === item.variantId);
        return itemAcc + ((variant?.cost || 0) * item.quantity);
      }, 0);
      return acc + saleCost;
    }, 0);

    const grossProfit = revenue - cogs;
    const netProfit = revenue - expenses - cogs; // Simplified net profit
    const averageTicket = periodSales.length > 0 ? revenue / periodSales.length : 0;
    const salesCount = periodSales.length;

    // Projected revenue (pending quotes)
    const projectedRevenue = periodQuotes.filter(q => new Date(q.validUntil) >= new Date()).reduce((acc, q) => acc + q.totalAmount, 0);

    return { revenue, expenses, cogs, grossProfit, netProfit, averageTicket, salesCount, projectedRevenue, periodSales, periodDocs };
  };

  const currentMetrics = useMemo(() => calculateMetrics(dateRanges.start, dateRanges.end), [dateRanges, sales, financialDocs, quotes, products]);
  const compareMetrics = useMemo(() => {
    if (!dateRanges.compStart || !dateRanges.compEnd) return null;
    return calculateMetrics(dateRanges.compStart, dateRanges.compEnd);
  }, [dateRanges, sales, financialDocs, quotes, products]);

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  // Chart Data Preparation
  const chartData = useMemo(() => {
    const data = [];
    let current = new Date(dateRanges.start);
    const end = new Date(dateRanges.end);
    
    // Group by day if <= 31 days, else by month
    const daysDiff = differenceInDays(end, dateRanges.start);
    const groupBy = daysDiff <= 31 ? 'day' : 'month';

    while (current <= end) {
      const key = groupBy === 'day' ? format(current, 'dd/MM') : format(current, 'MMM yy', { locale: es });
      
      let periodStart = new Date(current);
      let periodEnd = groupBy === 'day' ? new Date(current) : endOfMonth(current);
      periodEnd.setHours(23, 59, 59, 999);

      const pSales = filterByDate(currentMetrics.periodSales, 'date', periodStart, periodEnd);
      const pDocs = filterByDate(currentMetrics.periodDocs, 'date', periodStart, periodEnd);

      const rev = pSales.reduce((acc, s) => acc + s.amountPaid, 0);
      const exp = pDocs.filter(d => d.type === 'purchase').reduce((acc, d) => acc + d.amount, 0);

      data.push({
        name: key,
        Ingresos: rev,
        Gastos: exp,
        Beneficio: rev - exp
      });

      if (groupBy === 'day') {
        current = addDays(current, 1);
      } else {
        current = addDays(endOfMonth(current), 1);
      }
    }
    return data;
  }, [dateRanges, currentMetrics]);

  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    currentMetrics.periodSales.forEach(sale => {
      sale.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        const cat = product?.category || 'Sin categoría';
        categories[cat] = (categories[cat] || 0) + (item.price * item.quantity);
      });
    });

    return Object.entries(categories).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [currentMetrics.periodSales, products]);

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  const formatCurrency = (amount: number) => new Intl.NumberFormat('es-AR', { 
    style: 'currency', 
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);

  const MetricCard = ({ title, value, compareValue, icon: Icon, isCurrency = true }: any) => {
    const change = compareValue !== undefined && compareValue !== null ? calculateChange(value, compareValue) : null;
    const isPositive = change !== null && change >= 0;

    return (
      <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-stone-500 dark:text-stone-400">{title}</p>
            <h3 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 mt-1 break-words">
              {isCurrency ? formatCurrency(value) : value}
            </h3>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Icon size={20} />
          </div>
        </div>
        
        {change !== null && (
          <div className="mt-4 flex items-center text-sm">
            <span className={`flex items-center font-medium ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isPositive ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
              {Math.abs(change).toFixed(2)}%
            </span>
            <span className="text-stone-500 ml-2">vs periodo anterior</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      <div className="flex-none flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Estadísticas y Reportes</h2>
          <p className="text-stone-500 text-sm mt-1">Analiza el rendimiento de tu negocio, balances y proyecciones.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-1">
            <select 
              value={period} 
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="bg-transparent text-sm font-medium text-stone-700 dark:text-stone-300 outline-none px-3 py-1.5"
            >
              <option value="thisMonth">Este Mes</option>
              <option value="lastMonth">Mes Pasado</option>
              <option value="thisYear">Este Año</option>
              <option value="lastYear">Año Pasado</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          <div className="flex items-center bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-1">
            <span className="text-xs text-stone-500 px-2">Comparar con:</span>
            <select 
              value={comparePeriod} 
              onChange={(e) => setComparePeriod(e.target.value as ComparePeriod)}
              className="bg-transparent text-sm font-medium text-stone-700 dark:text-stone-300 outline-none px-2 py-1.5"
            >
              <option value="previous">Periodo Anterior</option>
              <option value="sameLastYear">Mismo Periodo Año Pasado</option>
              <option value="none">Sin Comparación</option>
            </select>
          </div>
        </div>
      </div>

      {period === 'custom' && (
        <div className="flex-none flex gap-4 items-center bg-white dark:bg-stone-900 p-4 rounded-xl border border-stone-200 dark:border-stone-800">
          <div className="flex items-center">
            <label className="text-sm text-stone-500 mr-2">Desde:</label>
            <input 
              type="date" 
              value={customStart} 
              onChange={(e) => setCustomStart(e.target.value)}
              className="border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-1.5 text-sm bg-stone-50 dark:bg-stone-950"
            />
          </div>
          <div className="flex items-center">
            <label className="text-sm text-stone-500 mr-2">Hasta:</label>
            <input 
              type="date" 
              value={customEnd} 
              onChange={(e) => setCustomEnd(e.target.value)}
              className="border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-1.5 text-sm bg-stone-50 dark:bg-stone-950"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0 space-y-6 pb-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Ingresos Totales" 
          value={currentMetrics.revenue} 
          compareValue={compareMetrics?.revenue} 
          icon={DollarSign} 
        />
        <MetricCard 
          title="Beneficio Neto" 
          value={currentMetrics.netProfit} 
          compareValue={compareMetrics?.netProfit} 
          icon={Activity} 
        />
        <MetricCard 
          title="Ventas Realizadas" 
          value={currentMetrics.salesCount} 
          compareValue={compareMetrics?.salesCount} 
          icon={ShoppingBag} 
          isCurrency={false}
        />
        <MetricCard 
          title="Ticket Promedio" 
          value={currentMetrics.averageTicket} 
          compareValue={compareMetrics?.averageTicket} 
          icon={TrendingUp} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
          <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-6">Balance: Ingresos vs Gastos</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(value) => `$${value/1000}k`} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="Ingresos" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Chart */}
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
          <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-6">Ventas por Categoría</h3>
          {categoryData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-stone-400">
              <PieChartIcon size={48} className="mb-4 opacity-20" />
              <p>No hay datos de ventas</p>
            </div>
          )}
        </div>
      </div>

      {/* Projections & Additional Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
          <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-4">Proyecciones y Oportunidades</h3>
          
          <div className="space-y-4">
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-indigo-800 dark:text-indigo-300">Ingresos Proyectados (Presupuestos Pendientes)</span>
                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(currentMetrics.projectedRevenue)}</span>
              </div>
              <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70">
                Basado en {quotes.filter(q => new Date(q.validUntil) >= new Date()).length} presupuestos activos en este periodo.
              </p>
            </div>

            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Margen Bruto Promedio</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {currentMetrics.revenue > 0 ? ((currentMetrics.grossProfit / currentMetrics.revenue) * 100).toFixed(2) : (0).toFixed(2)}%
                </span>
              </div>
              <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">
                Diferencia entre ingresos por ventas y costo de mercadería vendida (COGS).
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
          <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-4">Resumen de Gastos</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-lg transition-colors">
              <span className="text-sm text-stone-600 dark:text-stone-400">Costo de Mercadería (COGS)</span>
              <span className="font-medium text-stone-900 dark:text-stone-100">{formatCurrency(currentMetrics.cogs)}</span>
            </div>
            <div className="flex justify-between items-center p-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-lg transition-colors">
              <span className="text-sm text-stone-600 dark:text-stone-400">Gastos Operativos (Comprobantes)</span>
              <span className="font-medium text-stone-900 dark:text-stone-100">{formatCurrency(currentMetrics.expenses)}</span>
            </div>
            <div className="flex justify-between items-center p-3 border-t border-stone-100 dark:border-stone-800">
              <span className="text-sm font-bold text-stone-800 dark:text-stone-200">Total Egresos</span>
              <span className="font-bold text-rose-600">{formatCurrency(currentMetrics.cogs + currentMetrics.expenses)}</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
