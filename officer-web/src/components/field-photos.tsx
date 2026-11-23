"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { api, apiForm } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useApi } from "@/lib/use-api";

interface FileRow {
  id: string;
  fileName: string;
  contentType: string;
  url: string;
  createdAt: string;
}

export function FieldPhotos({ parcelId }: { parcelId: string }) {
  const { tr } = useLang();
  const files = useApi<FileRow[]>(`/v1/files?entity=parcel&entityId=${parcelId}`);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(p: FileRow) {
    if (!window.confirm(tr(`"${p.fileName}" हटाउने?`, `Delete "${p.fileName}"?`))) return;
    setError(null);
    try {
      await api(`/v1/files/${p.id}`, { method: "DELETE" });
      await files.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("हटाउन सकिएन", "Could not delete"));
    }
  }

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("entity", "parcel");
      form.append("entityId", parcelId);
      form.append("file", file);
      await apiForm("/v1/files", form);
      await files.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr("अपलोड हुन सकेन", "Upload failed"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const photos = (files.data ?? []).filter((f) => f.contentType.startsWith("image/"));

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-heading text-h4 text-ink">{tr("खेतका फोटो", "Field photos")}</h3>
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="inline-flex min-h-10 items-center gap-2 rounded-control border-[1.5px] border-input-border bg-white px-3 text-small font-semibold text-ink hover:border-ink disabled:opacity-50"
        >
          <Camera className="size-4" /> {busy ? tr("अपलोड हुँदैछ", "Uploading") : tr("फोटो थप्नुहोस्", "Add photo")}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
      </div>
      {error && <p className="mt-2 text-small text-danger">{error}</p>}
      {files.data && photos.length === 0 && <p className="mt-2 text-small text-muted">{tr("फोटो छैन।", "No photos yet.")}</p>}
      {photos.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="relative">
              <button
                type="button"
                onClick={() => void remove(p)}
                aria-label={tr("फोटो हटाउनुहोस्", "Delete photo")}
                className="absolute top-1 right-1 z-10 grid size-8 place-items-center rounded-full bg-white/90 text-danger shadow-card hover:bg-white"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-control border border-line bg-fill">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.fileName} className="size-full object-cover" loading="lazy" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
