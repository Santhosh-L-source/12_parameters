let realAxios = null;
try {
  realAxios = require('axios');
} catch (e) {
  // Use built-in fetch fallback
}

async function fetchAdapter(urlOrConfig, maybeConfig = {}) {
  let url = typeof urlOrConfig === 'string' ? urlOrConfig : (urlOrConfig.url || '');
  let config = typeof urlOrConfig === 'object' ? urlOrConfig : maybeConfig;
  let method = (config.method || 'GET').toUpperCase();
  let headers = config.headers || {};
  let body = config.data
    ? (typeof config.data === 'string' ? config.data : JSON.stringify(config.data))
    : undefined;

  if (config.params) {
    const query = new URLSearchParams(config.params).toString();
    if (query) url += (url.includes('?') ? '&' : '?') + query;
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
    signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (_) {
      data = await response.text();
    }
  } else {
    data = await response.text();
  }

  return {
    data,
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
  };
}

const axios = realAxios || ((url, config) => fetchAdapter(url, config));
if (!realAxios) {
  axios.get = (url, config) => fetchAdapter(url, { ...config, method: 'GET' });
  axios.post = (url, data, config) => fetchAdapter(url, { ...config, method: 'POST', data });
  axios.put = (url, data, config) => fetchAdapter(url, { ...config, method: 'PUT', data });
  axios.delete = (url, config) => fetchAdapter(url, { ...config, method: 'DELETE' });
  axios.create = () => axios;
}

module.exports = axios;
