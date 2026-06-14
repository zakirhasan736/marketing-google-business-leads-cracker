export function getGoogleMapsPlaceUrl(
  placeId: string,
  name?: string
): string {
  const params = new URLSearchParams({
    api: "1",
    query_place_id: placeId,
  });
  if (name) {
    params.set("query", name);
  }
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function getLeadMapsUrl(lead: {
  placeId: string;
  name: string;
  mapsUrl?: string | null;
}): string {
  return lead.mapsUrl || getGoogleMapsPlaceUrl(lead.placeId, lead.name);
}
