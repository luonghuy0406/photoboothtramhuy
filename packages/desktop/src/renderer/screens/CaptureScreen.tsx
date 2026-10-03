import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { sound } from '../utils/audio';
import { webcam } from '../utils/webcam';
import { motion } from 'framer-motion';

export function CaptureScreen() {
  const transition = useSessionStore((s) => s.transition);
  const sessionId = useSessionStore((s) => s.sessionId);
  const currentShot = useSessionStore((s) => s.currentShot);
  const totalShots = useSessionStore((s) => s.totalShots);
  const cameraSource = useSessionStore((s) => s.cameraSource);
  const addPhoto = useSessionStore((s) => s.addPhoto);
  const setError = useSessionStore((s) => s.setError);
  const serverUrl = useSessionStore((s) => s.serverUrl);

  const [flashing, setFlashing] = useState<boolean>(true);
  const [capturedThumb, setCapturedThumb] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string>('Đang chụp ảnh...');

  useEffect(() => {
    let isMounted = true;

    const performCapture = async () => {
      // 1. Play shutter sound & trigger flash effect
      sound.playShutter();
      setFlashing(true);
      setTimeout(() => {
        if (isMounted) setFlashing(false);
      }, 400);

      // 2. Capture frame from Laptop Webcam if active/fallback
      let imageBase64: string | undefined;
      if (cameraSource === 'webcam' || cameraSource === 'auto') {
        const snapshot = webcam.captureSnapshot(0.95);
        if (snapshot) {
          imageBase64 = snapshot;
        }
      }

      try {
        // 3. Send capture request to server
        const response = await fetch(`${serverUrl}/api/camera/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            shotIndex: currentShot,
            imageBase64,
          }),
        });

        const json = await response.json();

        if (!json.success || !json.data) {
          throw new Error(json.error || 'Lỗi chụp ảnh từ máy ảnh');
        }

        const photoData = json.data;
        if (!isMounted) return;

        // 4. Save photo into session store
        addPhoto(photoData);
        setCapturedThumb(photoData.thumbnailUrl || photoData.originalUrl);

        const isLastShot = currentShot + 1 >= totalShots;

        if (isLastShot) {
          // Finished all 3 shots, release camera stream for battery/privacy
          webcam.stopStream();
          setStatusText('Đã hoàn thành 3 kiểu ảnh!');
          setTimeout(() => {
            if (isMounted) transition('CAPTURE_DONE');
          }, 1500);
        } else {
          setStatusText(`Đẹp lắm! Chuẩn bị cho kiểu ảnh ${currentShot + 2}/${totalShots}...`);
          setTimeout(() => {
            if (isMounted) transition('NEXT_SHOT');
          }, 1800);
        }
      } catch (err) {
        console.error('Capture error:', err);
        if (isMounted) {
          setError(String(err));
        }
      }
    };

    performCapture();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="screen capture-screen">
      {/* White flash overlay */}
      {flashing && <div className="flash-overlay" />}

      <div className="capture-content">
        <h2 className="capture-status">{statusText}</h2>

        {capturedThumb ? (
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="captured-preview-box"
          >
            <img src={capturedThumb} alt="Vừa chụp" className="captured-thumb-img" />
            <div className="shot-badge">Ảnh {currentShot + 1} / {totalShots}</div>
          </motion.div>
        ) : (
          <div className="capture-loading-spinner" />
        )}
      </div>
    </div>
  );
}
