import React, { useState, useEffect } from 'react';
import { Product, RawMaterial, Sale, ProductionOrder } from '../types';
import ProductList from './ProductList';
import RawMaterialList from './RawMaterialList';
import { Package, Beaker, ShoppingBag, ExternalLink } from 'lucide-react';

interface InventoryViewProps {
  initialTab?: 'products' | 'raw-materials';
  products: Product[];
  rawMaterials: RawMaterial[];
  productionOrders: ProductionOrder[];
  sales: Sale[];
  onAddProduct: () => void;
  onAddMultipleProducts: (products: Product[]) => void;
  onEditProduct: (id: string) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onAdjustStock: (productId: string, variantId: string, newStock: number) => void;
  onProduce: (productId: string, variantId: string, quantity: number) => Promise<void>;
  onAddRawMaterial: (material: RawMaterial) => void;
  onAddMultipleRawMaterials: (materials: RawMaterial[]) => Promise<void>;
  onUpdateRawMaterial: (material: RawMaterial) => void;
  onDeleteRawMaterial: (id: string) => void;
  onRestockRawMaterial: (id: string, quantity: number, newCost?: number) => void;
  onNavigateToCatalog: () => void;
}

export default function InventoryView({
  initialTab = 'products',
  products,
  rawMaterials,
  productionOrders,
  sales,
  onAddProduct,
  onAddMultipleProducts,
  onEditProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAdjustStock,
  onProduce,
  onAddRawMaterial,
  onAddMultipleRawMaterials,
  onUpdateRawMaterial,
  onDeleteRawMaterial,
  onRestockRawMaterial,
  onNavigateToCatalog
}: InventoryViewProps) {
  const [activeTab, setActiveTab] = useState<'products' | 'raw-materials'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-6">
      <div className="flex-none flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex space-x-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'products'
                ? 'bg-white dark:bg-stone-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            <Package size={18} className="mr-2" />
            Catálogo de Productos
          </button>
          <button
            onClick={() => setActiveTab('raw-materials')}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'raw-materials'
                ? 'bg-white dark:bg-stone-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            <Beaker size={18} className="mr-2" />
            Materias Primas e Insumos
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 mt-6">
        {activeTab === 'products' && (
          <ProductList 
            products={products} 
            rawMaterials={rawMaterials}
            sales={sales}
            onAdd={onAddProduct}
            onAddMultiple={onAddMultipleProducts}
            onEdit={onEditProduct} 
            onUpdate={onUpdateProduct}
            onDelete={onDeleteProduct}
            onAdjustStock={onAdjustStock}
            onProduce={onProduce}
            onNavigateToCatalog={onNavigateToCatalog}
          />
        )}
        {activeTab === 'raw-materials' && (
          <RawMaterialList 
            rawMaterials={rawMaterials} 
            products={products}
            productionOrders={productionOrders}
            onAdd={onAddRawMaterial} 
            onAddMultiple={onAddMultipleRawMaterials}
            onUpdate={onUpdateRawMaterial} 
            onDelete={onDeleteRawMaterial}
            onRestock={onRestockRawMaterial}
          />
        )}
      </div>
    </div>
  );
}
