import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  hideCloseButton?: boolean;
}

export default function BarcodeScanner({ onScan, onClose, hideCloseButton }: BarcodeScannerProps) {
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'reader',
      { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
      /* verbose= */ false
    );

    scanner.render(
      (decodedText) => {
        scanner.clear();
        onScan(decodedText);
      },
      (err) => {
        // Ignore errors during scanning (usually just means no barcode found yet)
      }
    );

    return () => {
      scanner.clear().catch(console.error);
    };
  }, [onScan]);

  return (
    <div className="w-full bg-white dark:bg-stone-900 rounded-3xl overflow-hidden shadow-sm relative">
      {!hideCloseButton && (
        <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100">Escanear Código</h3>
          <button onClick={onClose} className="p-2 bg-stone-100 dark:bg-stone-800 rounded-full text-stone-500 hover:text-stone-800 dark:hover:text-stone-200">
            <X size={20} />
          </button>
        </div>
      )}
      <div className="p-4">
        <div id="reader" className="w-full"></div>
        {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
      </div>
    </div>
  );
}
