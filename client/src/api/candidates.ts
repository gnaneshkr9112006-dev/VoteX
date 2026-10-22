import { apiGet, apiPost, apiPut, apiDelete } from './client';

export const candidatesApi = {
  addCandidate: (electionId: string, data: any) => apiPost(`/elections/${electionId}/candidates`, data),
  getCandidates: (electionId: string) => apiGet(`/elections/${electionId}/candidates`),
  updateCandidate: (electionId: string, candidateId: string, data: any) => apiPut(`/elections/${electionId}/candidates/${candidateId}`, data),
  deleteCandidate: (electionId: string, candidateId: string) => apiDelete(`/elections/${electionId}/candidates/${candidateId}`)
};
