import type { Hotel } from "@/lib/types";
import { hash01, hotels, store } from "./store";

export interface HotelQuery {
  city: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  minStars?: number | null;
  maxPriceINR?: number | null;
  area?: string | null;
  amenities?: string[] | null;
}

/** Live room counts for a date: base inventory, jittered, minus bookings. */
export function hotelForDate(h: Hotel, date: string): Hotel {
  return {
    ...h,
    roomTypes: h.roomTypes.map((r) => {
      const key = `${h.id}:${r.code}`;
      const jitter = hash01(`${key}@${date}`) < 0.15 ? -r.available : 0; // ~15% sold out
      const consumed = store.consumed.get(`${key}|${date}`) ?? 0;
      return { ...r, available: Math.max(0, r.available + jitter - consumed) };
    }),
  };
}

export function searchHotels(q: HotelQuery): Hotel[] {
  const city = q.city.trim().toLowerCase();
  return hotels
    .filter((h) => h.city.toLowerCase() === city || h.area.toLowerCase().includes(city))
    .filter((h) => q.minStars == null || h.stars >= q.minStars)
    .filter((h) => q.maxPriceINR == null || h.pricePerNightINR <= q.maxPriceINR)
    .filter((h) => !q.area || h.area.toLowerCase().includes(q.area.toLowerCase()))
    .filter((h) => !q.amenities?.length || q.amenities.every((a) => h.amenities.includes(a)))
    .map((h) => hotelForDate(h, q.checkIn))
    .filter((h) => h.roomTypes.some((r) => r.available > 0 && r.maxGuests >= Math.min(q.guests, 4)))
    .sort((a, b) => b.rating - a.rating || a.pricePerNightINR - b.pricePerNightINR)
    .slice(0, 5);
}

export function getHotel(id: string): Hotel | null {
  return hotels.find((h) => h.id === id) ?? null;
}
