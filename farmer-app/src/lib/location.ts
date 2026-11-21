/** Save a field's location from the phone's GPS (stand in the field, tap once). */
import * as Location from "expo-location";
import { api } from "./api";

export type LocationResult = { ok: true; accuracyM: number | null } | { ok: false; reason: "denied" | "unavailable" | "failed" };

export async function saveFieldLocation(parcelId: string): Promise<LocationResult> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: "denied" };
  if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: "unavailable" };
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const accuracyM = pos.coords.accuracy != null ? Math.round(pos.coords.accuracy) : null;
    await api(`/v1/parcels/${parcelId}/location`, {
      method: "PATCH",
      body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, ...(accuracyM != null ? { accuracyM } : {}) }),
    });
    return { ok: true, accuracyM };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
