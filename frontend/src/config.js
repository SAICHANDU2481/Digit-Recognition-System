/**
 * Application & API Configuration
 *
 * Dynamically resolves the backend API URL:
 * 1. Checks user-configured override in localStorage ('digitvision_api_url')
 * 2. Checks build-time environment variable VITE_API_BASE_URL (configured on Vercel)
 * 3. Falls back to relative paths for local development (proxied by Vite)
 */

export const getApiBaseUrl = () => {
  let raw = '';
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem('digitvision_api_url');
    if (stored && stored.trim()) {
      raw = stored.trim();
    }
  }

  if (!raw) {
    raw = (import.meta.env.VITE_API_BASE_URL || '').trim();
  }

  raw = raw.replace(/\/+$/, '');
  return raw.endsWith('/api') ? raw.slice(0, -4) : raw;
};

export const setCustomApiUrl = (url) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (url && url.trim()) {
      window.localStorage.setItem('digitvision_api_url', url.trim());
    } else {
      window.localStorage.removeItem('digitvision_api_url');
    }
  }
};

export const API_BASE_URL = getApiBaseUrl();

/**
 * Helper to construct an absolute or relative endpoint URL.
 *
 * @param {string} endpoint - The endpoint path, e.g. '/api/health' or '/api/predict'
 * @returns {string} The fully resolved URL
 */
export const getApiUrl = (endpoint) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const base = getApiBaseUrl();
  if (!base) {
    return cleanEndpoint;
  }
  return `${base}${cleanEndpoint}`;
};
