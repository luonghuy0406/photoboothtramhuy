import React, { useEffect, useState } from 'react';
import { RemoteController } from './components/RemoteController';
import { GalleryView } from './components/GalleryView';
import { LoadingView } from './components/LoadingView';
import { ErrorView } from './components/ErrorView';

interface SessionData {
  eventName: string;
  coupleName: string;
  session: {
    id: string;
    photos: Array<{
      id: string;
      thumbnailUrl: string;
      fullUrl: string;
      downloadUrl: string;
      width: number;
      height: number;
    }>;
    stripUrl?: string;
    createdAt: string;
  };
}

export function App() {
  const [routeInfo, setRouteInfo] = useState<{ mode: 'remote' | 'gallery'; sessionId: string } | null>(null);
  const [galleryData, setGalleryData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const route = parseRoute();
    if (!route) {
      setError('Không tìm thấy phiên chụp. Vui lòng quét mã QR trên màn hình Photobooth.');
      setLoading(false);
      return;
    }

    setRouteInfo(route);

    if (route.mode === 'gallery') {
      fetchGallery(route.sessionId);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchGallery = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/gallery/${sessionId}`);
      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Không thể tải ảnh.');
      } else {
        setGalleryData(result.data);
      }
    } catch {
      setError('Không thể kết nối. Hãy đảm bảo bạn đang kết nối Wi-Fi "HUY-TRAM-PHOTO".');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} />;

  if (routeInfo?.mode === 'remote') {
    return <RemoteController sessionId={routeInfo.sessionId} />;
  }

  if (galleryData) {
    return <GalleryView data={galleryData} />;
  }

  return <ErrorView message="Không tìm thấy phiên chụp." />;
}

function parseRoute(): { mode: 'remote' | 'gallery'; sessionId: string } | null {
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);

  // Match /remote/:sessionId
  const remoteIndex = parts.indexOf('remote');
  if (remoteIndex !== -1 && parts[remoteIndex + 1]) {
    return { mode: 'remote', sessionId: parts[remoteIndex + 1] };
  }

  // Match /gallery/:sessionId
  const galleryIndex = parts.indexOf('gallery');
  if (galleryIndex !== -1 && parts[galleryIndex + 1]) {
    return { mode: 'gallery', sessionId: parts[galleryIndex + 1] };
  }

  // Fallback: /pb-xxxx or /:sessionId
  if (parts.length > 0 && parts[0] !== 'api') {
    return { mode: 'remote', sessionId: parts[0] };
  }

  // Fallback query param: ?session=pb-xxx or ?id=pb-xxx
  const urlParams = new URLSearchParams(window.location.search);
  const querySession = urlParams.get('session') || urlParams.get('id');
  if (querySession) {
    return { mode: 'remote', sessionId: querySession };
  }

  return null;
}
