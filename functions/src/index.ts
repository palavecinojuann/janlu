import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore("ai-studio-19c9ceaa-c323-42fd-a900-048de6612687");

const CONVERSION_TO_UMB: Record<string, number> = {
  mg: 0.001,
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  mm: 1,
  cm: 10,
  m: 1000,
  u: 1,
  un: 1,
  tu: 1
};

const UNIT_DIMENSIONS: Record<string, string> = {
  mg: 'weight',
  g: 'weight',
  kg: 'weight',
  ml: 'volume',
  l: 'volume',
  mm: 'length',
  cm: 'length',
  m: 'length',
  u: 'units',
  un: 'units',
  tu: 'units'
};

const UMB_FOR_DIMENSION: Record<string, string> = {
  weight: 'g',
  volume: 'ml',
  length: 'mm',
  units: 'u'
};

function toUMB(quantity: number, unit: string): number {
  const factor = CONVERSION_TO_UMB[unit];
  if (factor === undefined) return quantity;
  return quantity * factor;
}

function calculateDynamicStock(variant: any, allMaterialsMap: Map<string, any>): number {
  if (!variant.recipe || variant.recipe.length === 0) {
    const directStock = (variant.stock || 0) - (variant.compromisedStock || 0);
    return directStock > 0 ? directStock : 0;
  }

  if (variant.isFinishedGood !== false) {
    const directStock = (variant.stock || 0) - (variant.compromisedStock || 0);
    return directStock > 0 ? directStock : 0;
  }

  let minStock = Infinity;
  for (const item of variant.recipe) {
    const rm = allMaterialsMap.get(item.rawMaterialId);
    if (rm) {
      if (item.quantity > 0) {
        const effectiveUnit = item.unit || rm.baseUnit || UMB_FOR_DIMENSION[rm.dimension || (rm.unit ? UNIT_DIMENSIONS[rm.unit] : 'units')] || 'u';
        const quantityRequiredInUMB = toUMB(item.quantity, effectiveUnit);
        const availableRMStock = Math.max(0, (rm.stock || 0) - (rm.compromisedStock || 0));
        const possibleUnits = Math.floor(availableRMStock / quantityRequiredInUMB);
        if (possibleUnits < minStock) minStock = possibleUnits;
      } else {
        return 0;
      }
    } else {
      return 0;
    }
  }
  return minStock === Infinity ? 0 : minStock;
}

/**
 * 🚀 updateStockOnSale
 * Escucha cambios en las ventas (/sales) y descuenta o devuelve variantes de stock
 * e insumos de materias primas de forma atómica y segura en el servidor.
 */
