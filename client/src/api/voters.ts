import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from './client';

export const votersApi = {
  registerVoter: (electionId: string, data: any) => apiPost(`/elections/${electionId}/voters`, data),
  getVoters: (electionId: string) => apiGet(`/elections/${electionId}/voters`),
  updateVoter: (electionId: string, voterId: string, data: any) =>
    apiPut(`/elections/${electionId}/voters/${voterId}`, data),
  deleteVoter: (electionId: string, voterId: string) => apiDelete(`/elections/${electionId}/voters/${voterId}`),
  clearAllVoters: (electionId: string) => apiDelete(`/elections/${electionId}/voters`),
  enrollVoterFace: (electionId: string, voterId: string, data: { faceDescriptor: number[]; photoBase64?: string }) =>
    apiPost(`/elections/${electionId}/voters/${voterId}/face`, data),
  importVotersCSV: (electionId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiUpload(`/elections/${electionId}/voters/import`, formData);
  }
};
