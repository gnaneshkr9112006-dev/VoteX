import { apiGet, apiPost } from './client';

export const authApi = {
  adminLogin: (data: any) => apiPost('/auth/admin/login', data),
  voterLogin: (data: any) => apiPost('/auth/voter/login', data),
  logout: () => apiPost('/auth/logout', {}),
  getCurrentUser: () => apiGet('/auth/me'),
  googleLogin: (data: { idToken: string; roomNumber?: string; role?: 'admin' | 'voter' }) =>
    apiPost('/auth/google', data),
  unifiedLogin: (data: { identifier: string; authProvider?: string; name?: string; avatar?: string }) =>
    apiPost('/auth/unified/login', data),
  unifiedSelectRole: (data: { identifier: string; role: 'admin' | 'voter'; name?: string; roomNumber?: string }) =>
    apiPost('/auth/unified/select-role', data),
  unifiedResetRole: (data: { identifier: string }) =>
    apiPost('/auth/unified/reset-role', data)
};
