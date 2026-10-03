export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface GallerySession {
  id: string;
  photos: GalleryPhoto[];
  stripUrl?: string;
  createdAt: string;
}

export interface GalleryPhoto {
  id: string;
  thumbnailUrl: string;
  fullUrl: string;
  downloadUrl: string;
  width: number;
  height: number;
}

export interface GalleryResponse {
  eventName: string;
  coupleName: string;
  sessions: GallerySession[];
}