export const updateStockOnSale = onDocumentWritten(
  {
    document: "sales/{saleId}",
    database: "ai-studio-19c9ceaa-c323-42fd-a900-048de6612687"
  },
  async (event: any) => {
    const change = event.data;
    if (!change) {
      console.log("[JANLU] No se encontraron datos de cambio.");
      return;
    }

    const beforeSnapshot = change.before;
    const beforeData = beforeSnapshot?.exists ? beforeSnapshot.data() : null;

    const afterSnapshot = change.after;
    const afterData = afterSnapshot?.exists ? afterSnapshot.data() : null;

    // Si la orden fue completamente eliminada del sistema, salimos
    if (!afterData) {
      console.log(`[JANLU] Venta ${event.params.saleId} eliminada. Ignorando.`);
      return;
    }

    const saleId = event.params.saleId;
    const beforeStatus = beforeData?.status;
    const afterStatus = afterData.status;

    // Si ya está sincronizado por el cliente (inventorySynced === true)
    if (afterData.inventorySynced === true) {
      console.log(`[JANLU] Venta ${saleId} marcada como sincronizada. Ignorando.`);
      return;
    }

    // Helper to map status to stock state
    type StockState = 'none' | 'committed' | 'consumed';
    const getStockState = (status?: string): StockState => {
      if (!status) return 'none';
      if (status === 'nuevo' || status === 'en_preparacion') {
        return 'committed';
      }
      if (status === 'listo_para_entregar' || status === 'entregado') {
        return 'consumed';
      }
      return 'none';
    };

    const oldState = getStockState(beforeStatus);
    const newState = getStockState(afterStatus);

    if (oldState === newState) {
      console.log(`[JANLU] Sin cambios de estado de inventario (${oldState} -> ${newState}) para venta ${saleId}.`);
      return;
    }

    console.log(`[JANLU] Procesando transición de inventario para la venta ${saleId}: ${oldState} -> ${newState}`);

    const items = afterData.items || [];
    if (items.length === 0) {
      console.log(`[JANLU] La venta ${saleId} no tiene ítems.`);
      return;
    }

    try {
      await db.runTransaction(async (transaction: any) => {
        const saleRef = db.collection("sales").doc(saleId);
        const saleDoc = await transaction.get(saleRef);
        if (!saleDoc.exists) {
          throw new Error(`La venta ${saleId} no existe en la base de datos.`);
        }

        const saleCurrentData = saleDoc.data();
        if (saleCurrentData?.inventorySynced === true) {
          console.log(`[JANLU] Venta ${saleId} ya sincronizada en otra transacción.`);
          return;
        }

        // Collect all IDs to read first
        const courseIds = new Set<string>();

        for (const item of items) {
          if (item.isCourse || item.courseId) {
            courseIds.add(item.courseId || item.productId);
          }
        }

        // Read all course documents
        const courseDocsMap = new Map<string, any>();
        for (const cid of courseIds) {
          const docRef = db.collection("courses").doc(cid);
          const docSnap = await transaction.get(docRef);
          if (docSnap.exists) {
            courseDocsMap.set(cid, docSnap.data());
          }
        }

        // Read all product documents in bulk inside transaction
        const productDocsMap = new Map<string, any>();
        const allProductsSnapshot = await transaction.get(db.collection("products"));
        const allProducts: any[] = [];
        allProductsSnapshot.forEach((docSnap: any) => {
          const data = docSnap.data();
          allProducts.push({ ...data, id: docSnap.id });
          productDocsMap.set(docSnap.id, data);
        });

        // Read all raw material documents in bulk inside transaction
        const materialDocsMap = new Map<string, any>();
        const allMaterialsSnapshot = await transaction.get(db.collection("rawMaterials"));
        allMaterialsSnapshot.forEach((docSnap: any) => {
          materialDocsMap.set(docSnap.id, docSnap.data());
        });

        // Track modified documents to update at the end
        const modifiedCourses = new Map<string, any>();
        const modifiedProducts = new Map<string, any>();
        const modifiedMaterials = new Map<string, any>();

        // Process each item
        for (const item of items) {
          // A. WORKSHOP / COURSE
          if (item.isCourse || item.courseId) {
            const courseId = item.courseId || item.productId;
            const course = modifiedCourses.get(courseId) || courseDocsMap.get(courseId);
            if (!course) {
              console.warn(`[JANLU] El curso/workshop ${courseId} no existe.`);
              continue;
            }

            const oldInactive = oldState === 'none';
            const newActive = newState === 'committed' || newState === 'consumed';
            const oldActive = oldState === 'committed' || oldState === 'consumed';
            const newInactive = newState === 'none';

            let enrolledCount = course.enrolledCount || 0;
            const maxQuota = course.maxQuota || 0;

            if (oldInactive && newActive) {
              if (enrolledCount + item.quantity > maxQuota) {
                throw new Error(`Cupo insuficiente para el workshop/curso: ${course.title || item.productName}. Quedan ${maxQuota - enrolledCount} cupos.`);
              }
              enrolledCount += item.quantity;
            } else if (oldActive && newInactive) {
              enrolledCount = Math.max(0, enrolledCount - item.quantity);
            }

            modifiedCourses.set(courseId, { ...course, enrolledCount });
            continue;
          }

          // B. PRODUCT AND INGREDIENTS
          if (!item.productId) continue;
          const product = modifiedProducts.get(item.productId) || productDocsMap.get(item.productId);
          if (!product) {
            console.warn(`[JANLU] El producto ${item.productId} no existe.`);
            continue;
          }

          const variants = product.variants || [];
          let selectedVariant: any = null;

          // Check if variant exists and find it
          const updatedVariants = variants.map((v: any) => {
            if (v.id === item.variantId || v.name === item.variantName) {
              selectedVariant = v;
              let stock = v.stock || 0;
              let compromisedStock = v.compromisedStock || 0;

              // Only mutate finished good stock at variant level
              if (v.isFinishedGood !== false) {
                // Apply transition logic for finished goods
                if (oldState === 'none' && newState === 'committed') {
                  compromisedStock += item.quantity;
                } else if (oldState === 'none' && newState === 'consumed') {
                  stock = Math.max(0, stock - item.quantity);
                } else if (oldState === 'committed' && newState === 'none') {
                  compromisedStock = Math.max(0, compromisedStock - item.quantity);
                } else if (oldState === 'committed' && newState === 'consumed') {
                  compromisedStock = Math.max(0, compromisedStock - item.quantity);
                  stock = Math.max(0, stock - item.quantity);
                } else if (oldState === 'consumed' && newState === 'none') {
                  stock += item.quantity;
                } else if (oldState === 'consumed' && newState === 'committed') {
                  stock += item.quantity;
                  compromisedStock += item.quantity;
                }
              }

              return { ...v, stock, compromisedStock };
            }
            return v;
          });

          modifiedProducts.set(item.productId, { ...product, variants: updatedVariants });

          // If variant recipe exists, mutate raw materials
          if (selectedVariant && selectedVariant.recipe && Array.isArray(selectedVariant.recipe)) {
            for (const ingredient of selectedVariant.recipe) {
              if (!ingredient.rawMaterialId) continue;

              const material = modifiedMaterials.get(ingredient.rawMaterialId) || materialDocsMap.get(ingredient.rawMaterialId);
              if (!material) {
                console.warn(`[JANLU] El insumo ${ingredient.rawMaterialId} no existe.`);
                continue;
              }

              let stock = material.stock || 0;
              let compromisedStock = material.compromisedStock || 0;
              const totalQty = (ingredient.quantity || 0) * (item.quantity || 0);

              if (totalQty > 0) {
                // Apply transition logic for raw materials
                if (oldState === 'none' && newState === 'committed') {
                  compromisedStock += totalQty;
                } else if (oldState === 'none' && newState === 'consumed') {
                  stock = Math.max(0, stock - totalQty);
                } else if (oldState === 'committed' && newState === 'none') {
                  compromisedStock = Math.max(0, compromisedStock - totalQty);
                } else if (oldState === 'committed' && newState === 'consumed') {
                  compromisedStock = Math.max(0, compromisedStock - totalQty);
                  stock = Math.max(0, stock - totalQty);
                } else if (oldState === 'consumed' && newState === 'none') {
                  stock += totalQty;
                } else if (oldState === 'consumed' && newState === 'committed') {
                  stock += totalQty;
                  compromisedStock += totalQty;
                }
              }

              modifiedMaterials.set(ingredient.rawMaterialId, { ...material, stock, compromisedStock });
            }
          }
        }

        // Merge modified materials into materialDocsMap so calculateDynamicStock uses the updated stock values
        const allMaterialsMapForRecalc = new Map<string, any>();
        for (const [mid, mData] of materialDocsMap.entries()) {
          allMaterialsMapForRecalc.set(mid, { ...mData, id: mid });
        }
        for (const [materialId, materialData] of modifiedMaterials.entries()) {
          allMaterialsMapForRecalc.set(materialId, { ...allMaterialsMapForRecalc.get(materialId), ...materialData });
        }

        // Recalculate dynamic stocks for all products in the database
        for (const product of allProducts) {
          const currentProduct = modifiedProducts.get(product.id) || product;
          const variants = currentProduct.variants || [];
          let productChanged = false;

          const updatedVariants = variants.map((v: any) => {
            if (v.isFinishedGood === false && v.recipe && v.recipe.length > 0) {
              const newStock = calculateDynamicStock(v, allMaterialsMapForRecalc);
              if (v.stock !== newStock) {
                productChanged = true;
                return { ...v, stock: newStock };
              }
            }
            return v;
          });

          if (productChanged) {
            modifiedProducts.set(product.id, { ...currentProduct, variants: updatedVariants });
          }
        }

        // Commit all modified documents to transaction using update for specific fields
        for (const [courseId, courseData] of modifiedCourses.entries()) {
          transaction.update(db.collection("courses").doc(courseId), { enrolledCount: courseData.enrolledCount });
        }
        for (const [productId, productData] of modifiedProducts.entries()) {
          transaction.update(db.collection("products").doc(productId), { variants: productData.variants });
        }
        for (const [materialId, materialData] of modifiedMaterials.entries()) {
          transaction.update(db.collection("rawMaterials").doc(materialId), { 
            stock: materialData.stock, 
            compromisedStock: materialData.compromisedStock 
          });
        }

        // Mark sale as synchronized
        transaction.update(saleRef, { inventorySynced: true });
        console.log(`[JANLU SUCCESS] Transición de inventario completada exitosamente para la venta ${saleId}`);
      });
    } catch (error: any) {
      console.error(`[JANLU CRITICAL ERROR] Error al procesar inventario para la venta ${saleId}:`, error);
      // Marcamos el error en el documento
      await afterSnapshot.ref.update({
        inventorySynced: false,
        status: "failed_stock",
        errorLog: error.message || "Error desconocido de stock"
      });
    }
  }
);
