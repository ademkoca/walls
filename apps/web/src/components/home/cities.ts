export type CityKey = 'beograd' | 'noviSad' | 'nis' | 'kragujevac' | 'noviPazar';

/** `location` is the city as listings store it, so English pages search by the Serbian name. */
export const CITIES: { key: CityKey; location: string }[] = [
  { key: 'beograd', location: 'Beograd' },
  { key: 'noviSad', location: 'Novi Sad' },
  { key: 'nis', location: 'Niš' },
  { key: 'kragujevac', location: 'Kragujevac' },
  { key: 'noviPazar', location: 'Novi Pazar' },
];
