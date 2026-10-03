import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { webcam } from '../utils/webcam';
import { sound } from '../utils/audio';
import { motion, AnimatePresence } from 'framer-motion';
import {
  initFirebaseGateway,
  createCloudSession,
  listenToCloudSession,
  uploadPhotoToFirebaseStorage,
  markCloudSessionReady,
  saveStoredFirebaseConfig,
  getStoredFirebaseConfig,
} from '../utils/firebaseGateway';
import type { FirebaseSessionDoc } from '@photobooth/shared';

interface WifiData {
  ssid: string;
  password?: string;
  auth?: string;
  qrCode: string;
}

interface ActiveSessionData {
  sessionId: string;
  state: string;
  remoteUrl: string;
  qrCode: string;
  wifi?: WifiData;
  stripUrl?: string | null;
  photos?: Array<{ id: string; originalUrl: string; thumbnailUrl: string }>;
}

export function TouchlessKiosk() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeSession, setActiveSession] = useState<ActiveSessionData | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flashing, setFlashing] = useState<boolean>(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Đang sẵn sàng...');
  const [adminOpen, setAdminOpen] = useState<boolean>(false);
  const [cameraStatus, setCameraStatus] = useState<string>('connected');
  const [qrMode, setQrMode] = useState<'capture' | 'wifi'>('capture');

  // Vercel & Firebase Gateway states
  const [vercelDomain, setVercelDomain] = useState<string>(() => {
    return localStorage.getItem('kiosk_vercel_domain') || '';
  });
  const [vercelQrCode, setVercelQrCode] = useState<string | null>(null);
  const [firebaseConfigInput, setFirebaseConfigInput] = useState<string>(() => {
    const saved = getStoredFirebaseConfig();
    return saved ? JSON.stringify(saved, null, 2) : '';
  });
  const [isCloudActive, setIsCloudActive] = useState<boolean>(false);

  // Wi-Fi Config form states in Admin modal
  const [wifiSsidInput, setWifiSsidInput] = useState<string>('');
  const [wifiPassInput, setWifiPassInput] = useState<string>('');
  const [savingWifi, setSavingWifi] = useState<boolean>(false);

  const serverUrl = 'http://127.0.0.1:3000';

  // 1. Initialize webcam live stream & Firebase check
  useEffect(() => {
    let isMounted = true;
    const initCamera = async () => {
      const stream = await webcam.startStream();
      if (stream && videoRef.current && isMounted) {
        webcam.attachToVideo(videoRef.current);
      }
    };
    initCamera();

    const { isConfigured } = initFirebaseGateway();
    setIsCloudActive(isConfigured);

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Poll active session status from server
  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      try {
        const res = await fetch(`${serverUrl}/api/active-session`);
        const json = await res.json();
        if (json?.success && json?.data && isMounted) {
          const data: ActiveSessionData = json.data;
          setActiveSession(data);

          // If Vercel domain is configured, generate QR code pointing to Vercel URL
          if (vercelDomain.trim()) {
            const cleanDomain = vercelDomain.trim().replace(/\/$/, '');
            const targetUrl = `${cleanDomain}/remote/${data.sessionId}`;
            try {
              const vQr = await QRCode.toDataURL(targetUrl, { width: 400, margin: 2 });
              setVercelQrCode(vQr);
            } catch (e) {
              console.error('Vercel QR generate error:', e);
            }
          } else {
            setVercelQrCode(null);
          }

          // Pre-populate Wi-Fi inputs if empty
          if (!wifiSsidInput && data.wifi?.ssid) {
            setWifiSsidInput(data.wifi.ssid);
          }
          if (!wifiPassInput && data.wifi?.password) {
            setWifiPassInput(data.wifi.password);
          }

          // Update status text based on remote state
          if (data.state === 'WAITING_GUEST') {
            setStatusMessage('📱 Hãy quét mã QR để bắt đầu chụp ảnh');
            setCapturedPhotoUrl(null);
            setCountdown(null);
          } else if (data.state === 'GUEST_CONNECTED') {
            setStatusMessage('✨ Điện thoại đã kết nối! Hãy tạo dáng và bấm chụp trên điện thoại nhé');
            setQrMode('capture');
          } else if (data.state === 'COUNTDOWN' && countdown === null && !capturedPhotoUrl) {
            startCountdown(data.sessionId);
          } else if (data.state === 'READY' && data.stripUrl) {
            setCapturedPhotoUrl(data.stripUrl);
            setStatusMessage('💕 Ảnh đã được gửi về điện thoại của bạn!');
          }
        }
      } catch {
        // server booting
      }
    };

    fetchSession();
    const interval = setInterval(fetchSession, 600);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [countdown, capturedPhotoUrl, wifiSsidInput, wifiPassInput, vercelDomain]);

  // 3. Realtime Cloud sync via Firebase (if configured)
  useEffect(() => {
    if (!activeSession?.sessionId) return;
    const { isConfigured } = initFirebaseGateway();
    if (!isConfigured) return;

    // Create / ensure cloud session exists
    createCloudSession(activeSession.sessionId, {
      coupleName: 'Huy & Trâm',
      eventName: 'Huy & Trâm Wedding Photobooth',
    });

    // Listen to real-time phone updates from Firebase
    const unsubscribe = listenToCloudSession(activeSession.sessionId, (cloudDoc: FirebaseSessionDoc) => {
      if (cloudDoc.state === 'GUEST_CONNECTED') {
        setStatusMessage('✨ Điện thoại đã kết nối qua Firebase Cloud Gateway!');
        setQrMode('capture');
      } else if (cloudDoc.state === 'COUNTDOWN' && countdown === null && !capturedPhotoUrl) {
        startCountdown(activeSession.sessionId);
      } else if (cloudDoc.state === 'FINISHED') {
        advanceToNextSession();
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeSession?.sessionId, countdown, capturedPhotoUrl]);

  // 4. Countdown & Capture sequence
  const startCountdown = (sessionId: string) => {
    setCountdown(3);
    sound.playBeep(false);

    let current = 3;
    const timer = setInterval(() => {
      current--;
      if (current === 2) {
        sound.playBeep(false);
        setCountdown(2);
      } else if (current === 1) {
        sound.playBeep(true);
        setCountdown(1);
      } else if (current <= 0) {
        clearInterval(timer);
        setCountdown(0);
        executeCapture(sessionId);
      }
    }, 1000);
  };

  const executeCapture = async (sessionId: string) => {
    sound.playShutter();
    setFlashing(true);
    setTimeout(() => setFlashing(false), 450);

    const imageBase64 = webcam.captureSnapshot(0.95);

    try {
      setStatusMessage('Đang xử lý ảnh cưới...');
      const capRes = await fetch(`${serverUrl}/api/camera/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          shotIndex: 0,
          imageBase64: imageBase64 || undefined,
        }),
      });
      const capJson = await capRes.json();

      if (!capJson.success) {
        throw new Error(capJson.error || 'Chụp ảnh thất bại');
      }

      // Process single-photo wedding frame
      const procRes = await fetch(`${serverUrl}/api/sessions/${sessionId}/process`, {
        method: 'POST',
      });
      const procJson = await procRes.json();

      if (procJson.success && procJson.data) {
        const localStripUrl = procJson.data.stripUrl;
        setCapturedPhotoUrl(localStripUrl);
        setStatusMessage('💕 Ảnh đã gửi về điện thoại của bạn!');

        // Upload to Firebase Storage & mark cloud doc READY (if cloud active)
        const { isConfigured } = initFirebaseGateway();
        if (isConfigured) {
          setStatusMessage('☁️ Đang đồng bộ ảnh lên Firebase Cloud...');
          const cloudUrl = await uploadPhotoToFirebaseStorage(sessionId, localStripUrl);
          await markCloudSessionReady(sessionId, cloudUrl || localStripUrl);
          setStatusMessage('💕 Ảnh đã đồng bộ lên điện thoại của bạn!');
        }

        // Auto-advance after 14s
        setTimeout(() => {
          advanceToNextSession();
        }, 14000);
      }
    } catch (err) {
      console.error('Capture error:', err);
      setStatusMessage('Đã có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setCountdown(null);
    }
  };

  const advanceToNextSession = async () => {
    try {
      setCapturedPhotoUrl(null);
      setCountdown(null);
      const res = await fetch(`${serverUrl}/api/sessions/next`, { method: 'POST' });
      const json = await res.json();
      if (json.success && json.data) {
        setActiveSession(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const checkCamera = async () => {
    try {
      const res = await fetch(`${serverUrl}/api/camera/status`);
      const json = await res.json();
      setCameraStatus(json?.data?.status || 'unknown');
    } catch {
      setCameraStatus('offline');
    }
  };

  const handleSaveWifi = async () => {
    if (!wifiSsidInput.trim()) {
      alert('Vui lòng nhập tên Wi-Fi (SSID)');
      return;
    }
    setSavingWifi(true);
    try {
      const res = await fetch(`${serverUrl}/api/config/wifi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ssid: wifiSsidInput.trim(),
          password: wifiPassInput.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert(`✅ Đã cập nhật mạng Wi-Fi: ${wifiSsidInput}! Mã QR Wi-Fi đã được tạo mới.`);
        setAdminOpen(false);
        setQrMode('wifi');
      }
    } catch {
      alert('Không thể lưu cấu hình Wi-Fi. Vui lòng thử lại.');
    } finally {
      setSavingWifi(false);
    }
  };

  const handleSaveVercelDomain = () => {
    const clean = vercelDomain.trim();
    localStorage.setItem('kiosk_vercel_domain', clean);
    alert(`✅ Đã lưu tên miền Vercel: ${clean || '(Không dùng, quay về IP local)'}`);
  };

  const handleSaveFirebaseConfig = () => {
    try {
      const parsed = JSON.parse(firebaseConfigInput.trim());
      saveStoredFirebaseConfig(parsed);
      const { isConfigured } = initFirebaseGateway();
      setIsCloudActive(isConfigured);
      alert('✅ Đã lưu cấu hình Firebase Cloud Gateway thành công!');
    } catch {
      alert('JSON không hợp lệ. Vui lòng dán đúng định dạng cấu hình Firebase SDK.');
    }
  };

  const displayQrCode = vercelQrCode || activeSession?.qrCode;
  const currentRemoteUrl = vercelDomain.trim()
    ? `${vercelDomain.trim().replace(/\/$/, '')}/remote/${activeSession?.sessionId}`
    : activeSession?.remoteUrl;

  return (
    <div className="touchless-kiosk-container">
      {/* Flash overlay */}
      {flashing && <div className="flash-overlay" />}

      {/* Main Background: Live Webcam Video Feed */}
      <div className="touchless-live-view">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="touchless-video-feed mirrored"
        />

        {/* Captured Photo Overlay when ready */}
        {capturedPhotoUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="touchless-captured-preview"
          >
            <img src={capturedPhotoUrl} alt="Ảnh vừa chụp" className="captured-result-img" />
            <div className="photo-sent-badge">
              <span>📱 Đã gửi về điện thoại của bạn</span>
            </div>
          </motion.div>
        )}

        {/* Countdown overlay */}
        <AnimatePresence>
          {countdown !== null && (
            <motion.div
              key={countdown}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="touchless-countdown-overlay"
            >
              <span className="touchless-countdown-text">
                {countdown > 0 ? countdown : 'Cười lên nào! ✨'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sidebar: Wedding Info & Dynamic QR Code Card */}
      <div className="touchless-sidebar">
        {/* Admin trigger button at top right */}
        <button
          className="touchless-gear-btn"
          onClick={() => {
            setAdminOpen(true);
            checkCamera();
          }}
          title="Cài đặt Vercel, Firebase & Hệ thống"
        >
          ⚙
        </button>

        <div className="wedding-brand">
          <p className="wedding-date">15 · 03 · 2025</p>
          <h1 className="wedding-couples">Huy &amp; Trâm</h1>
          <div className="wedding-gold-line" />
          <p className="wedding-sub">DIGITAL PHOTOBOOTH</p>
        </div>

        {/* Interactive Dual-Mode QR Card */}
        <div className="touchless-qr-card">
          {/* Tab Selector: Wi-Fi vs Capture */}
          <div className="qr-tabs-nav">
            <button
              className={`qr-nav-tab ${qrMode === 'capture' ? 'active' : ''}`}
              onClick={() => setQrMode('capture')}
            >
              📸 2. Chụp &amp; Nhận ảnh
            </button>
            <button
              className={`qr-nav-tab ${qrMode === 'wifi' ? 'active' : ''}`}
              onClick={() => setQrMode('wifi')}
            >
              📶 1. Vào Wi-Fi
            </button>
          </div>

          {/* TAB 1: WI-FI AUTO-CONNECT QR */}
          {qrMode === 'wifi' && (
            <>
              <div className="qr-badge wifi-badge-accent">📶 KẾT NỐI WI-FI TỰ ĐỘNG</div>
              <div className="qr-box-inner">
                {activeSession?.wifi?.qrCode ? (
                  <img
                    src={activeSession.wifi.qrCode}
                    alt="Quét mã QR để vào Wi-Fi"
                    className="touchless-qr-img"
                  />
                ) : (
                  <div className="qr-loading">Đang tải mã Wi-Fi...</div>
                )}
              </div>
              <div className="qr-instructions-box">
                <p className="qr-main-instruction">
                  Quét mã bằng Camera điện thoại để <strong>tự động vào mạng Wi-Fi</strong>
                </p>
                <div className="wifi-info-pill">
                  Tên mạng: <strong>{activeSession?.wifi?.ssid || 'HUY-TRAM-PHOTO'}</strong>
                  {activeSession?.wifi?.password ? (
                    <span> · Pass: <strong>{activeSession.wifi.password}</strong></span>
                  ) : (
                    <span> (Không mật khẩu)</span>
                  )}
                </div>
                <button
                  className="switch-qr-sub-btn"
                  onClick={() => setQrMode('capture')}
                >
                  Đã kết nối Wi-Fi? Bấm để Chụp ảnh ➔
                </button>
              </div>
            </>
          )}

          {/* TAB 2: REMOTE CAPTURE & GALLERY QR */}
          {qrMode === 'capture' && (
            <>
              <div className="qr-badge">
                {vercelDomain.trim() ? '🌐 CLOUD VERCEL · 4G/5G' : 'LƯỢT CHỤP CỦA BẠN'}
              </div>
              <div className="qr-box-inner">
                {displayQrCode ? (
                  <img
                    src={displayQrCode}
                    alt="Quét mã QR để chụp"
                    className="touchless-qr-img"
                  />
                ) : (
                  <div className="qr-loading">Đang tạo mã QR...</div>
                )}
              </div>
              <div className="qr-instructions-box">
                <p className="qr-main-instruction">
                  Mở <strong>Camera điện thoại</strong> quét mã để bấm chụp &amp; lấy ảnh
                </p>
                {vercelDomain.trim() ? (
                  <div className="wifi-info-pill">
                    🌐 Hoạt động với <strong>4G/5G bất kỳ</strong>
                  </div>
                ) : (
                  <button
                    className="switch-qr-sub-btn"
                    onClick={() => setQrMode('wifi')}
                  >
                    📶 Chưa vào Wi-Fi? <strong>Bấm vào đây để quét mã Wi-Fi</strong>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Status Callout Banner */}
        <div className={`touchless-status-banner ${activeSession?.state}`}>
          <p>{statusMessage}</p>
        </div>

        {/* Next session button */}
        {capturedPhotoUrl && (
          <button className="start-button next-guest-touchless-btn" onClick={advanceToNextSession}>
            Lượt tiếp theo ➔
          </button>
        )}
      </div>

      {/* Admin Dashboard Modal */}
      {adminOpen && (
        <div className="admin-modal-backdrop" onClick={() => setAdminOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-header">
              <h2>⚙ Quản Trị &amp; Cài Đặt Kết Nối</h2>
              <button className="admin-close-btn" onClick={() => setAdminOpen(false)}>
                ✕
              </button>
            </div>
            <div className="admin-body">
              {/* Vercel Public URL Section */}
              <div className="admin-item-block">
                <h3>🌐 Tên Miền Vercel (Dành Cho 4G / Internet)</h3>
                <p className="admin-item-desc">
                  Nhập link website đã deploy lên Vercel. Mã QR trên màn hình sẽ tự động trỏ tới link này để khách dùng 4G quét:
                </p>
                <div className="admin-wifi-form">
                  <div className="admin-field">
                    <label>Link Vercel Frontend:</label>
                    <input
                      type="text"
                      className="admin-input-text"
                      placeholder="VD: https://photobooth-huy-tram.vercel.app"
                      value={vercelDomain}
                      onChange={(e) => setVercelDomain(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={handleSaveVercelDomain}
                    className="small-btn primary full-width-btn"
                  >
                    💾 Lưu Tên Miền Vercel
                  </button>
                </div>
              </div>

              {/* Firebase Cloud Gateway Section */}
              <div className="admin-item-block">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>🔥 Firebase Cloud Gateway</h3>
                  <span className={`status-badge ${isCloudActive ? 'connected' : 'offline'}`}>
                    {isCloudActive ? 'ĐANG KẾT NỐI' : 'CHƯA CẤU HÌNH'}
                  </span>
                </div>
                <p className="admin-item-desc">
                  Dán cấu hình JSON của Firebase SDK (tạo miễn phí tại console.firebase.google.com):
                </p>
                <div className="admin-wifi-form">
                  <textarea
                    className="admin-input-text"
                    style={{ height: 110, fontFamily: 'monospace', fontSize: '0.8rem' }}
                    placeholder='{"apiKey": "AIza...", "projectId": "...", ...}'
                    value={firebaseConfigInput}
                    onChange={(e) => setFirebaseConfigInput(e.target.value)}
                  />
                  <button
                    onClick={handleSaveFirebaseConfig}
                    className="small-btn primary full-width-btn"
                  >
                    🔥 Lưu Cấu Hình Firebase Gateway
                  </button>
                </div>
              </div>

              {/* Local Wi-Fi Section as backup */}
              <div className="admin-item-block">
                <h3>📶 Cấu Hình Wi-Fi Dự Phòng (Nội Bộ)</h3>
                <div className="admin-wifi-form">
                  <div className="admin-field">
                    <label>Tên Wi-Fi (SSID):</label>
                    <input
                      type="text"
                      className="admin-input-text"
                      placeholder="VD: HUY-TRAM-PHOTO"
                      value={wifiSsidInput}
                      onChange={(e) => setWifiSsidInput(e.target.value)}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Mật khẩu Wi-Fi:</label>
                    <input
                      type="text"
                      className="admin-input-text"
                      placeholder="Mật khẩu (bỏ trống nếu không có)"
                      value={wifiPassInput}
                      onChange={(e) => setWifiPassInput(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={handleSaveWifi}
                    disabled={savingWifi}
                    className="small-btn primary full-width-btn"
                  >
                    {savingWifi ? 'Đang lưu...' : '💾 Lưu & Tạo Mã QR Wi-Fi'}
                  </button>
                </div>
              </div>

              <div className="admin-divider" />

              <div className="admin-item">
                <label>Trạng thái Máy ảnh:</label>
                <span className={`status-badge ${cameraStatus}`}>
                  {cameraStatus.toUpperCase()} (Laptop Webcam HD)
                </span>
              </div>

              <div className="admin-item">
                <label>Đổi sang Lượt chụp mới ngay:</label>
                <button
                  onClick={() => {
                    advanceToNextSession();
                    setAdminOpen(false);
                  }}
                  className="small-btn primary"
                >
                  🔄 Tạo mã QR cho lượt mới
                </button>
              </div>

              <div className="admin-item">
                <label>Link Khách Đang Dùng:</label>
                <code style={{ wordBreak: 'break-all' }}>{currentRemoteUrl}</code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
