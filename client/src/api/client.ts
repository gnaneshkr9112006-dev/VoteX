const getBaseUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, '');
  }
  return '';
};

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const base = getBaseUrl();
  const url = `${base}/api${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });

  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    if (!response.ok) {
      throw new Error(
        `Backend API unreachable (HTTP ${response.status}). If deployed on Vercel, please connect your backend server URL via VITE_API_URL.`
      );
    }
    throw new Error(
      'Invalid response format from server (received HTML instead of JSON). Backend API is not running at this domain.'
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `API request failed with status ${response.status}`);
  }

  return data;
}

export const apiGet = (endpoint: string) => apiFetch(endpoint);
export const apiPost = (endpoint: string, data: any) =>
  apiFetch(endpoint, { method: 'POST', body: JSON.stringify(data) });
export const apiPut = (endpoint: string, data: any) =>
  apiFetch(endpoint, { method: 'PUT', body: JSON.stringify(data) });
export const apiDelete = (endpoint: string) =>
  apiFetch(endpoint, { method: 'DELETE' });

export async function apiUpload(endpoint: string, formData: FormData) {
  const base = getBaseUrl();
  const url = `${base}/api${endpoint}`;

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    credentials: 'include'
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Upload failed: Backend API returned invalid response format.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Upload failed with status ${response.status}`);
  }

  return data;
}
