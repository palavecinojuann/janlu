import React from 'react';
import { Sale, Customer } from '../types';
import { QRCodeSVG } from 'qrcode.react';

interface ShippingLabelProps {
  sale: Sale;
  customer?: Customer;
  notes?: string;
  customAddress?: string;
}

export default function ShippingLabel({ sale, customer, notes, customAddress }: ShippingLabelProps) {
  return (
    <div className="shipping-label w-full max-w-[400px] min-h-[300px] border-4 border-black p-4 sm:p-6 flex flex-col bg-white text-black font-sans box-border mx-auto print:w-[400px] print:max-w-none">
      <div className="flex justify-between items-start border-b-2 border-black pb-3 sm:pb-4 mb-3 sm:mb-4">
        <div className="flex flex-col items-center">
          <h1 className="text-3xl sm:text-4xl font-cinzel font-bold text-black leading-none tracking-normal">JANLU</h1>
          <p className="font-lato text-[8px] sm:text-[9px] uppercase tracking-[0.3em] text-black mt-1 ml-1">Aromas & Diseño</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] sm:text-xs font-bold">PEDIDO</p>
          <p className="text-lg sm:text-xl font-black">#{sale.id.split('-')[1] || sale.id}</p>
        </div>
      </div>

      <div className="flex-1 space-y-2 sm:space-y-3">
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold uppercase text-stone-500">Destinatario</p>
          <p className="text-base sm:text-lg font-bold leading-tight">{sale.customerName}</p>
        </div>
        
        <div>
          <p className="text-[9px] sm:text-[10px] font-bold uppercase text-stone-500">
            {sale.deliveryMethod === 'retiro' ? 'Punto de Retiro' : 'Dirección de Envío'}
          </p>
          <p className="text-xs sm:text-sm font-medium leading-tight">
            {sale.deliveryMethod === 'retiro' 
              ? (customAddress || 'RETIRO EN TALLER') 
              : (customAddress || customer?.address || 'SIN DIRECCIÓN REGISTRADA')}
          </p>
        </div>

        <div>
          <p className="text-[9px] sm:text-[10px] font-bold uppercase text-stone-500">Teléfono</p>
          <p className="text-xs sm:text-sm font-medium">{customer?.phone || 'N/A'}</p>
        </div>

        {notes && (
          <div>
            <p className="text-[9px] sm:text-[10px] font-bold uppercase text-stone-500">Notas / Instrucciones</p>
            <p className="text-xs sm:text-sm font-medium leading-tight">{notes}</p>
          </div>
        )}

        <div>
          <p className="text-[9px] sm:text-[10px] font-bold uppercase text-stone-500 mb-1">Artículos</p>
          <ul className="text-[10px] sm:text-xs font-medium space-y-0.5">
            {sale.items.map((item, index) => (
              <li key={index} className="flex justify-between items-start">
                <div className="flex-1 pr-2">
                  <span className="truncate">{item.quantity}x {item.productName}</span>
                  <p className="text-[8px] text-stone-500">{item.variantName}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-stone-600 font-bold">${item.price.toLocaleString('es-AR')} c/u</p>
                  <p className="text-xs font-black">${(item.price * item.quantity).toLocaleString('es-AR')}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-2 mt-2 border-t border-stone-200">
          <p className="text-[9px] sm:text-[10px] font-bold uppercase text-stone-500 mb-1">Pagos</p>
          {sale.discount && sale.discount > 0 && sale.discount < 100 && (
            <div className="flex justify-between text-[10px] sm:text-xs mb-0.5">
              <span>Subtotal:</span>
              <span>${(sale.totalAmount / (1 - sale.discount / 100)).toLocaleString('es-AR')}</span>
            </div>
          )}
          {sale.discount && sale.discount > 0 && (
            <div className="flex justify-between text-[10px] sm:text-xs mb-0.5 text-emerald-700">
              <span>Descuento {sale.appliedCouponCode ? `(${sale.appliedCouponCode})` : ''}:</span>
              <span className="font-bold">-{sale.discount}%</span>
            </div>
          )}
          <div className="flex justify-between text-[10px] sm:text-xs mb-0.5">
            <span>Total:</span>
            <span className="font-bold">${sale.totalAmount.toLocaleString('es-AR')}</span>
          </div>
          <div className="flex justify-between text-[10px] sm:text-xs mb-0.5">
            <span>Abonado:</span>
            <span className="font-bold text-emerald-700">${sale.amountPaid.toLocaleString('es-AR')}</span>
          </div>
          {sale.totalAmount > sale.amountPaid ? (
            <div className="flex justify-between text-[10px] sm:text-xs font-bold text-rose-700 mt-1 pt-1 border-t border-stone-100">
              <span>Pendiente:</span>
              <span>${(sale.totalAmount - sale.amountPaid).toLocaleString('es-AR')}</span>
            </div>
          ) : (
            <div className="flex justify-between text-[10px] sm:text-xs font-bold text-emerald-700 mt-1 pt-1 border-t border-stone-100">
              <span>Estado:</span>
              <span>PAGADO</span>
            </div>
          )}
          {sale.paymentHistory && sale.paymentHistory.length > 0 && (
            <div className="mt-2 pt-1 border-t border-stone-100">
              <p className="text-[8px] sm:text-[9px] font-bold uppercase text-stone-500 mb-0.5">Historial de Pagos</p>
              {sale.paymentHistory.map((ph, i) => (
                <div key={i} className="flex justify-between text-[9px] sm:text-[10px] text-stone-600 mb-0.5">
                  <div className="flex flex-col">
                    <span className="font-bold">{ph.amount > 0 ? 'Pago' : 'Ajuste'}</span>
                    <span className="text-[7px] sm:text-[8px]">{new Date(ph.date).toLocaleDateString()} - {ph.method || ''}</span>
                  </div>
                  <span className={`font-bold ${ph.amount > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {ph.amount > 0 ? '+' : ''}${ph.amount.toLocaleString('es-AR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-end mt-3 sm:mt-4 pt-3 sm:pt-4 border-t-2 border-black">
        <div className="w-16 h-16 sm:w-24 sm:h-24 bg-stone-100 flex items-center justify-center border border-stone-300">
          <QRCodeSVG value={`SALE-${sale.id}`} size={64} className="sm:w-20 sm:h-20 w-14 h-14" />
        </div>
        <div className="text-right">
          <p className="text-[7px] sm:text-[8px] font-bold uppercase">Fecha de Despacho</p>
          <p className="text-[10px] sm:text-xs font-bold">{new Date().toLocaleDateString()}</p>
          {sale.generatedCouponCode && (
            <div className="mt-2 p-1 border border-dashed border-black rounded">
              <p className="text-[6px] font-bold uppercase">Cupón de Regalo</p>
              <p className="text-[10px] font-black">{sale.generatedCouponCode}</p>
              <p className="text-[6px]">20% OFF PRÓX. COMPRA</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
