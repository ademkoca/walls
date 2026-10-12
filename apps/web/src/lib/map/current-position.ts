import type { Coordinates } from './map-provider';

/** The device location could not be read: the user denied access, or it is unavailable. */
export class PositionError extends Error {
  constructor(readonly reason: 'denied' | 'unavailable') {
    super(`Device location ${reason}`);
    this.name = 'PositionError';
  }
}

const TIMEOUT_MS = 10_000;
const MAX_CACHED_AGE_MS = 60_000;

/**
 * The device's current position. The browser asks the user for permission the first time;
 * call only from an explicit user action. Rejects with a `PositionError`.
 */
export function currentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new PositionError('unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) =>
        reject(
          new PositionError(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'),
        ),
      { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: MAX_CACHED_AGE_MS },
    );
  });
}
