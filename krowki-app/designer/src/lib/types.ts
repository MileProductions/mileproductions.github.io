export interface Adjust {
  brightness: number; // -100..100
  contrast: number;
  saturation: number;
  warmth: number;
  preset: 'none' | 'bw' | 'sepia' | 'vintage' | 'warm';
}
export const NO_ADJUST: Adjust = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, preset: 'none' };

export interface Crop { x: number; y: number; width: number; height: number }

interface Base {
  id: string;
  name: string;
  /** środek elementu w mm (układ edytora) */
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotation: number;
  opacity: number;
  hidden?: boolean;
  locked?: boolean;
}

export interface ImageEl extends Base {
  type: 'image';
  assetId: string | null; // null = puste miejsce na zdjęcie
  placeholderLabel?: string;
  crop: Crop | null;
  flipX: boolean;
  flipY: boolean;
  adjust: Adjust;
  clipFront: boolean;
}

export interface TextEl extends Base {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number; // mm
  fill: string;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
  lineHeight: number;
  stroke: string;
  strokeWidth: number;
}

export interface ShapeEl extends Base {
  type: 'shape';
  shape: 'rect' | 'ellipse' | 'heart';
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
}

export type El = ImageEl | TextEl | ShapeEl;

export interface Design {
  bg: string;
  elements: El[];
}

export interface Asset {
  id: string;
  name: string;
  blob: Blob;
  /** źródło w pełnej rozdzielczości (max 6000 px) */
  source: HTMLCanvasElement | HTMLImageElement;
  width: number;
  height: number;
  vector: boolean;
}

let n = 0;
export const uid = (p = 'el') => `${p}_${Date.now().toString(36)}_${(n++).toString(36)}`;
