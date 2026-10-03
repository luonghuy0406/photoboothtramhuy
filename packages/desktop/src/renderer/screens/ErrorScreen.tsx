import React from 'react';
import { useSessionStore } from '../stores/sessionStore';

export function ErrorScreen() {
  const reset = useSessionStore((s) => s.reset);
  const error = useSessionStore((s) => s.error);

  return (
    <div className="screen error-screen">
      <div className="error-card">
        <span className="error-emoji">⚠️</span>
        <h2 className="error-heading">Đã xảy ra sự cố</h2>
        <p className="error-description">{error || 'Không thể kết nối máy ảnh hoặc máy chủ.'}</p>
        <button className="retry-button" onClick={reset}>
          Quay lại trang chủ 🔄
        </button>
      </div>
    </div>
  );
}
