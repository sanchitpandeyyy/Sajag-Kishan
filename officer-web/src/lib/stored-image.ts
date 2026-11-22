export function storedSat(url: string): string {
  return `/api/v1/satellite/img?src=${encodeURIComponent(url)}`;
}
