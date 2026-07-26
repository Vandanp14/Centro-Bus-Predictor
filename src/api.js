const configuredBase =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  '';

const normalizedBase = configuredBase.replace(/\/+$/, '');

export const API_BASE_URL = normalizedBase
  ? normalizedBase.endsWith('/api/v1')
    ? normalizedBase
    : `${normalizedBase}/api/v1`
  : '/api/v1';
