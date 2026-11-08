import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Download, Home, Copy, Check, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auditApi } from '../api/audit';

const VoteReceiptPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const receipt = location.state?.receipt;

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<any>(null);

  if (!receipt) {
    return (
      <div className="glass-card text-center" style={{ maxWidth: '500px', margin: '4rem auto', padding: '2rem' }}>
        <h3>No receipt found</h3>
        <p className="text-secondary mt-2">No active vote receipt was found in this session.</p>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/')}><Home size={18}/> Return Home</button>
      </div>
    );
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(receipt.receipt_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyHash = () => {
    navigator.clipboard.writeText(receipt.tx_hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2500);
  };

  const handleVerifyNow = async () => {
    setVerifying(true);
    setVerifyStatus(null);
    try {
      const res = await auditApi.verifyReceipt(receipt.receipt_code || receipt.tx_hash);
      setVerifyStatus(res);
    } catch (err) {
      setVerifyStatus({ found: false, message: 'Could not connect to audit service' });
    } finally {
      setVerifying(false);
    }
  };

  const handleFinish = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="animate-fade-up text-center" style={{ padding: '1rem 0' }}>
      <CheckCircle2 size={80} color="var(--accent-emerald)" style={{ margin: '0 auto 1.5rem' }} />
      <h1 className="heading-lg mb-2 text-gradient" style={{ backgroundImage: 'var(--gradient-emerald)' }}>Vote Successfully Cast!</h1>
      <p className="text-secondary mb-4" style={{ fontSize: '0.95rem' }}>Your ballot has been cryptographically signed and stored in the decentralized election registry.</p>
      
      <div className="glass-card" style={{ maxWidth: '560px', margin: '0 auto 2rem', textAlign: 'left', padding: '2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <label className="text-secondary" style={{ fontSize: '0.85rem', fontWeight: 600 }}>RECEIPT CODE</label>
            <button
              onClick={handleCopyCode}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: copiedCode ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.25rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              {copiedCode ? <><Check size={14} color="var(--accent-emerald)"/> Copied</> : <><Copy size={14}/> Copy Code</>}
            </button>
          </div>
          <p style={{ fontSize: '1.6rem', fontWeight: 'bold', letterSpacing: '0.05em', color: 'var(--accent-cyan)' }}>
            {receipt.receipt_code}
          </p>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <label className="text-secondary" style={{ fontSize: '0.85rem', fontWeight: 600 }}>CRYPTOGRAPHIC TRANSACTION HASH</label>
            <button
              onClick={handleCopyHash}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: copiedHash ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.25rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              {copiedHash ? <><Check size={14} color="var(--accent-emerald)"/> Copied</> : <><Copy size={14}/> Copy Hash</>}
            </button>
          </div>
          <p style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.35)', padding: '0.75rem', borderRadius: '6px', wordBreak: 'break-all', fontSize: '0.85rem', border: '1px solid var(--border-glass)' }}>
            {receipt.tx_hash}
          </p>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label className="text-secondary" style={{ fontSize: '0.85rem', fontWeight: 600 }}>TIMESTAMP</label>
          <p style={{ marginTop: '0.25rem' }}>{new Date(receipt.timestamp).toLocaleString()}</p>
        </div>

        <div style={{
          background: 'rgba(6, 182, 212, 0.08)',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ShieldCheck size={16} /> Audit Trail Verification
              </p>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                Verify your ballot inclusion in the blockchain audit log.
              </p>
            </div>
            <button
              onClick={handleVerifyNow}
              disabled={verifying}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
            >
              {verifying ? <><Loader2 size={14} className="spin"/> Verifying...</> : 'Verify Inclusion Now'}
            </button>
          </div>

          {verifyStatus && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {verifyStatus.found ? (
                <div style={{ color: 'var(--accent-emerald)', fontSize: '0.85rem', fontWeight: 500 }}>
                  ✓ <strong>Blockchain Verified:</strong> Included in Block #{verifyStatus.blockNumber} (Room: {verifyStatus.roomNumber})
                </div>
              ) : (
                <div style={{ color: 'var(--accent-red)', fontSize: '0.85rem' }}>
                  {verifyStatus.message || 'Verification could not find record.'}
                </div>
              )}
            </div>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-glass)', margin: '1.5rem 0' }} />
        <p className="text-secondary" style={{ fontSize: '0.82rem', lineHeight: '1.5' }}>
          🔒 <strong>Secret Ballot Guarantee:</strong> Your vote choice is private and mathematically separated from your identity. Either the <strong>Receipt Code</strong> or the <strong>Transaction Hash</strong> can be entered into the <strong>Audit Log</strong> to verify that your ballot was counted.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={() => window.print()}><Download size={18}/> Download Receipt</button>
        <button className="btn btn-primary" onClick={handleFinish}><Home size={18}/> Return Home</button>
      </div>
    </div>
  );
};
export default VoteReceiptPage;
