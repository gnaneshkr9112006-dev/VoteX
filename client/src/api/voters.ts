import { apiGet, apiPost, apiDelete, apiFetch } from './client';

export const votersApi = {
  registerVoter: (electionId: string, data: any) => apiPost(`/elections/${electionId}/voters`, data),
  getVoters: (electionId: string) => apiGet(`/elections/${electionId}/voters`),
  deleteVoter: (electionId: string, voterId: string) => apiDelete(`/elections/${electionId}/voters/${voterId}`),
  enrollVoterFace: (electionId: string, voterId: string, data: { faceDescriptor: number[]; photoBase64?: string }) =>
    apiPost(`/elections/${electionId}/voters/${voterId}/face`, data),
  importVotersCSV: async (electionId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`/api/elections/${electionId}/voters/import`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  }
};
