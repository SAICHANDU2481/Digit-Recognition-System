/**
 * Application & API Configuration
 *
 * In production (e.g., hosted on Vercel), set VITE_API_BASE_URL in your Vercel
 * project settings to your backend deployment URL (e.g., https://your-backend.onrender.com).
 *
 * In local development, if VITE_API_BASE_URL is not set, API requests default to relative paths
 * (e.g., /api/...), which Vite proxies to http://localhost:5000 via vite.config.js.
 */

const rawBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

// Normalize: If user provides "https://host.com/api", strip trailing "/api"
// so that calling getApiUrl('/api/health') or getApiUrl('/health') yields consistent URLs.
export const API_BASE_URL = rawBase.endsWith('/api') ? rawBase.slice(0, -4) : rawBase;

/**
 * Helper to construct an absolute or relative endpoint URL.
 *
 * @param {string} endpoint - The endpoint path, e.g. '/api/health' or '/api/predict'
 * @returns {string} The fully resolved URL
 */
export const getApiUrl = (endpoint) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (!API_BASE_URL) {
    return cleanEndpoint;
  }
  return `${API_BASE_URL}${cleanEndpoint}`;
};
