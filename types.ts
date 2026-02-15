
export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface Detection {
  id: string;
  label: string;
  confidence: number;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
  selected: boolean;
}

export interface ImageItem {
  id: string;
  fileName: string;
  src: string;
  file: File;
  detections: Detection[];
  isAnalyzing: boolean;
  error: string | null;
}

export interface AppState {
  image: string | null;
  fileName: string | null;
  isAnalyzing: boolean;
  detections: Detection[];
  error: string | null;
  images: ImageItem[];
  activeImageId: string | null;
}
