import { Variant, RawMaterial } from '../types';
import { UMB_FOR_DIMENSION, UNIT_DIMENSIONS, toUMB, Unit, Dimension } from './units';

export const getVariantStock = (variant: Variant | undefined | null, rawMaterials: RawMaterial[] | undefined | null): number => {
  if (!variant) return 0;
  const rms = rawMaterials || [];

  // REGLA 1: Si la variante NO tiene receta (insumos de venta directa, pabilos, esencias, etc.),
  // retornamos INCONDICIONALMENTE su stock físico directo disponible.
  if (!variant.recipe || variant.recipe.length === 0) {
    const directStock = (variant.stock || 0) - (variant.compromisedStock || 0);
    return directStock > 0 ? directStock : 0;
  }

  // REGLA 2: Si tiene receta pero NO hay insumos en memoria (vista del cliente público),
  // retornamos el stock físico directo precalculado de la variante (ej. velas fabricadas en stock).
  if (rms.length === 0) {
    const directStock = (variant.stock || 0) - (variant.compromisedStock || 0);
    return directStock > 0 ? directStock : 0;
  }

  // REGLA 3: Vista del Administrador (con insumos en memoria) y con receta.
  // Si está marcado explícitamente como producto terminado listo, usa su propio stock
  if (variant.isFinishedGood === true) {
    const directStock = (variant.stock || 0) - (variant.compromisedStock || 0);
    return directStock > 0 ? directStock : 0;
  }

  // De lo contrario, calcula el stock dinámico en base a los insumos disponibles en el taller
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
};
