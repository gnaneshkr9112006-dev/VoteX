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

  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => ({}));
  } else {
    const rawText = await response.text().catch(() => '');
    if (response.status === 429) {
      throw new Error('Rate limit reached: Too many requests. Please wait a few moments and try again.');
    }
    if (!response.ok) {
      if (rawText && rawText.length < 200 && !rawText.includes('<!DOCTYPE') && !rawText.includes('<html')) {
        throw new Error(rawText.trim());
      }
      if (response.status === 500) {
        throw new Error(
          'Backend connection error (HTTP 500). Please verify the backend server is running on http://localhost:5000.'
        );
      }
      throw new Error(
        `Server returned HTTP ${response.status}. Please check your connection.`
      );
    }
    data = { message: rawText };
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(data?.message || 'Rate limit reached: Too many requests. Please wait a few moments.');
    }
    throw new Error(data?.message || `API request failed with status ${response.status}`);
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
  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => ({}));
  } else {
    const rawText = await response.text().catch(() => '');
    if (!response.ok) {
      throw new Error(rawText && rawText.length < 200 && !rawText.includes('<') ? rawText.trim() : `Upload failed with status ${response.status}`);
    }
    data = { message: rawText };
  }

  if (!response.ok) {
    throw new Error(data?.message || `Upload failed with status ${response.status}`);
  }

  return data;
}
