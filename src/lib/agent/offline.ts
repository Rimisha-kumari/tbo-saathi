/**
 * Keyless fallback agent used when ANTHROPIC_API_KEY is not set. It parses a few
 * intents with rules and drives the same tools, so the full demo flow (search →
 * itinerary → book → disruption) works with zero keys. Replies are English with
 * a localised lead-in; real multilingual conversation needs the Claude agent.
 */
import type { Booking, ChatEvent, DisruptionResult, Flight, Hotel, Itinerary, Lang } from "@/lib/types";
import { addDays } from "@/lib/travel/inventory";
import { store } from "@/lib/travel/store";
import { runTool, userConfirmed } from "./handlers";

type Emit = (ev: ChatEvent) => void;

interface Session {
  lastFlights: Flight[];
  lastHotels: Hotel[];
  lastDisruption: DisruptionResult | null;
  hotelCheckIn: string;
  pax: number;
}
const g = globalThis as unknown as { __saathiOffline?: Map<string, Session> };
const sessions = (g.__saathiOffline ??= new Map());

const CITY_ALIASES: Record<string, string[]> = {
  DEL: ["delhi", "new delhi", "दिल्ली", "டெல்லி", "ఢిల్లీ", "দিল্লি"],
  BOM: ["mumbai", "bombay", "मुंबई", "மும்பை", "ముంబై", "মুম্বাই"],
  GOI: ["goa", "गोवा", "கோவா", "గోవా", "গোয়া"],
  BLR: ["bengaluru", "bangalore", "बेंगलुरु", "बैंगलोर", "பெங்களூரு", "బెంగళూరు", "বেঙ্গালুরু"],
  MAA: ["chennai", "madras", "चेन्नई", "சென்னை", "చెన్నై", "চেন্নাই"],
  HYD: ["hyderabad", "हैदराबाद", "ஹைதராபாத்", "హైదరాబాద్", "হায়দ্রাবাদ"],
  CCU: ["kolkata", "calcutta", "कोलकाता", "கொல்கத்தா", "కోల్‌కతా", "কলকাতা"],
  JAI: ["jaipur", "जयपुर", "ஜெய்ப்பூர்", "జైపూర్", "জয়পুর"],
  COK: ["kochi", "cochin", "कोच्चि", "கொச்சி", "కొచ్చి", "কোচি"],
};
const CITY_NAME: Record<string, string> = { DEL: "Delhi", BOM: "Mumbai", GOI: "Goa", BLR: "Bengaluru", MAA: "Chennai", HYD: "Hyderabad", CCU: "Kolkata", JAI: "Jaipur", COK: "Kochi" };
const LEAD: Record<Lang, string> = { "en-IN": "Sure.", "hi-IN": "ज़रूर।", "ta-IN": "சரி.", "te-IN": "సరే.", "bn-IN": "অবশ্যই।" };

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function findCities(text: string): string[] {
  const t = text.toLowerCase();
  const hits: { code: string; at: number }[] = [];
  for (const [code, names] of Object.entries(CITY_ALIASES)) {
    const at = Math.min(...names.map((n) => (t.indexOf(n) === -1 ? Infinity : t.indexOf(n))));
    if (at !== Infinity) hits.push({ code, at });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.code);
}

function findDate(text: string): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const iso = text.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  if (/tomorrow|kal|कल|நாளை|రేపు|আগামীকাল/i.test(text)) return addDays(today, 1);
  return addDays(today, 7);
}

