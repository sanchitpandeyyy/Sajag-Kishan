/** Satellite pictures go through the API, which keeps a copy in Neon Object Storage after the first view. */
export function storedSat(url: string): string {
  return `/api/v1/satellite/img?src=${encodeURIComponent(url)}`;
}
