/** Clamp a value into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

/** Linear interpolation between a and b by t (t=0 => a, t=1 => b). */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Frame-rate independent exponential smoothing factor for rate-based
 * interpolation: `lerp(current, target, dampFactor(rate, dt))`.
 */
export function dampFactor(rate: number, dtSeconds: number): number {
  return 1 - Math.exp(-rate * dtSeconds);
}

/** FNV-1a 32-bit string hash — deterministic tie-breaking helper. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
