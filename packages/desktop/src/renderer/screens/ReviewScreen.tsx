import React, { useEffect, useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { motion } from 'framer-motion';

export function ReviewScreen() {
  const transition = useSessionStore((s) => s.transition);
  const photos = useSessionStore((s) => s.photos);
  const retake = useSessionStore((s) => s.retake);

  const [autoTimeout, setAutoTimeout] = useState<number>(30);

  useEffect(() => {
    const timer = setInterval(() => {
      setAutoTimeout((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          transition('CONFIRM'); // Auto-confirm if guests walk away
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [transition]);

  return (
    <motion.div
      className="screen review-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="review-header">
        <h2 className="review-title">Xem Lại Ảnh</h2>
        <p className="review-subtitle">Bạn có muốn giữ 3 kiểu ảnh này không?</p>
      </div>

      <div className="photos-review-grid">
        {photos.map((photo, idx) => (
          <motion.div
            key={photo.id || idx}
            className="review-photo-card"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: idx * 0.15 }}
          >
            <img
              src={(photo as any).thumbnailUrl || (photo as any).originalUrl || photo.originalPath}
              alt={`Ảnh ${idx + 1}`}
              className="review-img"
            />
            <span className="card-badge">#{idx + 1}</span>
          </motion.div>
        ))}
      </div>

      <div className="review-actions">
        <button className="review-btn retake-btn" onClick={retake}>
          🔄 Chụp lại lượt này
        </button>

        <button
          className="review-btn confirm-btn pulse"
          onClick={() => transition('CONFIRM')}
        >
          ✨ Lấy ảnh ngay ({autoTimeout}s)
        </button>
      </div>
    </motion.div>
  );
}
