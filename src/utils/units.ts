export type Dimension = 'weight' | 'volume' | 'length' | 'units';

export type Unit = 
  | 'mg' | 'g' | 'kg' 
  | 'ml' | 'l' 
  | 'mm' | 'cm' | 'm' 
  | 'u'; // unidades

export const UNIT_DIMENSIONS: Record<Unit, Dimension> = {
  mg: 'weight',
  g: 'weight',
  kg: 'weight',
  ml: 'volume',
  l: 'volume',
  mm: 'length',
  cm: 'length',
  m: 'length',
  u: 'units'
};

// Factores de conversión hacia la Unidad de Medida Base (UMB)
// UMBs: g (peso), ml (volumen), mm (longitud), u (unidades)
export const CONVERSION_TO_UMB: Record<Unit, number> = {
  mg: 0.001,
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  mm: 1,
  cm: 10,
  m: 1000,
  u: 1
};

export const UMB_FOR_DIMENSION: Record<Dimension, Unit> = {
  weight: 'g',
  volume: 'ml',
  length: 'mm',
  units: 'u'
};

export function getUnitsForDimension(dimension?: Dimension, fallbackUnit?: Unit): Unit[] {
  const effectiveDimension = dimension || (fallbackUnit ? UNIT_DIMENSIONS[fallbackUnit] : 'units');
  return Object.keys(UNIT_DIMENSIONS).filter(u => UNIT_DIMENSIONS[u as Unit] === effectiveDimension) as Unit[];
}

/**
 * Convierte una cantidad de una unidad específica a la Unidad de Medida Base (UMB).
 * Ej: toUMB(1, 'm') -> 1000 (mm)
 * Ej: toUMB(5, 'l') -> 5000 (ml)
 */
export function toUMB(quantity: number, unit: Unit): number {
  const factor = CONVERSION_TO_UMB[unit];
  if (factor === undefined) throw new Error(`Unidad no soportada: ${unit}`);
  return quantity * factor;
}

/**
 * Convierte una cantidad desde la UMB a una unidad específica.
 * Ej: fromUMB(1000, 'm') -> 1 (m)
 */
export function fromUMB(quantityUMB: number, targetUnit: Unit): number {
  const factor = CONVERSION_TO_UMB[targetUnit];
  if (factor === undefined) throw new Error(`Unidad no soportada: ${targetUnit}`);
  return quantityUMB / factor;
}

/**
 * Formatea visualmente una cantidad en UMB a la unidad más legible para humanos.
 * Ej: formatUMB(3500, 'volume') -> "3.5 L"
 * Ej: formatUMB(950, 'length') -> "95 cm"
 */
export function formatUMB(quantityUMB: number, dimension?: Dimension, fallbackUnit?: Unit): string {
  const effectiveDimension = dimension || (fallbackUnit ? UNIT_DIMENSIONS[fallbackUnit] : 'units');
  
  if (effectiveDimension === 'weight') {
    if (quantityUMB >= 1000) return `${+(quantityUMB / 1000).toFixed(2)} kg`;
    if (quantityUMB < 1 && quantityUMB > 0) return `${+(quantityUMB * 1000).toFixed(2)} mg`;
    return `${+quantityUMB.toFixed(2)} g`;
  }
  
  if (effectiveDimension === 'volume') {
    if (quantityUMB >= 1000) return `${+(quantityUMB / 1000).toFixed(2)} L`;
    return `${+quantityUMB.toFixed(2)} ml`;
  }
  
  if (effectiveDimension === 'length') {
    if (quantityUMB >= 1000) return `${+(quantityUMB / 1000).toFixed(2)} m`;
    if (quantityUMB >= 10) return `${+(quantityUMB / 10).toFixed(2)} cm`;
    return `${+quantityUMB.toFixed(2)} mm`;
  }
  
  return `${+quantityUMB.toFixed(2)} u`;
}

/**
 * Calcula el costo por UMB basado en el costo de la unidad de compra.
 * Ej: Si 1 kg cuesta $1000, el costo por UMB (g) es $1.
 */
export function calculateCostPerUMB(costPerPurchaseUnit: number, purchaseUnit: Unit): number {
  const factor = CONVERSION_TO_UMB[purchaseUnit];
  return costPerPurchaseUnit / factor;
}