function findPick(text: string): number | null {
  const m = text.match(/\b(?:add|pick|choose|select|option|take)\s*(?:the\s*)?(?:hotel|flight)?\s*(?:no\.?|number)?\s*#?(\d)\b/i);
  if (m) return Number(m[1]);
  if (/^\s*#?(\d)\s*$/.test(text)) return Number(text.trim().replace("#", ""));
  if (/\b(first|cheapest|pehla)\b|पहला/i.test(text)) return 1;
  if (/\b(second|doosra)\b|दूसरा/i.test(text)) return 2;
  return null;
}

export async function runOffline(args: {
  text: string;
  lang: Lang;
  sessionId: string;
  itineraryId: string | null;
  bookingId: string | null;
  emit: Emit;
}): Promise<void> {
  const { text, emit } = args;
  const s: Session = sessions.get(args.sessionId) ?? { lastFlights: [], lastHotels: [], lastDisruption: null, hotelCheckIn: "", pax: 1 };
  sessions.set(args.sessionId, s);
  let itineraryId = args.itineraryId;
  let bookingId = args.bookingId;
  const ctx = { lastUserText: text };

  const say = (msg: string) => emit({ type: "text", delta: `${LEAD[args.lang]} ${msg}` });
  const tool = <T>(name: string, input: unknown): { ok: boolean; data: T } => {
    emit({ type: "expression", value: "thinking" });
    emit({ type: "tool", name, status: "start" });
    const out = runTool(name, input, ctx);
    emit({ type: "tool", name, status: out.ok ? "done" : "error", data: out.data });
    if (out.state) {
      itineraryId = out.state.itineraryId ?? itineraryId;
      bookingId = out.state.bookingId ?? bookingId;
      emit({ type: "state", itineraryId, bookingId });
    }
    if (out.expression) emit({ type: "expression", value: out.expression });
    return out as { ok: boolean; data: T };
  };
  const errorOf = (d: unknown) => (d as { error?: string }).error ?? "Something went wrong.";

  const paxMatch = text.match(/(\d)\s*(people|persons|adults|pax|travell?ers|log|लोग|பேர்|మంది|জন)/i);
  if (paxMatch) s.pax = Number(paxMatch[1]);
  const cities = findCities(text);
  const date = findDate(text);
  const pick = findPick(text);

  // 1. Disruption alert (sent by the "simulate disruption" demo control).
  const alert = text.match(/\[disruption:(flight_cancel|flight_delay|hotel_overbooked|weather)\]/);
  if (alert && bookingId) {
    const booking = store.bookings.get(bookingId)!;
    const it = store.itineraries.get(booking.itineraryId)!;
    const kind = alert[1].startsWith("flight") ? "flight" : alert[1] === "hotel_overbooked" ? "hotel" : "sightseeing";
    const affected = it.items.find((i) => i.kind === kind);
    const r = tool<DisruptionResult>("handleDisruption", {
      bookingId,
      disruption: { type: alert[1], affectedRefId: affected?.refId ?? "", severity: "high" },
    });
    if (!r.ok) return say(errorOf(r.data));
    s.lastDisruption = r.data;
    const best = r.data.options[0];
    return say(`I'm so sorry — ${r.data.impact} ${best ? `My best suggestion: ${best.label}${best.priceDeltaINR > 0 ? ` for ${rupees(best.priceDeltaINR)} extra` : " at no extra cost"}. Say "option 1" to accept, or pick another option.` : "I couldn't find alternatives."}`);
  }

  // 2. Accepting a disruption option.
  if (s.lastDisruption && pick && itineraryId && bookingId) {
    const opt = s.lastDisruption.options[pick - 1];
    if (!opt) return say(`Please choose an option between 1 and ${s.lastDisruption.options.length}.`);
    const { remove, add } = opt.itineraryPatch;
    if (remove && add) tool("updateItinerary", { itineraryId, action: "replace", item: { ...add, priceINR: null, meta: metaOf(add.meta) }, replaceRefId: remove, travellers: null });
    else if (remove) tool("updateItinerary", { itineraryId, action: "remove", item: { kind: "flight", refId: remove, date, pax: 1, priceINR: null, meta: null }, replaceRefId: null, travellers: null });
    const booking = store.bookings.get(bookingId)!;
    const b = tool<Booking>("bookTrip", { itineraryId, leadGuest: booking.leadGuest, confirm: true });
    s.lastDisruption = null;
    emit({ type: "expression", value: "speaking" });
    return say(b.ok ? `Done. ${opt.label}. Your updated vouchers are ready under PNR ${b.data.pnr}.` : errorOf(b.data));
  }

  // 3. Booking / confirmation.
  const wantsBook = /\b(book|confirm|checkout|pay)\b|बुक|பதிவு|బుక్|বুক/i.test(text);
  const it = itineraryId ? (store.itineraries.get(itineraryId) as Itinerary | undefined) : undefined;
  if (it && it.items.length && (wantsBook || userConfirmed(text)) && pick == null) {
    if (!userConfirmed(text)) {
      return say(`Your trip has ${it.items.length} item(s), total ${rupees(it.totalINR)}. Shall I book it? Please say yes to confirm.`);
    }
    const b = tool<Booking>("bookTrip", { itineraryId: it.id, leadGuest: { name: "Demo Traveller", phone: "+91 90000 00000", email: "traveller@example.com" }, confirm: true });
    return say(b.ok ? `Booked! Your PNR is ${b.data.pnr} and ${b.data.vouchers.length} voucher(s) are ready below.` : errorOf(b.data));
  }

  // 4a. Card buttons send explicit ids: "Add flight 6E 101 (id 6E101-e@2026-12-05)".
  const idMatch = text.match(/\bid ([A-Za-z0-9@\-]+)/);
  if (idMatch && /\badd\b/i.test(text)) {
    const refId = idMatch[1];
    const isHotel = /^H\d+$/.test(refId);
    const checkIn = s.hotelCheckIn || date;
    const room = text.match(/room code (\w+)/i)?.[1] ?? "STD";
    const item = isHotel
      ? { kind: "hotel", refId, date: checkIn, pax: s.pax, priceINR: null, meta: { roomCode: room, checkOut: addDays(checkIn, 2), slot: null } }
      : { kind: "flight", refId, date: refId.split("@")[1] ?? date, pax: s.pax, priceINR: null, meta: null };
    const r = tool<Itinerary>("updateItinerary", { itineraryId, action: "add", item, replaceRefId: null, travellers: { adults: s.pax, children: 0 } });
    return say(r.ok ? addedMsg(r.data) : errorOf(r.data));
  }

  // 4. Picking a search result into the itinerary.
  if (pick && (s.lastFlights.length || s.lastHotels.length)) {
    const useHotel = s.lastHotels.length > 0 && (/hotel|room|होटल|ஹோட்டல்|హోటల్|হোটেল/i.test(text) || !s.lastFlights.length);
    const item = useHotel
      ? (() => {
          const h = s.lastHotels[pick - 1];
          return h && { kind: "hotel", refId: h.id, date: s.hotelCheckIn, pax: s.pax, priceINR: null, meta: { roomCode: "STD", checkOut: addDays(s.hotelCheckIn, 2), slot: null } };
        })()
      : (() => {
          const f = s.lastFlights[pick - 1];
          return f && { kind: "flight", refId: f.id, date: f.departAt.slice(0, 10), pax: s.pax, priceINR: null, meta: null };
        })();
    if (!item) return say(`I only have ${useHotel ? s.lastHotels.length : s.lastFlights.length} options. Please pick one of those.`);
    const r = tool<Itinerary>("updateItinerary", { itineraryId, action: "add", item, replaceRefId: null, travellers: { adults: s.pax, children: 0 } });
    if (useHotel) s.lastHotels = [];
    else s.lastFlights = [];
    return say(r.ok ? addedMsg(r.data) : errorOf(r.data));
  }

  // 5. Hotel search.
  if (/hotel|stay|room|होटल|ठहर|ஹோட்டல்|హోటల్|হোটেল/i.test(text) && cities.length) {
    const city = CITY_NAME[cities[cities.length - 1]];
    const r = tool<Hotel[]>("searchHotels", { city, checkIn: date, checkOut: addDays(date, 2), guests: s.pax, minStars: null, maxPriceINR: null, area: null, amenities: null });
    if (!r.ok || !r.data.length) return say(`I couldn't find hotels in ${city} for those dates.`);
    s.lastHotels = r.data;
    s.hotelCheckIn = date;
    const top = r.data[0];
    return say(`Top pick in ${city}: ${top.name}, ${top.stars} star, rated ${top.rating}, from ${rupees(top.pricePerNightINR)} a night. Say "add hotel 1" to pick one.`);
  }

  // 6. Flight search.
  if (cities.length >= 2) {
    const [from, to] = cities;
    const r = tool<Flight[]>("searchFlights", { from, to, date, returnDate: null, adults: s.pax, cabin: null, maxStops: null, sortBy: "price" });
    if (!r.ok || !r.data.length) return say(`No flights from ${CITY_NAME[from]} to ${CITY_NAME[to]} on ${date}.`);
    s.lastFlights = r.data;
    const f = r.data[0];
    return say(`Cheapest ${CITY_NAME[from]} to ${CITY_NAME[to]} on ${date}: ${f.airline} ${f.flightNo} at ${f.departAt.slice(11, 16)}, ${rupees(f.fareINR)} per person. Say "add 1" to pick it.`);
  }

  emit({ type: "expression", value: "idle" });
  return say(
    'I\'m running in offline demo mode. Try: "Flights from Delhi to Goa on ' + date + ' for 2 people", then "add 1", "hotel in Goa", "add hotel 1", and "book it".',
  );
}

function metaOf(m: Record<string, string | number | null> | undefined) {
  return { roomCode: (m?.roomCode as string) ?? null, checkOut: (m?.checkOut as string) ?? null, slot: (m?.slot as string) ?? null };
}

function addedMsg(it: Itinerary): string {
  const hasHotel = it.items.some((i) => i.kind === "hotel");
  return `Added to your trip. Total is now ${rupees(it.totalINR)}. ${hasHotel ? "Shall I book it?" : "Want a hotel too, or shall I book it?"}`;
}
