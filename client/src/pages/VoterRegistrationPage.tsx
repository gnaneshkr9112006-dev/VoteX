import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as faceapi from '@vladmandic/face-api';
import { electionsApi } from '../api/elections';
import { votersApi } from '../api/voters';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Camera,
  ShieldCheck,
  RefreshCw,
  Image as ImageIcon,
  UserCheck
} from 'lucide-react';
import Modal from '../components/Modal';
import Toast from '../components/Toast';

const VoterRegistrationPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [elections, setElections] = useState<any[]>([]);
  const [selectedElection, setSelectedElection] = useState('');
  const [voters, setVoters] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'info'|'success'|'error' } | null>(null);
  const [voterToDelete, setVoterToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<{ name: string; photo: string } | null>(null);
  const [electionFilter, setElectionFilter] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin Photo Enrollment Modal State
  const [enrollModalVoter, setEnrollModalVoter] = useState<any | null>(null);
  const [photoMode, setPhotoMode] = useState<'upload' | 'camera'>('upload');
  const [uploadedPhotoSrc, setUploadedPhotoSrc] = useState<string | null>(null);
  const [extractedDescriptor, setExtractedDescriptor] = useState<number[] | null>(null);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [faceStatusMsg, setFaceStatusMsg] = useState<string | null>(null);
  const [savingBiometrics, setSavingBiometrics] = useState(false);

  // Camera in modal
  const modalVideoRef = useRef<HTMLVideoElement>(null);
  const modalStreamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const queryElectionId = searchParams.get('electionId');

  useEffect(() => {
    electionsApi.getElections().then(res => {
      const data = Array.isArray(res) ? res : (res.elections || []);
      setElections(data);
      if (data.length > 0) {
        if (queryElectionId && data.some((el: any) => String(el.id) === queryElectionId)) {
          setSelectedElection(queryElectionId);
        } else {
          setSelectedElection(String(data[0].id));
        }
      }
    }).catch(console.error);
  }, [queryElectionId]);

  const fetchVoters = () => {
    if (selectedElection) {
      votersApi.getVoters(selectedElection)
        .then(res => setVoters(Array.isArray(res) ? res : (res.voters || [])))
        .catch(console.error);
    }
  };

  useEffect(() => { fetchVoters(); }, [selectedElection]);

  // Load models in background for photo extraction
  useEffect(() => {
    const initModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
      } catch {
        try {
          const CDN_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(CDN_URL),
            faceapi.nets.faceLandmark68TinyNet.loadFromUri(CDN_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(CDN_URL)
          ]);
        } catch (e) {
          console.warn('Could not load face models in Admin modal:', e);
        }
      }
    };
    initModels();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedElection) return;
    try {
      const res = await votersApi.importVotersCSV(selectedElection, file);
      setToast({ message: res.message || 'Voters imported successfully', type: 'success' });
      fetchVoters();
    } catch (err: any) {
      setToast({ message: err.message || 'Import failed', type: 'error' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmDelete = async () => {
    if (!voterToDelete || !selectedElection) return;
    setDeleting(true);
    try {
      await votersApi.deleteVoter(selectedElection, voterToDelete);
      setToast({ message: 'Voter removed successfully', type: 'success' });
      fetchVoters();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to remove voter', type: 'error' });
    } finally {
      setDeleting(false);
      setVoterToDelete(null);
    }
  };

  // Open Admin Photo Enrollment Modal
  const openPhotoEnrollModal = (voter: any) => {
    setEnrollModalVoter(voter);
    setUploadedPhotoSrc(null);
    setExtractedDescriptor(null);
    setFaceStatusMsg(null);
    setPhotoMode('upload');
  };

  const closePhotoEnrollModal = () => {
    if (modalStreamRef.current) {
      modalStreamRef.current.getTracks().forEach(t => t.stop());
      modalStreamRef.current = null;
    }
    setCameraActive(false);
    setEnrollModalVoter(null);
    setUploadedPhotoSrc(null);
    setExtractedDescriptor(null);
  };

  // Switch to camera
  const startModalCamera = async () => {
    setPhotoMode('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
      modalStreamRef.current = stream;
      if (modalVideoRef.current) {
        modalVideoRef.current.srcObject = stream;
        modalVideoRef.current.play();
        setCameraActive(true);
      }
    } catch (e: any) {
      setToast({ message: 'Could not access camera: ' + e.message, type: 'error' });
    }
  };

  // Process image for face detection & descriptor extraction
  const processImageForFace = async (dataUrl: string) => {
    setProcessingPhoto(true);
    setFaceStatusMsg('Analyzing facial landmarks with neural net...');
    setExtractedDescriptor(null);

    try {
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }))
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!detection || !detection.descriptor) {
        setFaceStatusMsg('⚠️ No clear face detected. Please ensure the image contains a clear, front-facing portrait.');
      } else {
        setExtractedDescriptor(Array.from(detection.descriptor));
        setFaceStatusMsg('✅ Face detected! 128-dimensional biometric profile generated.');
      }
    } catch (err: any) {
      setFaceStatusMsg('Error analyzing photo: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessingPhoto(false);
    }
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setUploadedPhotoSrc(result);
      processImageForFace(result);
    };
    reader.readAsDataURL(file);
  };

  const captureModalCameraSnapshot = () => {
    if (!modalVideoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = modalVideoRef.current.videoWidth || 640;
    canvas.height = modalVideoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(modalVideoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setUploadedPhotoSrc(dataUrl);
      if (modalStreamRef.current) {
        modalStreamRef.current.getTracks().forEach(t => t.stop());
        modalStreamRef.current = null;
      }
      setCameraActive(false);
      processImageForFace(dataUrl);
    }
  };

  const saveOfficialBiometrics = async () => {
    if (!enrollModalVoter || !selectedElection || !extractedDescriptor) return;
    setSavingBiometrics(true);
    try {
      await votersApi.enrollVoterFace(selectedElection, enrollModalVoter.voter_id, {
        faceDescriptor: extractedDescriptor,
        photoBase64: uploadedPhotoSrc || undefined
      });
      setToast({ message: `Official biometrics enrolled for ${enrollModalVoter.full_name}!`, type: 'success' });
      closePhotoEnrollModal();
      fetchVoters();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to save official biometrics', type: 'error' });
    } finally {
      setSavingBiometrics(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="heading-lg">Voter Registration &amp; Biometrics</h1>
          <p className="text-secondary" style={{ marginTop: '0.25rem' }}>
            Register eligible voters, upload official government ID photos, and inspect biometric verification status.
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
                <option key={el.id} value={el.id}>{el.title} ({el.room_number || el.id})</option>
              ))}
          </select>
        </div>
      </div>

      <div className="glass-card mb-4" style={{ textAlign: 'center', padding: '2.5rem 2rem', border: '2px dashed var(--border-glass)' }}>
        <Upload size={44} color="var(--accent-cyan)" style={{ marginBottom: '0.75rem' }} />
        <h3 style={{ marginBottom: '0.4rem' }}>Import Voters from CSV</h3>
        <p className="text-secondary" style={{ marginBottom: '1.25rem', fontSize: '0.9rem' }}>Format: voter_id, full_name, email</p>
        <input type="file" accept=".csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
        <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>Select CSV File</button>
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>Registered Voters ({voters.length})</h3>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Biometrics: <strong style={{ color: '#10b981' }}>{voters.filter(v => v.has_face_enrolled).length}</strong> of {voters.length} Certified
          </span>
        </div>
        <div className="table-responsive">
          <table className="votex-table">
            <thead>
              <tr>
                <th>Voter ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Face Biometrics</th>
                <th>Voting Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {voters.map(v => (
                <tr key={v.id}>
                  <td><code>{v.voter_id}</code></td>
                  <td><strong>{v.full_name}</strong></td>
                  <td>{v.email}</td>
                  <td>
                    {v.has_face_enrolled ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {v.face_photo && (
                          <img
                            src={v.face_photo}
                            alt="Face Thumbnail"
                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '2px solid #10b981' }}
                            onClick={() => setPreviewPhoto({ name: v.full_name, photo: v.face_photo })}
                            title="Click to preview certified official photo"
                          />
                        )}
                        <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
                          <CheckCircle2 size={15} /> Certified
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
                        <AlertCircle size={15} /> Not Enrolled
                      </span>
                    )}
                  </td>
                  <td>
                    {v.has_voted ? (
                      <span style={{ color: 'var(--accent-emerald)', fontWeight: 600, fontSize: '0.85rem' }}>Voted</span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Eligible</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        onClick={() => openPhotoEnrollModal(v)}
                        title="Upload official ID photo / capture face"
                      >
                        <Camera size={14} color="#06b6d4" />
                        <span>{v.has_face_enrolled ? 'Update Photo' : 'Enroll Photo'}</span>
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        onClick={() => setVoterToDelete(v.voter_id)}
                      >
                        <Trash2 size={14} />
                        <span>Remove</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {voters.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                    No voters registered for this election yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Official Photo Enrollment Modal */}
      <Modal
        isOpen={!!enrollModalVoter}
        onClose={closePhotoEnrollModal}
        title={`Enroll Official Biometrics: ${enrollModalVoter?.full_name} (${enrollModalVoter?.voter_id})`}
      >
        <div style={{ marginBottom: '1.25rem' }}>
          <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
            Register the official reference face for this voter. On voting day, the voter must match this photo to be granted ballot access.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <button
              type="button"
              className={`btn ${photoMode === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
              onClick={() => {
                if (modalStreamRef.current) {
                  modalStreamRef.current.getTracks().forEach(t => t.stop());
                }
                setCameraActive(false);
                setPhotoMode('upload');
              }}
            >
              <ImageIcon size={16} />
              <span>Upload ID Photo</span>
            </button>
            <button
              type="button"
              className={`btn ${photoMode === 'camera' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
              onClick={startModalCamera}
            >
              <Camera size={16} />
              <span>Admin Camera</span>
            </button>
          </div>

          {/* Upload Mode */}
          {photoMode === 'upload' && (
            <div style={{
              border: '2px dashed rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              padding: '1.5rem',
              textAlign: 'center',
              background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <input
                type="file"
                accept="image/*"
                id="admin-voter-photo-file"
                style={{ display: 'none' }}
                onChange={handlePhotoFileChange}
              />
              <label htmlFor="admin-voter-photo-file" className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <Upload size={16} />
                <span>Select Official Photo (JPG, PNG)</span>
              </label>
              <p className="text-secondary" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                Passport photo, Driver's License photo, or clear portrait.
              </p>
            </div>
          )}

          {/* Camera Mode */}
          {photoMode === 'camera' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                position: 'relative',
                width: '100%',
                maxWidth: '400px',
                height: '300px',
                margin: '0 auto 1rem',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#090d16',
                border: '2px solid rgba(6, 182, 212, 0.4)'
              }}>
                <video
                  ref={modalVideoRef}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                  autoPlay
                  playsInline
                  muted
                />
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={captureModalCameraSnapshot}
                disabled={!cameraActive}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Camera size={16} />
                <span>Capture Photo</span>
              </button>
            </div>
          )}

          {/* Preview & Status */}
          {uploadedPhotoSrc && (
            <div style={{
              marginTop: '1.25rem',
              padding: '1rem',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <img
                src={uploadedPhotoSrc}
                alt="Selected Photo"
                style={{
                  width: '90px',
                  height: '110px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: extractedDescriptor ? '2px solid #10b981' : '2px solid #ef4444'
                }}
              />
              <div style={{ flex: 1, fontSize: '0.88rem' }}>
                <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '0.25rem' }}>
                  {enrollModalVoter?.full_name}
                </div>
                {processingPhoto && (
                  <div style={{ color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <RefreshCw size={14} className="pulse" />
                    <span>Analyzing facial features...</span>
                  </div>
                )}
                {faceStatusMsg && !processingPhoto && (
                  <div style={{ color: extractedDescriptor ? '#10b981' : '#f59e0b', fontSize: '0.85rem' }}>
                    {faceStatusMsg}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={closePhotoEnrollModal}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!extractedDescriptor || savingBiometrics}
              onClick={saveOfficialBiometrics}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <ShieldCheck size={16} />
              <span>{savingBiometrics ? 'Saving Biometrics...' : 'Save Official Biometrics'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={!!voterToDelete} onClose={() => setVoterToDelete(null)} title="Remove Voter">
        <p style={{ marginBottom: '1.5rem', color: '#cbd5e1' }}>
          Are you sure you want to remove voter <code>{voterToDelete}</code> from this election roster?
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => setVoterToDelete(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
            {deleting ? 'Removing...' : 'Remove Voter'}
          </button>
        </div>
      </Modal>

      {/* Photo Preview Modal */}
      <Modal isOpen={!!previewPhoto} onClose={() => setPreviewPhoto(null)} title={`Certified Official Photo: ${previewPhoto?.name}`}>
        {previewPhoto && (
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <img
              src={previewPhoto.photo}
              alt="Enrolled Face"
              style={{ maxWidth: '320px', width: '100%', borderRadius: '12px', border: '2px solid rgba(6, 182, 212, 0.5)' }}
            />
            <p className="text-secondary" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
              Certified 128-dimensional facial geometry profile registered in encrypted voter registry.
            </p>
          </div>
        )}
      </Modal>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default VoterRegistrationPage;
