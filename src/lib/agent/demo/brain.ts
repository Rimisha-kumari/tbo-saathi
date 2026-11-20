/**
 * Smart Demo Mode: a rule-based travel brain used when no LLM key is set. It
 * understands English, Hinglish, Hindi, Tamil, Telugu and Bengali cues, keeps
 * multi-turn state (destination → origin follow-ups), and drives the same tools
 * as the LLM agents, so every workspace feature works with zero keys.
 */
import type { LangId } from "@/lib/lang";
import { addDays } from "@/lib/travel/inventory";
import { CITY_BY_CODE, type AdjustResult, type PlanResult } from "@/lib/travel/planner";
import { getFlight } from "@/lib/travel/flights";
import { store } from "@/lib/travel/store";
import { weatherFor } from "@/lib/travel/weather";
import type { ChatEvent, DisruptionResult, Flight, Hotel, Itinerary, PendingAction, PrefKey } from "@/lib/types";
import { emitTool } from "../claude";
import type { ToolContext } from "../handlers";
import { asciiDigits, PREF_LABEL } from "../memory";
import { PHRASES, rupees, type Theme } from "./phrases";

type Emit = (ev: ChatEvent) => void;

interface DemoSession {
  origin: string | null;
  destination: string | null;
  departDate: string | null;
  nights: number;
  adults: number;
  children: number;
  pending: "origin" | "destination" | null;
}
const g = globalThis as unknown as { __saathiDemo?: Map<string, DemoSession> };
const sessions = (g.__saathiDemo ??= new Map());

const CITY_ALIASES: Record<string, string[]> = {
  DEL: ["delhi", "new delhi", "dilli", "दिल्ली", "டெல்லி", "ఢిల్లీ", "దిల్లీ", "দিল্লি"],
  BOM: ["mumbai", "bombay", "मुंबई", "மும்பை", "ముంబై", "মুম্বাই", "মুম্বই"],
  GOI: ["goa", "गोवा", "கோவா", "గోవా", "গোয়া", "গোয়া"],
  BLR: ["bengaluru", "bangalore", "बेंगलुरु", "बैंगलोर", "பெங்களூரு", "బెంగళూరు", "বেঙ্গালুরু"],
  MAA: ["chennai", "madras", "चेन्नई", "சென்னை", "చెన్నై", "চেন্নাই"],
  HYD: ["hyderabad", "हैदराबाद", "ஹைதராபாத்", "హైదరాబాద్", "হায়দ্রাবাদ"],
  CCU: ["kolkata", "calcutta", "कोलकाता", "கொல்கத்தா", "కోల్‌కతా", "కోల్కతా", "কলকাতা"],
  JAI: ["jaipur", "जयपुर", "ஜெய்ப்பூர்", "జైపూర్", "জয়পুর", "জয়পুর"],
  COK: ["kochi", "cochin", "कोच्चि", "கொச்சி", "కొచ్చి", "কোচি"],
};

const THEMES: Record<Theme, { re: RegExp; cities: string[] }> = {
  beach: { re: /beach|sea|samundar|समुद्र|बीच|கடற்கரை|பீச்|బీచ్|సముద్ర|সমুদ্র|সৈকত|বিচ/i, cities: ["GOI", "COK", "MAA"] },
  heritage: { re: /heritage|history|fort|palace|किला|विरासत|महल|கோட்டை|பாரம்பரிய|కోట|వారసత్వ|দুর্গ|ঐতিহ্য|রাজবাড়ি/i, cities: ["JAI", "DEL", "HYD"] },
  food: { re: /food|biryani|khana|खाना|खाने|உணவு|சாப்பாடு|ఆహార|బిర్యానీ|খাবার/i, cities: ["HYD", "CCU", "DEL"] },
  nature: { re: /nature|backwater|hill|green|honeymoon|romantic|प्रकृति|हनीमून|इयற்கை|இயற்கை|తేనెమూన్|ప్రకృతి|প্রকৃতি|হানিমুন/i, cities: ["COK", "GOI", "BLR"] },
  city: { re: /city life|shopping|nightlife|party|शॉपिंग|पार्टी|ஷாப்பிங்|షాపింగ్|শপিং/i, cities: ["BOM", "BLR", "DEL"] },
  culture: { re: /culture|art|temple|museum|संस्कृति|मंदिर|கலாச்சார|கோயில்|సంస్కృతి|ఆలయ|সংস্কৃতি|মন্দির/i, cities: ["CCU", "MAA", "JAI"] },
};
const CITY_THEME: Record<string, Theme> = { GOI: "beach", COK: "nature", MAA: "culture", JAI: "heritage", DEL: "heritage", HYD: "food", CCU: "culture", BOM: "city", BLR: "city" };

