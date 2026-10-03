import React, { useState } from 'react';

interface Photo {
  id: string;
  thumbnailUrl: string;
  fullUrl: string;
  downloadUrl: string;
  width: number;
  height: number;
}

interface GalleryViewProps {
  data: {
    eventName: string;
    coupleName: string;
    session: {
      id: string;
      photos: Photo[];
      stripUrl?: string;
      createdAt: string;
    };
  };
}

export function GalleryView({ data }: GalleryViewProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn('Download fallback to direct link:', err);
      window.open(url, '_blank');
    }
  };

  const downloadPhoto = async (photo: Photo, index: number) => {
    setDownloading(photo.id);
    await handleDownload(
      photo.downloadUrl || photo.fullUrl,
      `${data.coupleName.replace(/\s+/g, '-')}-anh-${index + 1}.jpg`
    );
    setDownloading(null);
  };

  const downloadStrip = async () => {
    if (!data.session.stripUrl) return;
    setDownloading('strip');
    await handleDownload(
      data.session.stripUrl,
      `${data.coupleName.replace(/\s+/g, '-')}-photo-strip.jpg`
    );
    setDownloading(null);
  };

  const handleDownloadAll = async () => {
    if (data.session.stripUrl) {
      await downloadStrip();
    }
    for (let i = 0; i < data.session.photos.length; i++) {
      await downloadPhoto(data.session.photos[i], i);
      await new Promise((r) => setTimeout(r, 400));
    }
  };

  return (
    <div className="gallery">
      <header className="gallery-header">
        <h1 className="gallery-title">{data.coupleName}</h1>
        <p className="gallery-subtitle">{data.eventName}</p>
        <div className="guest-wifi-badge">
          📶 Đang kết nối mạng nội bộ HUY-TRAM-PHOTO
        </div>
      </header>

      {/* Main Feature: Photo Strip Souvenir */}
      {data.session.stripUrl && (
        <div className="strip-section">
          <div className="strip-container-mobile">
            <img
              src={data.session.stripUrl}
              alt="Photo Strip Cưới"
              className="photo-strip"
              onClick={() => window.open(data.session.stripUrl!, '_blank')}
            />
          </div>

          <button
            className="download-strip-btn"
            onClick={downloadStrip}
            disabled={downloading === 'strip'}
          >
            {downloading === 'strip' ? '⏳ Đang tải...' : '📥 Tải Photo Strip Cưới'}
          </button>
        </div>
      )}

      {/* Single photos grid */}
      <h3 className="photos-grid-heading">Từng kiểu ảnh riêng</h3>
      <div className="photo-grid">
        {data.session.photos.map((photo, idx) => (
          <div key={photo.id} className="photo-card">
            <img
              src={photo.thumbnailUrl}
              alt={`Ảnh ${idx + 1}`}
              className="photo-thumbnail"
              onClick={() => setSelectedPhoto(photo)}
              loading="lazy"
            />
            <div className="photo-card-footer">
              <span className="photo-num">Kiểu #{idx + 1}</span>
              <button
                className="download-btn"
                onClick={() => downloadPhoto(photo, idx)}
                disabled={downloading === photo.id}
              >
                {downloading === photo.id ? 'Đang tải...' : 'Tải ảnh gốc ⬇'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {data.session.photos.length > 1 && (
        <button className="download-all-btn" onClick={handleDownloadAll}>
          💾 Tải tất cả (Strip + 3 ảnh gốc)
        </button>
      )}

      {/* Full preview modal */}
      {selectedPhoto && (
        <div className="photo-modal" onClick={() => setSelectedPhoto(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={selectedPhoto.fullUrl} alt="Ảnh gốc" className="modal-image" />
            <div className="modal-actions">
              <button onClick={() => downloadPhoto(selectedPhoto, 0)}>Tải về máy</button>
              <button onClick={() => setSelectedPhoto(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      <footer className="gallery-footer">
        <p>💕 Cảm ơn bạn đã đến chung vui cùng chúng mình!</p>
        <p className="footer-sub">Huy &amp; Trâm Wedding Photobooth</p>
      </footer>
    </div>
  );
}
