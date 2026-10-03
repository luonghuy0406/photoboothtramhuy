import React from 'react';

export function ErrorView({ message }: { message: string }) {
  return (
    <div className="error-view">
      <div className="error-icon">😅</div>
      <h2>Oops!</h2>
      <p>{message}</p>
      <button onClick={() => window.location.reload()} className="retry-btn">
        Thử lại
      </button>
    </div>
  );
}
