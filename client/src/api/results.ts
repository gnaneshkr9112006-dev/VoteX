import { apiGet } from './client';

export const resultsApi = {
  getResults: (electionId: string) => apiGet(`/elections/${electionId}/results`),
  getResultsByRoom: (roomNumber: string) => apiGet(`/elections/room/${roomNumber}/results`)
};
