export interface GoogleAccount {
  name: string;
}

export interface GoogleAccountsResponse {
  accounts?: GoogleAccount[];
}

export interface GoogleLocationsResponse {
  locations?: Array<{ name: string; title: string }>;
}

export interface GoogleReviewsResponse {
  reviews?: Array<Record<string, unknown>>;
}

export interface GoogleLocation {
  id: string;
  title: string;
  accountName: string;
}

export type SchoolGoogleData = {
  id: string;
  accessToken: string | null;
  refreshToken: string | null;
  locationName: string | null;
  googleAccountId: string | null;
};

export interface GoogleGeocodeResponse {
  status: string;
  results: {
    geometry: {
      location: { lat: number; lng: number };
    };
  }[];
}

export interface GoogleTimezoneResponse {
  status: string;
  timeZoneId: string;
}
