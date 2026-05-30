import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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

    const afterSnapshot = change.after;
    const afterData = afterSnapshot?.exists() ? afterSnapshot.data() : null;

    // Si la orden fue completamente eliminada del sistema, salimos
    if (!afterData) {
      console.log(`[JANLU] Venta ${event.params.saleId} eliminada. Ignorando.`);
      return;
    }

    const saleId = event.params.saleId;
    const afterStatus = afterData.status;
    const isSynced = afterData.inventorySynced === true;
    const items = afterData.items || [];

    const isBudgetStatus = (status?: string) => 
      status === "presupuesto" || status === "presupuesto_vencido" || status === "presupuesto_rechazado";

    let shouldDeduct = false;
    let shouldRevert = false;

    if (!isSynced) {
      // Si no está sincronizado y pasa a ser activo/entregado (es decir, no es presupuesto ni cancelado)
      if (!isBudgetStatus(afterStatus) && afterStatus !== "cancelado") {
        shouldDeduct = true;
      }
    } else {
      // Si ya estaba sincronizado y pasa a ser inactivo (presupuesto o cancelado)
      if (isBudgetStatus(afterStatus) || afterStatus === "cancelado") {
        shouldRevert = true;
      }
    }

    // Si no aplica ninguna acción, salimos temprano
    if (!shouldDeduct && !shouldRevert) {
      console.log(`[JANLU] No hay transiciones de inventario que ejecutar para la venta ${saleId}.`);
      return;
    }

    console.log(`[JANLU] Procesando inventario para la venta: ${saleId}. Acceso: ${shouldDeduct ? "DEDUCCIÓN" : "REVERSIÓN"}. Items: ${items.length}`);

    try {
      // 👑 EJECUCIÓN ATÓMICA CON TRANSACCIÓN
      await db.runTransaction(async (transaction: any) => {
        const saleRef = db.collection("sales").doc(saleId);
        const saleDoc = await transaction.get(saleRef);
        if (!saleDoc.exists) {
          throw new Error(`La venta ${saleId} no existe en la base de datos.`);
        }

        const saleCurrentData = saleDoc.data();
        const currentSynced = saleCurrentData?.inventorySynced === true;

        if (shouldDeduct) {
          // Si ya fue sincronizada por otra ejecución concurrente, salimos sin duplicar
          if (currentSynced) {
            console.log(`[JANLU] Venta ${saleId} ya sincronizada. Cancelando deducción duplicada.`);
            return;
          }

          for (const item of items) {
            // 0️⃣ DEDUCCIÓN DE WORKSHOP / CURSO
            if (item.isCourse || item.courseId) {
              const courseId = item.courseId || item.productId;
              const courseRef = db.collection("courses").doc(courseId);
              const courseDoc = await transaction.get(courseRef);

              if (!courseDoc.exists) {
                console.warn(`[JANLU] El curso/workshop ${courseId} no existe en la base de datos.`);
                continue;
              }

              const course = courseDoc.data();
              const currentEnrolled = course?.enrolledCount || 0;
              const maxQuota = course?.maxQuota || 0;
              const targetQuantity = item.quantity || 0;

              if (currentEnrolled + targetQuantity > maxQuota) {
                throw new Error(`Cupo insuficiente para el workshop/curso: ${course?.title || item.productName}. Quedan ${maxQuota - currentEnrolled} cupos disponibles.`);
              }

              transaction.update(courseRef, {
                enrolledCount: currentEnrolled + targetQuantity
              });
              continue;
            }

            if (!item.productId) continue;

            const productRef = db.collection("products").doc(item.productId);
            const productDoc = await transaction.get(productRef);

            if (!productDoc.exists) {
              console.warn(`[JANLU] El producto ${item.productId} no existe en la base de datos.`);
              continue;
            }

            const product = productDoc.data();
            let selectedVariant: any = null;

            // 1️⃣ DEDUCCIÓN DE STOCK EN LA VARIANTE CORRESPONDIENTE
            const updatedVariants = (product?.variants || []).map((variant: any) => {
              if (variant.id === item.variantId || variant.name === item.variantName) {
                selectedVariant = variant;
                const currentStock = variant.stock || 0;
                const targetQuantity = item.quantity || 0;

                if (currentStock < targetQuantity) {
                  throw new Error(`Stock insuficiente para el aroma/variante: ${variant.name || item.variantName}`);
                }
                return { ...variant, stock: currentStock - targetQuantity };
              }
              return variant;
            });

            transaction.update(productRef, { variants: updatedVariants });

            // 2️⃣ DEDUCCIÓN DE INSUMOS EN MATERIAS PRIMAS (RECETA)
            if (selectedVariant && selectedVariant.recipe && Array.isArray(selectedVariant.recipe)) {
              for (const ingredient of selectedVariant.recipe) {
                if (!ingredient.rawMaterialId) continue;

                const materialRef = db.collection("rawMaterials").doc(ingredient.rawMaterialId);
                const totalToDiscount = (ingredient.quantity || 0) * (item.quantity || 0);

                if (totalToDiscount > 0) {
                  transaction.update(materialRef, {
                    stock: FieldValue.increment(-totalToDiscount)
                  });
                }
              }
            }
          }

          // Marcar como sincronizado e indicar que fue exitoso
          transaction.update(saleRef, { inventorySynced: true });
          console.log(`[JANLU SUCCESS] Inventario descontado con éxito para la venta ${saleId}`);

        } else if (shouldRevert) {
          // Si ya fue desincronizada por otra ejecución concurrente, salimos sin duplicar
          if (!currentSynced) {
            console.log(`[JANLU] Venta ${saleId} ya desincronizada. Cancelando reversión duplicada.`);
            return;
          }

          for (const item of items) {
            // 0️⃣ REVERSIÓN DE WORKSHOP / CURSO
            if (item.isCourse || item.courseId) {
              const courseId = item.courseId || item.productId;
              const courseRef = db.collection("courses").doc(courseId);
              const courseDoc = await transaction.get(courseRef);

              if (!courseDoc.exists) {
                console.warn(`[JANLU] El curso/workshop ${courseId} no existe en la base de datos.`);
                continue;
              }

              const course = courseDoc.data();
              const currentEnrolled = course?.enrolledCount || 0;
              const targetQuantity = item.quantity || 0;

              transaction.update(courseRef, {
                enrolledCount: Math.max(0, currentEnrolled - targetQuantity)
              });
              continue;
            }

            if (!item.productId) continue;

            const productRef = db.collection("products").doc(item.productId);
            const productDoc = await transaction.get(productRef);

            if (!productDoc.exists) {
              console.warn(`[JANLU] El producto ${item.productId} no existe en la base de datos.`);
              continue;
            }

            const product = productDoc.data();
            let selectedVariant: any = null;

            // 1️⃣ REVERSIÓN DE STOCK EN LA VARIANTE CORRESPONDIENTE
            const updatedVariants = (product?.variants || []).map((variant: any) => {
              if (variant.id === item.variantId || variant.name === item.variantName) {
                selectedVariant = variant;
                const currentStock = variant.stock || 0;
                const targetQuantity = item.quantity || 0;
                return { ...variant, stock: currentStock + targetQuantity };
              }
              return variant;
            });

            transaction.update(productRef, { variants: updatedVariants });

            // 2️⃣ REVERSIÓN DE INSUMOS EN MATERIAS PRIMAS (RECETA)
            if (selectedVariant && selectedVariant.recipe && Array.isArray(selectedVariant.recipe)) {
              for (const ingredient of selectedVariant.recipe) {
                if (!ingredient.rawMaterialId) continue;

                const materialRef = db.collection("rawMaterials").doc(ingredient.rawMaterialId);
                const totalToDiscount = (ingredient.quantity || 0) * (item.quantity || 0);

                if (totalToDiscount > 0) {
                  transaction.update(materialRef, {
                    stock: FieldValue.increment(totalToDiscount)
                  });
                }
              }
            }
          }

          // Desmarcar sincronización
          transaction.update(saleRef, { inventorySynced: false });
          console.log(`[JANLU SUCCESS] Reversión de inventario (re-stock) completada para la venta ${saleId}`);
        }
      });
    } catch (error: any) {
      console.error(`[JANLU CRITICAL ERROR] Error al procesar inventario para la venta ${saleId}:`, error);

      // Si la transacción falló al descontar (ej. por falta de stock), marcamos el error en el documento
      if (shouldDeduct) {
        await afterSnapshot.ref.update({
          inventorySynced: false,
          status: "failed_stock",
          errorLog: error.message || "Error desconocido de stock"
        });
      }
    }
  }
);
