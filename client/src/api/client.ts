export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'API request failed');
  }
  return response.json();
}

export const apiGet = (endpoint: string) => apiFetch(endpoint);
export const apiPost = (endpoint: string, data: any) => apiFetch(endpoint, { method: 'POST', body: JSON.stringify(data) });
export const apiPut = (endpoint: string, data: any) => apiFetch(endpoint, { method: 'PUT', body: JSON.stringify(data) });
export const apiDelete = (endpoint: string) => apiFetch(endpoint, { method: 'DELETE' });

export async function apiUpload(endpoint: string, formData: FormData) {
  const response = await fetch(`/api${endpoint}`, {
    method: 'POST',
    body: formData,
    credentials: 'include'
    // No Content-Type header — browser sets it with boundary for multipart
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Upload failed');
  }
  return response.json();
}
