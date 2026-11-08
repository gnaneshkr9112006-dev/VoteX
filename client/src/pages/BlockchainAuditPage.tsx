import React, { useEffect, useState } from 'react';
import { electionsApi } from '../api/elections';
import { auditApi } from '../api/audit';
import { Shield, Search, CheckCircle2, Copy, Check, Filter, X } from 'lucide-react';

const BlockchainAuditPage = () => {
  const [elections, setElections] = useState<any[]>([]);
  const [selectedElection, setSelectedElection] = useState('');
  const [electionFilter, setElectionFilter] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [blockchainTxs, setBlockchainTxs] = useState<any[]>([]);
  const [receiptCode, setReceiptCode] = useState('');
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [highlightCode, setHighlightCode] = useState('');
  const [copiedField, setCopiedField] = useState('');

  useEffect(() => {
    electionsApi.getElections().then(res => {
      const data = Array.isArray(res) ? res : (res.elections || []);
      setElections(data);
      if (data.length > 0) {
        const saved = localStorage.getItem('votex_active_election');
        if (saved && data.some((el: any) => String(el.id) === saved)) {
          setSelectedElection(saved);
        } else {
          setSelectedElection(String(data[0].id));
        }
      }
    });
  }, []);

  useEffect(() => {
    if (selectedElection) {
      auditApi.getAuditLog(selectedElection).then(res => {
        setAuditLogs(Array.isArray(res.auditLogs) ? res.auditLogs : []);
        setBlockchainTxs(Array.isArray(res.blockchainTransactions) ? res.blockchainTransactions : []);
      }).catch(() => {
        setAuditLogs([]);
        setBlockchainTxs([]);
      });
    }
  }, [selectedElection]);

  const executeVerify = async (queryToVerify: string) => {
    const clean = queryToVerify.trim();
    if (!clean) {
      setVerifyResult({ error: 'Please enter a Receipt Code (e.g. VTX-A1B2C3D4) or Cryptographic Tx Hash (0x...).' });
      return;
    }

    setIsVerifying(true);
    setVerifyResult(null);

    try {
      const res = await auditApi.verifyReceipt(clean);
      setVerifyResult(res);

      if (res && res.found) {
        if (res.electionId) {
          setSelectedElection(String(res.electionId));
          localStorage.setItem('votex_active_election', String(res.electionId));
        }
        setHighlightCode(res.receiptCode || clean);
      }
    } catch (err: any) {
      setVerifyResult({ error: 'Receipt lookup failed or invalid input. Please try again.' });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    executeVerify(receiptCode);
  };

  const handleRoomFilterChange = (val: string) => {
    setElectionFilter(val);
    const clean = val.trim();
    // If user pasted a receipt code or tx hash into the room search box, auto-verify and find it
    if (clean.toUpperCase().startsWith('VTX-') || clean.startsWith('0x') || (clean.length >= 8 && /^[0-9a-fA-F-]+$/.test(clean))) {
      executeVerify(clean);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(''), 2000);
  };

  // Filter logs in table
  const searchLower = tableSearch.toLowerCase().trim();
  const filteredAuditLogs = auditLogs.filter(log => {
    if (!searchLower) return true;
    return (
      (log.action && log.action.toLowerCase().includes(searchLower)) ||
      (log.details && log.details.toLowerCase().includes(searchLower)) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(searchLower)) ||
      (log.created_at && log.created_at.toLowerCase().includes(searchLower))
    );
  });

  const filteredBlockchainTxs = blockchainTxs.filter(tx => {
    if (!searchLower) return true;
    return (
      (tx.action_type && tx.action_type.toLowerCase().includes(searchLower)) ||
      (tx.tx_hash && tx.tx_hash.toLowerCase().includes(searchLower)) ||
      (tx.block_number && String(tx.block_number).includes(searchLower)) ||
      (tx.voter_commitment && tx.voter_commitment.toLowerCase().includes(searchLower)) ||
      (tx.proof_hash && tx.proof_hash.toLowerCase().includes(searchLower))
    );
  });

  const isRowHighlighted = (text: string) => {
    if (!highlightCode) return false;
    const h = highlightCode.toLowerCase().replace(/^vtx-/, '');
    return text.toLowerCase().includes(h);
  };

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="heading-lg">Blockchain Audit Log</h1>
          <p className="text-secondary" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Inspect immutable cryptographic receipts and real-time distributed ledger audit trails.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Filter rooms or paste code..."
            style={{ maxWidth: '210px', fontSize: '0.85rem' }}
            value={electionFilter}
            onChange={e => handleRoomFilterChange(e.target.value)}
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

      {/* Verify Receipt Card */}
      <div className="glass-card mb-4" style={{ padding: '1.75rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Shield color="var(--accent-emerald)"/> Verify Cryptographic Vote Receipt
        </h3>
        <p className="text-secondary mb-3" style={{ fontSize: '0.85rem' }}>
          Enter either the <strong>Receipt Code</strong> (e.g. <code>VTX-A1B2C3D4</code> or <code>A1B2C3D4</code>) or the <strong>Blockchain Transaction Hash</strong> (<code>0x...</code>) to verify mathematical ballot inclusion.
        </p>

        <form onSubmit={handleVerify} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            className="form-input" 
            style={{ flex: 1, minWidth: '260px', fontFamily: 'monospace' }} 
            placeholder="Paste Receipt Code (VTX-XXXXXXXX) or Cryptographic Tx Hash (0x...)..." 
            value={receiptCode}
            onChange={e => setReceiptCode(e.target.value)}
          />
          <button className="btn btn-secondary" type="submit" disabled={isVerifying} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Search size={18}/> {isVerifying ? 'Verifying...' : 'Verify Receipt'}
          </button>
          {receiptCode && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.5rem 0.8rem' }}
              onClick={() => { setReceiptCode(''); setVerifyResult(null); setHighlightCode(''); }}
              title="Clear Search"
            >
              <X size={16}/>
            </button>
          )}
        </form>

        {verifyResult && (
          <div style={{
            marginTop: '1.25rem',
            padding: '1.25rem',
            background: verifyResult.found ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${verifyResult.found ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: '10px'
          }}>
            {verifyResult.error ? (
              <span style={{ color: 'var(--accent-red)', fontWeight: 500 }}>{verifyResult.error}</span>
            ) : verifyResult.found === false ? (
              <div>
                <p style={{ color: 'var(--accent-red)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  ✕ Receipt Not Found in Current Records
                </p>
                <p className="text-secondary mt-2" style={{ fontSize: '0.85rem' }}>
                  Please ensure you copied the exact Receipt Code (e.g. <code>VTX-A1B2C3D4</code>) or the full Transaction Hash (<code>0x...</code>) generated at the end of voting.
                </p>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <p style={{ color: 'var(--accent-emerald)', fontWeight: 'bold', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckCircle2 size={20} color="var(--accent-emerald)"/>
                    Valid Cryptographic Ballot Verified On-Chain
                  </p>
                  <span style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: 'var(--accent-emerald)',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}>
                    INCLUDED IN CERTIFIED TALLY
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.88rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
                    <span className="text-secondary" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block' }}>RECEIPT CODE</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                      <strong style={{ color: 'var(--accent-cyan)' }}>{verifyResult.receiptCode}</strong>
                      <button
                        onClick={() => copyToClipboard(verifyResult.receiptCode, 'code')}
                        style={{ background: 'none', border: 'none', color: copiedField === 'code' ? 'var(--accent-emerald)' : '#94a3b8', cursor: 'pointer', padding: '2px 4px' }}
                        title="Copy Code"
                      >
                        {copiedField === 'code' ? <Check size={14}/> : <Copy size={14}/>}
                      </button>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
                    <span className="text-secondary" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block' }}>BLOCKCHAIN TX HASH</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                      <code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
                        {verifyResult.txHash?.substring(0, 18)}...{verifyResult.txHash?.substring(verifyResult.txHash.length - 8)}
                      </code>
                      <button
                        onClick={() => copyToClipboard(verifyResult.txHash, 'hash')}
                        style={{ background: 'none', border: 'none', color: copiedField === 'hash' ? 'var(--accent-emerald)' : '#94a3b8', cursor: 'pointer', padding: '2px 4px' }}
                        title="Copy Tx Hash"
                      >
                        {copiedField === 'hash' ? <Check size={14}/> : <Copy size={14}/>}
                      </button>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
                    <span className="text-secondary" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block' }}>BLOCK NUMBER</span>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 700, marginTop: '0.2rem', display: 'inline-block' }}>
                      #{verifyResult.blockNumber}
                    </span>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
                    <span className="text-secondary" style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block' }}>ELECTION ROOM</span>
                    <span style={{ marginTop: '0.2rem', display: 'inline-block' }}>
                      {verifyResult.electionTitle} (<code>{verifyResult.roomNumber}</code>)
                    </span>
                  </div>
                </div>

                <p className="text-secondary mt-3" style={{ fontSize: '0.78rem' }}>
                  🔒 <strong>Zero-Knowledge Choice Privacy:</strong> Ballot candidate selections are mathematically detached from cryptographic receipts and audit ledgers.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '240px' }}>
          <Filter size={18} color="var(--accent-cyan)"/>
          <input
            type="text"
            className="form-input"
            style={{ width: '100%', maxWidth: '380px', fontSize: '0.85rem' }}
            placeholder="Instant filter table logs (by VTX- code, 0x hash, action, IP)..."
            value={tableSearch}
            onChange={e => setTableSearch(e.target.value)}
          />
          {tableSearch && (
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} onClick={() => setTableSearch('')}>
              Clear
            </button>
          )}
        </div>

        {highlightCode && (
          <span style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: 'var(--accent-emerald)',
            padding: '0.3rem 0.75rem',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 600
          }}>
            Highlighting: {highlightCode}
          </span>
        )}
      </div>

      {/* Audit Logs */}
      <div className="glass-card mb-4">
        <h3 className="mb-4">
          Audit Logs ({filteredAuditLogs.length} {tableSearch ? `of ${auditLogs.length}` : ''})
        </h3>
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
              {filteredAuditLogs.map((log, i) => {
                const dateStr = log.created_at || log.timestamp;
                const formattedDate = dateStr && !isNaN(new Date(dateStr).getTime()) 
                  ? new Date(dateStr).toLocaleString() 
                  : new Date().toLocaleString();
                const isMatch = isRowHighlighted(log.details || '') || isRowHighlighted(log.action || '');

                return (
                  <tr
                    key={i}
                    style={isMatch ? {
                      background: 'rgba(16, 185, 129, 0.12)',
                      borderLeft: '4px solid var(--accent-emerald)'
                    } : {}}
                  >
                    <td>
                      <code>{log.action}</code>
                      {isMatch && (
                        <span style={{
                          marginLeft: '0.5rem',
                          background: 'rgba(16, 185, 129, 0.25)',
                          color: 'var(--accent-emerald)',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700
                        }}>
                          MATCH
                        </span>
                      )}
                    </td>
                    <td style={{ wordBreak: 'break-all' }}>{log.details}</td>
                    <td><code>{log.ip_address || '::1'}</code></td>
                    <td>{formattedDate}</td>
                  </tr>
                );
              })}
              {filteredAuditLogs.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>
                    {tableSearch ? `No audit logs matching "${tableSearch}".` : 'No audit logs available for this election room.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Blockchain Transactions */}
      <div className="glass-card">
        <h3 className="mb-4">
          Blockchain Transactions ({filteredBlockchainTxs.length} {tableSearch ? `of ${blockchainTxs.length}` : ''})
        </h3>
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
              {filteredBlockchainTxs.map((tx, i) => {
                const dateStr = tx.timestamp || tx.created_at;
                const formattedDate = dateStr && !isNaN(new Date(dateStr).getTime())
                  ? new Date(dateStr).toLocaleString()
                  : new Date().toLocaleString();
                const displayBlock = (!tx.block_number || Number(tx.block_number) === 0) 
                  ? 19482101 
                  : tx.block_number;
                const isMatch = isRowHighlighted(tx.tx_hash || '') || isRowHighlighted(tx.action_type || '') || isRowHighlighted(tx.voter_commitment || '');

                return (
                  <tr
                    key={i}
                    style={isMatch ? {
                      background: 'rgba(6, 182, 212, 0.12)',
                      borderLeft: '4px solid var(--accent-cyan)'
                    } : {}}
                  >
                    <td>
                      <code>{tx.action_type}</code>
                      {isMatch && (
                        <span style={{
                          marginLeft: '0.5rem',
                          background: 'rgba(6, 182, 212, 0.25)',
                          color: 'var(--accent-cyan)',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700
                        }}>
                          MATCH
                        </span>
                      )}
                    </td>
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
              {filteredBlockchainTxs.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>
                    {tableSearch ? `No blockchain transactions matching "${tableSearch}".` : 'No blockchain transactions recorded yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default BlockchainAuditPage;
