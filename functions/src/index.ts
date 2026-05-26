import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore("ai-studio-19c9ceaa-c323-42fd-a900-048de6612687");

/**
 * 🚀 updateStockOnSale
 * Escucha la creación de una orden en /sales y descuenta variantes de stock
 * e insumos de materias primas de forma atómica en el servidor.
 */
export const updateStockOnSale = onDocumentCreated(
  {
    document: "sales/{saleId}",
    database: "ai-studio-19c9ceaa-c323-42fd-a900-048de6612687"
  },
  async (event: any) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log("[JANLU] No se encontraron datos en el snapshot.");
    return;
  }

  const saleData = snapshot.data();
  const items = saleData.items || []; // Productos comprados en el carrito

  console.log(`[JANLU] Procesando reducción de stock para la venta: ${event.params.saleId}. Items: ${items.length}`);

  try {
    // 👑 EJECUCIÓN ATÓMICA CON TRANSACCIÓN
    await db.runTransaction(async (transaction: any) => {
      for (const item of items) {
        // 0️⃣ VERIFICACIÓN DE WORKSHOP / CURSO
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

        // 1️⃣ REDUCCIÓN DE STOCK EN LA VARIANTE CORRESPONDIENTE
        const updatedVariants = (product?.variants || []).map((variant: any) => {
          // Buscamos coincidencia por ID de variante o por nombre si ID no coincide
          if (variant.id === item.variantId || variant.name === item.variantName) {
            selectedVariant = variant;
            const currentStock = variant.stock || 0;
            const targetQuantity = item.quantity || 0;

            // Cortafuegos de seguridad por si se intenta comprar sin stock real
            if (currentStock < targetQuantity) {
              throw new Error(`Stock insuficiente para el aroma/variante: ${variant.name || item.variantName}`);
            }
            return { ...variant, stock: currentStock - targetQuantity };
          }
          return variant;
        });

        // Impactamos la variante con su stock restado
        transaction.update(productRef, { variants: updatedVariants });

        // 2️⃣ REDUCCIÓN DE INSUMOS EN MATERIAS PRIMAS (RECETA)
        // La receta está cargada dentro de la variante seleccionada, no en la raíz del producto.
        if (selectedVariant && selectedVariant.recipe && Array.isArray(selectedVariant.recipe)) {
          for (const ingredient of selectedVariant.recipe) {
            if (!ingredient.rawMaterialId) continue;

            const materialRef = db.collection("rawMaterials").doc(ingredient.rawMaterialId);
            
            // Calculamos cuánto consumió esta cantidad de productos basándonos en la cantidad ('quantity')
            const totalToDiscount = (ingredient.quantity || 0) * (item.quantity || 0);

            if (totalToDiscount > 0) {
              // FieldValue.increment con valor negativo resta directamente en el servidor sin necesidad de leer primero
              transaction.update(materialRef, {
                stock: FieldValue.increment(-totalToDiscount)
              });
            }
          }
        }
      }
      
      // Opcional: Marcamos la orden en Firestore como procesada por el inventario
      transaction.update(snapshot.ref, { inventorySynced: true, status: "completed" });
    });

    console.log(`[JANLU SUCCESS] Inventario e insumos actualizados correctamente para la orden ${event.params.saleId}`);

  } catch (error: any) {
    console.error(`[JANLU CRITICAL ERROR] Error al procesar inventario para la orden ${event.params.saleId}:`, error);
    
    // Si la transacción falló (por ejemplo, por falta de stock), dejamos constancia en la orden
    await snapshot.ref.update({ 
      inventorySynced: false, 
      status: "failed_stock",
      errorLog: error.message || "Error desconocido de stock"
    });
  }
});
