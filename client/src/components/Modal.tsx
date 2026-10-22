import React from 'react';
import './Modal.css';

const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card animate-fade-up">
        <div className="modal-header">
          <h3>{title}</h3>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};
export default Modal;
