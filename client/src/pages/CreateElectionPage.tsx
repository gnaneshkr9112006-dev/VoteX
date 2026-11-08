import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { electionsApi } from '../api/elections';
import Toast from '../components/Toast';

const CreateElectionPage = () => {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res: any = await electionsApi.createElection({
        title,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString()
      });
      const electionId = res?.electionId || (res?.election && res.election.id);
      if (electionId) {
        localStorage.setItem('votex_active_election', String(electionId));
        navigate(`/admin/candidates?electionId=${electionId}&new=true`);
      } else {
        navigate('/admin/candidates');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating election');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-up" style={{ maxWidth: '600px' }}>
      <h1 className="heading-lg mb-4">Create Election</h1>
      <form className="glass-card" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Election Title</label>
          <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">Start Date & Time</label>
          <input type="datetime-local" className="form-input" value={startTime} onChange={e => setStartTime(e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">End Date & Time</label>
          <input type="datetime-local" className="form-input" value={endTime} onChange={e => setEndTime(e.target.value)} required />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Creating...' : 'Create Election Room'}
        </button>
      </form>
      {errorMsg && <Toast message={errorMsg} type="error" onClose={() => setErrorMsg(null)} />}
    </div>
  );
};
export default CreateElectionPage;
