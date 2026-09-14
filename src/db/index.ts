import type { ApiError } from '../../shared/api';
export class RequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method, credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000),
      ...(data !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}),
    });
  } catch {
    throw new RequestError(method === 'GET' ? 'Cannot reach MyCoach. Check the host Mac and your network.' : 'Connection lost. The save could not be confirmed. Reconnect and check the latest data before retrying.', 0);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'The server could not complete the request.' })) as ApiError;
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('mycoach-session-expired'));
    throw new RequestError(body.message, response.status);
  }
  return response.json() as Promise<T>;
}
