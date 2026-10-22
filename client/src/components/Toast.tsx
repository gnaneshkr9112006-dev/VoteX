import React, { useEffect } from 'react';
import './Toast.css';

const Toast = ({ message, type = 'info', onClose }: { message: string, type?: 'info' | 'success' | 'error', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast toast-${type} animate-fade-up`}>
      {message}
    </div>
  );
};
export default Toast;
