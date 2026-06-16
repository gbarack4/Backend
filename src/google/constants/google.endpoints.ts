export const GOOGLE_ENDPOINTS = {
  ACCOUNTS: 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
  LOCATIONS: (accountName: string) =>
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
  REVIEWS: (locationName: string) =>
    `https://mybusiness.googleapis.com/v4/${locationName}/reviews`,
} as const;
