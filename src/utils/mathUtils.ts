/**
 * Round a number to a specific number of decimal places.
 * Default is 2 for financial values.
 */
export function roundTo(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Round financial values to 2 decimal places.
 */
export function roundFinancial(value: number): number {
  return roundTo(value, 2);
}

/**
 * Round unit costs or more precise values to 4 decimal places.
 */
export function roundPrecise(value: number): number {
  return roundTo(value, 4);
}
