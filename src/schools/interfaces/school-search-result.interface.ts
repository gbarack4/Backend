export interface SchoolSearchResult {
  id: string;
  locationId: string | null;
  name: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  about: string | null;
  address: string | null;
  suburb: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number;
  reviewCount: number;
  distance: number | null;
}
