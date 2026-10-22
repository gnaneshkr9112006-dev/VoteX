import { apiGet, apiPost } from './client';

export const voteApi = {
  getFaceProfile: () => apiGet('/vote/face-profile'),
  enrollFace: (data: { faceDescriptor: number[]; photoBase64?: string }) => apiPost('/vote/enroll-face', data),
  verifyBiometric: (data: any) => apiPost('/vote/verify', data),
  castVote: (data: any) => apiPost('/vote/cast', data),
  getReceipt: (receiptId: string) => apiGet(`/vote/receipt/${receiptId}`),
  getVoteStatus: () => apiGet('/vote/status')
};

