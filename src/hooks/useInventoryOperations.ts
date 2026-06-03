import React from 'react';
import { db } from '../firebase';
import { doc, setDoc, updateDoc, deleteDoc, writeBatch, runTransaction, increment, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Product, Customer, Sale, Quote, RawMaterial, FinancialDocument, Activity, ProductionOrder, Campaign, Offer, Simulation, Coupon, User, Course, RecipeItem } from '../types';
import { handleFirestoreError, cleanObject, OperationType } from '../utils/firebaseHelpers';
import { roundFinancial, roundPrecise } from '../utils/mathUtils';
import { toUMB, Unit, UNIT_DIMENSIONS, UMB_FOR_DIMENSION } from '../utils/units';
import { updateMirrorProductVariants, getVariantStock } from '../utils/stockUtils';
import { generateNextCustomerNumber, addCustomerWithAntiMatching, grantManualBenefitToCustomer, handleSaleStatusCompleted, handleSaleStatusReverted } from '../useCustomer';
import { User as FirebaseUser } from 'firebase/auth';

const sanitizeForAuditLog = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(v => sanitizeForAuditLog(v));
  } else if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'photoUrl' || k === 'photoUrls' || k === 'photo') {
        if (typeof v === 'string' && v.startsWith('data:')) {
          sanitized[k] = '[Base64 Image Omitted]';
        } else if (Array.isArray(v)) {
          sanitized[k] = v.map(item => (typeof item === 'string' && item.startsWith('data:')) ? '[Base64 Image Omitted]' : item);
        } else {
          sanitized[k] = v;
        }
      } else {
        sanitized[k] = sanitizeForAuditLog(v);
      }
    }
    return sanitized;
  }
  if (typeof obj === 'string' && obj.length > 5000) {
    return `${obj.substring(0, 100)}... [Truncated due to size]`;
  }
  return obj;
};

