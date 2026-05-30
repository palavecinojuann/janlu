import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore("ai-studio-19c9ceaa-c323-42fd-a900-048de6612687");

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
    const beforeData = beforeSnapshot?.exists() ? beforeSnapshot.data() : null;

    const afterSnapshot = change.after;
    const afterData = afterSnapshot?.exists() ? afterSnapshot.data() : null;

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
        const productIds = new Set<string>();
        const materialIds = new Set<string>();
        const courseIds = new Set<string>();

        for (const item of items) {
          if (item.isCourse || item.courseId) {
            courseIds.add(item.courseId || item.productId);
          } else if (item.productId) {
            productIds.add(item.productId);
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

        // Read all product documents
        const productDocsMap = new Map<string, any>();
        for (const pid of productIds) {
          const docRef = db.collection("products").doc(pid);
          const docSnap = await transaction.get(docRef);
          if (docSnap.exists) {
            const pData = docSnap.data();
            productDocsMap.set(pid, pData);
            
            // Gather raw materials from product variants recipe
            const saleItemsForProduct = items.filter((item: any) => item.productId === pid);
            for (const item of saleItemsForProduct) {
              const variant = pData.variants?.find((v: any) => v.id === item.variantId || v.name === item.variantName);
              if (variant && variant.recipe) {
                for (const rec of variant.recipe) {
                  if (rec.rawMaterialId) {
                    materialIds.add(rec.rawMaterialId);
                  }
                }
              }
            }
          }
        }

        // Read all raw material documents
        const materialDocsMap = new Map<string, any>();
        for (const mid of materialIds) {
          const docRef = db.collection("rawMaterials").doc(mid);
          const docSnap = await transaction.get(docRef);
          if (docSnap.exists) {
            materialDocsMap.set(mid, docSnap.data());
          }
        }

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
              if (v.isFinishedGood === true) {
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
