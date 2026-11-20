import type { Weather } from "@/lib/types";
import { hash01 } from "@/lib/hash";

type Season = [months: number[], tempC: number, condition: Weather["condition"]];

/** Rough monthly climate per city (1 = Jan). Deterministic per city+date. */
const CLIMATE: Record<string, Season[]> = {
  Goa: [[[6, 7, 8, 9], 27, "Rain"], [[10, 11, 12, 1, 2, 3, 4, 5], 32, "Sunny"]],
  Mumbai: [[[6, 7, 8, 9], 28, "Rain"], [[10, 11, 12, 1, 2, 3, 4, 5], 32, "Sunny"]],
  Kochi: [[[6, 7, 8, 9, 10], 27, "Rain"], [[11, 12, 1, 2, 3, 4, 5], 31, "Partly cloudy"]],
  Chennai: [[[10, 11, 12], 28, "Rain"], [[1, 2, 3, 4, 5, 6, 7, 8, 9], 34, "Sunny"]],
  Delhi: [[[12, 1], 18, "Haze"], [[2, 3, 10, 11], 27, "Pleasant"], [[4, 5, 6], 40, "Sunny"], [[7, 8, 9], 33, "Rain"]],
  Jaipur: [[[12, 1], 21, "Pleasant"], [[2, 3, 10, 11], 28, "Sunny"], [[4, 5, 6], 41, "Sunny"], [[7, 8, 9], 32, "Thunderstorm"]],
  Bengaluru: [[[6, 7, 8, 9, 10], 23, "Rain"], [[11, 12, 1, 2], 25, "Pleasant"], [[3, 4, 5], 31, "Partly cloudy"]],
  Hyderabad: [[[3, 4, 5], 38, "Sunny"], [[6, 7, 8, 9], 28, "Rain"], [[10, 11, 12, 1, 2], 28, "Pleasant"]],
  Kolkata: [[[6, 7, 8, 9], 31, "Rain"], [[11, 12, 1, 2], 24, "Pleasant"], [[3, 4, 5], 35, "Sunny"], [[10], 31, "Partly cloudy"]],
};

const ICON: Record<Weather["condition"], string> = {
  Sunny: "☀️",
  "Partly cloudy": "⛅",
  Cloudy: "☁️",
  Rain: "🌧️",
  Thunderstorm: "⛈️",
  Haze: "🌫️",
  Pleasant: "🌤️",
};

export function weatherFor(city: string, date: string): Weather {
  const month = Number(date.slice(5, 7)) || 1;
  const season = CLIMATE[city]?.find(([months]) => months.includes(month)) ?? [[], 29, "Sunny"];
  const jitter = hash01(`${city}${date}`);
  const tempC = Math.round(season[1] + (jitter - 0.5) * 4);
  let condition = season[2];
  if (condition === "Sunny" && jitter > 0.8) condition = "Partly cloudy";
  if (condition === "Rain" && jitter < 0.2) condition = "Cloudy";
  return { tempC, condition, icon: ICON[condition] };
}

export const isWet = (w: Weather) => w.condition === "Rain" || w.condition === "Thunderstorm";
