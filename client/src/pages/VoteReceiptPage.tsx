import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Download, Home } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const VoteReceiptPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const receipt = location.state?.receipt;

  if (!receipt) {
    return <div>No receipt found.</div>;
  }

  const handleFinish = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="animate-fade-up text-center">
      <CheckCircle2 size={80} color="var(--accent-emerald)" style={{ margin: '0 auto 2rem' }} />
      <h1 className="heading-lg mb-4 text-gradient" style={{ backgroundImage: 'var(--gradient-emerald)' }}>Vote Successfully Cast!</h1>
      
      <div className="glass-card" style={{ maxWidth: '500px', margin: '0 auto 2rem', textAlign: 'left' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label className="text-secondary">Receipt Code</label>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', wordBreak: 'break-all' }}>{receipt.receipt_code}</p>
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label className="text-secondary">Transaction Hash</label>
          <p style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '4px', wordBreak: 'break-all' }}>
            {receipt.tx_hash}
          </p>
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label className="text-secondary">Timestamp</label>
          <p>{new Date(receipt.timestamp).toLocaleString()}</p>
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid var(--border-glass)', margin: '1.5rem 0' }} />
        <p className="text-secondary" style={{ fontSize: '0.85rem' }}>
          NOTE: Your vote choice is private and not shown on this receipt. Keep this code to verify your vote was counted in the audit log.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button className="btn btn-secondary" onClick={() => window.print()}><Download size={18}/> Download Receipt</button>
        <button className="btn btn-primary" onClick={handleFinish}><Home size={18}/> Return Home</button>
      </div>
    </div>
  );
};
export default VoteReceiptPage;
