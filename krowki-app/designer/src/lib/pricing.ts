import { PRICING, type PricingConfig } from '../config/pricing';

export interface Quote {
  kg: number; pcs: number; unitPrice: number; total: number; discountPct: number; individual: boolean;
}

export function quote(kgIn: number, cfg: PricingConfig = PRICING): Quote {
  const kg = Math.min(cfg.maxKg, Math.max(cfg.minKg, Math.round(kgIn)));
  const tier = [...cfg.tiers].reverse().find((t) => kg >= t.fromKg) ?? { discount: 0 };
  const unitPrice = round2(cfg.pricePerKg * (1 - tier.discount));
  return {
    kg,
    pcs: Math.round(kg * cfg.pcsPerKg),
    unitPrice,
    total: round2(unitPrice * kg),
    discountPct: Math.round(tier.discount * 100),
    individual: kg >= cfg.individualFromKg,
  };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const formatPrice = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + PRICING.currency;