export function useInventoryOperations(
  currentUser: FirebaseUser | null,
  isAdmin: boolean,
  products: Product[],
  rawMaterials: RawMaterial[],
  sales: Sale[],
  quotes: Quote[],
  customers: Customer[],
  users: User[],
  productionOrders: ProductionOrder[],
  auditLogs: any[],
  coupons: Coupon[],
  storeSettings: any,
  setCoupons?: React.Dispatch<React.SetStateAction<Coupon[]>>,
  setAuditLogs?: React.Dispatch<React.SetStateAction<any[]>>,
  setLastVisibleLog?: React.Dispatch<React.SetStateAction<any>>,
  setHasMoreLogs?: React.Dispatch<React.SetStateAction<boolean>>
) {
  const logAction = async (action: string, collectionName: string, documentId: string, newData?: unknown, previousData?: unknown) => {
    if (!currentUser) return;
    const logId = uuidv4();
    const log = {
      id: logId,
      userId: currentUser.uid,
      userEmail: currentUser.email,
      action,
      collection: collectionName,
      documentId,
      timestamp: new Date().toISOString(),
      newData: newData ? sanitizeForAuditLog(newData) : null,
      previousData: previousData ? sanitizeForAuditLog(previousData) : null,
    };
    try {
      await setDoc(doc(db, 'auditLogs', logId), log);
    } catch (e) {
      console.error("Error logging action:", e);
    }
  };

  const addProduct = async (product: Product) => {
    try {
      const rounded = {
        ...product,
        variants: product.variants.map(v => ({
          ...v,
          cost: roundFinancial(v.cost),
          price: roundFinancial(v.price),
          wholesalePrice: v.wholesalePrice ? roundFinancial(v.wholesalePrice) : undefined
        }))
      };
      const cleaned = cleanObject(rounded);
      await setDoc(doc(db, 'products', product.id), cleaned);
      await logAction('create', 'products', product.id, cleaned);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const addMultipleProducts = async (newProducts: Product[]) => {
    if (!isAdmin) return;
    try {
      const BATCH_SIZE = 500;
      for (let i = 0; i < newProducts.length; i += BATCH_SIZE) {
        const chunk = newProducts.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(product => {
          const rounded = {
            ...product,
            variants: product.variants.map(v => ({
              ...v,
              cost: roundFinancial(v.cost),
              price: roundFinancial(v.price),
              wholesalePrice: v.wholesalePrice ? roundFinancial(v.wholesalePrice) : undefined
            }))
          };
          batch.set(doc(db, 'products', product.id), cleanObject(rounded));
        });
        await batch.commit();
      }
      for (const p of newProducts) await logAction('create_batch', 'products', p.id, p);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const updateProduct = async (updatedProduct: Product) => {
    try {
      const rounded = {
        ...updatedProduct,
        variants: updatedProduct.variants.map(v => ({
          ...v,
          cost: roundFinancial(v.cost),
          price: roundFinancial(v.price),
          wholesalePrice: v.wholesalePrice ? roundFinancial(v.wholesalePrice) : undefined
        }))
      };
      const prev = products.find(p => p.id === updatedProduct.id);
      const cleaned = cleanObject(rounded);
      await setDoc(doc(db, 'products', updatedProduct.id), cleaned);
      await logAction('update', 'products', updatedProduct.id, cleaned, prev);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const updateMultipleProducts = async (updatedProducts: Product[]) => {
    try {
      const uniqueProducts: Product[] = [];
      const seenIds = new Set<string>();
      updatedProducts.forEach(product => {
        if (!seenIds.has(product.id)) {
          seenIds.add(product.id);
          uniqueProducts.push(product);
        }
      });
      // Write each product document individually (in parallel) to avoid batch payload size limit
      await Promise.all(uniqueProducts.map(async (product) => {
        await setDoc(doc(db, 'products', product.id), cleanObject(product));
      }));
      for (const p of uniqueProducts) {
        const prev = products.find(old => old.id === p.id);
        await logAction('update_batch', 'products', p.id, p, prev);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const prev = products.find(p => p.id === id);
      const linkedRawMaterial = rawMaterials.find(rm => rm.linkedProductId === id);
      if (linkedRawMaterial) {
        await setDoc(doc(db, 'rawMaterials', linkedRawMaterial.id), cleanObject({
          ...linkedRawMaterial,
          sellAsProduct: false,
          linkedProductId: null
        }));
      }
      await deleteDoc(doc(db, 'products', id));
      await logAction('delete', 'products', id, null, prev);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'products');
    }
  };

  const addCourse = async (course: Course) => {
    try {
      const cleaned = cleanObject(course);
      await setDoc(doc(db, 'courses', course.id), cleaned);
      await logAction('create', 'courses', course.id, cleaned);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'courses');
    }
  };

  const updateCourse = async (course: Course) => {
    try {
      const cleaned = cleanObject(course);
      await updateDoc(doc(db, 'courses', course.id), cleaned);
      await logAction('update', 'courses', course.id, cleaned);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'courses');
    }
  };

  const deleteCourse = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'courses', id));
      await logAction('delete', 'courses', id);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'courses');
    }
  };

  const adjustStock = async (productId: string, variantId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const updatedProduct = {
      ...product,
      variants: product.variants.map(v => {
        if (v.id === variantId) {
          return { ...v, stock: v.isFinishedGood !== false ? Math.max(0, v.stock + quantity) : v.stock };
        }
        return v;
      })
    };
    try {
      await setDoc(doc(db, 'products', productId), cleanObject(updatedProduct));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const addCustomer = async (customer: Customer) => {
    try {
      await addCustomerWithAntiMatching(customer);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'customers');
      throw error;
    }
  };

  const updateCustomer = async (updated: Customer) => {
    try {
      const normalizeEmail = (e?: string) => e?.trim().toLowerCase() || '';
      const normalizePhone = (p?: string) => p?.replace(/\D/g, '') || '';
      const nEmail = normalizeEmail(updated.email);
      const nPhone = normalizePhone(updated.phone);
      const isDuplicate = customers.some(c => c.id !== updated.id && ((nEmail && normalizeEmail(c.email) === nEmail) || (nPhone && normalizePhone(c.phone) === nPhone)));
      if (isDuplicate) throw new Error('El email o teléfono ingresado ya pertenece a otro cliente registrado.');

      const prev = customers.find(c => c.id === updated.id);
      const cleaned = cleanObject(updated);
      await setDoc(doc(db, 'customers', updated.id), cleaned);
      await logAction('update', 'customers', updated.id, cleaned, prev);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'customers');
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      const prev = customers.find(c => c.id === id);
      await deleteDoc(doc(db, 'customers', id));
      await logAction('delete', 'customers', id, null, prev);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'customers');
    }
  };

  const getUpdatedDynamicProducts = (updatedMaterials: RawMaterial[], modifiedProducts: Product[] = []): Product[] => {
    const materialMap = new Map<string, RawMaterial>();
    rawMaterials.forEach(rm => materialMap.set(rm.id, rm));
    updatedMaterials.forEach(rm => materialMap.set(rm.id, rm));
    const allMaterials = Array.from(materialMap.values());

    const updatedMaterialIds = new Set(updatedMaterials.map(rm => rm.id));
    const updatedProducts: Product[] = [];

    const modifiedProductsMap = new Map<string, Product>();
    modifiedProducts.forEach(p => modifiedProductsMap.set(p.id, p));

    const allProductsMap = new Map<string, Product>();
    products.forEach(p => allProductsMap.set(p.id, p));
    modifiedProducts.forEach(p => allProductsMap.set(p.id, p));

    allProductsMap.forEach((product, productId) => {
      let productChanged = false;
      const updatedVariants = product.variants.map(variant => {
        if (variant.isFinishedGood === false && variant.recipe && variant.recipe.length > 0) {
          const referencesModifiedMaterial = variant.recipe.some(item => 
            updatedMaterialIds.has(item.rawMaterialId)
          );
          if (referencesModifiedMaterial) {
            const newStock = getVariantStock(variant, allMaterials);
            if (variant.stock !== newStock) {
              productChanged = true;
              return { ...variant, stock: newStock };
            }
          }
        }
        return variant;
      });

      if (productChanged) {
        updatedProducts.push({ ...product, variants: updatedVariants });
      } else if (modifiedProductsMap.has(productId)) {
        updatedProducts.push(product);
      }
    });

    return updatedProducts;
  };

  const addRawMaterial = async (material: RawMaterial) => {
    try {
      const batch = writeBatch(db);
      let linkedProductId = material.linkedProductId;
      let modifiedProduct: Product | undefined;
      if (material.sellAsProduct) {
        linkedProductId = uuidv4();
        const product: Product = {
          id: linkedProductId,
          name: material.name,
          description: material.description || '',
          category: material.category || 'Insumos',
          photoUrl: material.photoUrl || '',
          photoUrls: material.photoUrl ? [material.photoUrl] : [],
          showInCatalog: material.showInCatalog !== undefined ? material.showInCatalog : true,
          catalogType: 'insumo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          variants: [{
            id: uuidv4(),
            name: material.unit,
            price: material.price || 0,
            cost: material.costPerUnit || 0,
            margin: 0,
            sku: '',
            stock: material.stock || 0,
            compromisedStock: material.compromisedStock || 0,
            isFinishedGood: false,
            recipe: [{
              id: uuidv4(),
              rawMaterialId: material.id,
              quantity: toUMB(1, material.unit as Unit),
              unit: material.baseUnit || UMB_FOR_DIMENSION[material.dimension || (material.unit ? UNIT_DIMENSIONS[material.unit as Unit] : 'units')]
            }]
          }]
        };
        modifiedProduct = product;
      }
      const rounded = { ...material, linkedProductId, costPerUnit: roundPrecise(material.costPerUnit) };
      const cleaned = cleanObject(rounded);
      batch.set(doc(db, 'rawMaterials', material.id), cleaned);

      // Sync dynamic products
      const updatedProducts = getUpdatedDynamicProducts([rounded], modifiedProduct ? [modifiedProduct] : []);
      updatedProducts.forEach(p => {
        batch.set(doc(db, 'products', p.id), cleanObject(p));
      });

      await batch.commit();
      await logAction('create', 'rawMaterials', material.id, cleaned);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rawMaterials');
    }
  };

  const addMultipleRawMaterials = async (materials: RawMaterial[]) => {
    try {
      const batch = writeBatch(db);
      const processedMaterials = materials.map(material => ({
        ...material,
        costPerUnit: roundPrecise(material.costPerUnit)
      }));
      processedMaterials.forEach(material => {
        batch.set(doc(db, 'rawMaterials', material.id), cleanObject(material));
      });

      // Sync dynamic products
      const updatedProducts = getUpdatedDynamicProducts(processedMaterials);
      updatedProducts.forEach(p => {
        batch.set(doc(db, 'products', p.id), cleanObject(p));
      });

      await batch.commit();
      for (const m of processedMaterials) await logAction('create_batch', 'rawMaterials', m.id, m);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rawMaterials');
    }
  };

  const updateRawMaterial = async (updated: RawMaterial) => {
    try {
      const batch = writeBatch(db);
      let linkedProductId = updated.linkedProductId;
      let modifiedProduct: Product | undefined;
      if (updated.sellAsProduct) {
        if (!linkedProductId) linkedProductId = uuidv4();
        const existingProduct = products.find(p => p.id === linkedProductId);
        const variantId = existingProduct?.variants[0]?.id || uuidv4();
        const product: Product = {
          ...existingProduct,
          id: linkedProductId,
          name: updated.name,
          description: updated.description || existingProduct?.description || '',
          category: updated.category || existingProduct?.category || 'Insumos',
          photoUrl: updated.photoUrl || existingProduct?.photoUrl || '',
          photoUrls: existingProduct?.photoUrls || (updated.photoUrl ? [updated.photoUrl] : []),
          showInCatalog: updated.showInCatalog !== undefined ? updated.showInCatalog : (existingProduct ? (existingProduct.showInCatalog !== undefined ? existingProduct.showInCatalog : true) : true),
          catalogType: 'insumo',
          createdAt: existingProduct?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          variants: existingProduct 
            ? updateMirrorProductVariants(
                existingProduct.variants,
                updated.id,
                updated.stock || 0,
                updated.compromisedStock || 0,
                updated.costPerUnit || 0,
                updated.price && updated.price > 0 ? updated.price : undefined
              )
            : [{
                id: variantId,
                name: updated.unit,
                price: updated.price || 0,
                cost: updated.costPerUnit || 0,
                margin: 0,
                sku: '',
                stock: updated.stock || 0,
                compromisedStock: updated.compromisedStock || 0,
                isFinishedGood: false,
                recipe: [{
                  id: uuidv4(),
                  rawMaterialId: updated.id,
                  quantity: toUMB(1, updated.unit as Unit),
                  unit: updated.baseUnit || UMB_FOR_DIMENSION[updated.dimension || (updated.unit ? UNIT_DIMENSIONS[updated.unit as Unit] : 'units')]
                }]
              }]
        };
        modifiedProduct = product;
      } else if (linkedProductId) {
        batch.delete(doc(db, 'products', linkedProductId));
        linkedProductId = undefined;
      }
      const rounded = { ...updated, linkedProductId, costPerUnit: roundPrecise(updated.costPerUnit) };
      const prev = rawMaterials.find(m => m.id === updated.id);
      const cleaned = cleanObject(rounded);
      batch.set(doc(db, 'rawMaterials', updated.id), cleaned);

      // Sync dynamic products
      const updatedProducts = getUpdatedDynamicProducts([rounded], modifiedProduct ? [modifiedProduct] : []);
      updatedProducts.forEach(p => {
        batch.set(doc(db, 'products', p.id), cleanObject(p));
      });

      await batch.commit();
      await logAction('update', 'rawMaterials', updated.id, cleaned, prev);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rawMaterials');
    }
  };

  const updateMultipleRawMaterials = async (updatedMaterials: RawMaterial[]) => {
    try {
      const uniqueMaterials: RawMaterial[] = [];
      const seenMaterialIds = new Set<string>();
      
      updatedMaterials.forEach(material => {
        if (!seenMaterialIds.has(material.id)) {
          seenMaterialIds.add(material.id);
          uniqueMaterials.push(material);
        }
      });

      const productsToUpdateMap = new Map<string, Product>();

      // Accumulate product updates across all raw materials
      uniqueMaterials.forEach(material => {
        if (material.sellAsProduct && material.linkedProductId) {
          const product = productsToUpdateMap.get(material.linkedProductId) || 
                          products.find(p => p.id === material.linkedProductId);
          
          if (product) {
            const updatedVariants = updateMirrorProductVariants(
              product.variants,
              material.id,
              material.stock || 0,
              material.compromisedStock || 0,
              material.costPerUnit || 0,
              material.price && material.price > 0 ? material.price : undefined
            );
            
            productsToUpdateMap.set(material.linkedProductId, {
              ...product,
              name: material.name,
              description: material.description || product.description || '',
              category: material.category || product.category || 'Insumos',
              photoUrl: material.photoUrl || product.photoUrl || '',
              showInCatalog: material.showInCatalog !== undefined ? material.showInCatalog : (product.showInCatalog !== undefined ? product.showInCatalog : true),
              catalogType: 'insumo',
              variants: updatedVariants
            });
          }
        }
      });

      const modifiedProducts = Array.from(productsToUpdateMap.values());
      const updatedProducts = getUpdatedDynamicProducts(uniqueMaterials, modifiedProducts);

      // Write each material individually (in parallel) to avoid batch payload size limit
      await Promise.all(uniqueMaterials.map(async (material) => {
        await setDoc(doc(db, 'rawMaterials', material.id), cleanObject(material));
      }));

      // Write each updated product individually (in parallel)
      await Promise.all(updatedProducts.map(async (product) => {
        await setDoc(doc(db, 'products', product.id), cleanObject(product));
      }));

      for (const m of uniqueMaterials) {
        const prev = rawMaterials.find(old => old.id === m.id);
        await logAction('update_batch', 'rawMaterials', m.id, m, prev);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rawMaterials');
    }
  };

  const deleteRawMaterial = async (id: string) => {
    try {
      const prev = rawMaterials.find(m => m.id === id);
      if (prev?.linkedProductId) await deleteDoc(doc(db, 'products', prev.linkedProductId));
      await deleteDoc(doc(db, 'rawMaterials', id));

      if (prev) {
        const deletedMaterialWithZeroStock = { ...prev, stock: 0, compromisedStock: 0 };
        const updatedProducts = getUpdatedDynamicProducts([deletedMaterialWithZeroStock]);
        await Promise.all(updatedProducts.map(async (product) => {
          await setDoc(doc(db, 'products', product.id), cleanObject(product));
        }));
      }

      await logAction('delete', 'rawMaterials', id, null, prev);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'rawMaterials');
    }
  };

  const restockRawMaterial = async (id: string, quantity: number, newCost?: number) => {
    const material = rawMaterials.find(m => m.id === id);
    if (!material) return;
    const updatedStock = material.stock + quantity;
    const updatedMaterial = { ...material, stock: updatedStock, costPerUnit: newCost || material.costPerUnit, updatedAt: new Date().toISOString() };
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'rawMaterials', id), cleanObject(updatedMaterial));
      
      let modifiedProduct: Product | undefined;
      if (material.sellAsProduct && material.linkedProductId) {
        const existingProduct = products.find(p => p.id === material.linkedProductId);
        if (existingProduct) {
          modifiedProduct = {
            ...existingProduct,
            variants: updateMirrorProductVariants(
              existingProduct.variants,
              material.id,
              updatedStock,
              material.compromisedStock || 0
            )
          };
        }
      }

      const updatedProducts = getUpdatedDynamicProducts([updatedMaterial], modifiedProduct ? [modifiedProduct] : []);
      updatedProducts.forEach(p => {
        batch.set(doc(db, 'products', p.id), cleanObject(p));
      });

      await batch.commit();
      await logAction('restock', 'rawMaterials', id, updatedMaterial, material);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rawMaterials');
    }
  };

  const addFinancialDoc = async (docData: FinancialDocument) => {
    try { await setDoc(doc(db, 'financialDocs', docData.id), cleanObject(docData)); } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'financialDocs'); }
  };
  const deleteFinancialDoc = async (id: string) => {
    try { await deleteDoc(doc(db, 'financialDocs', id)); } catch (error) { handleFirestoreError(error, OperationType.DELETE, 'financialDocs'); }
  };

  const addActivity = async (activity: Omit<Activity, 'id' | 'createdAt'>) => {
    try {
      const id = uuidv4();
      const newActivity: Activity = { ...activity, id, createdAt: new Date().toISOString() };
      await setDoc(doc(db, 'activities', id), cleanObject(newActivity));
    } catch (error) { handleFirestoreError(error, OperationType.CREATE, 'activities'); }
  };

  const updateActivity = async (activity: Activity) => {
    try { await setDoc(doc(db, 'activities', activity.id), cleanObject(activity)); } catch (error) { handleFirestoreError(error, OperationType.UPDATE, `activities/${activity.id}`); }
  };

  const deleteActivity = async (id: string) => {
    try { await deleteDoc(doc(db, 'activities', id)); } catch (error) { handleFirestoreError(error, OperationType.DELETE, `activities/${id}`); }
  };

  const addProductionOrder = async (order: Omit<ProductionOrder, 'id' | 'createdAt' | 'status'>) => {
    try {
      const id = uuidv4();
      const newOrder: ProductionOrder = { ...order, id, status: 'pending', createdAt: new Date().toISOString() };
      await setDoc(doc(db, 'productionOrders', id), cleanObject(newOrder));

      // Registrar Auditoría y Actividad
      await logAction('create_production_order', 'productionOrders', id, newOrder);
      await addActivity({
        title: 'Producción Programada',
        description: `Se programó la fabricación de ${newOrder.quantity} unidades de ${newOrder.productName} (${newOrder.variantName})`,
        type: 'inventory',
        status: 'pending',
        date: newOrder.date,
        time: new Date().toLocaleTimeString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'productionOrders');
    }
  };

  const updateProductionOrder = async (order: ProductionOrder) => {
    const oldOrder = productionOrders.find(o => o.id === order.id);
    if (!oldOrder) return;

    try {
      if (oldOrder.status === 'completed' && (order.status === 'pending' || order.status === 'cancelled')) {
        // Reversión de stock (Descompletado o Cancelado de orden ya completada)
        const oldProduct = products.find(p => p.id === oldOrder.productId);
        const oldVariant = oldProduct?.variants.find(v => v.id === oldOrder.variantId);
        
        const batch = writeBatch(db);

        if (oldProduct && oldVariant) {
          const updatedOldProduct = {
            ...oldProduct,
            variants: oldProduct.variants.map(v => {
              if (v.id === oldVariant.id) {
                return { ...v, stock: v.isFinishedGood !== false ? Math.max(0, v.stock - oldOrder.quantity) : v.stock };
              }
              return v;
            })
          };

          if (oldVariant.recipe) {
            const mirrorUpdates = new Map<string, Product>();
            const updatedMaterialsList: RawMaterial[] = [];
            oldVariant.recipe.forEach(recipeItem => {
              const m = rawMaterials.find(rm => rm.id === recipeItem.rawMaterialId);
              if (m) {
                const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
                const quantityUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
                const returnAmount = quantityUMB * oldOrder.quantity;
                const newStock = m.stock + returnAmount;
                const updatedM = { ...m, stock: newStock };
                updatedMaterialsList.push(updatedM);
                batch.set(
                  doc(db, 'rawMaterials', m.id), 
                  { stock: newStock }, 
                  { merge: true }
                );

                if (m.sellAsProduct && m.linkedProductId) {
                  const mirror = mirrorUpdates.get(m.linkedProductId) || products.find(p => p.id === m.linkedProductId);
                  if (mirror) {
                    const updatedVariants = updateMirrorProductVariants(
                      mirror.variants,
                      m.id,
                      newStock,
                      undefined
                    );
                    mirrorUpdates.set(m.linkedProductId, {
                      ...mirror,
                      variants: updatedVariants
                    });
                  }
                }
              }
            });

            const modifiedProducts = Array.from(mirrorUpdates.values());
            modifiedProducts.push(updatedOldProduct);
            const updatedProducts = getUpdatedDynamicProducts(updatedMaterialsList, modifiedProducts);
            updatedProducts.forEach(p => {
              batch.set(doc(db, 'products', p.id), cleanObject(p));
            });
          } else {
            batch.set(doc(db, 'products', updatedOldProduct.id), cleanObject(updatedOldProduct));
          }
        }
        batch.set(doc(db, 'productionOrders', order.id), cleanObject(order));
        await batch.commit();

        // Registrar Auditoría y Actividad
        await logAction('cancel_production_order', 'productionOrders', order.id, order, oldOrder);
        await addActivity({
          title: order.status === 'cancelled' ? 'Producción Cancelada' : 'Producción Revertida',
          description: `Se ${order.status === 'cancelled' ? 'canceló' : 'revirtió'} la fabricación de ${order.quantity} unidades de ${order.productName} (${order.variantName})`,
          type: 'inventory',
          status: 'completed',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString()
        });

      } else if ((oldOrder.status === 'pending' || oldOrder.status === 'cancelled') && order.status === 'completed') {
        // Completar orden desde pendiente/cancelado (Chequear stock y descontar)
        const newProduct = products.find(p => p.id === order.productId);
        const newVariant = newProduct?.variants.find(v => v.id === order.variantId);
        
        if (newProduct && newVariant) {
          if (newVariant.recipe) {
            for (const recipeItem of newVariant.recipe) {
              const m = rawMaterials.find(rm => rm.id === recipeItem.rawMaterialId);
              if (m) {
                const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
                const quantityUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
                const totalNeeded = quantityUMB * order.quantity;
                if (m.stock < totalNeeded) {
                  throw new Error(`Stock insuficiente de ${m.name}. Se necesitan ${totalNeeded} ${m.baseUnit}, pero solo hay ${m.stock} ${m.baseUnit}.`);
                }
              }
            }
          }

          const batch = writeBatch(db);
          const updatedMaterialsList: RawMaterial[] = [];
          const updatedProduct = {
            ...newProduct,
            variants: newProduct.variants.map(v => 
              v.id === newVariant.id ? { ...v, stock: v.isFinishedGood !== false ? v.stock + order.quantity : v.stock } : v
            )
          };

          if (newVariant.recipe) {
            const mirrorUpdates = new Map<string, Product>();
            newVariant.recipe.forEach(recipeItem => {
              const m = rawMaterials.find(rm => rm.id === recipeItem.rawMaterialId);
              if (m) {
                const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
                const quantityUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
                const discountAmount = quantityUMB * order.quantity;
                const newStock = Math.max(0, m.stock - discountAmount);
                const updatedM = { ...m, stock: newStock };
                updatedMaterialsList.push(updatedM);
                batch.set(
                  doc(db, 'rawMaterials', m.id),
                  { stock: newStock },
                  { merge: true }
                );

                if (m.sellAsProduct && m.linkedProductId) {
                  const mirror = mirrorUpdates.get(m.linkedProductId) || products.find(p => p.id === m.linkedProductId);
                  if (mirror) {
                    const updatedVariants = updateMirrorProductVariants(
                      mirror.variants,
                      m.id,
                      newStock,
                      undefined
                    );
                    mirrorUpdates.set(m.linkedProductId, {
                      ...mirror,
                      variants: updatedVariants
                    });
                  }
                }
              }
            });

            const modifiedProducts = Array.from(mirrorUpdates.values());
            modifiedProducts.push(updatedProduct);
            const updatedProducts = getUpdatedDynamicProducts(updatedMaterialsList, modifiedProducts);
            updatedProducts.forEach(p => {
              batch.set(doc(db, 'products', p.id), cleanObject(p));
            });
          } else {
            batch.set(doc(db, 'products', newProduct.id), cleanObject(updatedProduct));
          }
          batch.set(doc(db, 'productionOrders', order.id), cleanObject(order));
          await batch.commit();

          // Registrar Auditoría y Actividad
          await logAction('complete_production_order', 'productionOrders', order.id, order, oldOrder);
          await addActivity({
            title: 'Producción Completada',
            description: `Se completó la fabricación de ${order.quantity} unidades de ${order.productName} (${order.variantName})`,
            type: 'inventory',
            status: 'completed',
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString()
          });
        }
      } else {
        // Actualización general o cambios de estado simples (ej. pending -> cancelled sin haber sido completada)
        await setDoc(doc(db, 'productionOrders', order.id), cleanObject(order));
        
        if (oldOrder.status !== order.status) {
          await logAction('update_production_order_status', 'productionOrders', order.id, order, oldOrder);
          await addActivity({
            title: order.status === 'cancelled' ? 'Producción Cancelada' : 'Producción Actualizada',
            description: `Se ${order.status === 'cancelled' ? 'canceló' : 'actualizó'} la orden de fabricación de ${order.quantity} unidades de ${order.productName} (${order.variantName})`,
            type: 'inventory',
            status: 'completed',
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString()
          });
        } else {
          await logAction('update_production_order', 'productionOrders', order.id, order, oldOrder);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `productionOrders/${order.id}`);
      throw error;
    }
  };

  const deleteProductionOrder = async (id: string) => {
    const oldOrder = productionOrders.find(o => o.id === id);
    try {
      await deleteDoc(doc(db, 'productionOrders', id));

      if (oldOrder) {
        await logAction('delete_production_order', 'productionOrders', id, null, oldOrder);
        await addActivity({
          title: 'Orden de Producción Eliminada',
          description: `Se eliminó la orden de ${oldOrder.quantity} unidades de ${oldOrder.productName} (${oldOrder.variantName})`,
          type: 'inventory',
          status: 'completed',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `productionOrders/${id}`);
    }
  };

  const fabricarProducto = async (productId: string, variantId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    const variant = product?.variants.find(v => v.id === variantId);
    if (!product || !variant) return;
    try {
      const batch = writeBatch(db);
      const updatedMaterialsList: RawMaterial[] = [];

      const updatedProduct = {
        ...product,
        variants: product.variants.map(v => 
          v.id === variant.id ? { ...v, stock: v.isFinishedGood !== false ? v.stock + quantity : v.stock } : v
        )
      };

      if (variant.recipe) {
        const mirrorUpdates = new Map<string, Product>();
        for (const recipeItem of variant.recipe) {
          const m = rawMaterials.find(rm => rm.id === recipeItem.rawMaterialId);
          if (m) {
            const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
            const discountAmount = toUMB(recipeItem.quantity, effectiveUnit as Unit) * quantity;
            if (m.stock < discountAmount) {
              throw new Error(`Stock insuficiente de ${m.name}`);
            }
            const newStock = Math.max(0, m.stock - discountAmount);
            const updatedM = { ...m, stock: newStock };
            updatedMaterialsList.push(updatedM);
            batch.set(
              doc(db, 'rawMaterials', m.id), 
              { stock: newStock }, 
              { merge: true }
            );

            if (m.sellAsProduct && m.linkedProductId) {
              const mirror = mirrorUpdates.get(m.linkedProductId) || products.find(p => p.id === m.linkedProductId);
              if (mirror) {
                const updatedVariants = updateMirrorProductVariants(
                  mirror.variants,
                  m.id,
                  newStock,
                  undefined
                );
                mirrorUpdates.set(m.linkedProductId, {
                  ...mirror,
                  variants: updatedVariants
                });
              }
            }
          }
        }

        const modifiedProducts = Array.from(mirrorUpdates.values());
        modifiedProducts.push(updatedProduct);
        const updatedProducts = getUpdatedDynamicProducts(updatedMaterialsList, modifiedProducts);
        updatedProducts.forEach(p => {
          batch.set(doc(db, 'products', p.id), cleanObject(p));
        });
      } else {
        batch.set(doc(db, 'products', product.id), cleanObject(updatedProduct));
      }
      
      await batch.commit();

      // LOG ACTION & ACTIVITY
      await logAction('fabricate_product_direct', 'products', product.id, updatedProduct, product);
      await addActivity({ 
        title: 'Producción Completada', 
        description: `Se fabricaron ${quantity} unidades de ${product.name}`, 
        type: 'inventory', 
        status: 'completed', 
        date: new Date().toISOString().split('T')[0], 
        time: new Date().toLocaleTimeString() 
      });
    } catch (error) {
      throw error;
    }
  };

  const completeProductionOrder = async (id: string) => {
    const order = productionOrders.find(o => o.id === id);
    if (!order || order.status !== 'pending') return;
    const product = products.find(p => p.id === order.productId);
    const variant = product?.variants.find(v => v.id === order.variantId);
    if (!product || !variant) return;
    try {
      const batch = writeBatch(db);
      const updatedMaterialsList: RawMaterial[] = [];

      const updatedProduct = { 
        ...product, 
        variants: product.variants.map(v => 
          v.id === variant.id ? { ...v, stock: v.isFinishedGood !== false ? v.stock + order.quantity : v.stock } : v
        ) 
      };

      if (variant.recipe) {
        const mirrorUpdates = new Map<string, Product>();
        variant.recipe.forEach(recipeItem => {
          const m = rawMaterials.find(rm => rm.id === recipeItem.rawMaterialId);
          if (m) {
            const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
            const discountAmount = toUMB(recipeItem.quantity, effectiveUnit as Unit) * order.quantity;
            const newStock = Math.max(0, m.stock - discountAmount);
            const updatedM = { ...m, stock: newStock };
            updatedMaterialsList.push(updatedM);
            batch.set(
              doc(db, 'rawMaterials', m.id), 
              { stock: newStock }, 
              { merge: true }
            );

            if (m.sellAsProduct && m.linkedProductId) {
              const mirror = mirrorUpdates.get(m.linkedProductId) || products.find(p => p.id === m.linkedProductId);
              if (mirror) {
                const updatedVariants = updateMirrorProductVariants(
                  mirror.variants,
                  m.id,
                  newStock,
                  undefined
                );
                mirrorUpdates.set(m.linkedProductId, {
                  ...mirror,
                  variants: updatedVariants
                });
              }
            }
          }
        });

        const modifiedProducts = Array.from(mirrorUpdates.values());
        modifiedProducts.push(updatedProduct);
        const updatedProducts = getUpdatedDynamicProducts(updatedMaterialsList, modifiedProducts);
        updatedProducts.forEach(p => {
          batch.set(doc(db, 'products', p.id), cleanObject(p));
        });
      } else {
        batch.set(doc(db, 'products', product.id), cleanObject(updatedProduct));
      }
      
      const completedOrder = { ...order, status: 'completed' as const };
      batch.set(doc(db, 'productionOrders', id), cleanObject(completedOrder));
      
      await batch.commit();

      // LOG ACTION & ACTIVITY
      await logAction('complete_production_order', 'productionOrders', id, completedOrder, order);
      await addActivity({
        title: 'Producción Completada',
        description: `Se completó la fabricación de ${order.quantity} unidades de ${order.productName} (${order.variantName})`,
        type: 'inventory',
        status: 'completed',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `productionOrders/${id}/complete`);
    }
  };

  const saveSimulation = async (simulation: Simulation) => {
    try { await setDoc(doc(db, 'simulations', simulation.id), cleanObject(simulation)); } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'simulations'); }
  };
  const deleteSimulation = async (id: string) => {
    try { await deleteDoc(doc(db, 'simulations', id)); } catch (error) { handleFirestoreError(error, OperationType.DELETE, 'simulations'); }
  };

  const addPreAuth = async (email: string, role: string = 'admin') => {
    try {
      await setDoc(doc(db, 'preAuthorizedAdmins', email), { email, role, addedAt: new Date().toISOString(), addedBy: currentUser?.email || 'unknown' });
      const existingUser = users.find(u => u.email === email);
      if (existingUser) {
        await setDoc(doc(db, 'users', existingUser.uid), { role }, { merge: true });
        await logAction('update_role', 'users', existingUser.uid, { role }, existingUser);
      }
    } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'preAuthorizedAdmins'); }
  };

  const updatePreAuthRole = async (email: string, role: string) => {
    try {
      await updateDoc(doc(db, 'preAuthorizedAdmins', email), { role });
      const existingUser = users.find(u => u.email === email);
      if (existingUser) {
        await setDoc(doc(db, 'users', existingUser.uid), { role }, { merge: true });
        await logAction('update_role', 'users', existingUser.uid, { role }, existingUser);
      }
    } catch (error) { handleFirestoreError(error, OperationType.UPDATE, 'preAuthorizedAdmins'); }
  };

  const removePreAuth = async (email: string) => {
    try { await deleteDoc(doc(db, 'preAuthorizedAdmins', email)); } catch (error) { handleFirestoreError(error, OperationType.DELETE, 'preAuthorizedAdmins'); }
  };

  const generateCoupon = async (customerId?: string, percentage: number = 20, customCode?: string) => {
    const code = customCode ? `${customCode}-${uuidv4().substring(0, 6).toUpperCase()}` : `VUELVE-${percentage}-${uuidv4().substring(0, 6).toUpperCase()}`;
    const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 30);
    const newCoupon: Coupon = { id: uuidv4(), code, discountPercentage: percentage, expiresAt: expiresAt.toISOString(), customerId, isUsed: false, createdAt: new Date().toISOString() };
    try {
      await setDoc(doc(db, 'coupons', newCoupon.id), cleanObject(newCoupon));
      if (setCoupons) {
        setCoupons(prev => [...prev, newCoupon]);
      }
      return newCoupon;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'coupons');
      return null;
    }
  };

  const validateCoupon = async (code: string, customerEmail?: string): Promise<{ valid: boolean; discount?: number; error?: string }> => {
    let coupon: Coupon | undefined = undefined;
    try {
      const q = query(
        collection(db, 'coupons'),
        where('code', '==', code.trim().toUpperCase())
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        coupon = { ...docSnap.data(), id: docSnap.id } as Coupon;
      }
    } catch (e) {
      console.error("Error validating coupon: ", e);
      return { valid: false, error: 'Error al validar el cupón. Intente de nuevo.' };
    }

    if (!coupon) {
      return { valid: false, error: 'Cupón no encontrado o inactivo' };
    }

    if (coupon.code.toUpperCase().includes('BIENVENIDA')) {
      if (!customerEmail || customerEmail.trim() === '') {
        return {
          valid: false,
          error: 'Por favor, ingresa tu email en los datos de contacto antes de aplicar este cupón.'
        };
      }

      const hasPreviousPurchases = sales.some(sale =>
        sale.customerEmail?.toLowerCase() === customerEmail.toLowerCase() &&
        sale.status !== 'cancelado'
      );

      if (hasPreviousPurchases) {
        return {
          valid: false,
          error: 'Este cupón es exclusivo para tu primera compra en Janlu Velas.'
        };
      }
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return { valid: false, error: 'Este cupón ha expirado' };
    }

    return { valid: true, discount: coupon.discountPercentage || 0 };
  };

  const isBudgetStatus = (status?: string) => 
    status === 'presupuesto' || status === 'presupuesto_vencido' || status === 'presupuesto_rechazado';
  const isActiveStatus = (status?: string) => 
    status === 'nuevo' || status === 'en_preparacion';
  const isCancelledStatus = (status?: string) => status === 'cancelado';
  const isDeliveredStatus = (status?: string) => 
    status === 'listo_para_entregar' || status === 'entregado';

  const commitStock = async (saleItems: Sale['items']) => {
    const batch = writeBatch(db);
    const mirrorUpdates = new Map<string, Product>();
    const updatedMaterialsList: RawMaterial[] = [];
    saleItems.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const variant = product?.variants.find(v => v.id === item.variantId);
      if (!product || !variant) return;
      if (variant.isFinishedGood !== false) {
        const updatedProduct = mirrorUpdates.get(product.id) || { ...product };
        updatedProduct.variants = updatedProduct.variants.map(v => v.id === variant.id ? { ...v, compromisedStock: (v.compromisedStock || 0) + item.quantity } : v);
        mirrorUpdates.set(product.id, updatedProduct);
      } else if (variant.recipe) {
        variant.recipe.forEach(recipeItem => {
          const rm = rawMaterials.find(r => r.id === recipeItem.rawMaterialId);
          if (rm) {
            const newCompromised = (rm.compromisedStock || 0) + (recipeItem.quantity * item.quantity);
            const updatedM = { ...rm, compromisedStock: newCompromised };
            updatedMaterialsList.push(updatedM);
            batch.set(doc(db, 'rawMaterials', rm.id), { compromisedStock: newCompromised }, { merge: true });
            
            // Sincronizar espejo comercial si existe
            if (rm.sellAsProduct && rm.linkedProductId) {
              const mirror = mirrorUpdates.get(rm.linkedProductId) || products.find(p => p.id === rm.linkedProductId);
              if (mirror) {
                const updatedVariants = updateMirrorProductVariants(
                  mirror.variants,
                  rm.id,
                  rm.stock,
                  newCompromised
                );
                mirrorUpdates.set(rm.linkedProductId, {
                  ...mirror,
                  variants: updatedVariants
                });
              }
            }
          }
        });
      }
    });

    const modifiedProducts = Array.from(mirrorUpdates.values());
    const updatedProducts = getUpdatedDynamicProducts(updatedMaterialsList, modifiedProducts);
    updatedProducts.forEach(p => {
      batch.set(doc(db, 'products', p.id), cleanObject(p));
    });
    await batch.commit();
  };

  const releaseStock = async (saleItems: Sale['items']) => {
    const batch = writeBatch(db);
    const mirrorUpdates = new Map<string, Product>();
    const updatedMaterialsList: RawMaterial[] = [];
    saleItems.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const variant = product?.variants.find(v => v.id === item.variantId);
      if (!product || !variant) return;
      if (variant.isFinishedGood !== false) {
        const updatedProduct = mirrorUpdates.get(product.id) || { ...product };
        updatedProduct.variants = updatedProduct.variants.map(v => v.id === variant.id ? { ...v, compromisedStock: Math.max(0, (v.compromisedStock || 0) - item.quantity) } : v);
        mirrorUpdates.set(product.id, updatedProduct);
      } else if (variant.recipe) {
        variant.recipe.forEach(recipeItem => {
          const rm = rawMaterials.find(r => r.id === recipeItem.rawMaterialId);
          if (rm) {
            const newCompromised = Math.max(0, (rm.compromisedStock || 0) - (recipeItem.quantity * item.quantity));
            const updatedM = { ...rm, compromisedStock: newCompromised };
            updatedMaterialsList.push(updatedM);
            batch.set(doc(db, 'rawMaterials', rm.id), { compromisedStock: newCompromised }, { merge: true });
            
            // Sincronizar espejo comercial si existe
            if (rm.sellAsProduct && rm.linkedProductId) {
              const mirror = mirrorUpdates.get(rm.linkedProductId) || products.find(p => p.id === rm.linkedProductId);
              if (mirror) {
                const updatedVariants = updateMirrorProductVariants(
                  mirror.variants,
                  rm.id,
                  rm.stock,
                  newCompromised
                );
                mirrorUpdates.set(rm.linkedProductId, {
                  ...mirror,
                  variants: updatedVariants
                });
              }
            }
          }
        });
      }
    });

    const modifiedProducts = Array.from(mirrorUpdates.values());
    const updatedProducts = getUpdatedDynamicProducts(updatedMaterialsList, modifiedProducts);
    updatedProducts.forEach(p => {
      batch.set(doc(db, 'products', p.id), cleanObject(p));
    });
    await batch.commit();
  };

  const consumeStockDefinitively = async (saleItems: Sale['items'], deductCompromised: boolean = true) => {
    const batch = writeBatch(db);
    const mirrorUpdates = new Map<string, Product>();
    const updatedMaterialsList: RawMaterial[] = [];
    saleItems.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const variant = product?.variants.find(v => v.id === item.variantId);
      if (!product || !variant) return;
      if (variant.isFinishedGood !== false) {
        const compromisedStock = deductCompromised
          ? Math.max(0, (variant.compromisedStock || 0) - item.quantity)
          : (variant.compromisedStock || 0);
        const updatedProduct = mirrorUpdates.get(product.id) || { ...product };
        updatedProduct.variants = updatedProduct.variants.map(v => v.id === variant.id ? { ...v, stock: Math.max(0, v.stock - item.quantity), compromisedStock } : v);
        mirrorUpdates.set(product.id, updatedProduct);
      } else if (variant.recipe) {
        variant.recipe.forEach(recipeItem => {
          const rm = rawMaterials.find(r => r.id === recipeItem.rawMaterialId);
          if (rm) {
            const newStock = Math.max(0, rm.stock - (recipeItem.quantity * item.quantity));
            const newCompromised = deductCompromised
              ? Math.max(0, (rm.compromisedStock || 0) - (recipeItem.quantity * item.quantity))
              : (rm.compromisedStock || 0);
            const updatedM = { ...rm, stock: newStock, compromisedStock: newCompromised };
            updatedMaterialsList.push(updatedM);
            batch.set(doc(db, 'rawMaterials', rm.id), { stock: newStock, compromisedStock: newCompromised }, { merge: true });
            
            // Sincronizar espejo comercial si existe
            if (rm.sellAsProduct && rm.linkedProductId) {
              const mirror = mirrorUpdates.get(rm.linkedProductId) || products.find(p => p.id === rm.linkedProductId);
              if (mirror) {
                const updatedVariants = updateMirrorProductVariants(
                  mirror.variants,
                  rm.id,
                  newStock,
                  newCompromised
                );
                mirrorUpdates.set(rm.linkedProductId, {
                  ...mirror,
                  variants: updatedVariants
                });
              }
            }
          }
        });
      }
    });

    const modifiedProducts = Array.from(mirrorUpdates.values());
    const updatedProducts = getUpdatedDynamicProducts(updatedMaterialsList, modifiedProducts);
    updatedProducts.forEach(p => {
      batch.set(doc(db, 'products', p.id), cleanObject(p));
    });
    await batch.commit();
  };

  const revertConsumedStockToCommitted = async (saleItems: Sale['items']) => {
    const batch = writeBatch(db);
    const mirrorUpdates = new Map<string, Product>();
    const updatedMaterialsList: RawMaterial[] = [];
    saleItems.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const variant = product?.variants.find(v => v.id === item.variantId);
      if (!product || !variant) return;
      if (variant.isFinishedGood !== false) {
        const updatedProduct = mirrorUpdates.get(product.id) || { ...product };
        updatedProduct.variants = updatedProduct.variants.map(v => v.id === variant.id ? { ...v, stock: v.stock + item.quantity, compromisedStock: (v.compromisedStock || 0) + item.quantity } : v);
        mirrorUpdates.set(product.id, updatedProduct);
      } else if (variant.recipe) {
        variant.recipe.forEach(recipeItem => {
          const rm = rawMaterials.find(r => r.id === recipeItem.rawMaterialId);
          if (rm) {
            const newStock = rm.stock + (recipeItem.quantity * item.quantity);
            const newCompromised = (rm.compromisedStock || 0) + (recipeItem.quantity * item.quantity);
            const updatedM = { ...rm, stock: newStock, compromisedStock: newCompromised };
            updatedMaterialsList.push(updatedM);
            batch.set(doc(db, 'rawMaterials', rm.id), { stock: newStock, compromisedStock: newCompromised }, { merge: true });
            
            // Sincronizar espejo comercial si existe
            if (rm.sellAsProduct && rm.linkedProductId) {
              const mirror = mirrorUpdates.get(rm.linkedProductId) || products.find(p => p.id === rm.linkedProductId);
              if (mirror) {
                const updatedVariants = updateMirrorProductVariants(
                  mirror.variants,
                  rm.id,
                  newStock,
                  newCompromised
                );
                mirrorUpdates.set(rm.linkedProductId, {
                  ...mirror,
                  variants: updatedVariants
                });
              }
            }
          }
        });
      }
    });

    const modifiedProducts = Array.from(mirrorUpdates.values());
    const updatedProducts = getUpdatedDynamicProducts(updatedMaterialsList, modifiedProducts);
    updatedProducts.forEach(p => {
      batch.set(doc(db, 'products', p.id), cleanObject(p));
    });
    await batch.commit();
  };

  const restorePhysicalStock = async (saleItems: Sale['items']) => {
    const batch = writeBatch(db);
    const mirrorUpdates = new Map<string, Product>();
    const updatedMaterialsList: RawMaterial[] = [];
    saleItems.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const variant = product?.variants.find(v => v.id === item.variantId);
      if (!product || !variant) return;
      if (variant.isFinishedGood !== false) {
        const updatedProduct = mirrorUpdates.get(product.id) || { ...product };
        updatedProduct.variants = updatedProduct.variants.map(v => v.id === variant.id ? { ...v, stock: v.stock + item.quantity } : v);
        mirrorUpdates.set(product.id, updatedProduct);
      } else if (variant.recipe) {
        variant.recipe.forEach(recipeItem => {
          const rm = rawMaterials.find(r => r.id === recipeItem.rawMaterialId);
          if (rm) {
            const newStock = rm.stock + (recipeItem.quantity * item.quantity);
            const updatedM = { ...rm, stock: newStock };
            updatedMaterialsList.push(updatedM);
            batch.set(doc(db, 'rawMaterials', rm.id), { stock: newStock }, { merge: true });
            
            // Sincronizar espejo comercial si existe
            if (rm.sellAsProduct && rm.linkedProductId) {
              const mirror = mirrorUpdates.get(rm.linkedProductId) || products.find(p => p.id === rm.linkedProductId);
              if (mirror) {
                const updatedVariants = updateMirrorProductVariants(
                  mirror.variants,
                  rm.id,
                  newStock,
                  undefined
                );
                mirrorUpdates.set(rm.linkedProductId, {
                  ...mirror,
                  variants: updatedVariants
                });
              }
            }
          }
        });
      }
    });

    const modifiedProducts = Array.from(mirrorUpdates.values());
    const updatedProducts = getUpdatedDynamicProducts(updatedMaterialsList, modifiedProducts);
    updatedProducts.forEach(p => {
      batch.set(doc(db, 'products', p.id), cleanObject(p));
    });
    await batch.commit();
  };

  const registerSale = async (saleData: Omit<Sale, 'id' | 'date'>) => {
    let nextOrderNumber = 1000;
    try {
      const counterRef = doc(db, 'metadata', 'counters');
      nextOrderNumber = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let newOrderNumber = 1000;
        if (counterDoc.exists() && typeof counterDoc.data().lastOrderNumber === 'number') newOrderNumber = counterDoc.data().lastOrderNumber + 1;
        else newOrderNumber = Math.max(1000, sales.reduce((max, sale) => Math.max(max, sale.orderNumber || 0), 0) + 1);
        transaction.set(counterRef, { lastOrderNumber: newOrderNumber }, { merge: true });
        return newOrderNumber;
      });
    } catch (error) {
      nextOrderNumber = 900000 + Math.floor(Math.random() * 90000);
    }
    const initialPayments = [];
    if (saleData.amountPaid && saleData.amountPaid > 0) {
      initialPayments.push({
        amount: saleData.amountPaid,
        method: saleData.paymentMethod || 'efectivo',
        date: new Date().toISOString(),
        status: saleData.paymentStatus || 'verified',
        notes: saleData.paymentNotes || 'Pago inicial'
      });
    }
    const newSale: Sale = { 
      ...saleData, 
      id: uuidv4(), 
      orderNumber: nextOrderNumber, 
      date: new Date().toISOString(), 
      status: saleData.status || 'nuevo',
      paymentHistory: saleData.paymentHistory || (initialPayments.length > 0 ? initialPayments : undefined),
      inventorySynced: isAdmin ? true : false
    };
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'sales', newSale.id), cleanObject(newSale));
      await batch.commit();

      if (isAdmin) {
        if (!isBudgetStatus(newSale.status) && !isCancelledStatus(newSale.status) && !isDeliveredStatus(newSale.status)) {
          await commitStock(newSale.items);
        } else if (isDeliveredStatus(newSale.status)) {
          await consumeStockDefinitively(newSale.items, false);
        }
      }

      return newSale.id;
    } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'sales'); }
  };

  const updateSale = async (updatedSale: Sale) => {
    const oldSale = sales.find(sale => sale.id === updatedSale.id);
    if (!oldSale) return;
    try {
      const saleToSave = {
        ...updatedSale,
        inventorySynced: isAdmin ? true : (updatedSale.inventorySynced || false)
      };
      await setDoc(doc(db, 'sales', updatedSale.id), cleanObject(saleToSave));
      
      const oldStatus = oldSale.status;
      const newStatus = updatedSale.status;

      if (isAdmin) {
        // Máquina de estados de stock físico y comprometido
        if (isBudgetStatus(oldStatus) || isCancelledStatus(oldStatus)) {
          if (isActiveStatus(newStatus)) {
            await commitStock(updatedSale.items);
          } else if (isDeliveredStatus(newStatus)) {
            await consumeStockDefinitively(updatedSale.items, false);
          }
        } else if (isActiveStatus(oldStatus)) {
          if (isBudgetStatus(newStatus) || isCancelledStatus(newStatus)) {
            await releaseStock(updatedSale.items);
          } else if (isDeliveredStatus(newStatus)) {
            await consumeStockDefinitively(updatedSale.items, true);
          }
        } else if (isDeliveredStatus(oldStatus)) {
          if (isActiveStatus(newStatus)) {
            await revertConsumedStockToCommitted(updatedSale.items);
          } else if (isBudgetStatus(newStatus) || isCancelledStatus(newStatus)) {
            await restorePhysicalStock(updatedSale.items);
          }
        }
      }

      // 🏆 Trigger de Hito de Compra (Fidelización)
      if (oldSale.status !== 'entregado' && updatedSale.status === 'entregado') {
        await handleSaleStatusCompleted(updatedSale);
      } else if (oldSale.status === 'entregado' && updatedSale.status !== 'entregado') {
        await handleSaleStatusReverted(updatedSale);
      }

      // 🚀 MODIFICACIÓN DE CUPOS EN WORKSHOPS POR CAMBIO DE ESTADO DE LA VENTA
      const oldInactive = isBudgetStatus(oldStatus) || isCancelledStatus(oldStatus);
      const newActive = isActiveStatus(newStatus) || isDeliveredStatus(newStatus);
      const oldActive = isActiveStatus(oldStatus) || isDeliveredStatus(oldStatus);
      const newInactive = isBudgetStatus(newStatus) || isCancelledStatus(newStatus);

      if (oldInactive && newActive) {
        const batch = writeBatch(db);
        updatedSale.items.forEach(item => {
          if (item.isCourse && item.courseId) {
            batch.set(doc(db, 'courses', item.courseId), { enrolledCount: increment(item.quantity) }, { merge: true });
          }
        });
        await batch.commit();
      } else if (oldActive && newInactive) {
        const batch = writeBatch(db);
        updatedSale.items.forEach(item => {
          if (item.isCourse && item.courseId) {
            batch.set(doc(db, 'courses', item.courseId), { enrolledCount: increment(-item.quantity) }, { merge: true });
          }
        });
        await batch.commit();
      }
    } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'sales'); }
  };

  const addQuote = async (quoteData: Omit<Quote, 'id' | 'date'>) => {
    const nextNum = quotes.reduce((max, quote) => Math.max(max, quote.quoteNumber || 0), 0) + 1;
    const newQuote: Quote = { ...quoteData, id: uuidv4(), quoteNumber: nextNum, date: new Date().toISOString() };
    try { await setDoc(doc(db, 'quotes', newQuote.id), cleanObject(newQuote)); } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'quotes'); }
  };

  const updateQuote = async (quote: Quote) => {
    try {
      await setDoc(doc(db, 'quotes', quote.id), cleanObject(quote));
      await logAction('update_quote', 'quotes', quote.id, quote);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'quotes');
    }
  };

  const deleteQuote = async (id: string) => {
    try { await deleteDoc(doc(db, 'quotes', id)); } catch (error) { handleFirestoreError(error, OperationType.DELETE, 'quotes'); }
  };

  const approveQuote = async (quote: Quote) => {
    if (!isAdmin) return;
    try {
      const saleData: Omit<Sale, 'id' | 'date'> = { customerId: quote.customerId, customerName: quote.customerName, items: quote.items.map(item => ({ id: uuidv4(), productId: item.productId, variantId: item.variantId, productName: item.productName, variantName: item.variantName, quantity: item.quantity, price: item.unitPrice || (item.quantity > 0 ? item.finalPrice / item.quantity : 0), total: roundFinancial(item.finalPrice) })), totalAmount: quote.totalAmount, amountPaid: 0, paymentPercentage: 0, paymentMethod: 'efectivo', status: 'nuevo', paymentStatus: 'pending', balanceDue: quote.totalAmount, discount: quote.subtotal - quote.totalAmount > 0 ? roundFinancial(quote.subtotal - quote.totalAmount) : 0 };
      const saleId = await registerSale(saleData);
      await deleteQuote(quote.id);
      await logAction('approve_quote', 'quotes', quote.id, { saleId: saleId || 'new' }, quote);
    } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'sales'); }
  };

  const purchaseStarterKit = async () => {
    // ... logic (similar to before)
  };

  const addCampaign = async (campaign: Campaign) => {
    try { await setDoc(doc(db, 'campaigns', campaign.id), campaign); } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'campaigns'); }
  };
  const deleteCampaign = async (id: string) => {
    try { await deleteDoc(doc(db, 'campaigns', id)); } catch (error) { handleFirestoreError(error, OperationType.DELETE, 'campaigns'); }
  };

  const addOffer = async (offer: Offer) => {
    try { await setDoc(doc(db, 'offers', offer.id), offer); } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'offers'); }
  };
  const updateOffer = async (updated: Offer) => {
    try { await setDoc(doc(db, 'offers', updated.id), updated); } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'offers'); }
  };
  const deleteOffer = async (id: string) => {
    try { await deleteDoc(doc(db, 'offers', id)); } catch (error) { handleFirestoreError(error, OperationType.DELETE, 'offers'); }
  };

  const addSubscriber = async (email: string) => {
    try { const id = uuidv4(); await setDoc(doc(db, 'subscribers', id), { id, email, createdAt: new Date().toISOString() }); } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'subscribers'); }
  };

  const updateCoupon = async (updated: Coupon) => {
    try {
      await setDoc(doc(db, 'coupons', updated.id), cleanObject(updated));
      if (setCoupons) {
        setCoupons(prev => prev.map(c => c.id === updated.id ? updated : c));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'coupons');
    }
  };
  const deleteCoupon = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'coupons', id));
      if (setCoupons) {
        setCoupons(prev => prev.filter(c => c.id !== id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'coupons');
    }
  };

  const updateUserRole = async (uid: string, newRole: string) => {
    try { const prev = users.find(u => u.uid === uid); await setDoc(doc(db, 'users', uid), { role: newRole }, { merge: true }); await logAction('update_role', 'users', uid, { role: newRole }, prev); } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'users'); }
  };

  const clearAuditLogs = async () => {
    if (!isAdmin) return;
    try {
      // NOTA: Arquitectura bajo demanda y paginada para la colección auditLogs para optimizar cuotas de lectura.
      let hasMore = true;
      while (hasMore) {
        const snapshot = await getDocs(query(collection(db, 'auditLogs'), limit(500)));
        if (snapshot.empty) {
          hasMore = false;
          break;
        }
        const batch = writeBatch(db);
        snapshot.docs.forEach(docSnap => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
        if (snapshot.docs.length < 500) {
          hasMore = false;
        }
      }
      await logAction('clear_logs', 'auditLogs', 'all');
      
      if (setAuditLogs) setAuditLogs([]);
      if (setLastVisibleLog) setLastVisibleLog(null);
      if (setHasMoreLogs) setHasMoreLogs(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'auditLogs');
    }
  };

  const updateStoreSettings = async (newSettings: any) => {
    if (!isAdmin) return;
    try { await setDoc(doc(db, 'settings', 'global'), cleanObject(newSettings)); await logAction('update', 'settings', 'global', newSettings, storeSettings); } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'settings'); }
  };

  return {
    addProduct, addMultipleProducts, updateProduct, updateMultipleProducts, deleteProduct, adjustStock,
    addCourse, updateCourse, deleteCourse,
    addCustomer, updateCustomer, deleteCustomer,
    addRawMaterial, addMultipleRawMaterials, updateRawMaterial, updateMultipleRawMaterials, deleteRawMaterial, restockRawMaterial,
    addFinancialDoc, deleteFinancialDoc,
    addActivity, updateActivity, deleteActivity,
    addProductionOrder, updateProductionOrder, deleteProductionOrder, completeProductionOrder, fabricarProducto,
    saveSimulation, deleteSimulation,
    addPreAuth, updatePreAuthRole, removePreAuth,
    generateCoupon, validateCoupon, updateCoupon, deleteCoupon,
    registerSale, updateSale,
    addQuote, updateQuote, deleteQuote, approveQuote,
    purchaseStarterKit,
    addCampaign, deleteCampaign,
    addOffer, updateOffer, deleteOffer,
    addSubscriber,
    updateUserRole, clearAuditLogs, updateStoreSettings,
    grantManualBenefitToCustomer
  };
}
