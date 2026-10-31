export const API_BASE = 'https://sonaa-backend-v2.vercel.app/api';
async function api(path, options = {}) {
  const { token, body, headers, signal: externalSignal, timeoutMs = 30000, ...fetchOptions } = options;
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', abortFromCaller, { once: true });
  }
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (timedOut) throw new Error('الخادم لم يستجب خلال 30 ثانية. تحقق من الاتصال ثم حاول مرة أخرى.');
    if (error?.name === 'AbortError') throw new Error('تم إلغاء الطلب قبل اكتماله.');
    throw new Error('تعذر الاتصال بالإنترنت أو بالخادم. تأكد من الاتصال ثم أعد المحاولة.');
  } finally {
    clearTimeout(timeout);
    if (externalSignal) externalSignal.removeEventListener('abort', abortFromCaller);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || data.error || `خطأ من الخادم (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}
export { api };
