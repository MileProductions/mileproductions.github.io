import { PRICING } from '../config/pricing';
import { formatPrice, quote } from '../lib/pricing';
import { useStore } from '../state/store';

export function PriceBox({ compact = false }: { compact?: boolean }) {
  const kg = useStore((s) => s.kg);
  const set = useStore((s) => s.set);
  const q = quote(kg);
  return (
    <div className={'kd-price' + (compact ? ' kd-price-compact' : '')}>
      <div className="kd-qty">
        <button aria-label="mniej" onClick={() => set({ kg: Math.max(PRICING.minKg, kg - 1) })}>−</button>
        <span><b>{q.kg} kg</b><small>≈ {q.pcs} szt.</small></span>
        <button aria-label="więcej" onClick={() => set({ kg: Math.min(PRICING.maxKg, kg + 1) })}>+</button>
      </div>
      <div className="kd-total">
        {q.individual ? <b>Wycena indywidualna</b> : <b>{formatPrice(q.total)}</b>}
        <small>{q.discountPct ? `rabat ${q.discountPct}% · ` : ''}{formatPrice(q.unitPrice)}/kg</small>
      </div>
    </div>
  );
}
