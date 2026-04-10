import { Variant, RawMaterial } from '../types';
import { UMB_FOR_DIMENSION, UNIT_DIMENSIONS, toUMB, Unit, Dimension } from './units';

export const getVariantStock = (variant: Variant | undefined | null, rawMaterials: RawMaterial[] | undefined | null): number => {
  if (!variant) return 0;
  const rms = rawMaterials || [];
  
  // If explicitly marked as a finished good, use its own stock field
  if (variant.isFinishedGood === true) {
    return variant.stock;
  }
  
  // If it has a recipe, calculate stock based on ingredients
  if (variant.recipe && variant.recipe.length > 0) {
    let minStock = Infinity;
    for (const item of variant.recipe) {
      const rm = rms.find(m => m.id === item.rawMaterialId);
      if (rm) {
        // Calculate stock based on recipe requirement
        // item.quantity is the amount of raw material needed for ONE unit of this variant
        if (item.quantity > 0) {
          const possibleUnits = Math.floor(rm.stock / item.quantity);
          if (possibleUnits < minStock) minStock = possibleUnits;
        } else {
          return 0;
        }
      } else {
        return 0; // Missing raw material, cannot make any
      }
    }
    return minStock === Infinity ? 0 : minStock;
  }
  
  // Default to its own stock field
  return variant.stock;
};
