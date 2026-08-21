import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface CalendarEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
}

let calendarCache: { data: CalendarEvent[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

function fallbackEvents(): CalendarEvent[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - now.getDay() + 1);
  monday.setHours(9, 30, 0, 0);

  const day = (offset: number, h = 9, m = 30) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + offset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  return [
    { title: "ISM Manufacturing PMI",       country: "USD", date: day(0, 15, 0),  impact: "High",   forecast: "49.5",  previous: "48.7",  actual: null },
    { title: "Construction Spending m/m",   country: "USD", date: day(0, 15, 0),  impact: "Medium", forecast: "0.2%",  previous: "-0.1%", actual: null },
    { title: "JOLTS Job Openings",          country: "USD", date: day(1, 15, 0),  impact: "High",   forecast: "8.70M", previous: "8.86M", actual: null },
    { title: "Factory Orders m/m",          country: "USD", date: day(1, 15, 0),  impact: "Medium", forecast: "-3.5%", previous: "1.4%",  actual: null },
    { title: "ADP Non-Farm Employment",     country: "USD", date: day(2, 13, 15), impact: "High",   forecast: "183K",  previous: "155K",  actual: null },
    { title: "ISM Services PMI",            country: "USD", date: day(2, 15, 0),  impact: "High",   forecast: "51.1",  previous: "52.8",  actual: null },
    { title: "FOMC Meeting Minutes",        country: "USD", date: day(2, 19, 0),  impact: "High",   forecast: null,    previous: null,    actual: null },
    { title: "Eurozone Services PMI",       country: "EUR", date: day(2, 9, 0),   impact: "Medium", forecast: "50.2",  previous: "49.7",  actual: null },
    { title: "ECB Rate Decision",           country: "EUR", date: day(3, 13, 15), impact: "High",   forecast: "4.25%", previous: "4.50%", actual: null },
    { title: "Unemployment Claims",         country: "USD", date: day(3, 13, 30), impact: "Medium", forecast: "218K",  previous: "224K",  actual: null },
    { title: "UK GDP m/m",                  country: "GBP", date: day(3, 7, 0),   impact: "High",   forecast: "0.1%",  previous: "0.2%",  actual: null },
    { title: "Non-Farm Payrolls",           country: "USD", date: day(4, 13, 30), impact: "High",   forecast: "178K",  previous: "275K",  actual: null },
    { title: "Unemployment Rate",           country: "USD", date: day(4, 13, 30), impact: "High",   forecast: "3.9%",  previous: "3.9%",  actual: null },
    { title: "Average Hourly Earnings m/m", country: "USD", date: day(4, 13, 30), impact: "High",   forecast: "0.3%",  previous: "0.1%",  actual: null },
    { title: "BoC Interest Rate Decision",  country: "CAD", date: day(4, 14, 0),  impact: "High",   forecast: null,    previous: null,    actual: null },
  ];
}

router.get("/calendar", async (_req, res): Promise<void> => {
  if (calendarCache && Date.now() - calendarCache.fetchedAt < CACHE_TTL_MS) {
    res.json(calendarCache.data);
    return;
  }

  try {
    const r = await fetch(`https://nfs.faireconomy.media/ff_calendar_thisweek.json?t=${Date.now()}`, {
      headers: { "User-Agent": "VelozTrade/1.0" },
      signal: AbortSignal.timeout(8_000),
    });

    if (!r.ok) throw new Error(`ForexFactory responded ${r.status}`);

    const raw = await r.json() as CalendarEvent[];
    const data: CalendarEvent[] = raw.map((e) => ({
      title:    e.title,
      country:  e.country,
      date:     e.date,
      impact:   e.impact ?? "Low",
      forecast: e.forecast ?? null,
      previous: e.previous ?? null,
      actual:   e.actual ?? null,
    }));

    calendarCache = { data, fetchedAt: Date.now() };
    logger.info({ count: data.length }, "Economic calendar refreshed from ForexFactory");
    res.json(data);
  } catch (err) {
    logger.warn({ err }, "ForexFactory fetch failed — using fallback events");
    const data = fallbackEvents();
    calendarCache = { data, fetchedAt: Date.now() };
    res.json(data);
  }
});

export default router;
