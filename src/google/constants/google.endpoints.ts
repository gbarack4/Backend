export const GOOGLE_ENDPOINTS = {
  ACCOUNTS: 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
  LOCATIONS: (accountName: string) =>
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
  REVIEWS: (accountName: string, locationName: string) =>
    `https://mybusinessreviews.googleapis.com/v1/${accountName}/${locationName}/reviews`,
  GEOCODING: 'https://maps.googleapis.com/maps/api/geocode/json',
  TIMEZONE: 'https://maps.googleapis.com/maps/api/timezone/json',
} as const;
