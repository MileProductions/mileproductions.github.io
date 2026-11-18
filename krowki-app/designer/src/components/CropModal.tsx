import { useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { FRONT } from '../config/template';
import { processedCanvas } from '../lib/images';
import { NO_ADJUST, type ImageEl } from '../lib/types';
import { useStore } from '../state/store';

const ASPECTS = [
  { label: 'Jak teraz', value: 0 },
  { label: 'Przód cukierka', value: FRONT.w / FRONT.h },
  { label: 'Kwadrat', value: 1 },
  { label: 'Dowolnie', value: -1 },
];

export function CropModal({ el, onClose }: { el: ImageEl; onClose: () => void }) {
  const asset = useStore((s) => (el.assetId ? s.assets[el.assetId] : undefined));
  const updateEl = useStore((s) => s.updateEl);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectSel, setAspectSel] = useState(0);
  const [area, setArea] = useState<Area | null>(null);
  if (!asset) return null;
  const src = processedCanvas(asset, { ...el, crop: null, adjust: NO_ADJUST }, 1600);
  const ratio = src.width / asset.width;
  const aspect = aspectSel === 0 ? el.w / el.h : aspectSel === -1 ? undefined : aspectSel;
  const initial = el.crop
    ? { x: el.crop.x * ratio, y: el.crop.y * ratio, width: el.crop.width * ratio, height: el.crop.height * ratio }
    : undefined;

  const apply = () => {
    if (!area) return onClose();
    const c = { x: area.x / ratio, y: area.y / ratio, width: area.width / ratio, height: area.height / ratio };
    const a = c.width / c.height;
    // zachowaj szerokość ramki, dopasuj wysokość do nowych proporcji
    updateEl(el.id, { crop: c, h: el.w / a }, 'crop' + Date.now());
    onClose();
  };

  return (
    <div className="kd-modal" role="dialog" aria-label="Kadrowanie zdjęcia">
      <div className="kd-modal-box kd-crop">
        <div className="kd-crop-area">
          <Cropper image={src.toDataURL('image/jpeg', 0.9)} crop={crop} zoom={zoom} aspect={aspect}
            onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, px) => setArea(px)}
            initialCroppedAreaPixels={initial ? { x: Math.round(initial.x), y: Math.round(initial.y), width: Math.round(initial.width), height: Math.round(initial.height) } : undefined}
            showGrid objectFit="contain" />
        </div>
        <div className="kd-row kd-wrap">
          {ASPECTS.map((a) => (
            <button key={a.label} className={'kd-chip' + (aspectSel === a.value ? ' kd-on' : '')} onClick={() => setAspectSel(a.value)}>{a.label}</button>
          ))}
        </div>
        <label className="kd-field">Powiększenie
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(+e.target.value)} />
        </label>
        <div className="kd-row kd-end">
          <button className="kd-btn" onClick={onClose}>Anuluj</button>
          <button className="kd-btn kd-primary" onClick={apply}>Zastosuj kadr</button>
        </div>
      </div>
    </div>
  );
}
