export type GeocodeResult =
  | { status: 'found'; lat: number; lng: number }
  | { status: 'not_found' }
  | { status: 'error'; message: string };
