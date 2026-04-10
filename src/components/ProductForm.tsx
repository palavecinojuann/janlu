import React, { useState, useEffect } from 'react';
import { Product, Variant, RawMaterial, RecipeItem } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Image as ImageIcon, Upload, RefreshCw } from 'lucide-react';
import { getUnitsForDimension, toUMB, formatUMB, UNIT_DIMENSIONS, UMB_FOR_DIMENSION, Dimension, Unit } from '../utils/units';
import { getVariantStock } from '../utils/stockUtils';
import imageCompression from 'browser-image-compression';

interface ProductFormProps {
  product?: Product;
  rawMaterials: RawMaterial[];
  onSave: (product: Product) => Promise<void>;
  onCancel: () => void;
}

export default function ProductForm({ product, rawMaterials, onSave, onCancel }: ProductFormProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    description: '',
    category: '',
    photoUrl: '',
    variants: [],
    showInCatalog: true,
    customNote: '',
  });

  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const PREDEFINED_CATEGORIES = ['Velas Aromáticas', 'Difusores', 'Home Spray', 'Accesorios', 'Kits'];

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        category: product.category || '',
        photoUrl: product.photoUrl || '',
        variants: product.variants.map(v => ({
          ...v,
          recipe: v.recipe?.map(ri => ({ ...ri, id: ri.id || uuidv4() }))
        })) || [],
        showInCatalog: product.showInCatalog ?? true,
        customNote: product.customNote || '',
      });
      if (product.category && !PREDEFINED_CATEGORIES.includes(product.category)) {
        setIsAddingNewCategory(true);
      }
    } else {
      // Add one empty variant by default if none exists
      setFormData(prev => {
        if (prev.variants.length === 0) {
          return {
            ...prev,
            variants: [{ 
              id: uuidv4(), 
              name: '', 
              stock: 0, 
              cost: 0, 
              margin: 0, 
              price: 0,
              barcode: Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0') 
            }]
          };
        }
        return prev;
      });
    }
  }, [product]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleVariantChange = (id: string, field: keyof Variant, value: string | number | boolean) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => {
        if (v.id === id) {
          const updatedVariant = { ...v, [field]: value };
          
          // Bidirectional calculation
          if (field === 'cost' || field === 'margin') {
            const cost = field === 'cost' ? Number(value) : v.cost;
            const margin = field === 'margin' ? Number(value) : v.margin;
            updatedVariant.price = cost * (1 + (margin / 100));
          } else if (field === 'price') {
            const price = Number(value);
            const cost = v.cost;
            if (cost > 0) {
              updatedVariant.margin = ((price / cost) - 1) * 100;
            }
          }
          
          return updatedVariant;
        }
        return v;
      }),
    }));
  };

  const addRecipeItem = (variantId: string) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => {
        if (v.id === variantId) {
          return {
            ...v,
            recipe: [...(v.recipe || []), { id: uuidv4(), rawMaterialId: '', quantity: 0 }]
          };
        }
        return v;
      })
    }));
  };

  const updateRecipeItem = (variantId: string, index: number, updates: Partial<RecipeItem>) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => {
        if (v.id === variantId && v.recipe) {
          const newRecipe = [...v.recipe];
          newRecipe[index] = { ...newRecipe[index], ...updates };
          return { ...v, recipe: newRecipe };
        }
        return v;
      })
    }));
  };

  const removeRecipeItem = (variantId: string, index: number) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((v) => {
        if (v.id === variantId && v.recipe) {
          const newRecipe = [...v.recipe];
          newRecipe.splice(index, 1);
          return { ...v, recipe: newRecipe };
        }
        return v;
      })
    }));
  };

  const addVariant = () => {
    setFormData((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        { 
          id: uuidv4(), 
          name: '', 
          stock: 0, 
          cost: 0, 
          margin: 0, 
          price: 0,
          barcode: Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0') 
        },
      ],
    }));
  };

  const removeVariant = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((v) => v.id !== id),
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('La imagen es demasiado grande. Por favor, selecciona una imagen de menos de 5MB.');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleSubmit started');
    setIsUploading(true);
    
    let photoUrl = formData.photoUrl;
    if (selectedFile) {
      try {
        console.log('Compressing image...');
        const options = {
          maxSizeMB: 0.1, // Max 100KB to fit in Firestore document
          maxWidthOrHeight: 800,
          useWebWorker: true
        };
        const compressedFile = await imageCompression(selectedFile, options);
        
        console.log('Converting image to base64...');
        const reader = new FileReader();
        photoUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(compressedFile);
        });
        console.log('Image converted to base64.');
      } catch (error: any) {
        console.error('Error handling image:', error);
        const errorMessage = error.message || 'Error desconocido';
        const errorCode = error.code || 'unknown';
        alert(`Error al procesar la imagen (${errorCode}): ${errorMessage}. Por favor, intenta de nuevo.`);
        setIsUploading(false);
        setUploadProgress(0);
        return;
      }
    }
    
    // Validation: If any variant is "Stock Dinámico" (isFinishedGood === false), it must have a valid recipe
    const invalidVariants = formData.variants.filter(v => 
      v.isFinishedGood === false && (!v.recipe || v.recipe.length === 0 || v.recipe.some(r => !r.rawMaterialId || r.quantity <= 0))
    );

    if (invalidVariants.length > 0) {
      alert(`Las siguientes variantes están marcadas como "Stock Dinámico" pero no tienen una fórmula válida definida: ${invalidVariants.map(v => v.name || 'Sin nombre').join(', ')}. Por favor, agrega al menos un insumo con cantidad mayor a cero.`);
      setIsUploading(false);
      return;
    }

    const now = new Date().toISOString();
    const newProduct: Product = {
      ...formData,
      photoUrl,
      id: product?.id || uuidv4(),
      createdAt: product?.createdAt || now,
      updatedAt: now,
    };
    console.log('Saving product:', newProduct);
    try {
      console.log('Before onSave');
      await onSave(newProduct);
      console.log('After onSave');
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error al guardar el producto. Por favor, intenta de nuevo.');
      setIsUploading(false);
      return;
    }
    setIsUploading(false);
    console.log('handleSubmit finished');
  };

  return (
    <div className="flex-1 overflow-y-auto min-h-0 max-w-4xl mx-auto w-full pb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">
          {product ? 'Editar Producto' : 'Nuevo Producto'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-6">
          <h3 className="text-lg font-semibold text-stone-800 dark:text-stone-100 border-b border-stone-100 dark:border-stone-800 pb-2">Información Básica</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                  placeholder="Ej: Vela Aromática Vainilla"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Categoría *</label>
                {isAddingNewCategory ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="category"
                      required
                      value={formData.category || ''}
                      onChange={handleChange}
                      className="flex-1 px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                      placeholder="Nueva categoría..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNewCategory(false);
                        setFormData(prev => ({ ...prev, category: PREDEFINED_CATEGORIES[0] }));
                      }}
                      className="px-3 py-2 text-sm text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <select
                    name="category"
                    required
                    value={formData.category || ''}
                    onChange={(e) => {
                      if (e.target.value === 'new') {
                        setIsAddingNewCategory(true);
                        setFormData(prev => ({ ...prev, category: '' }));
                      } else {
                        setFormData(prev => ({ ...prev, category: e.target.value }));
                      }
                    }}
                    className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                  >
                    <option value="">Seleccionar categoría...</option>
                    {PREDEFINED_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="new">+ Añadir nueva categoría...</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Descripción</label>
                <textarea
                  name="description"
                  rows={3}
                  value={formData.description || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow resize-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                  placeholder="Detalles del producto..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Nota Destacada del Producto (Opcional)</label>
                <textarea
                  name="customNote"
                  rows={2}
                  value={formData.customNote || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow resize-none bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                  placeholder="Sobrescribe la nota global. Ej: Edición Limitada..."
                />
              </div>

              <div className="flex items-center space-x-3 p-3 bg-stone-50 dark:bg-stone-950/50 rounded-xl border border-stone-100 dark:border-stone-800">
                <input
                  type="checkbox"
                  id="showInCatalog"
                  name="showInCatalog"
                  checked={formData.showInCatalog}
                  onChange={handleChange}
                  className="w-4 h-4 text-indigo-600 border-stone-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="showInCatalog" className="text-sm font-medium text-stone-700 dark:text-stone-300 cursor-pointer">
                  Mostrar en el Catálogo Online
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Foto del Producto</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-stone-200 dark:border-stone-700 border-dashed rounded-2xl hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors bg-stone-50 dark:bg-stone-950/50 group relative">
                <div className="space-y-2 text-center">
                  {formData.photoUrl ? (
                    <div className="relative w-full h-48 rounded-lg overflow-hidden">
                      <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <label className="cursor-pointer bg-white/90 dark:bg-stone-900/90 text-stone-800 dark:text-stone-200 px-4 py-2 rounded-lg font-medium text-sm shadow-sm hover:bg-white dark:hover:bg-stone-800 transition-colors flex items-center">
                          <Upload size={16} className="mr-2" />
                          Cambiar Foto
                          <input type="file" className="sr-only" accept="image/*" onChange={handlePhotoUpload} />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="p-4 bg-white dark:bg-stone-900 rounded-full shadow-sm mb-3">
                        <ImageIcon className="mx-auto h-8 w-8 text-stone-400 dark:text-stone-500" />
                      </div>
                      <div className="flex text-sm text-stone-600 dark:text-stone-400">
                        <label className="relative cursor-pointer bg-white dark:bg-stone-900 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                          <span>Sube un archivo</span>
                          <input type="file" className="sr-only" accept="image/*" onChange={handlePhotoUpload} />
                        </label>
                        <p className="pl-1">o arrastra y suelta</p>
                      </div>
                      <p className="text-xs text-stone-500 dark:text-stone-500 mt-2">PNG, JPG, GIF hasta 5MB</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
            <h3 className="text-lg font-semibold text-stone-800 dark:text-stone-100">Variantes y Precios</h3>
            <button
              type="button"
              onClick={addVariant}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-lg text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 hover:bg-indigo-200 dark:hover:bg-indigo-900/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              <Plus size={16} className="mr-1.5" />
              Agregar Variante
            </button>
          </div>

          <div className="space-y-4">
            {formData.variants.map((variant, index) => (
              <div key={variant.id} className="p-4 bg-stone-50 dark:bg-stone-950/50 rounded-xl border border-stone-200 dark:border-stone-800 relative group">
                {formData.variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVariant(variant.id)}
                    className="absolute -top-2 -right-2 p-1.5 bg-white dark:bg-stone-800 text-rose-500 rounded-full shadow-sm border border-stone-200 dark:border-stone-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                    title="Eliminar variante"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                  <div className="lg:col-span-1">
                    <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 uppercase tracking-wider">Nombre (ej: 50ml)</label>
                    <input
                      type="text"
                      required
                      value={variant.name}
                      onChange={(e) => handleVariantChange(variant.id, 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 uppercase tracking-wider">Código de Barras</label>
                    <div className="flex">
                      <input
                        type="text"
                        value={variant.barcode || ''}
                        onChange={(e) => handleVariantChange(variant.id, 'barcode', e.target.value)}
                        placeholder="Ej: 779123456789"
                        className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleVariantChange(variant.id, 'barcode', Math.floor(Math.random() * 900000000000 + 100000000000).toString())}
                        className="px-2 py-2 bg-stone-100 dark:bg-stone-800 border border-l-0 border-stone-200 dark:border-stone-700 rounded-r-lg text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                        title="Generar código aleatorio"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 uppercase tracking-wider">
                      {variant.isFinishedGood === false ? 'Stock Dinámico' : 'Stock'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      required={variant.isFinishedGood !== false}
                      disabled={variant.isFinishedGood === false}
                      value={variant.isFinishedGood === false ? getVariantStock(variant, rawMaterials) : variant.stock}
                      step="any"
                      onChange={(e) => handleVariantChange(variant.id, 'stock', e.target.value === '' ? '' : parseFloat(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      className={`w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 ${variant.isFinishedGood === false ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider">Costo ($)</label>
                      <button
                        type="button"
                        onClick={() => {
                          if (variant.recipe) {
                            let calculatedCost = variant.recipe.reduce((total, item) => {
                              const rm = rawMaterials.find(r => r.id === item.rawMaterialId);
                              if (rm) {
                                const effectiveUnit = item.unit || rm.baseUnit || UMB_FOR_DIMENSION[rm.dimension || (rm.unit ? UNIT_DIMENSIONS[rm.unit as Unit] : 'units')];
                                const quantityUMB = toUMB(item.quantity, effectiveUnit as Unit);
                                return total + (quantityUMB * rm.costPerUnit);
                              }
                              return total;
                            }, 0);
                            
                            // Add waste percentage
                            if (variant.wastePercentage) {
                              calculatedCost = calculatedCost * (1 + (variant.wastePercentage / 100));
                            }
                            
                            // Add labor cost
                            if (variant.laborTimeMinutes && variant.laborRatePerHour) {
                              const laborCost = (variant.laborTimeMinutes / 60) * variant.laborRatePerHour;
                              calculatedCost += laborCost;
                            }
                            
                            handleVariantChange(variant.id, 'cost', calculatedCost);
                          }
                        }}
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
                        title="Calcular costo basado en la fórmula, mermas y mano de obra"
                      >
                        Calcular
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 dark:text-stone-500 text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={variant.cost}
                        onChange={(e) => handleVariantChange(variant.id, 'cost', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full pl-7 pr-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 uppercase tracking-wider">Margen (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={variant.margin}
                        onChange={(e) => handleVariantChange(variant.id, 'margin', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        onFocus={(e) => e.target.select()}
                        className="w-full pr-7 pl-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-stone-400 dark:text-stone-500 text-sm">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 uppercase tracking-wider">Precio Final ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 dark:text-stone-500 text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        value={variant.price}
                        onChange={(e) => handleVariantChange(variant.id, 'price', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                        className="w-full pl-7 pr-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-indigo-50/50 dark:bg-indigo-900/20 font-medium text-indigo-900 dark:text-indigo-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Advanced Manufacturing & B2B Fields */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 uppercase tracking-wider" title="Precio para revendedores">Precio Mayorista ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 dark:text-stone-500 text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={variant.wholesalePrice || ''}
                        onChange={(e) => handleVariantChange(variant.id, 'wholesalePrice', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                        className="w-full pl-7 pr-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                        placeholder="Opcional"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 uppercase tracking-wider" title="Merma técnica (ej: cera que queda en la jarra)">% Merma Técnica</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={variant.wastePercentage || ''}
                        onChange={(e) => handleVariantChange(variant.id, 'wastePercentage', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                        className="w-full pr-7 pl-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                        placeholder="Ej: 3"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-stone-400 dark:text-stone-500 text-sm">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 uppercase tracking-wider" title="Tiempo de mano de obra por unidad">Tiempo MO (min)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={variant.laborTimeMinutes || ''}
                      onChange={(e) => handleVariantChange(variant.id, 'laborTimeMinutes', parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                      placeholder="Ej: 15"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 uppercase tracking-wider" title="Costo de mano de obra por hora">Valor Hora MO ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 dark:text-stone-500 text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={variant.laborRatePerHour || ''}
                        onChange={(e) => handleVariantChange(variant.id, 'laborRatePerHour', parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()}
                        className="w-full pl-7 pr-3 py-2 border border-stone-200 dark:border-stone-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                        placeholder="Ej: 5000"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row gap-4">
                  <div className="flex items-center space-x-3 p-3 bg-stone-50 dark:bg-stone-950/50 rounded-xl border border-stone-100 dark:border-stone-800 flex-1">
                    <input
                      type="checkbox"
                      id={`isKit-${variant.id}`}
                      checked={variant.isKit || false}
                      onChange={(e) => handleVariantChange(variant.id, 'isKit', e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-stone-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor={`isKit-${variant.id}`} className="text-sm font-medium text-stone-700 dark:text-stone-300 cursor-pointer">
                      Es un Kit/Combo (compuesto por otros productos)
                    </label>
                  </div>
                         <div className="flex items-center space-x-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800 flex-1">
                    <input
                      type="checkbox"
                      id={`isFinishedGood-${variant.id}`}
                      checked={variant.isFinishedGood === false}
                      onChange={(e) => handleVariantChange(variant.id, 'isFinishedGood', !e.target.checked)}
                      className="w-4 h-4 text-amber-600 border-stone-300 rounded focus:ring-amber-500"
                    />
                    <label htmlFor={`isFinishedGood-${variant.id}`} className="text-sm font-medium text-amber-800 dark:text-amber-300 cursor-pointer">
                      Es insumo de venta directa (stock dinámico)
                    </label>
                  </div>
                </div>

                {/* Recipe Section */}
                <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-800">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider">Fórmula (Insumos)</h4>
                    <button
                      type="button"
                      onClick={() => addRecipeItem(variant.id)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center"
                    >
                      <Plus size={12} className="mr-1" /> Agregar Insumo
                    </button>
                  </div>
                  
                  {variant.recipe && variant.recipe.length > 0 ? (
                    <div className="space-y-2">
                      {variant.recipe.map((item, index) => {
                        const selectedRM = rawMaterials.find(rm => rm.id === item.rawMaterialId);
                        const availableUnits = selectedRM ? getUnitsForDimension(selectedRM.dimension as Dimension, selectedRM.unit as Unit) : [];
                        
                        return (
                        <div key={`${variant.id}-${item.id || index}`} className="flex items-center gap-2">
                          <select
                            value={item.rawMaterialId || ''}
                            onChange={(e) => {
                              const newRmId = e.target.value;
                              const newRm = rawMaterials.find(rm => rm.id === newRmId);
                              if (newRm) {
                                const effectiveDimension = newRm.dimension || (newRm.unit ? UNIT_DIMENSIONS[newRm.unit as Unit] : 'units');
                                const baseUnit = newRm.baseUnit || UMB_FOR_DIMENSION[effectiveDimension];
                                updateRecipeItem(variant.id, index, { 
                                  rawMaterialId: newRmId, 
                                  unit: baseUnit 
                                });
                              } else {
                                updateRecipeItem(variant.id, index, { rawMaterialId: newRmId });
                              }
                            }}
                            className="flex-1 px-2 py-1.5 border border-stone-200 dark:border-stone-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                            required
                          >
                            <option value="">Seleccionar insumo...</option>
                            {rawMaterials.map(rm => (
                              <option key={rm.id} value={rm.id}>
                                {rm.name} (Stock: {formatUMB(rm.stock, rm.dimension as Dimension, rm.unit as Unit)})
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.quantity ?? 0}
                            onChange={(e) => updateRecipeItem(variant.id, index, { quantity: parseFloat(e.target.value) || 0 })}
                            onFocus={(e) => e.target.select()}
                            className="w-24 px-2 py-1.5 border border-stone-200 dark:border-stone-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                            placeholder="Cant."
                            required
                          />
                          {selectedRM ? (
                            <select
                              value={item.unit || selectedRM.baseUnit || UMB_FOR_DIMENSION[selectedRM.dimension || (selectedRM.unit ? UNIT_DIMENSIONS[selectedRM.unit as Unit] : 'units')]}
                              onChange={(e) => updateRecipeItem(variant.id, index, { unit: e.target.value })}
                              className="w-20 px-2 py-1.5 border border-stone-200 dark:border-stone-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                              required
                            >
                              {availableUnits.map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="w-20 px-2 py-1.5 border border-stone-200 dark:border-stone-700 rounded-lg text-sm bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 text-center">
                              -
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeRecipeItem(variant.id, index)}
                            className="p-1.5 text-stone-400 dark:text-stone-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )})}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400 dark:text-stone-500 italic">No hay insumos asignados a esta variante.</p>
                  )}
                </div>
              </div>
            ))}
            {formData.variants.length === 0 && (
              <div className="text-center py-8 bg-stone-50 dark:bg-stone-950/50 rounded-xl border border-stone-200 dark:border-stone-800 border-dashed">
                <p className="text-stone-500 dark:text-stone-400 text-sm">Agrega al menos una variante para este producto.</p>
                <button
                  type="button"
                  onClick={addVariant}
                  className="mt-2 text-indigo-600 dark:text-indigo-400 font-medium text-sm hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  + Agregar Variante
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 border border-stone-300 dark:border-stone-700 rounded-xl shadow-sm text-sm font-medium text-stone-700 dark:text-stone-300 bg-white dark:bg-stone-900 hover:bg-stone-50 dark:hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={formData.variants.length === 0 || isUploading}
            className="px-6 py-2.5 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isUploading ? (
              <>
                <RefreshCw size={18} className="mr-2 animate-spin" />
                {uploadProgress > 0 ? `Subiendo ${Math.round(uploadProgress)}%...` : 'Guardando...'}
              </>
            ) : (
              product ? 'Guardar Cambios' : 'Crear Producto'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
