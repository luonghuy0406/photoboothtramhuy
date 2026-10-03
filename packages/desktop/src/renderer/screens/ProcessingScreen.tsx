import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { motion } from 'framer-motion';

export function ProcessingScreen() {
  const transition = useSessionStore((s) => s.transition);
  const sessionId = useSessionStore((s) => s.sessionId);
  const setStripUrl = useSessionStore((s) => s.setStripUrl);
  const setQrCode = useSessionStore((s) => s.setQrCode);
  const setGuestUrl = useSessionStore((s) => s.setGuestUrl);
  const setError = useSessionStore((s) => s.setError);
  const serverUrl = useSessionStore((s) => s.serverUrl);

  const [statusMessage, setStatusMessage] = useState('Đang ghép photo strip cưới...');

  useEffect(() => {
    let isMounted = true;

    const processSession = async () => {
      try {
        if (!sessionId) {
          throw new Error('Không tìm thấy phiên chụp hợp lệ');
        }

        setStatusMessage('Đang ghép 3 ảnh thành photo strip...');
        const response = await fetch(`${serverUrl}/api/sessions/${sessionId}/process`, {
          method: 'POST',
        });

        const json = await response.json();

        if (!json.success || !json.data) {
          throw new Error(json.error || 'Lỗi xử lý ảnh photo strip');
        }

        if (!isMounted) return;

        setStatusMessage('Đang khởi tạo mã QR tải ảnh...');
        setStripUrl(json.data.stripUrl);
        setQrCode(json.data.qrCode);
        setGuestUrl(json.data.guestUrl);

        setTimeout(() => {
          if (isMounted) transition('STRIP_READY');
        }, 800);
      } catch (err) {
        console.error('Processing error:', err);
        if (isMounted) setError(String(err));
      }
    };

    processSession();

    return () => {
      isMounted = false;
    };
  }, [sessionId, serverUrl, setStripUrl, setQrCode, setGuestUrl, setError, transition]);

  return (
    <div className="screen processing-screen">
      <div className="processing-content">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}
          className="gold-spinner"
        />

        <h2 className="processing-title">Vui lòng chờ giây lát</h2>
        <p className="processing-message">{statusMessage}</p>
      </div>
    </div>
  );
}
