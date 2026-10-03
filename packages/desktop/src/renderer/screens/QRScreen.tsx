import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { motion } from 'framer-motion';

export function QRScreen() {
  const transition = useSessionStore((s) => s.transition);
  const reset = useSessionStore((s) => s.reset);
  const qrCode = useSessionStore((s) => s.qrCode);
  const stripUrl = useSessionStore((s) => s.stripUrl);
  const guestUrl = useSessionStore((s) => s.guestUrl);

  const [countdown, setCountdown] = useState<number>(25);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          reset();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [reset]);

  const handleFinish = () => {
    reset();
  };

  return (
    <motion.div
      className="screen qr-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="qr-screen-layout">
        {/* Left Side: Photo strip preview */}
        {stripUrl && (
          <div className="qr-strip-preview-col">
            <h3 className="section-label">Ảnh của bạn</h3>
            <div className="strip-container">
              <img src={stripUrl} alt="Photo Strip" className="completed-strip-img" />
            </div>
          </div>
        )}

        {/* Right Side: QR Code & Download Instructions */}
        <div className="qr-download-col">
          <h2 className="qr-heading">Quét QR Để Tải Ảnh 📱</h2>

          <div className="wifi-notice-box">
            <span className="wifi-icon">📶</span>
            <div>
              <p className="wifi-name">
                Kết nối Wi-Fi: <strong>HUY-TRAM-PHOTO</strong>
              </p>
              <p className="wifi-sub">Mạng nội bộ riêng · Không cần Internet</p>
            </div>
          </div>

          <div className="qr-frame">
            {qrCode ? (
              <img src={qrCode} alt="QR Code" className="qr-image" />
            ) : (
              <div className="qr-placeholder-loading">Đang tải mã QR...</div>
            )}
          </div>

          <p className="qr-instructions">
            Mở <strong>Camera trên điện thoại</strong> và hướng vào mã QR để xem &amp; tải ảnh gốc
          </p>

          {guestUrl && (
            <p className="guest-url-text">
              Hoặc truy cập: <code>{guestUrl}</code>
            </p>
          )}

          <div className="qr-footer-actions">
            <p className="countdown-auto-hint">
              Màn hình tự về trang chủ sau: <strong>{countdown}s</strong>
            </p>

            <button className="start-button next-guest-btn" onClick={handleFinish}>
              Hoàn tất / Lượt tiếp theo ✨
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
