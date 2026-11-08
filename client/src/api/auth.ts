import { apiGet, apiPost } from './client';

export const authApi = {
  adminLogin: (data: any) => apiPost('/auth/admin/login', data),
  voterLogin: (data: any) => apiPost('/auth/voter/login', data),
  lookupVoterPhone: (data: { roomNumber: string; voterId: string }) => apiPost('/auth/voter/lookup-phone', data),
  sendVoterOtp: (data: any) => apiPost('/auth/voter/send-otp', data),
  verifyVoterOtp: (data: any) => apiPost('/auth/voter/verify-otp', data),
  logout: () => apiPost('/auth/logout', {}),
  getCurrentUser: () => apiGet('/auth/me')
};
