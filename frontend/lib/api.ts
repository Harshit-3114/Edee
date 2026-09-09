import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { tryGetFirebaseAuth } from './firebase';

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
  timeout: 20_000,
});

/** Attach the Firebase JWT to every request automatically. */
api.interceptors.request.use(async (config) => {
  const user = tryGetFirebaseAuth()?.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original = error.config as RetriableConfig | undefined;
    const user = tryGetFirebaseAuth()?.currentUser;

    // Expired token. Refresh once and retry, so a user who left a tab open
    // overnight does not get bounced to login on their first click.
    if (status === 401 && original && !original._retried && user) {
      original._retried = true;
      await user.getIdToken(true);
      return api(original);
    }

    // Wrong portal for this account. Usually a stale claim after an admin
    // changed the role: refresh it and let RoleGate redirect on the new value.
    if (status === 403 && user) {
      await user.getIdToken(true);
    }

    return Promise.reject(error);
  },
);

/** Pull a human-readable message out of a FastAPI error response. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      if (first?.msg) return first.msg;
    }
    if (error.code === 'ECONNABORTED') return 'The server took too long to respond.';
    if (!error.response) return 'Could not reach the server. Check your connection.';
  }
  return fallback;
}

export type { AxiosRequestConfig };
export default api;
