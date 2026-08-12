import type { UnitSystem } from '../types';

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const ML_PER_FLOZ = 29.5735;
export const KM_PER_MI = 1.609344;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (i: number) => i * CM_PER_IN;
export const mlToFloz = (ml: number) => ml / ML_PER_FLOZ;
export const flozToMl = (oz: number) => oz * ML_PER_FLOZ;
export const kmToMi = (km: number) => km / KM_PER_MI;
export const miToKm = (mi: number) => mi * KM_PER_MI;

export interface UnitLabels {
  weight: string;
  length: string;
  volume: string;
  distance: string;
}

export function labels(units: UnitSystem): UnitLabels {
  return units === 'metric'
    ? { weight: 'kg', length: 'cm', volume: 'ml', distance: 'km' }
    : { weight: 'lb', length: 'in', volume: 'fl oz', distance: 'mi' };
}

/** Canonical (metric) -> display value in the user's chosen system. */
export function toDisplay(kind: keyof UnitLabels, value: number, units: UnitSystem): number {
  if (units === 'metric') return value;
  switch (kind) {
    case 'weight':
      return kgToLb(value);
    case 'length':
      return cmToIn(value);
    case 'volume':
      return mlToFloz(value);
    case 'distance':
      return kmToMi(value);
  }
}

/** Display value in the user's chosen system -> canonical (metric). */
export function toCanonical(kind: keyof UnitLabels, value: number, units: UnitSystem): number {
  if (units === 'metric') return value;
  switch (kind) {
    case 'weight':
      return lbToKg(value);
    case 'length':
      return inToCm(value);
    case 'volume':
      return flozToMl(value);
    case 'distance':
      return miToKm(value);
  }
}

export function round(value: number, places = 1): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}
