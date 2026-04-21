import React, { useState, useEffect } from 'react';
import { RawMaterial, Product } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { Save, X, RefreshCw, Image as ImageIcon, Upload, Trash2 } from 'lucide-react';
import { Unit, Dimension, UNIT_DIMENSIONS, UMB_FOR_DIMENSION, toUMB, fromUMB } from '../utils/units';
import { roundPrecise } from '../utils/mathUtils';
import imageCompression from 'browser-image-compression';

interface RawMaterialFormProps {
  initialData?: RawMaterial;
  products: Product[];
  onSave: (material: RawMaterial) => void;
  onCancel: () => void;
}

export default function RawMaterialForm({ initialData, products, onSave, onCancel }: RawMaterialFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [unit, setUnit] = useState<Unit>((initialData?.unit as Unit) || 'g');
  const [dimension, setDimension] = useState<Dimension>((initialData?.dimension as Dimension) || 'weight');
  const [barcode, setBarcode] = useState(initialData?.barcode || Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0'));
  
  // Display values are in the selected 'unit'
  const [displayStock, setDisplayStock] = useState<number>(
    initialData ? fromUMB(initialData.stock, (initialData.unit as Unit) || 'g') : 0
  );
  const [displayCost, setDisplayCost] = useState<number>(
    initialData ? initialData.costPerUnit * toUMB(1, (initialData.unit as Unit) || 'g') : 0
  );
  const [displayMinStock, setDisplayMinStock] = useState<number>(
    initialData ? fromUMB(initialData.minStock, (initialData.unit as Unit) || 'g') : 0
  );

  const [price, setPrice] = useState<number>(initialData?.price || 0);
  const [category, setCategory] = useState<string>(initialData?.category || 'Insumos');
  const [description, setDescription] = useState<string>(initialData?.description || '');
  const [photoUrl, setPhotoUrl] = useState<string>(initialData?.photoUrl || '');
  const [sellAsProduct, setSellAsProduct] = useState<boolean>(initialData?.sellAsProduct || false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Update unit options when dimension changes
  useEffect(() => {
    if (!initialData) {
      if (dimension === 'weight') setUnit('g');
      if (dimension === 'volume') setUnit('ml');
      if (dimension === 'length') setUnit('m');
      if (dimension === 'units') setUnit('u');
    }
  }, [dimension, initialData]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const options = {
        maxSizeMB: 0.2, 
        maxWidthOrHeight: 1024,
        useWebWorker: true,
        fileType: 'image/webp'
      };
      const compressedFile = await imageCompression(file, options);

      setSelectedFile(compressedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
        setIsUploading(false);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Error al comprimir la imagen:', error);
      alert('Hubo un error al procesar la imagen. Intenta con otra.');
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    
    let finalPhotoUrl = photoUrl;
    if (selectedFile) {
      try {
        const reader = new FileReader();
        finalPhotoUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
      } catch (error: any) {
        console.error('Error handling image:', error);
        alert('Error al procesar la imagen. Por favor, intenta de nuevo.');
        setIsUploading(false);
        return;
      }
    }

    // Convert display values to UMB for storage
    const stockUMB = toUMB(displayStock, unit);
    const minStockUMB = toUMB(displayMinStock, unit);
    // Cost per UMB = Cost per display unit / UMBs in 1 display unit
    const costPerUMB = roundPrecise(displayCost / toUMB(1, unit));

    onSave({
      id: initialData?.id || uuidv4(),
      name,
      unit,
      dimension,
      baseUnit: UMB_FOR_DIMENSION[dimension],
      stock: stockUMB,
      costPerUnit: costPerUMB,
      minStock: minStockUMB,
      barcode,
      price: price,
      category: category,
      description: description,
      photoUrl: finalPhotoUrl,
      sellAsProduct: sellAsProduct,
      linkedProductId: initialData?.linkedProductId,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="flex-1 overflow-y-auto min-h-0 max-w-2xl mx-auto w-full space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">
          {initialData ? 'Editar Insumo' : 'Nuevo Insumo'}
        </h2>
        <button
          onClick={onCancel}
          className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Nombre del Insumo</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-stone-900 dark:text-stone-100"
              placeholder="Ej. Cera de Soja"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Código de Barras</label>
            <div className="flex">
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-l-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-stone-900 dark:text-stone-100"
                placeholder="Ej. 779123456789"
              />
              <button
                type="button"
                onClick={() => setBarcode(Math.floor(Math.random() * 900000000000 + 100000000000).toString())}
                className="px-4 py-2 bg-stone-100 dark:bg-stone-800 border border-l-0 border-stone-200 dark:border-stone-700 rounded-r-xl text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                title="Generar código aleatorio"
              >
                <RefreshCw size={20} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Dimensión</label>
            <select
              value={dimension}
              onChange={(e) => setDimension(e.target.value as Dimension)}
              className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-stone-900 dark:text-stone-100"
            >
              <option value="weight">Peso</option>
              <option value="volume">Volumen</option>
              <option value="length">Longitud</option>
              <option value="units">Unidades</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Unidad de Compra/Visualización</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as Unit)}
              className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-stone-900 dark:text-stone-100"
            >
              {dimension === 'weight' && (
                <>
                  <option value="g">Gramos (g)</option>
                  <option value="kg">Kilogramos (kg)</option>
                </>
              )}
              {dimension === 'volume' && (
                <>
                  <option value="ml">Mililitros (ml)</option>
                  <option value="l">Litros (l)</option>
                </>
              )}
              {dimension === 'length' && (
                <>
                  <option value="mm">Milímetros (mm)</option>
                  <option value="cm">Centímetros (cm)</option>
                  <option value="m">Metros (m)</option>
                </>
              )}
              {dimension === 'units' && (
                <option value="u">Unidades (u)</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Stock Actual ({unit})</label>
            <input
              type="number"
              required
              min="0"
              step="any"
              value={displayStock}
              onChange={(e) => setDisplayStock(e.target.value === '' ? '' : parseFloat(e.target.value))}
              onFocus={(e) => e.target.select()}
              className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-stone-900 dark:text-stone-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Costo por {unit}</label>
            <input
              type="number"
              required
              min="0"
              step="any"
              value={displayCost}
              onChange={(e) => setDisplayCost(e.target.value === '' ? '' : parseFloat(e.target.value))}
              onFocus={(e) => e.target.select()}
              className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-stone-900 dark:text-stone-100"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Stock Mínimo (Alerta en {unit})</label>
            <input
              type="number"
              required
              min="0"
              step="any"
              value={displayMinStock}
              onChange={(e) => setDisplayMinStock(e.target.value === '' ? '' : parseFloat(e.target.value))}
              onFocus={(e) => e.target.select()}
              className="w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-stone-900 dark:text-stone-100"
            />
          </div>
        </div>

        <div className="pt-6 border-t border-stone-100 dark:border-stone-800">
          <div className="mb-6">
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">Imagen del Insumo</label>
            <div className="flex items-start space-x-4">
              <div className="flex-1">
                <div className="relative border-2 border-dashed border-stone-300 dark:border-stone-600 rounded-xl p-4 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-center cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Upload className="w-8 h-8 text-stone-400" />
                    <div className="text-sm text-stone-600 dark:text-stone-400">
                      <span className="font-medium text-indigo-600 dark:text-indigo-400">Haz clic para subir</span> o arrastra una imagen
                    </div>
                    <p className="text-xs text-stone-500">PNG, JPG, WEBP hasta 5MB</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center">
                  <div className="flex-grow border-t border-stone-200 dark:border-stone-700"></div>
                  <span className="px-3 text-xs text-stone-500 uppercase">O usa una URL</span>
                  <div className="flex-grow border-t border-stone-200 dark:border-stone-700"></div>
                </div>
                <input
                  type="url"
                  value={photoUrl}
                  onChange={(e) => {
                    setPhotoUrl(e.target.value);
                    setSelectedFile(null);
                  }}
                  className="mt-3 w-full px-4 py-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-stone-900 dark:text-stone-100"
                  placeholder="https://ejemplo.com/imagen.jpg"
                />
              </div>
              {photoUrl && (
                <div className="w-32 h-32 rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden bg-stone-50 dark:bg-stone-900 flex-shrink-0 relative group">
                  <img src={photoUrl} alt="Vista previa" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoUrl('');
                      setSelectedFile(null);
                    }}
                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-6 h-6 text-white" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <label className="flex items-center space-x-3 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={sellAsProduct}
              onChange={(e) => setSellAsProduct(e.target.checked)}
              className="w-5 h-5 text-indigo-600 rounded border-stone-300 focus:ring-indigo-500 dark:border-stone-600 dark:bg-stone-800"
            />
            <span className="text-stone-800 dark:text-stone-200 font-medium">Vender como producto</span>
          </label>

          {sellAsProduct && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-stone-50 dark:bg-stone-900/50 p-6 rounded-xl border border-stone-200 dark:border-stone-700">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Precio de Venta (por {unit})</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-stone-500">$</span>
                  <input
                    type="number"
                    required={sellAsProduct}
                    min="0"
                    step="any"
                    value={price}
                    onChange={(e) => setPrice(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    className="w-full pl-8 pr-4 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-stone-900 dark:text-stone-100"
                  />
                </div>
                {displayCost > 0 && price > 0 && (
                  <p className="text-xs text-stone-500 mt-1">
                    Margen: {(((price - displayCost) / displayCost) * 100).toFixed(1)}%
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Categoría en Catálogo</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-stone-900 dark:text-stone-100"
                  placeholder="Ej. Insumos, Herramientas"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-stone-900 dark:text-stone-100 resize-none"
                  placeholder="Descripción para el catálogo online..."
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-stone-100 dark:border-stone-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={isUploading}
            className="px-6 py-2 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 font-medium rounded-xl transition-colors mr-3 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isUploading}
            className="flex items-center px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {isUploading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
            ) : (
              <Save size={18} className="mr-2" />
            )}
            {isUploading ? 'Guardando...' : 'Guardar Insumo'}
          </button>
        </div>
      </form>
    </div>
  );
}