const has = (re: RegExp, t: string) => re.test(t);
const I = {
  disruption: /\[disruption:(flight_cancel|flight_delay|hotel_overbooked|weather)\]/,
  option: /\b(?:option|choose|pick|vikalp)\s*#?(\d)|विकल्प\s*(\d)|ஆப்ஷன்\s*(\d)|ఆప్షన్\s*(\d)|বিকল্প\s*(\d)/i,
  selectId: /\bid ([A-Za-z0-9@\-]+)/,
  cancel: /\b(cancel|radd)\b|रद्द|ரத்து|రద్దు|বাতিল/i,
  bookingWord: /booking|trip|ticket|बुकिंग|ट्रिप|टिकट|முன்பதிவு|புக்கிங்|பயண|బుకింగ్|ట్రిప్|বুকিং|ট্রিপ/i,
  book: /\b(book|confirm|checkout|pay|pakka)\b|बुक|पक्का|कन्फर्म|புக்|பதிவு செய்|బుక్|నిర్ధారించ|বুক|নিশ্চিত কর/i,
  cheaper: /cheap|cheaper|budget|kam karo|sasta|saste|sasti|lower (the )?price|सस्त|कम कर|किफ़ायती|மலிவ|குறைந்த விலை|விலை குறை|చౌక|తక్కువ ధర|সস্তা|কম দাম/i,
  addDay: /(add|extra|one more|plus|\+)\s*(a|1|one)?\s*(more\s*)?(day|night)|(ek|1)\s*(din|raat)\s*(badha|aur|zyada|add)|एक दिन (बढ़ा|और|जोड़)|1 दिन (बढ़ा|और|जोड़)|दिन बढ़ा|ஒரு நாள் (சேர்|அதிக)|ఒక రోజు (పెంచ|జోడ|ఎక్కువ)|এক ?দিন (বাড়া|যোগ)|1 দিন (বাড়া|যোগ)/i,
  removeDay: /(remove|reduce|less|cut|minus|one less)\s*(a|1|one)?\s*(day|night)|(ek|1)\s*(din|raat)\s*(kam|ghata)|एक दिन (कम|घटा)|दिन कम|ஒரு நாள் குறை|ఒక రోజు తగ్గ|এক ?দিন কম/i,
  upgrade: /upgrade|better hotel|luxury|अपग्रेड|बेहतर होटल|மேம்படுத்து|అప్‌గ్రేడ్|ఉన్నత|আপগ্রেড/i,
  compare: /compar|side by side|tulna|तुलना|ஒப்பிடு|ஒப்பீடு|పోల్చ|పోలిక|তুলনা/i,
  plan: /\b(plan|trip|tour|holiday|vacation|getaway|ghoom|ghum|yatra|itinerary|package)\b|यात्रा|ट्रिप|प्लान|घूम|छुट्टी|पैकेज|பயண|திட்ட|ட்ரிப்|சுற்றுலா|ప్రయాణ|ట్రిప్|ప్లాన్|టూర్|ভ্রমণ|ট্রিপ|পরিকল্পনা|প্ল্যান|ঘুর|বেড়া/i,
  recommend: /suggest|recommend|where should|where can|kahan|kaha jaye|idea|सुझा|कहाँ|कहां|कौन सी जगह|எங்கே|பரிந்துரை|ఎక్కడ|సూచ|কোথায়|পরামর্শ/i,
  flight: /flight|fly|udaan|फ्लाइट|उड़ान|விமான|ஃப்ளைட்|ఫ్లైట్|విమాన|ফ্লাইট|বিমান/i,
  hotel: /hotel|stay|room|होटल|ठहर|रुक|ஹோட்டல்|தங்க|హోటల్|బస|রুম|হোটেল|থাকা/i,
  greet: /^(hi|hello|hey|namaste|namaskar|vanakkam)\b|नमस्ते|नमस्कार|வணக்கம்|నమస్కారం|నమస్తే|নমস্কার|হ্যালো/i,
};

