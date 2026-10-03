import React, { useEffect, useRef, useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { webcam } from '../utils/webcam';
import { motion } from 'framer-motion';

export function PreviewScreen() {
  const transition = useSessionStore((s) => s.transition);
  const serverUrl = useSessionStore((s) => s.serverUrl);
  const cameraSource = useSessionStore((s) => s.cameraSource);
  const setCameraSource = useSessionStore((s) => s.setCameraSource);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [autoTimer, setAutoTimer] = useState<number>(6);
  const [cameraLabel, setCameraLabel] = useState<string>('Đang dò máy ảnh...');

  useEffect(() => {
    let isMounted = true;

    const setupCamera = async () => {
      // 1. Check if Canon M50 is connected on server
      try {
        const res = await fetch(`${serverUrl}/api/camera/status`);
        const json = await res.json();
        const isCanon = json?.data?.isCanonConnected;

        if (isMounted) {
          if (isCanon && cameraSource !== 'webcam') {
            setCameraLabel('Canon EOS M50 (USB)');
            setCameraSource('canon');
          } else {
            setCameraLabel('Laptop Webcam (FaceTime HD)');
            setCameraSource('webcam');
          }
        }
      } catch {
        if (isMounted) {
          setCameraLabel('Laptop Webcam (FaceTime HD)');
          setCameraSource('webcam');
        }
      }

      // 2. Start laptop webcam stream for live video feed
      const stream = await webcam.startStream();
      if (stream && videoRef.current && isMounted) {
        webcam.attachToVideo(videoRef.current);
      }
    };

    setupCamera();

    // 3. Auto-timer
    const interval = setInterval(() => {
      setAutoTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          transition('CAMERA_READY');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [serverUrl, cameraSource, setCameraSource, transition]);

  return (
    <motion.div
      className="screen preview-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="preview-container">
        <h2 className="preview-title">Chuẩn bị vị trí chụp</h2>
        <p className="preview-subtitle">
          Khuyến nghị: 1 - 4 người · Đứng vào giữa khung hình và nhìn thẳng ống kính
        </p>

        {/* Live video viewfinder */}
        <div className="viewfinder">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="viewfinder-feed mirrored"
          />

          <div className="viewfinder-overlay">
            <div className="pose-guide-box">
              <span className="camera-source-tag">📷 {cameraLabel}</span>
            </div>

            <div className="viewfinder-corners">
              <span className="corner-bracket bracket-tl" />
              <span className="corner-bracket bracket-tr" />
              <span className="corner-bracket bracket-bl" />
              <span className="corner-bracket bracket-br" />
            </div>
          </div>
        </div>

        <div className="preview-footer">
          <p className="auto-timer-hint">
            Tự động đếm ngược sau <strong>{autoTimer}s</strong>
          </p>
          <button
            className="start-button ready-btn"
            onClick={() => transition('CAMERA_READY')}
          >
            Sẵn sàng ngay! ⚡
          </button>
        </div>
      </div>
    </motion.div>
  );
}
