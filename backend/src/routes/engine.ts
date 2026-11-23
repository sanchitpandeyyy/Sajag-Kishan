import {
  evaluateLateBlight,
  evaluateRiceBlast,
  evaluateWeatherAlerts,
  fetchForecast,
  rankCrops,
  ZONE_LABEL_NE,
  zoneForElevation,
} from "../engine";
import { geoPointSchema } from "../shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";

const pointQuery = z.object({ lat: z.coerce.number(), lng: z.coerce.number() }).pipe(geoPointSchema);

export const engineRoutes = new Hono<AppEnv>()
  .get("/alerts", zValidator("query", pointQuery), async (c) => {
    const { lat, lng } = c.req.valid("query");
    const fc = await fetchForecast(lat, lng);
    const zone = zoneForElevation(fc.elevationM);
    return c.json({
      location: { lat, lng, elevationM: fc.elevationM, zone, zoneNe: ZONE_LABEL_NE[zone] },
      alerts: [...evaluateWeatherAlerts(fc.daily), ...evaluateLateBlight(fc.hourly), ...evaluateRiceBlast(fc.hourly)],
      daily: fc.daily,
      source: "open-meteo",
    });
  })
  .get(
    "/suitability",
    zValidator(
      "query",
      z.object({
        tempC: z.coerce.number(),
        rainMm: z.coerce.number(),
        soilPh: z.coerce.number().optional(),
        irrigated: z.enum(["true", "false"]).optional(),
      }),
    ),
    (c) => {
      const q = c.req.valid("query");
      return c.json({
        ranking: rankCrops({
          seasonMeanTempC: q.tempC,
          seasonRainMm: q.rainMm,
          soilPh: q.soilPh,
          irrigated: q.irrigated === "true",
        }),
        model: "ecocrop-v0.1",
      });
    },
  );
