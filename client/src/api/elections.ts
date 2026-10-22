import { apiGet, apiPost, apiPut } from './client';

export const electionsApi = {
  createElection: (data: any) => apiPost('/elections', data),
  getElections: () => apiGet('/elections'),
  getElection: (id: string) => apiGet(`/elections/${id}`),
  updateElection: (id: string, data: any) => apiPut(`/elections/${id}`, data),
  closeElection: (id: string) => apiPost(`/elections/${id}/close`, {}),
  publishResults: (id: string) => apiPost(`/elections/${id}/publish`, {}),
  getElectionStats: (id: string) => apiGet(`/elections/${id}/stats`),
  getPublicElections: (search?: string) =>
    apiGet('/elections/public' + (search ? `?search=${encodeURIComponent(search)}` : '')),
  seedScale200: (count = 205) => apiPost('/elections/scale/seed-200', { count })
};
