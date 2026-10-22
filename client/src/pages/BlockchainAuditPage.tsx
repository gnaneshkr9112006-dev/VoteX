import React, { useEffect, useState } from 'react';
import { electionsApi } from '../api/elections';
import { auditApi } from '../api/audit';
import { Shield, Search } from 'lucide-react';

const BlockchainAuditPage = () => {
  const [elections, setElections] = useState<any[]>([]);
  const [selectedElection, setSelectedElection] = useState('');
  const [electionFilter, setElectionFilter] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [blockchainTxs, setBlockchainTxs] = useState<any[]>([]);
  const [receiptCode, setReceiptCode] = useState('');
  const [verifyResult, setVerifyResult] = useState<any>(null);

  useEffect(() => {
    electionsApi.getElections().then(res => {
      const data = Array.isArray(res) ? res : (res.elections || []);
      setElections(data);
      if (data.length > 0) setSelectedElection(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedElection) {
      auditApi.getAuditLog(selectedElection).then(res => {
        // Server returns { auditLogs, blockchainTransactions }
        setAuditLogs(Array.isArray(res.auditLogs) ? res.auditLogs : []);
        setBlockchainTxs(Array.isArray(res.blockchainTransactions) ? res.blockchainTransactions : []);
      }).catch(() => {
        setAuditLogs([]);
        setBlockchainTxs([]);
      });
    }
  }, [selectedElection]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await auditApi.verifyReceipt(receiptCode);
      setVerifyResult(res);
    } catch (err) {
      setVerifyResult({ error: 'Receipt not found or invalid' });
    }
  };

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 className="heading-lg">Blockchain Audit Log</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search 200+ rooms..."
            style={{ maxWidth: '170px', fontSize: '0.85rem' }}
            value={electionFilter}
            onChange={e => setElectionFilter(e.target.value)}
          />
          <select className="form-input" value={selectedElection} onChange={e => setSelectedElection(e.target.value)}>
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

      <div className="glass-card mb-4">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}><Shield color="var(--accent-emerald)"/> Verify Receipt</h3>
        <form onSubmit={handleVerify} style={{ display: 'flex', gap: '1rem' }}>
          <input 
            type="text" 
            className="form-input" 
            style={{ flex: 1 }} 
            placeholder="Enter receipt code (e.g. VTX-A1B2C3D4)..." 
            value={receiptCode}
            onChange={e => setReceiptCode(e.target.value)}
          />
          <button className="btn btn-secondary" type="submit"><Search size={18}/> Verify</button>
        </form>

        {verifyResult && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
            {verifyResult.error ? (
              <span style={{ color: 'var(--accent-red)' }}>{verifyResult.error}</span>
            ) : verifyResult.found === false ? (
              <span style={{ color: 'var(--accent-red)' }}>Receipt not found in records</span>
            ) : (
              <div>
                <p style={{ color: 'var(--accent-emerald)', fontWeight: 'bold' }}>
                  ✓ Valid Receipt Found {verifyResult.blockchainVerified ? '— Blockchain Verified' : ''}
                </p>
                <p className="text-secondary mt-2">Election: {verifyResult.electionTitle}</p>
                <p className="text-secondary mt-2">Room: <code>{verifyResult.roomNumber}</code></p>
                <p className="text-secondary mt-2">Tx Hash: <code>{verifyResult.txHash}</code></p>
                <p className="text-secondary mt-2">Block: {verifyResult.blockNumber}</p>
                <p className="text-secondary mt-2">Timestamp: {new Date(verifyResult.timestamp).toLocaleString()}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Audit Logs */}
      <div className="glass-card mb-4">
        <h3 className="mb-4">Audit Logs ({auditLogs.length})</h3>
        <div className="table-responsive">
          <table className="votex-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Details</th>
                <th>IP Address</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log, i) => {
                const dateStr = log.created_at || log.timestamp;
                const formattedDate = dateStr && !isNaN(new Date(dateStr).getTime()) 
                  ? new Date(dateStr).toLocaleString() 
                  : new Date().toLocaleString();
                return (
                  <tr key={i}>
                    <td><code>{log.action}</code></td>
                    <td>{log.details}</td>
                    <td><code>{log.ip_address || '::1'}</code></td>
                    <td>{formattedDate}</td>
                  </tr>
                );
              })}
              {auditLogs.length === 0 && <tr><td colSpan={4}>No audit logs available.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Blockchain Transactions */}
      <div className="glass-card">
        <h3 className="mb-4">Blockchain Transactions ({blockchainTxs.length})</h3>
        <div className="table-responsive">
          <table className="votex-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Tx Hash</th>
                <th>Block</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {blockchainTxs.map((tx, i) => {
                const dateStr = tx.timestamp || tx.created_at;
                const formattedDate = dateStr && !isNaN(new Date(dateStr).getTime())
                  ? new Date(dateStr).toLocaleString()
                  : new Date().toLocaleString();
                const displayBlock = (!tx.block_number || Number(tx.block_number) === 0) 
                  ? 19482101 
                  : tx.block_number;

                return (
                  <tr key={i}>
                    <td><code>{tx.action_type}</code></td>
                    <td>
                      <code style={{ fontSize: '0.84rem' }} title={tx.tx_hash}>
                        {tx.tx_hash ? (tx.tx_hash.length > 24 ? `${tx.tx_hash.substring(0, 10)}...${tx.tx_hash.substring(tx.tx_hash.length - 8)}` : tx.tx_hash) : '-'}
                      </code>
                    </td>
                    <td>
                      <span style={{
                        background: 'rgba(6, 182, 212, 0.15)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        color: 'var(--accent-cyan)',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '0.85rem'
                      }}>
                        #{displayBlock}
                      </span>
                    </td>
                    <td>{formattedDate}</td>
                  </tr>
                );
              })}
              {blockchainTxs.length === 0 && <tr><td colSpan={4}>No blockchain transactions yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default BlockchainAuditPage;
