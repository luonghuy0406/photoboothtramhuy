import React, { useEffect, useState } from 'react';
import {
  initFirebase,
  subscribeToSession,
  connectGuest,
  triggerCapture,
  retakeSession,
  finishSession,
  saveFirebaseConfig,
  getFirebaseConfig,
} from '../firebase';
import type { FirebaseConfig, FirebaseSessionDoc } from '../types';

interface PhotoInfo {
  id: string;
  thumbnailUrl: string;
  originalUrl: string;
  downloadUrl: string;
}

interface SessionStatus {
  sessionId: string;
  state: 'WAITING_GUEST' | 'GUEST_CONNECTED' | 'COUNTDOWN' | 'READY' | 'FINISHED' | string;
  coupleName: string;
  eventName: string;
  hasPhoto: boolean;
  stripUrl?: string | null;
  photo?: PhotoInfo | null;
}

export function RemoteController({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [localCountdown, setLocalCountdown] = useState<number | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [gatewayMode, setGatewayMode] = useState<'firebase' | 'local'>('local');

  // Firebase manual setup modal (if needed)
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configJsonInput, setConfigJsonInput] = useState('');

  // 1. Initialize Realtime Bridge (Firebase or Local Server fallback)
  useEffect(() => {
    let isMounted = true;
    const { isConfigured } = initFirebase();

    if (isConfigured) {
      setGatewayMode('firebase');
      // A. FIREBASE REALTIME GATEWAY
      connectGuest(sessionId);

      const unsubscribe = subscribeToSession(
        sessionId,
        (data: FirebaseSessionDoc) => {
          if (!isMounted) return;
          setStatus({
            sessionId: data.id,
            state: data.state,
            coupleName: data.coupleName || 'Huy & Trâm',
            eventName: data.eventName || 'Wedding Photobooth',
            hasPhoto: !!data.photoUrl,
            stripUrl: data.photoUrl || null,
            photo: data.photoUrl ? {
              id: data.id,
              thumbnailUrl: data.thumbnailUrl || data.photoUrl,
              originalUrl: data.photoUrl,
              downloadUrl: data.photoUrl,
            } : null,
          });
          setError(null);
          setLoading(false);

          if (data.state === 'FINISHED') {
            setIsFinished(true);
          }
        },
        (err) => {
          if (isMounted) {
            console.error('Firebase connection error:', err);
            setError('Không thể kết nối Firebase Realtime Gateway.');
            setLoading(false);
          }
        }
      );

      return () => {
        isMounted = false;
        if (unsubscribe) unsubscribe();
      };
    } else {
      // B. LOCAL SERVER HTTP FALLBACK
      setGatewayMode('local');
      fetch(`/api/sessions/${sessionId}/connect`, { method: 'POST' }).catch(() => {});

      const pollStatus = async () => {
        try {
          const res = await fetch(`/api/sessions/${sessionId}/status`);
          const json = await res.json();

          if (json.success && isMounted) {
            const data: SessionStatus = json.data;
            setStatus(data);
            setError(null);

            if (data.state === 'FINISHED') {
              setIsFinished(true);
            }
          } else if (!json.success && isMounted) {
            setError(json.error || 'Không tìm thấy phiên chụp.');
          }
        } catch {
          if (isMounted) {
            setError('Không thể kết nối tới Photobooth. Hãy kiểm tra kết nối mạng của bạn.');
          }
        } finally {
          if (isMounted) setLoading(false);
        }
      };

      pollStatus();
      const interval = setInterval(pollStatus, 600);

      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
  }, [sessionId]);

  // 2. Synced Countdown Animation
  useEffect(() => {
    if (status?.state === 'COUNTDOWN' && localCountdown === null) {
      setLocalCountdown(3);
      let count = 3;
      const timer = setInterval(() => {
        count--;
        if (count > 0) {
          setLocalCountdown(count);
        } else {
          setLocalCountdown(0);
          clearInterval(timer);
          setTimeout(() => {
            setLocalCountdown(null);
          }, 1500);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [status?.state]);

  // Actions
  const handleStartCapture = async () => {
    if (isTriggering) return;
    setIsTriggering(true);
    try {
      setLocalCountdown(3);
      if (gatewayMode === 'firebase') {
        await triggerCapture(sessionId);
      } else {
        await fetch(`/api/sessions/${sessionId}/trigger`, { method: 'POST' });
      }
    } catch {
      alert('Không thể bắt đầu chụp. Vui lòng thử lại!');
      setLocalCountdown(null);
    } finally {
      setIsTriggering(false);
    }
  };

  const handleRetake = async () => {
    if (!window.confirm('Bạn có muốn chụp lại tấm khác không?')) return;
    try {
      setLocalCountdown(null);
      if (gatewayMode === 'firebase') {
        await retakeSession(sessionId);
      } else {
        await fetch(`/api/sessions/${sessionId}/retake`, { method: 'POST' });
      }
    } catch {
      alert('Có lỗi khi yêu cầu chụp lại. Vui lòng thử lại.');
    }
  };

  const handleFinish = async () => {
    try {
      if (gatewayMode === 'firebase') {
        await finishSession(sessionId);
      } else {
        await fetch(`/api/sessions/${sessionId}/finish`, { method: 'POST' });
      }
      setIsFinished(true);
    } catch {
      setIsFinished(true);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    setIsDownloading(true);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch {
      window.open(url, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveFirebaseConfig = () => {
    try {
      const parsed = JSON.parse(configJsonInput);
      saveFirebaseConfig(parsed);
      setShowConfigModal(false);
      window.location.reload();
    } catch {
      alert('JSON không hợp lệ. Vui lòng dán đúng định dạng cấu hình Firebase SDK.');
    }
  };

  if (loading) {
    return (
      <div className="remote-container">
        <div className="remote-loading-spinner" />
        <p className="remote-status-text">Đang kết nối tới Photobooth Gateway...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="remote-container">
        <div className="remote-error-box">
          <div className="remote-error-icon">⚠️</div>
          <h2>Không thể kết nối</h2>
          <p>{error}</p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button className="remote-retry-btn" onClick={() => window.location.reload()}>
              Thử lại
            </button>
            <button
              className="remote-retry-btn"
              style={{ background: '#333', color: '#fff' }}
              onClick={() => setShowConfigModal(true)}
            >
              Cấu hình Firebase
            </button>
          </div>
        </div>

        {showConfigModal && (
          <div className="photo-modal" onClick={() => setShowConfigModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ background: '#1c1b22', padding: 20, borderRadius: 16 }}>
              <h3 style={{ color: '#d4af37' }}>Cấu hình Firebase Gateway</h3>
              <textarea
                style={{ width: '100%', height: 140, background: '#111', color: '#fff', padding: 8, borderRadius: 8, border: '1px solid #444' }}
                placeholder='Dán JSON cấu hình Firebase SDK vào đây...'
                value={configJsonInput}
                onChange={(e) => setConfigJsonInput(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button className="download-btn" onClick={handleSaveFirebaseConfig}>Lưu cấu hình</button>
                <button className="download-btn" onClick={() => setShowConfigModal(false)}>Đóng</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Thank-you / Completed screen
  if (isFinished) {
    return (
      <div className="remote-container">
        <header className="remote-header">
          <div className="wedding-rings-icon">💍</div>
          <h1 className="remote-names">{status?.coupleName || 'Huy & Trâm'}</h1>
          <p className="remote-subtitle">WEDDING PHOTOBOOTH</p>
        </header>

        <div className="remote-finished-card">
          <div className="finished-heart">💕</div>
          <h2>Cảm ơn bạn!</h2>
          <p>Ảnh kỷ niệm đã được lưu thành công. Chúc bạn có một buổi tiệc thật vui vẻ và đáng nhớ cùng cô dâu chú rể!</p>

          <button
            className="remote-new-session-btn"
            onClick={() => window.location.reload()}
          >
            Chụp lượt mới 📸
          </button>
        </div>
      </div>
    );
  }

  const isReady = status?.state === 'READY' && (status.stripUrl || status.photo);
  const isCountingDown = localCountdown !== null || status?.state === 'COUNTDOWN';
  const displayPhotoUrl = status?.stripUrl || status?.photo?.originalUrl;

  return (
    <div className="remote-container">
      {/* Wedding Header */}
      <header className="remote-header">
        <div className="wedding-rings-icon">💍</div>
        <h1 className="remote-names">{status?.coupleName || 'Huy & Trâm'}</h1>
        <p className="remote-subtitle">REMOTE CONTROLLER · PHOTOBOOTH</p>
        <div className="remote-connection-badge">
          <span className="pulse-dot"></span>
          Đã kết nối {gatewayMode === 'firebase' ? 'Firebase Gateway (Cloud)' : 'Local Gateway'}
        </div>
      </header>

      {/* Main Interactive Body */}
      <main className="remote-main">
        {/* State 1: COUNTDOWN */}
        {isCountingDown && (
          <div className="remote-countdown-card">
            <div className="remote-countdown-circle">
              <span className="remote-countdown-number">
                {localCountdown && localCountdown > 0 ? localCountdown : '📸'}
              </span>
            </div>
            <h2 className="countdown-prompt">
              {localCountdown && localCountdown > 0 ? 'Chuẩn bị tạo dáng!' : 'Cười lên nào! ✨'}
            </h2>
            <p className="countdown-hint">Hãy nhìn thẳng vào camera trên laptop nhé</p>
          </div>
        )}

        {/* State 2: PHOTO READY (View & Download) */}
        {!isCountingDown && isReady && displayPhotoUrl && (
          <div className="remote-result-card">
            <div className="result-header">
              <span className="result-badge">✨ ẢNH CỦA BẠN ĐÃ XONG!</span>
            </div>

            <div className="result-image-wrapper">
              <img
                src={displayPhotoUrl}
                alt="Ảnh cưới vừa chụp"
                className="result-image"
              />
            </div>

            {downloadSuccess && (
              <div className="download-success-toast">
                ✅ Đã tải ảnh thành công về máy!
              </div>
            )}

            <div className="result-actions">
              <button
                className="remote-download-btn"
                onClick={() => handleDownload(displayPhotoUrl, `huy-tram-wedding-${sessionId}.jpg`)}
                disabled={isDownloading}
              >
                {isDownloading ? '⏳ Đang tải xuống...' : '📥 Tải ảnh về điện thoại (Gốc)'}
              </button>

              <div className="action-row">
                <button className="remote-retake-btn" onClick={handleRetake}>
                  🔄 Chụp lại
                </button>
                <button className="remote-finish-btn" onClick={handleFinish}>
                  ✨ Hoàn tất
                </button>
              </div>
            </div>
          </div>
        )}

        {/* State 3: READY TO SHOOT (Shutter Button) */}
        {!isCountingDown && !isReady && (
          <div className="remote-shutter-card">
            <div className="instruction-box">
              <p className="instruction-lead">Bạn đã sẵn sàng chưa?</p>
              <p className="instruction-sub">
                Đứng trước camera máy tính, tạo dáng cùng nhau rồi bấm nút chụp bên dưới nhé!
              </p>
            </div>

            <div className="shutter-button-wrapper">
              <button
                className="big-shutter-button"
                onClick={handleStartCapture}
                disabled={isTriggering}
              >
                <div className="shutter-inner">
                  <span className="shutter-icon">📸</span>
                  <span className="shutter-label">BẮT ĐẦU CHỤP</span>
                  <span className="shutter-sub">Đếm ngược 3 giây</span>
                </div>
              </button>
            </div>

            <div className="remote-tip">
              💡 Máy tính sẽ đếm ngược 3-2-1 và tự động chụp 1 tấm ảnh kỷ niệm cho bạn
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="remote-footer">
        <p>HUY &amp; TRÂM WEDDING · 15.03.2025</p>
        <p className="sub-lan-info">
          {gatewayMode === 'firebase' ? '🌐 Cloud Gateway · Hoạt động với 4G/5G' : 'Mạng nội bộ · Không cần Internet'}
        </p>
      </footer>
    </div>
  );
}
