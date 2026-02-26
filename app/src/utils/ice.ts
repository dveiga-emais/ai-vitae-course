/**
 * Clampea un valor numerico al rango [0, 100] y lo redondea a entero.
 */
export function clampIce(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)))
}

/**
 * Parsea, redondea y clampea un valor recibido de un formulario o de la IA.
 * Devuelve undefined si el valor no es un numero valido o esta vacio.
 */
export function sanitizeIceValue(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  const num = typeof raw === 'string' ? Number(raw) : raw
  if (typeof num !== 'number' || isNaN(num)) return undefined
  return clampIce(num)
}

/**
 * Calcula el ICE score como la media redondeada de Impact, Confidence y Ease.
 * Devuelve undefined si falta cualquiera de los tres valores.
 */
export function calculateIceScore(
  impact?: number,
  confidence?: number,
  ease?: number,
): number | undefined {
  if (impact === undefined || confidence === undefined || ease === undefined) {
    return undefined
  }
  return Math.round((impact + confidence + ease) / 3)
}
