import type { Itinerary, ItineraryItem } from "@/lib/types";
import { priceItem } from "./inventory";
import { setItems } from "./planner";
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
  // A cancelled trip can't be edited: start a fresh one.
  if (!it || it.status === "cancelled") {
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

  let items = [...it.items];
  if (args.action === "remove") {
    items = items.filter((i) => !sameRef(i, args.item.refId));
  } else {
    const priced = priceItem(args.item);
    if (args.action === "replace") {
      const target = args.replaceRefId ?? args.item.refId;
      const idx = items.findIndex((i) => sameRef(i, target));
      if (idx === -1) throw new Error(`Nothing to replace for ${target}`);
      if (priced.kind === "flight" && items[idx].meta?.direction) priced.meta = { ...priced.meta, direction: items[idx].meta!.direction };
      items[idx] = priced;
    } else {
      if (priced.kind === "flight" && !priced.meta?.direction) {
        const hasOut = items.some((i) => i.kind === "flight");
        priced.meta = { ...priced.meta, direction: hasOut ? "return" : "outbound" };
      }
      items = items.filter((i) => i.refId !== priced.refId).concat(priced);
    }
  }
  setItems(it, items);
  return it;
}
