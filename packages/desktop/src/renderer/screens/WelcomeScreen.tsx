import React, { useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { motion } from 'framer-motion';

export function WelcomeScreen() {
  const startSession = useSessionStore((s) => s.startSession);
  const serverUrl = useSessionStore((s) => s.serverUrl);
  const cameraSource = useSessionStore((s) => s.cameraSource);
  const setCameraSource = useSessionStore((s) => s.setCameraSource);

  const [adminOpen, setAdminOpen] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [cameraStatus, setCameraStatus] = useState<string>('unknown');
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  // Hidden admin access: 3 quick taps on the top right
  const handleSecretTap = () => {
    const next = tapCount + 1;
    if (next >= 3) {
      setAdminOpen(true);
      setTapCount(0);
      checkCamera();
    } else {
      setTapCount(next);
      setTimeout(() => setTapCount(0), 1200);
    }
  };

  const checkCamera = async () => {
    try {
      const res = await fetch(`${serverUrl}/api/camera/status`);
      const data = await res.json();
      setCameraStatus(data?.data?.status || 'error');
    } catch {
      setCameraStatus('offline');
    }
  };

  const handleExportAlbum = async () => {
    try {
      setExportMessage('Đang xuất toàn bộ album...');
      const res = await fetch(`${serverUrl}/api/admin/export`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setExportMessage(`Đã xuất thành công: ${json.data.exportedStrips} photo strips vào ${json.data.exportPath}`);
      } else {
        setExportMessage(`Lỗi: ${json.error}`);
      }
    } catch (e) {
      setExportMessage('Không thể kết nối máy chủ');
    }
  };

  const switchAdapter = async (adapter: 'mock' | 'eos-utility' | 'gphoto2' | 'webcam') => {
    try {
      await fetch(`${serverUrl}/api/camera/adapter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adapter }),
      });
      checkCamera();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <motion.div
      className="screen welcome-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Secret admin trigger zone */}
      <div
        onClick={handleSecretTap}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '100px',
          height: '100px',
          cursor: 'pointer',
          zIndex: 50,
        }}
      />

      <div className="welcome-decor-frame">
        <div className="corner corner-tl" />
        <div className="corner corner-tr" />
        <div className="corner corner-bl" />
        <div className="corner corner-br" />

        <div className="welcome-content">
          <p className="event-date">15 · 03 · 2025</p>

          <h1 className="couple-names">Huy &amp; Trâm</h1>

          <div className="divider-gold">
            <span className="gold-diamond">◆</span>
          </div>

          <p className="event-tagline">DIGITAL WEDDING PHOTOBOOTH</p>
          <p className="event-instructions">3 kiểu ảnh · Tự động ghép strip · Quét QR tải ngay</p>

          <motion.button
            className="start-button pulse"
            onClick={startSession}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Chạm để bắt đầu 📸
          </motion.button>
        </div>
      </div>

      {/* Admin Dashboard Modal */}
      {adminOpen && (
        <div className="admin-modal-backdrop" onClick={() => setAdminOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-header">
              <h2>⚙ Quản Trị Photobooth</h2>
              <button className="admin-close-btn" onClick={() => setAdminOpen(false)}>✕</button>
            </div>

            <div className="admin-body">
              <div className="admin-item">
                <label>Trạng thái Máy ảnh:</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={`status-badge ${cameraStatus}`}>{cameraStatus.toUpperCase()}</span>
                  <span style={{ fontSize: '0.85rem', color: '#aaa' }}>
                    ({cameraSource === 'webcam' ? 'Laptop Webcam' : cameraSource === 'canon' ? 'Canon M50' : 'Tự động'})
                  </span>
                  <button onClick={checkCamera} className="small-btn">Kiểm tra</button>
                </div>
              </div>

              <div className="admin-item">
                <label>Nguồn chụp ảnh:</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { setCameraSource('webcam'); switchAdapter('webcam'); }}
                    className={`small-btn ${cameraSource === 'webcam' ? 'primary' : ''}`}
                  >
                    💻 Laptop Webcam (Không cần cáp)
                  </button>
                  <button
                    onClick={() => { setCameraSource('auto'); }}
                    className={`small-btn ${cameraSource === 'auto' ? 'primary' : ''}`}
                  >
                    ⚡ Tự động (Ưu tiên Canon, dự phòng Laptop)
                  </button>
                  <button
                    onClick={() => { setCameraSource('canon'); switchAdapter('eos-utility'); }}
                    className={`small-btn ${cameraSource === 'canon' ? 'primary' : ''}`}
                  >
                    📷 Canon M50 (EOS Utility)
                  </button>
                  <button
                    onClick={() => { switchAdapter('mock'); }}
                    className="small-btn"
                  >
                    🧪 Mock
                  </button>
                </div>
              </div>

              <div className="admin-item">
                <label>Xuất toàn bộ album sau tiệc:</label>
                <button onClick={handleExportAlbum} className="small-btn primary">
                  📦 Xuất toàn bộ album ảnh
                </button>
              </div>

              {exportMessage && <p className="admin-message">{exportMessage}</p>}

              <div className="admin-item">
                <label>Mạng Wi-Fi nội bộ:</label>
                <code>SSID: HUY-TRAM-PHOTO · IP: 192.168.50.10:3000</code>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
