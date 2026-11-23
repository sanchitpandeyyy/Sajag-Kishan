"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { CROP_COLORS } from "@/lib/types";

export interface ParcelFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] } | { type: "Polygon"; coordinates: [number, number][][] };
  properties: {
    id: string;
    ward: number;
    areaM2: number;
    verification: string;
    farmerNameNe: string;
    tole: string;
    crop: string | null;
    cropNe: string | null;
    status?: string;
  };
}

const NO_CROP = "#9CA3AF";
const PILOT_CENTER: [number, number] = [80.18, 28.97];
const STATUS_COLORS: Record<string, string> = { cultivated: "#1f7a4d", weak: "#d9a93a", fallow: "#a0522d", unknown: "#c3c8d1" };

export function ParcelMap({ features, selectedId, onSelect, colorBy = "crop", height = "h-[460px]" }: { features: ParcelFeature[]; selectedId?: string | null; onSelect?: (id: string) => void; colorBy?: "crop" | "status"; height?: string }) {
  const colorByRef = useRef(colorBy);
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    void import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !el.current) return;
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const map = new maplibregl.Map({
        container: el.current,
        center: PILOT_CENTER,
        zoom: 12,
        attributionControl: { compact: true },
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              maxzoom: 19,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        map.addSource("parcels", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        const color = (
          colorByRef.current === "status"
            ? ["match", ["coalesce", ["get", "status"], "unknown"], ...Object.entries(STATUS_COLORS).flat(), NO_CROP]
            : ["match", ["coalesce", ["get", "crop"], "none"], ...Object.entries(CROP_COLORS).flat(), NO_CROP]
        ) as unknown as ExpressionSpecification;
        map.addLayer({
          id: "parcel-fill",
          type: "fill",
          source: "parcels",
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: { "fill-color": color, "fill-opacity": 0.45, "fill-outline-color": "#075426" },
        });
        map.addLayer({
          id: "parcel-points",
          type: "circle",
          source: "parcels",
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-color": color,
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 16, 12],
            "circle-stroke-width": ["case", ["==", ["get", "verification"], "VERIFIED"], 2.5, 1],
            "circle-stroke-color": ["case", ["==", ["get", "verification"], "VERIFIED"], "#075426", "#FFFFFF"],
          },
        });
        map.addLayer({
          id: "parcel-selected",
          type: "circle",
          source: "parcels",
          filter: ["==", ["get", "id"], ""],
          paint: { "circle-radius": 14, "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 3, "circle-stroke-color": "#FDB103" },
        });
        for (const layer of ["parcel-points", "parcel-fill"]) {
          map.on("click", layer, (e: MapLayerMouseEvent) => {
            const id = e.features?.[0]?.properties?.id as string | undefined;
            if (id) onSelectRef.current?.(id);
          });
          map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
        }
        mapRef.current = map;
      });
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let stop = false;
    const apply = () => {
      const map = mapRef.current;
      if (!map || stop) return false;
      const src = map.getSource("parcels") as GeoJSONSource | undefined;
      if (!src) return false;
      src.setData({ type: "FeatureCollection", features } as unknown as Parameters<GeoJSONSource["setData"]>[0]);
      const pts = features.flatMap((f) => (f.geometry.type === "Point" ? [f.geometry.coordinates] : (f.geometry.coordinates[0] ?? [])));
      if (pts.length) {
        const lngs = pts.map((p) => p[0]);
        const lats = pts.map((p) => p[1]);
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: 48, maxZoom: 15, duration: 0 },
        );
      }
      return true;
    };
    if (!apply()) {
      const t = setInterval(() => apply() && clearInterval(t), 200);
      return () => {
        stop = true;
        clearInterval(t);
      };
    }
  }, [features]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer("parcel-selected")) map.setFilter("parcel-selected", ["==", ["get", "id"], selectedId ?? ""]);
  }, [selectedId]);

  return <div ref={el} className={`${height} w-full overflow-hidden rounded-lg`} role="region" aria-label="Parcel map" />;
}

export function CropLegend({ crops, noCropLabel, verifiedLabel }: { crops: { crop: string; name: string }[]; noCropLabel: string; verifiedLabel: string }) {
  return (
    <ul className="flex flex-wrap gap-3 text-xs">
      {crops.map((c) => (
        <li key={c.crop} className="flex items-center gap-1">
          <span className="inline-block size-3 rounded-full" style={{ background: CROP_COLORS[c.crop] ?? NO_CROP }} />
          {c.name}
        </li>
      ))}
      <li className="flex items-center gap-1">
        <span className="inline-block size-3 rounded-full" style={{ background: NO_CROP }} />
        {noCropLabel}
      </li>
      <li className="flex items-center gap-1">
        <span className="inline-block size-3 rounded-full border-2 border-brand-800 bg-white" />
        {verifiedLabel}
      </li>
    </ul>
  );
}