const WEEKDAYS: [number, RegExp][] = [
  [5, /friday|shukravar|शुक्रवार|வெள்ளி|శుక్రవారం|শুক্রবার/i],
  [6, /saturday|weekend|shanivar|शनिवार|वीकेंड|சனி|வார இறுதி|శనివారం|వీకెండ్|শনিবার|সপ্তাহান্ত/i],
  [0, /sunday|ravivar|रविवार|ஞாயிறு|ఆదివారం|রবিবার/i],
  [1, /monday|somvar|सोमवार|திங்கள்|సోమవారం|সোমবার/i],
];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const HI_MONTHS = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function nextWeekday(dow: number, minAhead = 2): string {
  const t = todayIST();
  for (let i = minAhead; i < minAhead + 7; i++) {
    const d = addDays(t, i);
    if (new Date(`${d}T00:00:00Z`).getUTCDay() === dow) return d;
  }
  return addDays(t, 7);
}

function findDate(text: string): string | null {
  const iso = text.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const t = todayIST();
  if (/day after tomorrow|parso|परसों|நாளை மறுநாள்|ఎల్లుండి|পরশু/i.test(text)) return addDays(t, 2);
  if (/tomorrow|\bkal\b|कल|நாளை|రేపు|আগামীকাল|কাল/i.test(text)) return addDays(t, 1);
  const lower = text.toLowerCase();
  for (let m = 0; m < 12; m++) {
    const re = new RegExp(`(\\d{1,2})\\s*(?:${MONTHS[m]}[a-z]*|${HI_MONTHS[m]})|(?:${MONTHS[m]}[a-z]*)\\s*(\\d{1,2})`, "i");
    const hit = lower.match(re);
    if (hit) {
      const day = Number(hit[1] ?? hit[2]);
      let year = Number(t.slice(0, 4));
      const candidate = `${year}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (candidate < t) year++;
      return `${year}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  for (const [dow, re] of WEEKDAYS) if (re.test(text)) return nextWeekday(dow);
  if (/next week|agle hafte|अगले हफ्ते|अगले सप्ताह|அடுத்த வாரம்|వచ్చే వారం|পরের সপ্তাহ/i.test(text)) return addDays(t, 7);
  return null;
}

function findCities(text: string): string[] {
  const t = text.toLowerCase();
  const hits: { code: string; at: number }[] = [];
  for (const [code, names] of Object.entries(CITY_ALIASES)) {
    const at = Math.min(...names.map((n) => {
      const i = t.indexOf(n);
      return i === -1 ? Infinity : i;
    }));
    if (at !== Infinity) hits.push({ code, at });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.code);
}

/** Orders two cities using "from/se/से/இலிருந்து/నుండి/থেকে" and "to" markers. */
function originDest(text: string, cities: string[]): [string, string] {
  const [a, b] = cities;
  const nameOf = (code: string) => CITY_ALIASES[code].find((n) => text.toLowerCase().includes(n)) ?? "";
  const after = (code: string, re: RegExp) => {
    const n = nameOf(code);
    const i = text.toLowerCase().indexOf(n);
    return re.test(text.slice(i + n.length, i + n.length + 14));
  };
  const fromMarker = /^\s*(se|से|இலிருந்து|லிருந்து|నుండి|నుంచి|থেকে)/i;
  if (after(b, fromMarker) && !after(a, fromMarker)) return [b, a];
  if (/\bto\s+\S+\s+from\b/i.test(text)) return [b, a];
  return [a, b];
}

function findNights(text: string): number | null {
  const n = text.match(/(\d{1,2})\s*(nights?|raat|रात|இரவு|ராத்திரி|రాత్ర|রাত)/i);
  if (n) return Number(n[1]);
  const d = text.match(/(\d{1,2})\s*(days?|din|दिन|நாள்|రోజ|রোজ|দিন)/i);
  return d ? Math.max(1, Number(d[1]) - 1) : null;
}

function findPax(text: string): { adults: number; children: number } | null {
  const m = text.match(/(\d{1,2})\s*(people|persons?|adults?|pax|travell?ers|log|logon|लोग|लोगों|व्यक्ति|பேர்|நபர்|మంది|వ్యక్తులు|জন|জনের)/i);
  const kids = text.match(/(\d)\s*(kids?|children|bachch?e|बच्चे|குழந்தை|పిల్ల|বাচ্চা)/i);
  if (!m && !kids && !/couple|dono|हम दोनों|दो लोग|இருவர்|ఇద్దరు|দুজন/i.test(text)) return null;
  return { adults: m ? Number(m[1]) : 2, children: kids ? Number(kids[1]) : 0 };
}

function recommend(text: string, lang: LangId, exclude: string[]): string {
  const P = PHRASES[lang];
  const themes = (Object.keys(THEMES) as Theme[]).filter((t) => THEMES[t].re.test(text));
  const date = findDate(text) ?? nextWeekday(5, 7);
  const pool = themes.length ? themes.flatMap((t) => THEMES[t].cities) : ["GOI", "JAI", "COK", "HYD", "BLR"];
  const picks = [...new Set(pool)]
    .filter((c) => !exclude.includes(c))
    .map((c) => ({ c, w: weatherFor(CITY_BY_CODE[c], date) }))
    .sort((a, b) => Number(a.w.condition === "Rain") - Number(b.w.condition === "Rain"))
    .slice(0, 3);
  return P.recommend(picks.map(({ c, w }) => `${CITY_BY_CODE[c]} (${P.theme[themes.find((t) => THEMES[t].cities.includes(c)) ?? CITY_THEME[c]]}, ${w.tempC}°C ${w.icon})`).join(", "));
}

export async function runDemo(args: {
  text: string;
  lang: LangId;
  sessionId: string;
  itineraryId: string | null;
  bookingId: string | null;
  ctx: ToolContext;
  newPrefs: PrefKey[];
  emit: Emit;
}): Promise<void> {
  const { emit, ctx } = args;
  const P = PHRASES[args.lang];
  const text = asciiDigits(args.text);
  const s: DemoSession = sessions.get(args.sessionId) ?? { origin: null, destination: null, departDate: null, nights: 3, adults: 2, children: 0, pending: null };
  sessions.set(args.sessionId, s);
  let itineraryId = args.itineraryId;
  let bookingId = args.bookingId;
  const say = (msg: string) => {
    emit({ type: "expression", value: "speaking" });
    emit({ type: "text", delta: msg });
  };
  const tool = <T>(name: string, input: unknown) => {
    emit({ type: "expression", value: "thinking" });
    emit({ type: "tool", name, status: "start" });
    const out = emitTool(name, input, ctx, emit);
    if (out.state) {
      itineraryId = out.state.itineraryId ?? itineraryId;
      bookingId = out.state.bookingId ?? bookingId;
    }
    if (out.expression) emit({ type: "expression", value: out.expression });
    return out as { ok: boolean; data: T };
  };
  const fail = (d: unknown) => say(P.error((d as { error?: string }).error ?? "something went wrong"));
  const itinerary = itineraryId ? store.itineraries.get(itineraryId) : undefined;
  const liveBooking = bookingId ? store.bookings.get(bookingId) : undefined;
  const activeBooking = liveBooking?.status === "confirmed" ? liveBooking : undefined;

  // 1. Operations alert from the "Simulate disruption" control.
  const alert = text.match(I.disruption);
  if (alert) {
    if (!activeBooking) return say(P.noBooking);
    const r = tool<DisruptionResult>("handleDisruption", { bookingId: activeBooking.id, disruption: { type: alert[1], affectedRefId: "", severity: "high" } });
    if (!r.ok) return fail(r.data);
    return say(rescueLine(r.data, args.lang));
  }

  // 2. Choosing a rescue option in chat.
  const opt = text.match(I.option);
  const optN = opt ? Number(opt.slice(1).find(Boolean)) : null;
  if (optN && activeBooking && store.disruptions.has(activeBooking.id)) {
    const r = tool<PendingAction>("applyDisruptionOption", { bookingId: activeBooking.id, optionIndex: optN - 1 });
    return r.ok ? say(P.rebookReady) : fail(r.data);
  }

  // 3. Cancel a booking (prepares a refund summary; confirmation gate applies).
  if (has(I.cancel, text) && has(I.bookingWord, text) && !alert) {
    if (!activeBooking) return say(P.noBooking);
    const r = tool<PendingAction>("cancelBooking", { bookingId: activeBooking.id });
    return r.ok ? say(P.cancelReady(rupees(-r.data.payableINR))) : fail(r.data);
  }

  // 4. Select buttons on comparison cards send explicit ids.
  const idHit = text.match(I.selectId);
  if (idHit) {
    const refId = idHit[1];
    const it = itinerary && itinerary.status !== "cancelled" ? itinerary : undefined;
    let input: Record<string, unknown>;
    if (/^H\d+$/.test(refId)) {
      const room = text.match(/room code (\w+)/i)?.[1] ?? "STD";
      const current = it?.items.find((i) => i.kind === "hotel");
      const checkIn = current?.date ?? s.departDate ?? nextWeekday(5, 7);
      const checkOut = String(current?.meta?.checkOut ?? addDays(checkIn, s.nights));
      input = {
        itineraryId: it?.id ?? null,
        action: current ? "replace" : "add",
        item: { kind: "hotel", refId, date: checkIn, pax: s.adults + s.children, priceINR: null, meta: { roomCode: room, checkOut, slot: null, time: null } },
        replaceRefId: current?.refId ?? null,
        travellers: null,
      };
    } else {
      const f = getFlight(refId);
      if (!f) return say(P.unknown);
      const same = it?.items.find((i) => i.kind === "flight" && i.meta?.from === f.from && i.meta?.to === f.to);
      input = {
        itineraryId: it?.id ?? null,
        action: same ? "replace" : "add",
        item: { kind: "flight", refId, date: f.departAt.slice(0, 10), pax: same?.pax ?? s.adults + s.children, priceINR: null, meta: null },
        replaceRefId: same?.refId ?? null,
        travellers: it ? null : { adults: s.adults, children: s.children },
      };
    }
    const r = tool<Itinerary>("updateItinerary", input);
    return r.ok ? say(P.added(rupees(r.data.totalINR))) : fail(r.data);
  }

  const trip = itinerary && itinerary.status !== "cancelled" && itinerary.items.length ? itinerary : undefined;

  // 5. Budget edits on the current trip.
  const adjust = has(I.addDay, text) ? "add_day" : has(I.removeDay, text) ? "remove_day" : has(I.upgrade, text) ? "upgrade_hotel" : has(I.cheaper, text) && !findCities(text).length ? "cheaper" : null;
  if (adjust) {
    if (!trip) return say(P.noTrip);
    const r = tool<AdjustResult>("adjustTrip", { itineraryId: trip.id, action: adjust });
    if (!r.ok) return fail(r.data);
    const total = rupees(r.data.itinerary.totalINR);
    if (adjust === "cheaper") return say(r.data.deltaINR < 0 ? P.cheaper(rupees(-r.data.deltaINR), total) : P.cheaperNone(total));
    if (adjust === "upgrade_hotel") {
      const h = r.data.itinerary.items.find((i) => i.kind === "hotel");
      return say(P.upgraded(String(h?.meta?.name ?? ""), total));
    }
    const nights = Number(r.data.itinerary.items.find((i) => i.kind === "hotel")?.meta?.nights ?? s.nights);
    s.nights = nights;
    return say(P.dayChanged(adjust === "add_day", nights, total));
  }

  // 6. Booking request → summary card with Confirm / Edit.
  if (has(I.book, text) && !has(I.cancel, text) && !findCities(text).length) {
    if (!trip) return say(P.noTrip);
    const r = tool<PendingAction>("bookTrip", { itineraryId: trip.id, leadGuest: null });
    return r.ok ? say(P.confirmReady(rupees(r.data.totalINR))) : fail(r.data);
  }

  // 7. Compare: refresh side-by-side options for the current trip.
  if (has(I.compare, text) && !findCities(text).length) {
    if (!trip) return say(P.noTrip);
    const hotel = trip.items.find((i) => i.kind === "hotel");
    const out = trip.items.find((i) => i.kind === "flight");
    if (out?.meta?.from && out.meta.to) {
      tool<Flight[]>("searchFlights", { from: out.meta.from, to: out.meta.to, date: out.date, returnDate: null, adults: out.pax, cabin: null, maxStops: null, sortBy: "price" });
    }
    if (hotel) {
      tool<Hotel[]>("searchHotels", { city: hotel.meta?.city, checkIn: hotel.date, checkOut: hotel.meta?.checkOut, guests: hotel.pax, minStars: null, maxPriceINR: null, area: null, amenities: null });
    }
    return say(P.compare);
  }

  // 8. Slot filling for planning and searches.
  const cities = findCities(text);
  const date = findDate(text);
  const nights = findNights(text);
  const pax = findPax(text);
  if (date) s.departDate = date;
  if (nights) s.nights = nights;
  if (pax) {
    s.adults = pax.adults;
    s.children = pax.children;
  }
  let filledPending = false;
  if (cities.length >= 2) {
    [s.origin, s.destination] = originDest(text, cities);
  } else if (cities.length === 1) {
    if (s.pending === "origin" && cities[0] !== s.destination) s.origin = cities[0];
    else s.destination = cities[0];
    filledPending = s.pending !== null;
  }
  if (filledPending) s.pending = null;

  const wantsPlan = has(I.plan, text) || (ctx.budgetINR !== null && cities.length > 0) || filledPending || (cities.length > 0 && (nights !== null || pax !== null));
  const wantsHotel = has(I.hotel, text) && !has(I.plan, text);
  const wantsFlight = has(I.flight, text) && !has(I.plan, text);

  if (wantsHotel && s.destination && !wantsFlight) {
    const city = CITY_BY_CODE[s.destination];
    const checkIn = s.departDate ?? nextWeekday(5, 7);
    const r = tool<Hotel[]>("searchHotels", { city, checkIn, checkOut: addDays(checkIn, s.nights), guests: s.adults + s.children, minStars: null, maxPriceINR: null, area: null, amenities: null });
    if (!r.ok || !r.data.length) return r.ok ? say(P.error(`no rooms in ${city}`)) : fail(r.data);
    const h = r.data[0];
    return say(P.hotels({ city, name: h.name, stars: h.stars, rating: h.rating, price: rupees(h.pricePerNightINR) }));
  }

  if (wantsFlight && s.origin && s.destination && cities.length >= 2) {
    const d = s.departDate ?? nextWeekday(5, 7);
    const r = tool<Flight[]>("searchFlights", { from: s.origin, to: s.destination, date: d, returnDate: null, adults: s.adults + s.children, cabin: null, maxStops: null, sortBy: "price" });
    if (!r.ok || !r.data.length) return r.ok ? say(P.error(`no flights on ${d}`)) : fail(r.data);
    const f = r.data[0];
    return say(P.flights({ from: CITY_BY_CODE[s.origin], to: CITY_BY_CODE[s.destination], date: d, n: r.data.length, airline: f.airline, flightNo: f.flightNo, time: f.departAt.slice(11, 16), price: rupees(f.fareINR) }));
  }

  if (has(I.recommend, text) && !cities.length) {
    s.pending = "destination";
    return say(recommend(text, args.lang, s.origin ? [s.origin] : []));
  }

  if (wantsPlan || cities.length) {
    if (!s.destination) {
      s.pending = "destination";
      return say((Object.values(THEMES).some((t) => t.re.test(text)) ? recommend(text, args.lang, []) : P.askDestination));
    }
    if (!s.origin || s.origin === s.destination) {
      s.pending = "origin";
      return say(P.askOrigin(CITY_BY_CODE[s.destination]));
    }
    const departDate = s.departDate ?? nextWeekday(5, 7);
    const r = tool<PlanResult>("planTrip", {
      origin: s.origin,
      destination: s.destination,
      departDate,
      nights: s.nights,
      adults: s.adults,
      children: s.children,
      budgetINR: ctx.budgetINR,
    });
    if (!r.ok) return fail(r.data);
    const it = r.data.itinerary;
    const out = it.items.find((i) => i.kind === "flight");
    const hotel = it.items.find((i) => i.kind === "hotel");
    return say(
      P.planned({
        dest: CITY_BY_CODE[s.destination],
        nights: s.nights,
        total: rupees(it.totalINR),
        budget: ctx.budgetINR ? rupees(ctx.budgetINR) : null,
        over: r.data.overBudgetINR > 0 ? rupees(r.data.overBudgetINR) : null,
        flight: `${out?.meta?.airline} ${out?.meta?.flightNo} ${String(out?.meta?.departAt ?? "").slice(11, 16)}`,
        hotel: String(hotel?.meta?.name ?? ""),
      }),
    );
  }

  if (has(I.recommend, text)) return say(recommend(text, args.lang, []));
  if (args.newPrefs.length) return say(P.noted(args.newPrefs.map((k) => PREF_LABEL[k].replace(/^\S+\s/, "")).join(", ")));
  if (has(I.greet, text)) return say(`${P.greet} ${P.help}`);
  if (has(I.book, text) || has(I.cheaper, text)) return say(trip ? P.unknown : P.noTrip);
  return say(P.unknown);
}

function rescueLine(d: DisruptionResult, lang: LangId): string {
  const P = PHRASES[lang];
  const best = d.options.find((o) => o.itineraryPatch.upsert.some((u) => u.kind === "flight")) ?? d.options[0];
  const flight = best?.itineraryPatch.upsert.find((u) => u.kind === "flight");
  const cab = best?.itineraryPatch.upsert.find((u) => u.kind === "transfer");
  const hotel = best?.itineraryPatch.upsert.find((u) => u.kind === "hotel");
  const orig = d.impact.split(" ").slice(0, 3).join(" ").replace(/ [A-Z]{3}→.*/, "");
  if (!flight || !d.type.startsWith("flight")) return P.rescue({ orig, cancelled: false, alt: null, altTime: null, altDate: null, cabTime: null, checkIn: null, fallback: d.impact });
  const departAt = String(flight.meta?.departAt ?? "");
  const origDate = d.impact.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return P.rescue({
    orig: d.impact.match(/^(.*?\d+)\s/)?.[1] ?? orig,
    cancelled: d.type === "flight_cancel",
    alt: `${flight.meta?.airline ?? ""} ${flight.meta?.flightNo ?? ""}`.trim(),
    altTime: departAt.slice(11, 16),
    altDate: departAt.slice(0, 10) !== origDate ? departAt.slice(0, 10) : null,
    cabTime: cab ? String(cab.meta?.time ?? "") : null,
    checkIn: hotel ? String(hotel.meta?.checkInTime ?? "") : null,
    fallback: d.impact,
  });
}
