import { getPredictions, getStops } from './apiService';

const jsonResponse = (payload, ok = true, status = 200) =>
  Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(payload),
  });

describe('Centro API service', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('encodes direction and stop values in prediction requests', async () => {
    global.fetch.mockReturnValue(
      jsonResponse({ predictions: [], message: 'No service scheduled' })
    );

    const payload = await getPredictions(
      'OSW10',
      '15521',
      'FROM CAMPUS'
    );

    expect(payload.message).toBe('No service scheduled');
    expect(global.fetch.mock.calls[0][0]).toContain(
      '/api/v1/predictions?route=OSW10&stop=15521&direction=FROM+CAMPUS'
    );
  });

  test('returns the API error message for a failed request', async () => {
    global.fetch.mockReturnValue(
      jsonResponse(
        {
          error: {
            code: 'MISSING_DIRECTION',
            message: 'Choose a route direction.',
            requestId: 'request-1',
          },
        },
        false,
        400
      )
    );

    await expect(getStops('OSW10', '')).rejects.toMatchObject({
      message: 'Choose a route direction.',
      code: 'MISSING_DIRECTION',
      requestId: 'request-1',
    });
  });
});

