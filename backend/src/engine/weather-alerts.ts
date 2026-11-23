export type Severity = "INFO" | "WARNING" | "SEVERE";

export type AlertType =
  | "HEAVY_RAIN"
  | "FLOOD_RISK"
  | "FROST"
  | "HEAT"
  | "DRY_SPELL"
  | "STRONG_WIND"
  | "LATE_BLIGHT"
  | "RICE_BLAST";

export interface DailyForecast {
  date: string;
  precipitationMm: number;
  tempMaxC: number;
  tempMinC: number;
  windGustMaxKmh?: number;
}

export interface HourlyForecast {
  time: string;
  tempC: number;
  relativeHumidity: number;
}

export interface EngineAlert {
  type: AlertType;
  severity: Severity;
  date: string;
  titleNe: string;
  messageNe: string;
  evidence: Record<string, number | string>;
  ruleVersion: string;
}

const RULE_VERSION = "weather-v0.1";

export function evaluateWeatherAlerts(days: DailyForecast[]): EngineAlert[] {
  const alerts: EngineAlert[] = [];

  days.forEach((d, i) => {
    if (d.precipitationMm >= 50) {
      const severe = d.precipitationMm >= 100;
      alerts.push({
        type: "HEAVY_RAIN",
        severity: severe ? "SEVERE" : "WARNING",
        date: d.date,
        titleNe: severe ? "अति भारी वर्षाको खतरा" : "भारी वर्षाको सम्भावना",
        messageNe: "खेतबाट पानी निकास गर्नुहोस्, मल र विषादी छर्ने काम सार्नुहोस्।",
        evidence: { precipitationMm: d.precipitationMm },
        ruleVersion: RULE_VERSION,
      });
    }

    const threeDay = days.slice(i, i + 3).reduce((s, x) => s + x.precipitationMm, 0);
    if (i + 3 <= days.length && threeDay >= 150) {
      alerts.push({
        type: "FLOOD_RISK",
        severity: "SEVERE",
        date: d.date,
        titleNe: "बाढी/पहिरोको जोखिम",
        messageNe: "तीन दिनमा धेरै वर्षा हुने देखिन्छ। पशु र भण्डारण सुरक्षित स्थानमा राख्नुहोस्।",
        evidence: { threeDayPrecipitationMm: Math.round(threeDay) },
        ruleVersion: RULE_VERSION,
      });
    }

    if (d.tempMinC <= 2) {
      alerts.push({
        type: "FROST",
        severity: d.tempMinC <= 0 ? "SEVERE" : "WARNING",
        date: d.date,
        titleNe: "तुसारो पर्ने सम्भावना",
        messageNe: "बेलुका हल्का सिँचाइ गर्नुहोस्, नर्सरी र तरकारी छोप्नुहोस्।",
        evidence: { tempMinC: d.tempMinC },
        ruleVersion: RULE_VERSION,
      });
    }

    if (d.tempMaxC >= 38) {
      alerts.push({
        type: "HEAT",
        severity: "WARNING",
        date: d.date,
        titleNe: "अत्यधिक गर्मी",
        messageNe: "बिहान/बेलुका सिँचाइ गर्नुहोस्, दिउँसो खेतमा काम नगर्नुहोस्।",
        evidence: { tempMaxC: d.tempMaxC },
        ruleVersion: RULE_VERSION,
      });
    }

    if ((d.windGustMaxKmh ?? 0) >= 50) {
      alerts.push({
        type: "STRONG_WIND",
        severity: "WARNING",
        date: d.date,
        titleNe: "हावाहुरीको सम्भावना",
        messageNe: "पाकेको बाली छिटो भित्र्याउनुहोस्, टनेल/प्लास्टिक बाँध्नुहोस्।",
        evidence: { windGustMaxKmh: d.windGustMaxKmh ?? 0 },
        ruleVersion: RULE_VERSION,
      });
    }
  });

  if (days.length >= 10) {
    const firstTen = days.slice(0, 10);
    const total = firstTen.reduce((s, x) => s + x.precipitationMm, 0);
    if (total <= 2) {
      alerts.push({
        type: "DRY_SPELL",
        severity: "WARNING",
        date: firstTen[0]!.date,
        titleNe: "खडेरीको सम्भावना",
        messageNe: "आगामी १० दिन वर्षा नहुने देखिन्छ। सिँचाइको योजना बनाउनुहोस्।",
        evidence: { tenDayPrecipitationMm: Math.round(total * 10) / 10 },
        ruleVersion: RULE_VERSION,
      });
    }
  }

  return alerts;
}

function hoursPerDay(hours: HourlyForecast[], pred: (h: HourlyForecast) => boolean): Map<string, { match: number; minTemp: number }> {
  const byDay = new Map<string, { match: number; minTemp: number }>();
  for (const h of hours) {
    const day = h.time.slice(0, 10);
    const cur = byDay.get(day) ?? { match: 0, minTemp: Number.POSITIVE_INFINITY };
    if (pred(h)) cur.match += 1;
    cur.minTemp = Math.min(cur.minTemp, h.tempC);
    byDay.set(day, cur);
  }
  return byDay;
}

export function evaluateLateBlight(hours: HourlyForecast[]): EngineAlert[] {
  const days = [...hoursPerDay(hours, (h) => h.relativeHumidity >= 90)].sort(([a], [b]) => a.localeCompare(b));
  const alerts: EngineAlert[] = [];
  for (let i = 1; i < days.length; i++) {
    const [d0, a] = days[i - 1]!;
    const [d1, b] = days[i]!;
    const ok = (x: { match: number; minTemp: number }) => x.minTemp >= 10 && x.match >= 11;
    if (ok(a) && ok(b)) {
      alerts.push({
        type: "LATE_BLIGHT",
        severity: "WARNING",
        date: d1,
        titleNe: "डढुवा (लेट ब्लाइट) रोगको जोखिम",
        messageNe: "आलु/गोलभेंडा नियमित निरीक्षण गर्नुहोस्। सिफारिस गरिएको रोकथाम उपायबारे कृषि प्राविधिकसँग सल्लाह लिनुहोस्।",
        evidence: { from: d0, to: d1, humidHoursDay1: a.match, humidHoursDay2: b.match },
        ruleVersion: "blight-v0.1",
      });
    }
  }
  return alerts;
}

export function evaluateRiceBlast(hours: HourlyForecast[]): EngineAlert[] {
  const byDay = hoursPerDay(hours, (h) => h.relativeHumidity >= 90 && h.tempC >= 20 && h.tempC <= 26);
  return [...byDay]
    .filter(([, v]) => v.match >= 10)
    .map(([day, v]) => ({
      type: "RICE_BLAST" as const,
      severity: "WARNING" as const,
      date: day,
      titleNe: "धानमा मरुवा (ब्लास्ट) रोगको जोखिम",
      messageNe: "धेरै नाइट्रोजन मल नहाल्नुहोस्, खेत निरीक्षण गर्नुहोस्, लक्षण देखिए कृषि शाखामा खबर गर्नुहोस्।",
      evidence: { favourableHours: v.match },
      ruleVersion: "blast-v0.1",
    }));
}
