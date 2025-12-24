import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina classes CSS usando clsx e tailwind-merge
 * para resolver conflitos de classes do Tailwind
 *
 * @param inputs - Classes CSS para combinar
 * @returns String com classes combinadas e resolvidas
 *
 * @example
 * cn("px-2 py-1", "px-4") // "py-1 px-4"
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
