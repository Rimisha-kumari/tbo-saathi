import type { Itinerary, ItineraryItem } from "@/lib/types";
import { priceItem } from "./inventory";
import { newId, store } from "./store";

export interface UpdateItineraryArgs {
  itineraryId?: string | null;
  action: "add" | "remove" | "replace";
  item: ItineraryItem;
  replaceRefId?: string | null;
  travellers?: { adults: number; children: number } | null;
}

export function getItinerary(id: string): Itinerary | null {
  return store.itineraries.get(id) ?? null;
}

export function updateItinerary(args: UpdateItineraryArgs): Itinerary {
  let it = args.itineraryId ? store.itineraries.get(args.itineraryId) : undefined;
  if (args.itineraryId && !it) throw new Error(`Itinerary ${args.itineraryId} not found`);
  if (!it) {
    it = {
      id: newId("ITN"),
      travellers: args.travellers ?? { adults: Math.max(1, args.item.pax), children: 0 },
      items: [],
      totalINR: 0,
      status: "draft",
    };
    store.itineraries.set(it.id, it);
  }
  if (args.travellers) it.travellers = args.travellers;

  const sameRef = (i: ItineraryItem, refId: string) =>
    i.refId === refId || i.refId.split("@")[0] === refId.split("@")[0];

  if (args.action === "remove") {
    it.items = it.items.filter((i) => !sameRef(i, args.item.refId));
  } else {
    const priced = priceItem(args.item);
    if (args.action === "replace") {
      const target = args.replaceRefId ?? args.item.refId;
      const idx = it.items.findIndex((i) => sameRef(i, target));
      if (idx === -1) throw new Error(`Nothing to replace for ${target}`);
      it.items[idx] = priced;
    } else {
      it.items = it.items.filter((i) => i.refId !== priced.refId);
      it.items.push(priced);
    }
  }
  it.items.sort((a, b) => a.date.localeCompare(b.date));
  it.totalINR = it.items.reduce((s, i) => s + i.priceINR, 0);
  return it;
}
