import React from 'react';

const LoadingSpinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
    <div style={{
      width: '40px', height: '40px',
      border: '4px solid var(--border-glass)',
      borderTop: '4px solid var(--accent-cyan)',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
  </div>
);

export default LoadingSpinner;
