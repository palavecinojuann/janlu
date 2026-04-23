import { db } from '../firebase';
import { doc, setDoc, updateDoc, deleteDoc, writeBatch, runTransaction } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Product, Customer, Sale, Quote, RawMaterial, FinancialDocument, Activity, ProductionOrder, Campaign, Offer, Simulation, Coupon, User, Course, RecipeItem } from '../types';
import { handleFirestoreError, cleanObject, OperationType } from '../utils/firebaseHelpers';
import { roundFinancial, roundPrecise } from '../utils/mathUtils';
import { toUMB, Unit, UNIT_DIMENSIONS, UMB_FOR_DIMENSION } from '../utils/units';
import { generateNextCustomerNumber } from '../useCustomer';
import { User as FirebaseUser } from 'firebase/auth';

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
  storeSettings: any
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
      newData: newData ? JSON.parse(JSON.stringify(newData)) : null,
      previousData: previousData ? JSON.parse(JSON.stringify(previousData)) : null,
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
      const batch = writeBatch(db);
      updatedProducts.forEach(product => {
        batch.set(doc(db, 'products', product.id), cleanObject(product));
      });
      await batch.commit();
      for (const p of updatedProducts) {
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
      const normalizeEmail = (e?: string) => e?.trim().toLowerCase() || '';
      const normalizePhone = (p?: string) => p?.replace(/\D/g, '') || '';
      const nEmail = normalizeEmail(customer.email);
      const nPhone = normalizePhone(customer.phone);
      const isDuplicate = customers.some(c => (nEmail && normalizeEmail(c.email) === nEmail) || (nPhone && normalizePhone(c.phone) === nPhone));
      if (isDuplicate) throw new Error('Ya existe un cliente con este email o teléfono.');

      let finalCustomer = {
        ...customer,
        welcomeDiscountUsed: customer.welcomeDiscountUsed ?? false,
        discountPercentage: customer.discountPercentage ?? 10,
        assignedOffers: customer.assignedOffers ?? [],
        registeredAt: customer.registeredAt || new Date().toISOString(),
        createdAt: customer.createdAt || new Date().toISOString()
      };
      if (!finalCustomer.customerNumber) finalCustomer.customerNumber = await generateNextCustomerNumber();
      if (!finalCustomer.discountExpiresAt) {
        const regDate = new Date(finalCustomer.registeredAt);
        finalCustomer.discountExpiresAt = new Date(regDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      }
      const cleaned = cleanObject(finalCustomer);
      await setDoc(doc(db, 'customers', finalCustomer.id), cleaned);
      await logAction('create', 'customers', finalCustomer.id, cleaned);

      // 🎁 Generar cupón de BIENVENIDA corto
      if (finalCustomer.email && finalCustomer.email.trim() !== '') {
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const code = `HOLA10-${suffix}`;
        const couponExpiresAt = new Date();
        couponExpiresAt.setDate(couponExpiresAt.getDate() + 30);
        
        const newCoupon: Coupon = {
          id: uuidv4(),
          code,
          discountPercentage: 10,
          expiresAt: couponExpiresAt.toISOString(),
          customerId: finalCustomer.id,
          isUsed: false,
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'coupons', newCoupon.id), cleanObject(newCoupon));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'customers');
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

  const addRawMaterial = async (material: RawMaterial) => {
    try {
      let linkedProductId = material.linkedProductId;
      if (material.sellAsProduct) {
        linkedProductId = uuidv4();
        const product: Product = {
          id: linkedProductId,
          name: material.name,
          description: material.description || '',
          category: material.category || 'Insumos',
          photoUrl: material.photoUrl || '',
          showInCatalog: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          variants: [{
            id: uuidv4(),
            name: material.unit,
            price: material.price || 0,
            cost: material.costPerUnit || 0,
            margin: 0,
            sku: '',
            stock: 0,
            isFinishedGood: false,
            recipe: [{
              id: uuidv4(),
              rawMaterialId: material.id,
              quantity: toUMB(1, material.unit as Unit),
              unit: material.baseUnit || UMB_FOR_DIMENSION[material.dimension || (material.unit ? UNIT_DIMENSIONS[material.unit as Unit] : 'units')]
            }]
          }]
        };
        await setDoc(doc(db, 'products', product.id), cleanObject(product));
      }
      const rounded = { ...material, linkedProductId, costPerUnit: roundPrecise(material.costPerUnit) };
      const cleaned = cleanObject(rounded);
      await setDoc(doc(db, 'rawMaterials', material.id), cleaned);
      await logAction('create', 'rawMaterials', material.id, cleaned);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rawMaterials');
    }
  };

  const addMultipleRawMaterials = async (materials: RawMaterial[]) => {
    try {
      const batch = writeBatch(db);
      materials.forEach(material => {
        batch.set(doc(db, 'rawMaterials', material.id), cleanObject({ ...material, costPerUnit: roundPrecise(material.costPerUnit) }));
      });
      await batch.commit();
      for (const m of materials) await logAction('create_batch', 'rawMaterials', m.id, m);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rawMaterials');
    }
  };

  const updateRawMaterial = async (updated: RawMaterial) => {
    try {
      let linkedProductId = updated.linkedProductId;
      if (updated.sellAsProduct) {
        if (!linkedProductId) linkedProductId = uuidv4();
        const existingProduct = products.find(p => p.id === linkedProductId);
        const variantId = existingProduct?.variants[0]?.id || uuidv4();
        const product: Product = {
          id: linkedProductId,
          name: updated.name,
          description: updated.description || '',
          category: updated.category || 'Insumos',
          photoUrl: updated.photoUrl || '',
          showInCatalog: true,
          createdAt: existingProduct?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          variants: [{
            id: variantId,
            name: updated.unit,
            price: updated.price || 0,
            cost: updated.costPerUnit || 0,
            margin: 0,
            sku: '',
            stock: 0,
            isFinishedGood: false,
            recipe: [{
              id: uuidv4(),
              rawMaterialId: updated.id,
              quantity: toUMB(1, updated.unit as Unit),
              unit: updated.baseUnit || UMB_FOR_DIMENSION[updated.dimension || (updated.unit ? UNIT_DIMENSIONS[updated.unit as Unit] : 'units')]
            }]
          }]
        };
        await setDoc(doc(db, 'products', product.id), cleanObject(product));
      } else if (linkedProductId) {
        await deleteDoc(doc(db, 'products', linkedProductId));
        linkedProductId = undefined;
      }
      const rounded = { ...updated, linkedProductId, costPerUnit: roundPrecise(updated.costPerUnit) };
      const prev = rawMaterials.find(m => m.id === updated.id);
      const cleaned = cleanObject(rounded);
      await setDoc(doc(db, 'rawMaterials', updated.id), cleaned);
      await logAction('update', 'rawMaterials', updated.id, cleaned, prev);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'rawMaterials');
    }
  };

  const updateMultipleRawMaterials = async (updatedMaterials: RawMaterial[]) => {
    try {
      const batch = writeBatch(db);
      updatedMaterials.forEach(material => {
        batch.set(doc(db, 'rawMaterials', material.id), cleanObject(material));
        if (material.sellAsProduct && material.linkedProductId) {
          const existingProduct = products.find(p => p.id === material.linkedProductId);
          if (existingProduct) {
            const product: Product = {
              ...existingProduct,
              name: material.name,
              description: material.description || '',
              category: material.category || 'Insumos',
              photoUrl: material.photoUrl || '',
              variants: [{
                ...existingProduct.variants[0],
                name: material.unit,
                price: material.price || 0,
                recipe: [{
                  id: uuidv4(),
                  rawMaterialId: material.id,
                  quantity: toUMB(1, material.unit as Unit),
                  unit: material.baseUnit || UMB_FOR_DIMENSION[material.dimension || (material.unit ? UNIT_DIMENSIONS[material.unit as Unit] : 'units')]
                }] as RecipeItem[]
              }]
            };
            batch.set(doc(db, 'products', product.id), cleanObject(product));
          }
        }
      });
      await batch.commit();
      for (const m of updatedMaterials) {
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
      await logAction('delete', 'rawMaterials', id, null, prev);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'rawMaterials');
    }
  };

  const restockRawMaterial = async (id: string, quantity: number, newCost?: number) => {
    const material = rawMaterials.find(m => m.id === id);
    if (!material) return;
    const updatedMaterial = { ...material, stock: material.stock + quantity, costPerUnit: newCost || material.costPerUnit, updatedAt: new Date().toISOString() };
    try {
      await setDoc(doc(db, 'rawMaterials', id), cleanObject(updatedMaterial));
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
    } catch (error) { handleFirestoreError(error, OperationType.CREATE, 'productionOrders'); }
  };

  const updateProductionOrder = async (order: ProductionOrder) => {
    const oldOrder = productionOrders.find(o => o.id === order.id);
    if (!oldOrder) return;

    try {
      if (oldOrder.status === 'completed' && order.status === 'completed') {
        const oldProduct = products.find(p => p.id === oldOrder.productId);
        const oldVariant = oldProduct?.variants.find(v => v.id === oldOrder.variantId);
        let currentMaterials = [...rawMaterials];

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
            oldVariant.recipe.forEach(recipeItem => {
              currentMaterials = currentMaterials.map(m => {
                if (m.id === recipeItem.rawMaterialId) {
                  const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
                  const quantityUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
                  return { ...m, stock: m.stock + (quantityUMB * oldOrder.quantity) };
                }
                return m;
              });
            });
          }

          const newProduct = products.find(p => p.id === order.productId);
          const newVariant = newProduct?.variants.find(v => v.id === order.variantId);

          if (newProduct && newVariant) {
            const productToUpdate = (oldProduct.id === newProduct.id) ? updatedOldProduct : newProduct;
            const finalNewProduct = {
              ...productToUpdate,
              variants: productToUpdate.variants.map(v => {
                if (v.id === newVariant.id) {
                  return { ...v, stock: v.isFinishedGood !== false ? v.stock + order.quantity : v.stock };
                }
                return v;
              })
            };

            if (oldProduct.id !== newProduct.id) {
              await setDoc(doc(db, 'products', updatedOldProduct.id), cleanObject(updatedOldProduct));
            }
            await setDoc(doc(db, 'products', finalNewProduct.id), cleanObject(finalNewProduct));

            if (newVariant.recipe) {
              newVariant.recipe.forEach(recipeItem => {
                currentMaterials = currentMaterials.map(m => {
                  if (m.id === recipeItem.rawMaterialId) {
                    const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
                    const quantityUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
                    return { ...m, stock: Math.max(0, m.stock - (quantityUMB * order.quantity)) };
                  }
                  return m;
                });
              });
            }
          }
        }

        for (const material of currentMaterials) {
          await setDoc(doc(db, 'rawMaterials', material.id), cleanObject(material));
        }
      } else if (oldOrder.status === 'completed' && (order.status === 'pending' || order.status === 'cancelled')) {
        const oldProduct = products.find(p => p.id === oldOrder.productId);
        const oldVariant = oldProduct?.variants.find(v => v.id === oldOrder.variantId);
        let currentMaterials = [...rawMaterials];

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
          await setDoc(doc(db, 'products', updatedOldProduct.id), cleanObject(updatedOldProduct));

          if (oldVariant.recipe) {
            oldVariant.recipe.forEach(recipeItem => {
              currentMaterials = currentMaterials.map(m => {
                if (m.id === recipeItem.rawMaterialId) {
                  const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
                  const quantityUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
                  return { ...m, stock: m.stock + (quantityUMB * oldOrder.quantity) };
                }
                return m;
              });
            });
          }
        }
        for (const material of currentMaterials) {
          await setDoc(doc(db, 'rawMaterials', material.id), material);
        }
      } else if ((oldOrder.status === 'pending' || oldOrder.status === 'cancelled') && order.status === 'completed') {
        const newProduct = products.find(p => p.id === order.productId);
        const newVariant = newProduct?.variants.find(v => v.id === order.variantId);
        let currentMaterials = [...rawMaterials];

        if (newProduct && newVariant) {
          if (newVariant.recipe) {
            for (const recipeItem of newVariant.recipe) {
              const m = currentMaterials.find(rm => rm.id === recipeItem.rawMaterialId);
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

          const updatedNewProduct = {
            ...newProduct,
            variants: newProduct.variants.map(v => {
              if (v.id === newVariant.id) {
                return { ...v, stock: v.isFinishedGood !== false ? v.stock + order.quantity : v.stock };
              }
              return v;
            })
          };
          await setDoc(doc(db, 'products', updatedNewProduct.id), cleanObject(updatedNewProduct));

          if (newVariant.recipe) {
            newVariant.recipe.forEach(recipeItem => {
              currentMaterials = currentMaterials.map(m => {
                if (m.id === recipeItem.rawMaterialId) {
                  const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
                  const quantityUMB = toUMB(recipeItem.quantity, effectiveUnit as Unit);
                  return { ...m, stock: Math.max(0, m.stock - (quantityUMB * order.quantity)) };
                }
                return m;
              });
            });
          }
        }
        for (const material of currentMaterials) {
          await setDoc(doc(db, 'rawMaterials', material.id), material);
        }
      }

      await setDoc(doc(db, 'productionOrders', order.id), cleanObject(order));
    } catch (error) { handleFirestoreError(error, OperationType.UPDATE, `productionOrders/${order.id}`); }
  };

  const deleteProductionOrder = async (id: string) => {
    try { await deleteDoc(doc(db, 'productionOrders', id)); } catch (error) { handleFirestoreError(error, OperationType.DELETE, `productionOrders/${id}`); }
  };

  const fabricarProducto = async (productId: string, variantId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    const variant = product?.variants.find(v => v.id === variantId);
    if (!product || !variant) return;
    try {
      if (variant.recipe) {
        for (const recipeItem of variant.recipe) {
          const m = rawMaterials.find(rm => rm.id === recipeItem.rawMaterialId);
          if (m) {
            const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
            if (m.stock < toUMB(recipeItem.quantity, effectiveUnit as Unit) * quantity) throw new Error(`Stock insuficiente de ${m.name}`);
          }
        }
        let newMaterials = [...rawMaterials];
        variant.recipe.forEach(recipeItem => {
          newMaterials = newMaterials.map(m => {
            if (m.id === recipeItem.rawMaterialId) {
              const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
              return { ...m, stock: Math.max(0, m.stock - (toUMB(recipeItem.quantity, effectiveUnit as Unit) * quantity)) };
            }
            return m;
          });
        });
        for (const material of newMaterials) await setDoc(doc(db, 'rawMaterials', material.id), cleanObject(material));
      }
      const updatedProduct = { ...product, variants: product.variants.map(v => v.id === variant.id ? { ...v, stock: v.isFinishedGood !== false ? v.stock + quantity : v.stock } : v) };
      await setDoc(doc(db, 'products', product.id), cleanObject(updatedProduct));
      await addActivity({ title: 'Producción Completada', description: `Se fabricaron ${quantity} unidades de ${product.name}`, type: 'inventory', status: 'completed', date: new Date().toISOString().split('T')[0], time: new Date().toLocaleTimeString() });
    } catch (error) { throw error; }
  };

  const completeProductionOrder = async (id: string) => {
    const order = productionOrders.find(o => o.id === id);
    if (!order || order.status !== 'pending') return;
    const product = products.find(p => p.id === order.productId);
    const variant = product?.variants.find(v => v.id === order.variantId);
    if (!product || !variant) return;
    try {
      if (variant.recipe) {
        let newMaterials = [...rawMaterials];
        variant.recipe.forEach(recipeItem => {
          newMaterials = newMaterials.map(m => {
            if (m.id === recipeItem.rawMaterialId) {
              const effectiveUnit = recipeItem.unit || m.baseUnit || UMB_FOR_DIMENSION[m.dimension || (m.unit ? UNIT_DIMENSIONS[m.unit as Unit] : 'units')];
              return { ...m, stock: Math.max(0, m.stock - (toUMB(recipeItem.quantity, effectiveUnit as Unit) * order.quantity)) };
            }
            return m;
          });
        });
        for (const material of newMaterials) await setDoc(doc(db, 'rawMaterials', material.id), cleanObject(material));
      }
      const updatedProduct = { ...product, variants: product.variants.map(v => v.id === variant.id ? { ...v, stock: v.isFinishedGood !== false ? v.stock + order.quantity : v.stock } : v) };
      await setDoc(doc(db, 'products', updatedProduct.id), cleanObject(updatedProduct));
      await setDoc(doc(db, 'productionOrders', id), cleanObject({ ...order, status: 'completed' }));
    } catch (error) { handleFirestoreError(error, OperationType.WRITE, `productionOrders/${id}/complete`); }
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
    try { await setDoc(doc(db, 'coupons', newCoupon.id), cleanObject(newCoupon)); return newCoupon; } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'coupons'); return null; }
  };

  const validateCoupon = async (code: string, customerEmail?: string): Promise<{ valid: boolean; discount?: number; error?: string }> => {
    const coupon = coupons.find(c => c.code.toUpperCase() === code.trim().toUpperCase());

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

  const commitStock = async (saleItems: Sale['items']) => {
    const batch = writeBatch(db);
    saleItems.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const variant = product?.variants.find(v => v.id === item.variantId);
      if (!product || !variant) return;
      if (variant.isFinishedGood) {
        const updatedProduct = { ...product, variants: product.variants.map(v => v.id === variant.id ? { ...v, compromisedStock: (v.compromisedStock || 0) + item.quantity } : v) };
        batch.set(doc(db, 'products', product.id), cleanObject(updatedProduct), { merge: true });
      } else if (variant.recipe) {
        variant.recipe.forEach(recipeItem => {
          const rm = rawMaterials.find(r => r.id === recipeItem.rawMaterialId);
          if (rm) batch.set(doc(db, 'rawMaterials', rm.id), { compromisedStock: (rm.compromisedStock || 0) + (recipeItem.quantity * item.quantity) }, { merge: true });
        });
      }
    });
    await batch.commit();
  };

  const releaseStock = async (saleItems: Sale['items']) => {
    const batch = writeBatch(db);
    saleItems.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const variant = product?.variants.find(v => v.id === item.variantId);
      if (!product || !variant) return;
      if (variant.isFinishedGood) {
        const updatedProduct = { ...product, variants: product.variants.map(v => v.id === variant.id ? { ...v, compromisedStock: Math.max(0, (v.compromisedStock || 0) - item.quantity) } : v) };
        batch.set(doc(db, 'products', product.id), cleanObject(updatedProduct), { merge: true });
      } else if (variant.recipe) {
        variant.recipe.forEach(recipeItem => {
          const rm = rawMaterials.find(r => r.id === recipeItem.rawMaterialId);
          if (rm) batch.set(doc(db, 'rawMaterials', rm.id), { compromisedStock: Math.max(0, (rm.compromisedStock || 0) - (recipeItem.quantity * item.quantity)) }, { merge: true });
        });
      }
    });
    await batch.commit();
  };

  const consumeStockDefinitively = async (saleItems: Sale['items']) => {
    const batch = writeBatch(db);
    saleItems.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const variant = product?.variants.find(v => v.id === item.variantId);
      if (!product || !variant) return;
      if (variant.isFinishedGood) {
        const updatedProduct = { ...product, variants: product.variants.map(v => v.id === variant.id ? { ...v, stock: Math.max(0, v.stock - item.quantity), compromisedStock: Math.max(0, (v.compromisedStock || 0) - item.quantity) } : v) };
        batch.set(doc(db, 'products', product.id), cleanObject(updatedProduct), { merge: true });
      } else if (variant.recipe) {
        variant.recipe.forEach(recipeItem => {
          const rm = rawMaterials.find(r => r.id === recipeItem.rawMaterialId);
          if (rm) batch.set(doc(db, 'rawMaterials', rm.id), { stock: Math.max(0, rm.stock - (recipeItem.quantity * item.quantity)), compromisedStock: Math.max(0, (rm.compromisedStock || 0) - (recipeItem.quantity * item.quantity)) }, { merge: true });
        });
      }
    });
    await batch.commit();
  };

  const revertConsumedStockToCommitted = async (saleItems: Sale['items']) => {
    const batch = writeBatch(db);
    saleItems.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const variant = product?.variants.find(v => v.id === item.variantId);
      if (!product || !variant) return;
      if (variant.isFinishedGood) {
        const updatedProduct = { ...product, variants: product.variants.map(v => v.id === variant.id ? { ...v, stock: v.stock + item.quantity, compromisedStock: (v.compromisedStock || 0) + item.quantity } : v) };
        batch.set(doc(db, 'products', product.id), cleanObject(updatedProduct), { merge: true });
      } else if (variant.recipe) {
        variant.recipe.forEach(recipeItem => {
          const rm = rawMaterials.find(r => r.id === recipeItem.rawMaterialId);
          if (rm) batch.set(doc(db, 'rawMaterials', rm.id), { stock: rm.stock + (recipeItem.quantity * item.quantity), compromisedStock: (rm.compromisedStock || 0) + (recipeItem.quantity * item.quantity) }, { merge: true });
        });
      }
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
    const newSale: Sale = { ...saleData, id: uuidv4(), orderNumber: nextOrderNumber, date: new Date().toISOString(), status: saleData.status || 'nuevo' };
    try {
      await setDoc(doc(db, 'sales', newSale.id), cleanObject(newSale));
      if (newSale.status !== 'cancelado') await commitStock(newSale.items);
      return newSale.id;
    } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'sales'); }
  };

  const updateSale = async (updatedSale: Sale) => {
    const oldSale = sales.find(sale => sale.id === updatedSale.id);
    if (!oldSale) return;
    try {
      await setDoc(doc(db, 'sales', updatedSale.id), cleanObject(updatedSale));
      if (oldSale.status !== 'cancelado' && updatedSale.status === 'cancelado') await releaseStock(updatedSale.items);
      else if (oldSale.status === 'cancelado' && updatedSale.status !== 'cancelado' && updatedSale.status !== 'entregado') await commitStock(updatedSale.items);
      else if (oldSale.status !== 'entregado' && updatedSale.status === 'entregado') await consumeStockDefinitively(updatedSale.items);
      else if (oldSale.status === 'entregado' && updatedSale.status !== 'entregado' && updatedSale.status !== 'cancelado') await revertConsumedStockToCommitted(updatedSale.items);
    } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'sales'); }
  };

  const addQuote = async (quoteData: Omit<Quote, 'id' | 'date'>) => {
    const nextNum = quotes.reduce((max, quote) => Math.max(max, quote.quoteNumber || 0), 0) + 1;
    const newQuote: Quote = { ...quoteData, id: uuidv4(), quoteNumber: nextNum, date: new Date().toISOString() };
    try { await setDoc(doc(db, 'quotes', newQuote.id), cleanObject(newQuote)); } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'quotes'); }
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
    try { await setDoc(doc(db, 'coupons', updated.id), cleanObject(updated)); } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'coupons'); }
  };
  const deleteCoupon = async (id: string) => {
    try { await deleteDoc(doc(db, 'coupons', id)); } catch (error) { handleFirestoreError(error, OperationType.DELETE, 'coupons'); }
  };

  const updateUserRole = async (uid: string, newRole: string) => {
    try { const prev = users.find(u => u.uid === uid); await setDoc(doc(db, 'users', uid), { role: newRole }, { merge: true }); await logAction('update_role', 'users', uid, { role: newRole }, prev); } catch (error) { handleFirestoreError(error, OperationType.WRITE, 'users'); }
  };

  const clearAuditLogs = async () => {
    if (!isAdmin) return;
    try {
      const batch = writeBatch(db);
      auditLogs.forEach(log => { batch.delete(doc(db, 'auditLogs', log.id)); });
      await batch.commit();
      await logAction('clear_logs', 'auditLogs', 'all');
    } catch (error) { handleFirestoreError(error, OperationType.DELETE, 'auditLogs'); }
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
    addQuote, deleteQuote, approveQuote,
    purchaseStarterKit,
    addCampaign, deleteCampaign,
    addOffer, updateOffer, deleteOffer,
    addSubscriber,
    updateUserRole, clearAuditLogs, updateStoreSettings
  };
}
