import axios from 'axios';

// Use NEXT_PUBLIC_API_URL from environment, fallback to localhost for development
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// 10 minute timeout for long-running LLM requests (curriculum generation)
const REQUEST_TIMEOUT = 600000;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for auth tokens if needed
api.interceptors.request.use(
  (config) => {
    // Add auth token from localStorage or context if available
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Request failed';
    return Promise.reject(new Error(message));
  }
);

// Custom error class to include more details
class APIError extends Error {
  details?: string[];
  code?: string;

  constructor(message: string, details?: string[], code?: string) {
    super(message);
    this.name = 'APIError';
    this.details = details;
    this.code = code;
  }
}

// Legacy fetch API for backward compatibility
export async function fetchAPI(endpoint: string, options?: RequestInit) {
  // Get auth token
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  // Use relative URL if no base URL (production with proxy)
  const url = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;

  // Create AbortController with 10-minute timeout for long-running LLM requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      const message = errorData.error || errorData.message || 'Request failed';
      const details = errorData.details || [];
      throw new APIError(message, details, errorData.code);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new APIError(
        'Request timed out. The operation is taking longer than expected. Please try again.',
        [],
        'TIMEOUT'
      );
    }
    throw error;
  }
}
