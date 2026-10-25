import { apiGet, apiPost } from './client';

export const authApi = {
  adminLogin: (data: any) => apiPost('/auth/admin/login', data),
  voterLogin: (data: any) => apiPost('/auth/voter/login', data),
  logout: () => apiPost('/auth/logout', {}),
  getCurrentUser: () => apiGet('/auth/me')
};
