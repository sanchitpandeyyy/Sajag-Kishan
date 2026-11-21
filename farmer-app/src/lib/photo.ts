/** Take a photo of a field with the camera and store it (Neon Object Storage, via the API). */
import * as ImagePicker from "expo-image-picker";
import { apiUpload } from "./api";

export type PhotoResult = { ok: true } | { ok: false; reason: "denied" | "cancelled" | "failed" };

export async function takeFieldPhoto(parcelId: string): Promise<PhotoResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: "denied" };
  const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6, allowsEditing: false, exif: false });
  if (shot.canceled || !shot.assets[0]) return { ok: false, reason: "cancelled" };
  const a = shot.assets[0];
  const form = new FormData();
  form.append("entity", "parcel");
  form.append("entityId", parcelId);
  // React Native's FormData accepts a { uri, name, type } file descriptor.
  form.append("file", { uri: a.uri, name: a.fileName ?? `field-${Date.now()}.jpg`, type: a.mimeType ?? "image/jpeg" } as unknown as Blob);
  try {
    await apiUpload("/v1/files", form);
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
