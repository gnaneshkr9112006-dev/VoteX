import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { electionsApi } from '../api/elections';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { Trophy } from 'lucide-react';

const RoomSettingsPage = () => {
  const [elections, setElections] = useState<any[]>([]);
  const [selectedElection, setSelectedElection] = useState('');
  const [electionFilter, setElectionFilter] = useState('');
  const [election, setElection] = useState<any>(null);
  const [actionModal, setActionModal] = useState<'close' | 'publish' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchElections = async () => {
    const res = await electionsApi.getElections();
    const data = Array.isArray(res) ? res : (res.elections || []);
    setElections(data);
    if (data.length > 0 && !selectedElection) {
      const saved = localStorage.getItem('votex_active_election');
      if (saved && data.some((el: any) => String(el.id) === saved)) {
        setSelectedElection(saved);
      } else {
        setSelectedElection(String(data[0].id));
      }
    }
  };

  useEffect(() => { fetchElections(); }, []);

  useEffect(() => {
    if (selectedElection) {
      electionsApi.getElection(selectedElection).then(res => {
        setElection(res.election || res);
      });
    }
  }, [selectedElection]);

  const handleAction = async () => {
    if (!actionModal || !selectedElection) return;
    setActionLoading(true);
    try {
      if (actionModal === 'close') await electionsApi.closeElection(selectedElection);
      if (actionModal === 'publish') await electionsApi.publishResults(selectedElection);
      await fetchElections();
      const res = await electionsApi.getElection(selectedElection);
      setElection(res.election || res);
    } catch (err) {
      // handled smoothly
    } finally {
      setActionLoading(false);
      setActionModal(null);
    }
  };

  if (!election) return <div>Loading...</div>;

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 className="heading-lg">Room Settings</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search 200+ rooms..."
            style={{ maxWidth: '170px', fontSize: '0.85rem' }}
            value={electionFilter}
            onChange={e => setElectionFilter(e.target.value)}
          />
          <select className="form-input" value={selectedElection} onChange={e => { setSelectedElection(e.target.value); localStorage.setItem('votex_active_election', e.target.value); }}>
            {elections
              .filter(el =>
                electionFilter === '' ||
                (el.title && el.title.toLowerCase().includes(electionFilter.toLowerCase())) ||
                (el.room_number && el.room_number.toLowerCase().includes(electionFilter.toLowerCase()))
              )
              .map(el => <option key={el.id} value={el.id}>{el.title} ({el.room_number || el.id})</option>)}
          </select>
        </div>
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <h2>{election.title}</h2>
            <p className="text-secondary mt-2">Room Code: <code style={{ fontSize: '1.2rem', color: 'var(--accent-cyan)'}}>{election.room_number}</code></p>
          </div>
          <StatusBadge status={election.status} />
        </div>

        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '2rem' }}>
          <div className="glass-card" style={{ padding: '1rem' }}>
            <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Registered Voters</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{election.voter_count ?? 0}</p>
          </div>
          <div className="glass-card" style={{ padding: '1rem' }}>
            <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Votes Cast</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{election.vote_count ?? 0}</p>
          </div>
          <div className="glass-card" style={{ padding: '1rem' }}>
            <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Candidates</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{election.candidate_count ?? 0}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-danger" 
            disabled={election.status !== 'active' && election.status !== 'draft'}
            onClick={() => setActionModal('close')}
          >
            Close Election Early
          </button>
          
          <button 
            className="btn btn-primary" 
            disabled={election.status !== 'closed'}
            onClick={() => setActionModal('publish')}
          >
            Publish Results
          </button>

          {election.status === 'published' && (
            <Link 
              to={`/results?room=${election.room_number}`} 
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'linear-gradient(135deg, #ffd700 0%, #f59e0b 100%)',
                color: '#000',
                fontWeight: 700
              }}
            >
              <Trophy size={18} /> View Certified Results &amp; Winner
            </Link>
          )}
        </div>
      </div>

      <Modal 
        isOpen={!!actionModal} 
        onClose={() => setActionModal(null)} 
        title={actionModal === 'close' ? 'Close Election Early' : 'Publish Election Results'}
      >
        <p style={{ marginBottom: '2rem' }}>
          {actionModal === 'close'
            ? 'Are you sure you want to close this election early? No more votes will be accepted.'
            : 'Are you sure you want to publish the election results? Live tallied results will become publicly viewable.'}
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => setActionModal(null)}>Cancel</button>
          <button 
            className={actionModal === 'close' ? 'btn btn-danger' : 'btn btn-primary'} 
            onClick={handleAction} 
            disabled={actionLoading}
          >
            {actionLoading ? 'Processing...' : (actionModal === 'close' ? 'Confirm Close' : 'Confirm Publish')}
          </button>
        </div>
      </Modal>
    </div>
  );
};
export default RoomSettingsPage;
