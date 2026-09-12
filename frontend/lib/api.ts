import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { tryGetFirebaseAuth } from './firebase';
import { getDevToken } from './devSession';
import { logger } from './logger';

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
  timeout: 20_000,
});

/** Path without the query string: search terms can name people. */
function logPath(config: { url?: string }): string {
  return config.url?.split('?')[0] ?? '?';
}

/** Attach an identity to every request: the Firebase JWT when signed in,
 *  otherwise a locally stored dev token (dev mode only; the backend rejects
 *  dev tokens everywhere else). */
api.interceptors.request.use(async (config) => {
  const user = tryGetFirebaseAuth()?.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    const devToken = getDevToken();
    if (devToken) config.headers.Authorization = `Bearer ${devToken}`;
  }
  logger.debug('API →', config.method?.toUpperCase(), logPath(config));
  return config;
});

api.interceptors.response.use(
  (response) => {
    logger.debug('API ←', response.status, logPath(response.config));
    return response;
  },
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original = error.config as RetriableConfig | undefined;
    const user = tryGetFirebaseAuth()?.currentUser;

    logger.warn('API error', status, original && logPath(original));

    // Expired token. Refresh once and retry, so a user who left a tab open
    // overnight does not get bounced to login on their first click.
    if (status === 401 && original && !original._retried && user) {
      original._retried = true;
      logger.debug('Refreshing expired token and retrying once');
      await user.getIdToken(true);
      return api(original);
    }

    // Wrong portal for this account. Usually a stale claim after an admin
    // changed the role: refresh it and let RoleGate redirect on the new value.
    if (status === 403 && user) {
      logger.debug('Refreshing claims after a 403');
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
