import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { electionsApi } from '../api/elections';
import { candidatesApi } from '../api/candidates';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import StatusBadge from '../components/StatusBadge';
import { UserPlus, Trash2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';

const CandidateManagementPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [elections, setElections] = useState<any[]>([]);
  const [selectedElection, setSelectedElection] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', party: '', candidateCode: '', bio: '' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [candidateToDelete, setCandidateToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [electionFilter, setElectionFilter] = useState('');

  const queryElectionId = searchParams.get('electionId');
  const isNewElection = searchParams.get('new') === 'true';

  useEffect(() => {
    electionsApi.getElections().then(res => {
      const data = Array.isArray(res) ? res : (res.elections || []);
      setElections(data);
      if (data.length > 0) {
        const savedElection = localStorage.getItem('votex_active_election');
        const matchedQuery = queryElectionId
          ? data.find((el: any) => String(el.id) === queryElectionId || el.room_number?.toUpperCase() === queryElectionId?.toUpperCase())
          : null;
        const matchedSaved = savedElection
          ? data.find((el: any) => String(el.id) === savedElection || el.room_number?.toUpperCase() === savedElection?.toUpperCase())
          : null;

        if (matchedQuery) {
          setSelectedElection(String(matchedQuery.id));
          localStorage.setItem('votex_active_election', String(matchedQuery.id));
        } else if (matchedSaved) {
          setSelectedElection(String(matchedSaved.id));
        } else {
          setSelectedElection(String(data[0].id));
          localStorage.setItem('votex_active_election', String(data[0].id));
        }
      }
      setLoading(false);
    }).catch(err => {
      setToast({ message: err.message || 'Failed to load elections', type: 'error' });
      setLoading(false);
    });
  }, [queryElectionId]);

  useEffect(() => {
    if (selectedElection) {
      candidatesApi.getCandidates(selectedElection).then(res => {
        const list = Array.isArray(res) ? res : (res.candidates || []);
        setCandidates(list);
        if (isNewElection && list.length === 0) {
          openAddModal(list);
        }
      }).catch(err => {
        setToast({ message: err.message || 'Failed to load candidates', type: 'error' });
      });
    }
  }, [selectedElection]);

  const openAddModal = (existingCandidates = candidates) => {
    const nextCode = `CAN-0${existingCandidates.length + 1}`;
    setFormData({ name: '', party: '', candidateCode: nextCode, bio: '' });
    setModalOpen(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedElection) {
      setToast({ message: 'Please select an election room first', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      await candidatesApi.addCandidate(selectedElection, formData);
      setToast({ message: `Candidate "${formData.name}" added successfully!`, type: 'success' });
      setModalOpen(false);
      setFormData({ name: '', party: '', candidateCode: '', bio: '' });
      const res = await candidatesApi.getCandidates(selectedElection);
      const list = Array.isArray(res) ? res : (res.candidates || []);
      setCandidates(list);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to register candidate', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!candidateToDelete || !selectedElection) return;
    setDeleting(true);
    try {
      await candidatesApi.deleteCandidate(selectedElection, candidateToDelete);
      setCandidates(candidates.filter(c => String(c.id) !== String(candidateToDelete)));
      setToast({ message: 'Candidate removed successfully', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to delete candidate', type: 'error' });
    } finally {
      setDeleting(false);
      setCandidateToDelete(null);
    }
  };

  const currentElection = elections.find(el => String(el.id) === String(selectedElection));

  return (
    <div className="animate-fade-up">
      {isNewElection && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(16, 185, 129, 0.15))',
          border: '1px solid rgba(6, 182, 212, 0.4)',
          borderRadius: '12px',
          padding: '1rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <Sparkles color="#06b6d4" size={28} />
          <div>
            <h4 style={{ margin: 0, color: '#06b6d4' }}>New Election Room Created</h4>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#94a3b8' }}>
              Register candidates who will appear on voter ballots for <strong>{currentElection?.title || 'this election'}</strong>.
            </p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="heading-lg">Candidate Management</h1>
          <p className="text-secondary" style={{ marginTop: '0.25rem' }}>
            Configure and register contestants for active and upcoming election rooms.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search 200+ rooms..."
            style={{ maxWidth: '170px', fontSize: '0.85rem' }}
            value={electionFilter}
            onChange={e => setElectionFilter(e.target.value)}
          />
          <select
            className="form-input"
            style={{ minWidth: '240px' }}
            value={selectedElection}
            onChange={e => {
              setSelectedElection(e.target.value);
              localStorage.setItem('votex_active_election', e.target.value);
              setSearchParams({ electionId: e.target.value });
            }}
          >
            {elections
              .filter(el =>
                electionFilter === '' ||
                (el.title && el.title.toLowerCase().includes(electionFilter.toLowerCase())) ||
                (el.room_number && el.room_number.toLowerCase().includes(electionFilter.toLowerCase()))
              )
              .map(el => (
                <option key={el.id} value={el.id}>
                  {el.title} ({el.room_number || el.id}) - {el.status.toUpperCase()}
                </option>
              ))}
          </select>

          <button className="btn btn-primary" onClick={() => openAddModal()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserPlus size={18} />
            <span>Add Candidate</span>
          </button>
          <button
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--accent-cyan)', color: 'var(--accent-cyan)' }}
            onClick={() => navigate(`/admin/voters?electionId=${selectedElection}`)}
          >
            <span>Proceed to Add Voters →</span>
          </button>
        </div>
      </div>

      {currentElection && (
        <div className="glass-card mb-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{currentElection.title}</span>
            <code>Room #{currentElection.room_number || currentElection.id}</code>
            <StatusBadge status={currentElection.status} />
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Candidates Registered: <strong style={{ color: '#fff' }}>{candidates.length}</strong>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading candidate data...</div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {candidates.map(c => (
            <div key={c.id} className="glass-card" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{c.name}</h3>
                  <span style={{
                    display: 'inline-block',
                    background: 'rgba(6, 182, 212, 0.1)',
                    color: '#06b6d4',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    marginTop: '0.35rem'
                  }}>
                    {c.party || 'Independent'}
                  </span>
                </div>
                <code style={{ background: 'rgba(255,255,255,0.06)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                  {c.candidate_code}
                </code>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#94a3b8', flexGrow: 1, marginBottom: '1.5rem', lineHeight: '1.5' }}>
                {c.bio || 'No biography provided.'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                <button
                  className="btn btn-danger"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  onClick={() => setCandidateToDelete(String(c.id))}
                >
                  <Trash2 size={16} />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          ))}

          {candidates.length === 0 && (
            <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3.5rem 1rem' }}>
              <AlertCircle size={40} color="#64748b" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ color: '#cbd5e1', marginBottom: '0.5rem' }}>No Candidates Registered Yet</h3>
              <p className="text-secondary" style={{ maxWidth: '460px', margin: '0 auto 1.5rem', fontSize: '0.95rem' }}>
                This election has no contestants registered. Add at least 2 candidates before voters can cast ballots.
              </p>
              <button className="btn btn-primary" onClick={() => openAddModal()}>
                Add First Candidate
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Candidate Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Register Election Candidate">
        <form onSubmit={handleAdd}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              required
              className="form-input"
              placeholder="e.g. Eleanor Roosevelt"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Party / Affiliation *</label>
            <input
              required
              className="form-input"
              placeholder="e.g. Progressive Alliance"
              value={formData.party}
              onChange={e => setFormData({ ...formData, party: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Candidate Code <span style={{ color: '#64748b', fontSize: '0.8rem' }}>(Auto-assigned or custom)</span>
            </label>
            <input
              required
              className="form-input"
              placeholder="e.g. CAN-01"
              value={formData.candidateCode}
              onChange={e => setFormData({ ...formData, candidateCode: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Platform / Bio *</label>
            <textarea
              required
              rows={3}
              className="form-input"
              placeholder="Brief summary of policies and vision for voters..."
              value={formData.bio}
              onChange={e => setFormData({ ...formData, bio: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Registering...' : 'Register Candidate'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal isOpen={!!candidateToDelete} onClose={() => setCandidateToDelete(null)} title="Delete Candidate">
        <p style={{ marginBottom: '1.5rem', color: '#cbd5e1' }}>
          Are you sure you want to remove this candidate from <strong>{currentElection?.title}</strong>? This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => setCandidateToDelete(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Confirm Remove'}
          </button>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default CandidateManagementPage;
