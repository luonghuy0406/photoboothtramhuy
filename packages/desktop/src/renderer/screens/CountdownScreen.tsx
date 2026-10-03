import React, { useEffect, useRef, useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { sound } from '../utils/audio';
import { webcam } from '../utils/webcam';
import { motion, AnimatePresence } from 'framer-motion';

export function CountdownScreen() {
  const transition = useSessionStore((s) => s.transition);
  const currentShot = useSessionStore((s) => s.currentShot);
  const totalShots = useSessionStore((s) => s.totalShots);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [count, setCount] = useState<number>(3);

  useEffect(() => {
    // Attach ongoing webcam stream to background
    if (videoRef.current) {
      webcam.attachToVideo(videoRef.current);
    }

    // Play initial countdown beep
    sound.playBeep(false);

    const interval = setInterval(() => {
      setCount((prev) => {
        if (prev === 2) {
          sound.playBeep(false);
          return 1;
        }
        if (prev === 1) {
          sound.playBeep(true);
          return 0;
        }
        if (prev <= 0) {
          clearInterval(interval);
          transition('COUNTDOWN_DONE');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [transition]);

  return (
    <div className="screen countdown-screen">
      {/* Live background video so guests can see themselves */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="countdown-bg-video mirrored"
      />

      <div className="countdown-overlay">
        <div className="shot-indicator">
          ẢNH {currentShot + 1} / {totalShots}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={count}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="countdown-number"
          >
            {count > 0 ? count : 'Cười lên nào! ✨'}
          </motion.div>
        </AnimatePresence>

        <p className="countdown-hint">Tạo dáng thật tự tin nhé!</p>
      </div>
    </div>
  );
}
