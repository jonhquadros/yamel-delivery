/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formats integer cents into a localized BRL currency string.
 * Example: 2490 -> "R$ 24,90"
 */
export function formatCentsToBRL(cents: number): string {
  if (cents === null || cents === undefined || isNaN(cents)) {
    return 'R$ 0,00';
  }
  const realValue = cents / 100;
  return realValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converts a price input string (e.g. "24,90", "R$ 24,90", or "24.90") into integer cents.
 * Example: "24,90" -> 2490
 */
export function parseBRLToCents(val: string | number): number {
  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    return Math.round(val);
  }
  if (!val) return 0;
  // Remove non-numeric chars except commas and dots
  const cleanStr = val.replace(/[^\d,-]/g, '').replace(',', '.');
  const parsedFloat = parseFloat(cleanStr);
  if (isNaN(parsedFloat)) return 0;
  return Math.round(parsedFloat * 100);
}
