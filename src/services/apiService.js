import { API_BASE_URL } from '../api';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'REQUEST_FAILED', requestId = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

async function request(path, { signal } = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('The live Centro service could not be reached.', {
      code: 'NETWORK_ERROR',
    });
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError('The server returned an unreadable response.', {
      status: response.status,
      code: 'INVALID_RESPONSE',
    });
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message || 'The request could not be completed.',
      {
        status: response.status,
        code: payload?.error?.code,
        requestId: payload?.error?.requestId,
      }
    );
  }

  return payload;
}

const queryString = (params) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value);
    }
  });
  return query.toString();
};

export const getHealth = (options) => request('/health', options);

export const getRoutes = (options) => request('/routes', options);

export const getDirections = (routeId, options) =>
  request(`/routes/${encodeURIComponent(routeId)}/directions`, options);

export const getStops = (routeId, direction, options) =>
  request(
    `/routes/${encodeURIComponent(routeId)}/stops?${queryString({ direction })}`,
    options
  );

export const getPredictions = (routeId, stopId, direction, options) =>
  request(
    `/predictions?${queryString({
      route: routeId,
      stop: stopId,
      direction,
    })}`,
    options
  );

export const getTrip = (routeId, stopId, direction, options) =>
  request(
    `/trip?${queryString({
      route: routeId,
      stop: stopId,
      direction,
    })}`,
    options
  );

export const getVehicles = (routeId, options) =>
  request(`/routes/${encodeURIComponent(routeId)}/vehicles`, options);

export const getAllVehicles = (options) =>
  request('/vehicles', options);

export const getPatterns = (routeId, direction, options) =>
  request(
    `/routes/${encodeURIComponent(routeId)}/patterns?${queryString({ direction })}`,
    options
  );

// Compatibility exports for any older component that has not yet migrated.
export const getPrediction = async (routeId, stopId, direction, options) => {
  const payload = await getPredictions(routeId, stopId, direction, options);
  return payload.predictions?.[0] || null;
};

