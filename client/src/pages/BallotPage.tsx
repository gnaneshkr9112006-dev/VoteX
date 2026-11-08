import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { voteApi } from '../api/vote';
import { candidatesApi } from '../api/candidates';
import { useAuth } from '../contexts/AuthContext';
import { Lock, CheckCircle2, ShieldCheck, UserCheck } from 'lucide-react';
import './Ballot.css';
import Modal from '../components/Modal';
import Toast from '../components/Toast';

const BallotPage = () => {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [confirmModal, setConfirmModal] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [roomDisplay, setRoomDisplay] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'info'|'success'|'error' } | null>(null);
  const navigate = useNavigate();

  const loadCandidatesForElection = async (identifier: string | number) => {
    try {
      setLoadingCandidates(true);
      const res = await candidatesApi.getCandidates(String(identifier));
      const list = Array.isArray(res) ? res : (res.candidates || []);
      setCandidates(list);
    } catch (err) {
      console.error('Failed to load candidates:', err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  // Check vote status and load candidates on mount
  useEffect(() => {
    const savedRoom = localStorage.getItem('votex_voter_room') || '';
    const activeRoom = user?.roomNumber || savedRoom || 'VOTEX-2026';
    setRoomDisplay(activeRoom);

    voteApi.getVoteStatus()
      .then(res => {
        setHasVoted(res.hasVoted);
        if (res.roomNumber) setRoomDisplay(res.roomNumber);

        if (!res.hasVoted) {
          if (!res.isVerified) {
            navigate('/voter/verify');
            return;
          }
          const target = res.electionId || user?.electionId || activeRoom;
          loadCandidatesForElection(target);
        } else {
          setLoadingCandidates(false);
        }
        setCheckingStatus(false);
      })
      .catch(() => {
        const fallbackTarget = user?.electionId || activeRoom;
        loadCandidatesForElection(fallbackTarget);
        setCheckingStatus(false);
      });
  }, [user]);

  if (checkingStatus) {
    return <div className="glass-card text-center animate-fade-up" style={{ padding: '4rem 2rem' }}>Verifying Voter Credentials...</div>;
  }

  if (hasVoted) {
    return (
      <div className="glass-card text-center animate-fade-up" style={{ padding: '4rem 2rem' }}>
        <Lock size={64} color="var(--accent-gold)" style={{ margin: '0 auto 1.5rem' }} />
        <h2>Already Voted</h2>
        <p className="text-secondary mt-4">You have already cast your vote in this election room.</p>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/voter/results')}>View Results Page</button>
      </div>
    );
  }

  const selectedCandidateObj = candidates.find(c => String(c.id) === selectedCandidate);

  const handleCastVoteClick = () => {
    if (!selectedCandidate) {
      setToast({ message: 'Please select a candidate on the ballot first!', type: 'info' });
      return;
    }
    setConfirmModal(true);
  };

  const handleCastVote = async () => {
    if (!selectedCandidate) return;
    setLoading(true);
    try {
      const res = await voteApi.castVote({ candidateId: selectedCandidate });
      navigate('/voter/receipt', { state: { receipt: {
        receipt_code: res.receiptCode,
        tx_hash: res.txHash,
        timestamp: res.timestamp
      }}});
    } catch (err: any) {
      setToast({ message: err.message || 'Error casting vote', type: 'error' });
      setLoading(false);
      setConfirmModal(false);
    }
  };

  return (
    <div className="animate-fade-up" style={{ maxWidth: '850px', margin: '0 auto' }}>
      <div className="text-center mb-4">
        <h1 className="heading-lg">Official Ballot</h1>
        <p className="text-secondary mt-2">
          Room: <strong style={{ color: 'var(--accent-cyan)' }}>{roomDisplay}</strong>
        </p>
        <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.25rem' }}>
          Select your candidate below and click &quot;Cast Your Vote&quot; to permanently record your ballot.
        </p>
      </div>

      {loadingCandidates ? (
        <div className="glass-card text-center" style={{ padding: '3rem 2rem' }}>
          <p className="text-secondary">Loading official candidates...</p>
        </div>
      ) : candidates.length === 0 ? (
        <div className="glass-card text-center" style={{ padding: '3rem 2rem' }}>
          <p className="text-secondary">No candidates registered for election room {roomDisplay} yet.</p>
        </div>
      ) : (
        <div className="candidates-grid">
          {candidates.map(c => {
            const isSelected = selectedCandidate === String(c.id);
            return (
              <div 
                key={c.id} 
                className={`glass-card candidate-card ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedCandidate(String(c.id))}
                style={{
                  position: 'relative',
                  padding: '1.5rem',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--accent-cyan)' : '2px solid rgba(255,255,255,0.08)',
                  background: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'rgba(255,255,255,0.03)',
                  transition: 'all 0.2s ease',
                  borderRadius: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '6px',
                    background: isSelected ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)',
                    color: isSelected ? '#000' : '#cbd5e1',
                    fontWeight: 700
                  }}>
                    {c.candidate_code || `CAN-${String(c.id).padStart(2, '0')}`}
                  </span>
                  {isSelected && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--accent-cyan)', fontSize: '0.85rem', fontWeight: 600 }}>
                      <CheckCircle2 size={18} /> Selected
                    </span>
                  )}
                </div>

                <h3 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.25rem', color: '#f8fafc' }}>{c.name}</h3>
                <p className="party" style={{ margin: '0 0 0.75rem', color: 'var(--accent-cyan)', fontWeight: 600, fontSize: '0.95rem' }}>
                  {c.party || 'Independent'}
                </p>
                {c.bio && (
                  <p className="bio" style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.5 }}>
                    {c.bio}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="text-center mt-4" style={{ padding: '2rem 0' }}>
        <button 
          className="btn btn-primary" 
          style={{
            padding: '1.1rem 3.5rem',
            fontSize: '1.15rem',
            fontWeight: 600,
            background: selectedCandidate ? 'var(--gradient-emerald)' : 'rgba(255,255,255,0.12)',
            color: selectedCandidate ? '#fff' : '#94a3b8',
            cursor: selectedCandidate ? 'pointer' : 'not-allowed',
            border: 'none',
            boxShadow: selectedCandidate ? '0 0 25px rgba(16, 185, 129, 0.35)' : 'none',
            transition: 'all 0.25s ease'
          }}
          onClick={handleCastVoteClick}
          disabled={loading}
        >
          {loading ? 'Processing on Blockchain...' : selectedCandidate ? 'Cast Your Vote Now' : 'Select a Candidate to Vote'}
        </button>
      </div>

      <Modal isOpen={confirmModal} onClose={() => setConfirmModal(false)} title="Confirm Your Ballot Choice">
        <div style={{ padding: '0.5rem 0' }}>
          <div style={{
            background: 'rgba(6, 182, 212, 0.08)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            borderRadius: '10px',
            padding: '1.25rem',
            marginBottom: '1.5rem'
          }}>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>You are casting your vote for:</p>
            <h3 style={{ margin: '0.35rem 0', fontSize: '1.4rem', color: '#fff' }}>{selectedCandidateObj?.name}</h3>
            <p style={{ margin: 0, color: 'var(--accent-cyan)', fontWeight: 600 }}>{selectedCandidateObj?.party || 'Independent'}</p>
          </div>

          <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '2rem' }}>
            Are you sure you want to proceed? Once cast, your vote is cryptographically secured on the smart contract and <strong>cannot be modified or recast</strong>.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setConfirmModal(false)} disabled={loading}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCastVote} disabled={loading} style={{ background: 'var(--gradient-emerald)' }}>
              {loading ? 'Anchoring to Blockchain...' : 'Confirm & Cast Vote'}
            </button>
          </div>
        </div>
      </Modal>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};
export default BallotPage;
