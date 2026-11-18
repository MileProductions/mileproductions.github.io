// UWAGA: ceny i progi są PRZYKŁADOWE – do ustawienia przez sklep.
export const PRICING = {
  pricePerKg: 79,
  currency: 'zł',
  pcsPerKg: 95,
  minKg: 1,
  maxKg: 100,
  individualFromKg: 25,
  tiers: [
    { fromKg: 1, discount: 0 },
    { fromKg: 5, discount: 0.05 },
    { fromKg: 10, discount: 0.1 },
  ],
  leadTime: '5–7 dni roboczych od akceptacji projektu',
};
export type PricingConfig = typeof PRICING;
