import { Variant, RawMaterial } from '../types';
import { UMB_FOR_DIMENSION, UNIT_DIMENSIONS, toUMB, Unit, Dimension } from './units';

export const getVariantStock = (variant: Variant | undefined | null, rawMaterials: RawMaterial[] | undefined | null): number => {
  if (!variant) return 0;
  const rms = rawMaterials || [];

  // SI NO HAY INSUMOS EN MEMORIA (Vista del Cliente Público) -> Fallback seguro
  if (rms.length === 0) {
    const directStock = (variant.stock || 0) - (variant.compromisedStock || 0);
    return directStock > 0 ? directStock : 0;
  }

  // SI SÍ HAY INSUMOS (Vista del Administrador)
  // Si está marcado explícitamente como producto terminado, usa su propio stock
  if (variant.isFinishedGood === true) {
    const directStock = (variant.stock || 0) - (variant.compromisedStock || 0);
    return directStock > 0 ? directStock : 0;
  }

  // Si tiene receta, calcula el stock basado en los insumos disponibles
  if (variant.recipe && variant.recipe.length > 0) {
    let minStock = Infinity;
    for (const item of variant.recipe) {
      const rm = rms.find(m => m.id === item.rawMaterialId);
      if (rm) {
        // Calcular stock en base a los requerimientos de la receta
        if (item.quantity > 0) {
          const effectiveUnit = item.unit || rm.baseUnit || UMB_FOR_DIMENSION[rm.dimension || (rm.unit ? UNIT_DIMENSIONS[rm.unit as Unit] : 'units')];
          const quantityRequiredInUMB = toUMB(item.quantity, effectiveUnit as Unit);
          const availableRMStock = Math.max(0, rm.stock - (rm.compromisedStock || 0));
          const possibleUnits = Math.floor(availableRMStock / quantityRequiredInUMB);
          if (possibleUnits < minStock) minStock = possibleUnits;
        } else {
          return 0;
        }
      } else {
        return 0; // Insumo faltante, no se puede producir ninguno
      }
    }
    return minStock === Infinity ? 0 : minStock;
  }

  // Por defecto, usa su propio stock físico directo
  const directStock = (variant.stock || 0) - (variant.compromisedStock || 0);
  return directStock > 0 ? directStock : 0;
};
