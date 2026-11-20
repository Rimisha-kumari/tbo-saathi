import type { LangId } from "@/lib/lang";

export const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export type Theme = "beach" | "heritage" | "food" | "nature" | "city" | "culture";

interface PlannedArgs {
  dest: string;
  nights: number;
  total: string;
  budget: string | null;
  over: string | null;
  flight: string;
  hotel: string;
}
interface FlightsArgs {
  from: string;
  to: string;
  date: string;
  n: number;
  airline: string;
  flightNo: string;
  time: string;
  price: string;
}
interface HotelsArgs {
  city: string;
  name: string;
  stars: number;
  rating: number;
  price: string;
}
interface RescueArgs {
  orig: string;
  cancelled: boolean;
  alt: string | null;
  altTime: string | null;
  altDate: string | null;
  cabTime: string | null;
  checkIn: string | null;
  fallback: string;
}

export interface Phrases {
  theme: Record<Theme, string>;
  greet: string;
  help: string;
  recommend: (list: string) => string;
  askOrigin: (dest: string) => string;
  askDestination: string;
  planned: (a: PlannedArgs) => string;
  flights: (a: FlightsArgs) => string;
  hotels: (a: HotelsArgs) => string;
  compare: string;
  added: (total: string) => string;
  cheaper: (saved: string, total: string) => string;
  cheaperNone: (total: string) => string;
  dayChanged: (added: boolean, nights: number, total: string) => string;
  upgraded: (name: string, total: string) => string;
  confirmReady: (total: string) => string;
  cancelReady: (refund: string) => string;
  noBooking: string;
  noTrip: string;
  rescue: (a: RescueArgs) => string;
  rebookReady: string;
  noted: (labels: string) => string;
  unknown: string;
  error: (msg: string) => string;
}

const en: Phrases = {
  theme: { beach: "beaches", heritage: "forts & heritage", food: "food trails", nature: "backwaters & nature", city: "city life", culture: "art & culture" },
  greet: "Namaste! I'm Saathi. Where would you like to travel?",
  help: "I can plan the whole trip. Try: 'Delhi to Goa, 3 nights, 2 people, budget ₹50,000'.",
  recommend: (l) => `Great picks this season: ${l}. Which one do you like, and which city will you fly from?`,
  askOrigin: (d) => `${d} is a lovely choice! Which city will you fly from?`,
  askDestination: "Of course! Where would you like to go? Goa, Jaipur and Kochi are popular right now.",
  planned: (a) =>
    `Your ${a.nights}-night ${a.dest} trip is ready: ${a.flight}, a stay at ${a.hotel}, airport cabs and sightseeing. Total ${a.total}${a.over ? `, ${a.over} over budget — say 'make it cheaper'` : a.budget ? `, within your ${a.budget} budget` : ""}. See the Itinerary tab.`,
  flights: (a) => `I found ${a.n} flights from ${a.from} to ${a.to} on ${a.date}. Cheapest is ${a.airline} ${a.flightNo} at ${a.time}, ${a.price} per person. Compare them in the Compare tab.`,
  hotels: (a) => `Top pick in ${a.city}: ${a.name}, ${a.stars}-star, rated ${a.rating}, ${a.price} a night. More options are in the Compare tab.`,
  compare: "Flights and hotels are side by side in the Compare tab. Tap Select on the one you like.",
  added: (t) => `Added to your trip. The total is now ${t}.`,
  cheaper: (s, t) => `Saved you ${s}! The new total is ${t}.`,
  cheaperNone: (t) => `This is already the most budget-friendly option, total ${t}.`,
  dayChanged: (a, n, t) => `${a ? "Added a day" : "Removed a day"} — now ${n} nights, total ${t}.`,
  upgraded: (n, t) => `Upgraded your stay to ${n}. New total ${t}.`,
  confirmReady: (t) => `Your booking summary is ready, total ${t}. Please tap Confirm ✅ on the card, or Edit ✏️ to change anything.`,
  cancelReady: (r) => `Cancelling refunds ${r}. Tap Confirm on the card if you're sure.`,
  noBooking: "There's no confirmed booking yet. Shall we book your trip first?",
  noTrip: "We haven't planned a trip yet. Where would you like to go?",
  rescue: (a) =>
    a.alt
      ? `I'm so sorry, ${a.orig} ${a.cancelled ? "has been cancelled" : "is delayed"}. Don't worry — best option: ${a.alt} at ${a.altTime}${a.altDate ? ` on ${a.altDate}` : ""}${a.cabTime ? `, your airport cab moves to ${a.cabTime}` : ""}${a.checkIn ? ` and hotel check-in to ${a.checkIn}` : ""}. Choose it on the rescue card.`
      : `I'm so sorry about this. ${a.fallback} Choose an option on the rescue card.`,
  rebookReady: "Your rescue plan is ready. Tap Confirm on the card and I'll reissue your vouchers.",
  noted: (l) => `Noted: ${l}. I'll use that for every recommendation.`,
  unknown: "Sorry, I didn't quite get that. Try 'plan a Goa trip', 'make it cheaper', 'add 1 day' or 'book it'.",
  error: (m) => `Sorry: ${m}`,
};

const hi: Phrases = {
  theme: { beach: "समुद्र तट", heritage: "किले और विरासत", food: "खान-पान", nature: "बैकवॉटर और प्रकृति", city: "शहर की रौनक", culture: "कला और संस्कृति" },
  greet: "नमस्ते! मैं साथी हूँ। बताइए, कहाँ घूमने का मन है?",
  help: "मैं पूरी ट्रिप प्लान कर सकती हूँ। जैसे कहिए: 'दिल्ली से गोवा 3 रात, 2 लोग, बजट ₹50,000'।",
  recommend: (l) => `इस मौसम में ये बढ़िया रहेंगे: ${l}। कौन-सा पसंद है, और आप किस शहर से जाएँगे?`,
  askOrigin: (d) => `${d} बढ़िया चुनाव है! आप किस शहर से उड़ान लेंगे?`,
  askDestination: "ज़रूर! आप कहाँ जाना चाहेंगे? गोवा, जयपुर, कोच्चि जैसे विकल्प हैं।",
  planned: (a) =>
    `${a.dest} की ${a.nights} रात की ट्रिप तैयार है: ${a.flight}, ${a.hotel} में ठहरना, एयरपोर्ट कैब और घूमना शामिल। कुल ${a.total}${a.over ? `, बजट से ${a.over} ज़्यादा — 'सस्ता करो' कहिए` : a.budget ? `, आपके ${a.budget} बजट के अंदर` : ""}। Itinerary टैब में देखिए।`,
  flights: (a) => `${a.from} से ${a.to} ${a.date} को ${a.n} फ्लाइट मिलीं। सबसे सस्ती ${a.airline} ${a.flightNo}, ${a.time} बजे, ${a.price} प्रति व्यक्ति। Compare टैब में तुलना कीजिए।`,
  hotels: (a) => `${a.city} में सबसे अच्छा: ${a.name}, ${a.stars} स्टार, रेटिंग ${a.rating}, ${a.price} प्रति रात। बाकी विकल्प Compare टैब में हैं।`,
  compare: "Compare टैब में फ्लाइट और होटल साथ-साथ रखे हैं। जो पसंद हो, Select दबाइए।",
  added: (t) => `ट्रिप में जोड़ दिया। अब कुल ${t} है।`,
  cheaper: (s, t) => `${s} बचा लिए! नया कुल ${t} है।`,
  cheaperNone: (t) => `यह पहले से सबसे किफ़ायती विकल्प है, कुल ${t}।`,
  dayChanged: (a, n, t) => `${a ? "एक दिन बढ़ा दिया" : "एक दिन कम कर दिया"} — अब ${n} रात, कुल ${t}।`,
  upgraded: (n, t) => `होटल अपग्रेड करके ${n} कर दिया। नया कुल ${t}।`,
  confirmReady: (t) => `बुकिंग का सारांश तैयार है, कुल ${t}। कृपया कार्ड पर Confirm ✅ दबाइए, या Edit ✏️ से बदलाव कीजिए।`,
  cancelReady: (r) => `रद्द करने पर ${r} रिफ़ंड मिलेगा। पक्का करने के लिए कार्ड पर Confirm दबाइए।`,
  noBooking: "अभी कोई कन्फ़र्म बुकिंग नहीं है। पहले ट्रिप बुक कर लें?",
  noTrip: "अभी कोई ट्रिप प्लान नहीं है। बताइए, कहाँ जाना है?",
  rescue: (a) =>
    a.alt
      ? `माफ़ कीजिए, ${a.orig} ${a.cancelled ? "रद्द हो गई है" : "लेट है"}। चिंता मत कीजिए — सबसे अच्छा विकल्प: ${a.alt}, ${a.altTime} बजे${a.altDate ? ` (${a.altDate})` : ""}।${a.cabTime ? ` कैब ${a.cabTime} बजे कर दी जाएगी।` : ""}${a.checkIn ? ` होटल चेक-इन ${a.checkIn} बजे।` : ""} Rescue कार्ड पर चुनिए।`
      : `माफ़ कीजिए, यह परेशानी हुई। Rescue कार्ड पर विकल्प चुनिए।`,
  rebookReady: "Rescue प्लान तैयार है। कार्ड पर Confirm दबाते ही नए वाउचर जारी हो जाएँगे।",
  noted: (l) => `नोट कर लिया: ${l}। आगे के सुझाव इसी हिसाब से दूँगी।`,
  unknown: "माफ़ कीजिए, ठीक से समझ नहीं पाई। आप कह सकते हैं: 'गोवा की ट्रिप प्लान करो', 'सस्ता करो', 'एक दिन बढ़ाओ' या 'बुक करो'।",
  error: (m) => `माफ़ कीजिए: ${m}`,
};

const hinglish: Phrases = {
  theme: { beach: "beaches", heritage: "forts aur heritage", food: "food trails", nature: "backwaters aur nature", city: "city vibes", culture: "art aur culture" },
  greet: "Namaste! Main Saathi hoon. Bataiye, kahan ghoomne ka plan hai?",
  help: "Main poori trip plan kar sakti hoon. Jaise boliye: 'Delhi se Goa 3 raat, 2 log, budget ₹50k'.",
  recommend: (l) => `Is season mein ye best rahenge: ${l}. Kaunsa pasand hai, aur aap kis city se travel karenge?`,
  askOrigin: (d) => `${d} great choice hai! Aap kis city se flight lenge?`,
  askDestination: "Zaroor! Kahan jaana chahenge? Goa, Jaipur, Kochi jaise options hain.",
  planned: (a) =>
    `${a.dest} ki ${a.nights} raat ki trip ready hai: ${a.flight}, ${a.hotel} mein stay, airport cab aur sightseeing included. Total ${a.total}${a.over ? `, budget se ${a.over} zyada — 'sasta karo' boliye` : a.budget ? `, aapke ${a.budget} budget ke andar` : ""}. Itinerary tab check kijiye.`,
  flights: (a) => `${a.from} se ${a.to} ${a.date} ko ${a.n} flights mili. Sabse sasti ${a.airline} ${a.flightNo}, ${a.time} baje, ${a.price} per person. Compare tab mein dekhiye.`,
  hotels: (a) => `${a.city} mein top pick: ${a.name}, ${a.stars} star, rating ${a.rating}, ${a.price} per night. Baaki options Compare tab mein hain.`,
  compare: "Compare tab mein flights aur hotels side-by-side hain. Jo pasand aaye, Select dabaiye.",
  added: (t) => `Trip mein add kar diya. Ab total ${t} hai.`,
  cheaper: (s, t) => `${s} bacha liye! Naya total ${t}.`,
  cheaperNone: (t) => `Ye already sabse budget-friendly option hai, total ${t}.`,
  dayChanged: (a, n, t) => `${a ? "Ek din badha diya" : "Ek din kam kar diya"} — ab ${n} raat, total ${t}.`,
  upgraded: (n, t) => `Hotel upgrade karke ${n} kar diya. Naya total ${t}.`,
  confirmReady: (t) => `Booking summary ready hai, total ${t}. Card par Confirm ✅ dabaiye, ya Edit ✏️ se changes kijiye.`,
  cancelReady: (r) => `Cancel karne par ${r} refund milega. Pakka karne ke liye card par Confirm dabaiye.`,
  noBooking: "Abhi koi confirmed booking nahi hai. Pehle trip book kar lein?",
  noTrip: "Abhi koi trip plan nahi hai. Bataiye kahan jaana hai?",
  rescue: (a) =>
    a.alt
      ? `Sorry, ${a.orig} ${a.cancelled ? "cancel ho gayi hai" : "late hai"}. Tension mat lijiye — best option: ${a.alt}, ${a.altTime} baje${a.altDate ? ` (${a.altDate})` : ""}.${a.cabTime ? ` Cab ${a.cabTime} baje reschedule ho jayegi.` : ""}${a.checkIn ? ` Hotel check-in ${a.checkIn} baje.` : ""} Rescue card par choose kijiye.`
      : `Sorry, ye problem hui. Rescue card par option choose kijiye.`,
  rebookReady: "Rescue plan ready hai. Card par Confirm dabate hi naye vouchers issue ho jayenge.",
  noted: (l) => `Note kar liya: ${l}. Aage ke suggestions isi hisaab se dungi.`,
  unknown: "Sorry, theek se samajh nahi payi. Aap bol sakte hain: 'Goa trip plan karo', 'sasta karo', 'ek din badhao' ya 'book karo'.",
  error: (m) => `Sorry: ${m}`,
};

const ta: Phrases = {
  theme: { beach: "கடற்கரைகள்", heritage: "கோட்டைகள் & பாரம்பரியம்", food: "உணவு சுற்றுலா", nature: "உப்பங்கழி & இயற்கை", city: "நகர வாழ்க்கை", culture: "கலை & கலாச்சாரம்" },
  greet: "வணக்கம்! நான் சாதி. எங்கே பயணம் செல்ல விரும்புகிறீர்கள்?",
  help: "முழு பயணத்தையும் நான் திட்டமிடுவேன். உதாரணம்: 'சென்னையிலிருந்து கோவா 3 இரவு, 2 பேர், பட்ஜெட் ₹50,000'.",
  recommend: (l) => `இந்த பருவத்தில் இவை சிறந்தவை: ${l}. எது பிடித்திருக்கிறது, எந்த நகரத்திலிருந்து புறப்படுவீர்கள்?`,
  askOrigin: (d) => `${d} அருமையான தேர்வு! எந்த நகரத்திலிருந்து விமானத்தில் புறப்படுவீர்கள்?`,
  askDestination: "நிச்சயமாக! எங்கே செல்ல விரும்புகிறீர்கள்? கோவா, ஜெய்ப்பூர், கொச்சி போன்றவை உள்ளன.",
  planned: (a) =>
    `${a.dest} ${a.nights} இரவு பயணம் தயார்: ${a.flight}, ${a.hotel} தங்குமிடம், விமான நிலைய கார் மற்றும் சுற்றுலா சேர்த்து. மொத்தம் ${a.total}${a.over ? `, பட்ஜெட்டை விட ${a.over} அதிகம் — 'மலிவாக்கு' என்று சொல்லுங்கள்` : a.budget ? `, உங்கள் ${a.budget} பட்ஜெட்டுக்குள்` : ""}. Itinerary டேபில் பாருங்கள்.`,
  flights: (a) => `${a.from} முதல் ${a.to} வரை ${a.date} அன்று ${a.n} விமானங்கள் உள்ளன. மலிவானது ${a.airline} ${a.flightNo}, ${a.time} மணிக்கு, ஒருவருக்கு ${a.price}. Compare டேபில் ஒப்பிடுங்கள்.`,
  hotels: (a) => `${a.city}யில் சிறந்தது: ${a.name}, ${a.stars} நட்சத்திரம், மதிப்பீடு ${a.rating}, ஒரு இரவுக்கு ${a.price}. மற்ற தேர்வுகள் Compare டேபில் உள்ளன.`,
  compare: "Compare டேபில் விமானங்களும் ஹோட்டல்களும் அருகருகே உள்ளன. பிடித்ததை Select செய்யுங்கள்.",
  added: (t) => `பயணத்தில் சேர்த்துவிட்டேன். மொத்தம் இப்போது ${t}.`,
  cheaper: (s, t) => `${s} சேமித்தோம்! புதிய மொத்தம் ${t}.`,
  cheaperNone: (t) => `இதுவே மிகக் குறைந்த விலை தேர்வு, மொத்தம் ${t}.`,
  dayChanged: (a, n, t) => `${a ? "ஒரு நாள் சேர்த்தேன்" : "ஒரு நாள் குறைத்தேன்"} — இப்போது ${n} இரவுகள், மொத்தம் ${t}.`,
  upgraded: (n, t) => `ஹோட்டலை ${n} ஆக மேம்படுத்தினேன். புதிய மொத்தம் ${t}.`,
  confirmReady: (t) => `முன்பதிவு சுருக்கம் தயார், மொத்தம் ${t}. கார்டில் Confirm ✅ அழுத்துங்கள், அல்லது Edit ✏️ மூலம் மாற்றுங்கள்.`,
  cancelReady: (r) => `ரத்து செய்தால் ${r} திரும்பக் கிடைக்கும். உறுதிப்படுத்த கார்டில் Confirm அழுத்துங்கள்.`,
  noBooking: "இப்போது உறுதிசெய்யப்பட்ட முன்பதிவு இல்லை. முதலில் பயணத்தை முன்பதிவு செய்யலாமா?",
  noTrip: "இன்னும் பயணம் திட்டமிடப்படவில்லை. எங்கே செல்ல வேண்டும் என்று சொல்லுங்கள்.",
  rescue: (a) =>
    a.alt
      ? `மன்னிக்கவும், ${a.orig} ${a.cancelled ? "ரத்து செய்யப்பட்டது" : "தாமதமாகிறது"}. கவலை வேண்டாம் — சிறந்த தேர்வு: ${a.alt}, ${a.altTime} மணிக்கு${a.altDate ? ` (${a.altDate})` : ""}.${a.cabTime ? ` கார் ${a.cabTime} மணிக்கு மாற்றப்படும்.` : ""}${a.checkIn ? ` ஹோட்டல் செக்-இன் ${a.checkIn}.` : ""} Rescue கார்டில் தேர்ந்தெடுங்கள்.`
      : `மன்னிக்கவும், இந்த சிரமத்திற்கு. Rescue கார்டில் ஒரு தேர்வைத் தேர்ந்தெடுங்கள்.`,
  rebookReady: "மீட்பு திட்டம் தயார். கார்டில் Confirm அழுத்தியதும் புதிய வவுச்சர்கள் வழங்கப்படும்.",
  noted: (l) => `குறித்துக்கொண்டேன்: ${l}. இனி பரிந்துரைகள் இதன்படி இருக்கும்.`,
  unknown: "மன்னிக்கவும், சரியாகப் புரியவில்லை. 'கோவா பயணம் திட்டமிடு', 'மலிவாக்கு', 'ஒரு நாள் சேர்' அல்லது 'புக் செய்' என்று சொல்லலாம்.",
  error: (m) => `மன்னிக்கவும்: ${m}`,
};

const te: Phrases = {
  theme: { beach: "బీచ్‌లు", heritage: "కోటలు & వారసత్వం", food: "ఆహార విహారం", nature: "బ్యాక్‌వాటర్స్ & ప్రకృతి", city: "నగర జీవితం", culture: "కళ & సంస్కృతి" },
  greet: "నమస్కారం! నేను సాథీ. ఎక్కడికి వెళ్లాలనుకుంటున్నారు?",
  help: "మీ పూర్తి ట్రిప్ నేను ప్లాన్ చేస్తాను. ఉదా: 'హైదరాబాద్ నుండి గోవా 3 రాత్రులు, 2 మంది, బడ్జెట్ ₹50,000'.",
  recommend: (l) => `ఈ సీజన్‌లో ఇవి బాగుంటాయి: ${l}. ఏది నచ్చింది, ఏ నగరం నుండి బయలుదేరుతారు?`,
  askOrigin: (d) => `${d} మంచి ఎంపిక! మీరు ఏ నగరం నుండి ఫ్లైట్ ఎక్కుతారు?`,
  askDestination: "తప్పకుండా! ఎక్కడికి వెళ్లాలనుకుంటున్నారు? గోవా, జైపూర్, కొచ్చి వంటివి ఉన్నాయి.",
  planned: (a) =>
    `${a.dest} ${a.nights} రాత్రుల ట్రిప్ సిద్ధం: ${a.flight}, ${a.hotel}లో బస, ఎయిర్‌పోర్ట్ క్యాబ్ మరియు సైట్‌సీయింగ్ కలిపి. మొత్తం ${a.total}${a.over ? `, బడ్జెట్ కంటే ${a.over} ఎక్కువ — 'చౌకగా చేయి' అనండి` : a.budget ? `, మీ ${a.budget} బడ్జెట్‌లోనే` : ""}. Itinerary ట్యాబ్ చూడండి.`,
  flights: (a) => `${a.from} నుండి ${a.to}కి ${a.date}న ${a.n} ఫ్లైట్లు ఉన్నాయి. చౌకైనది ${a.airline} ${a.flightNo}, ${a.time}కి, ఒక్కొక్కరికి ${a.price}. Compare ట్యాబ్‌లో పోల్చండి.`,
  hotels: (a) => `${a.city}లో ఉత్తమమైనది: ${a.name}, ${a.stars} స్టార్, రేటింగ్ ${a.rating}, రాత్రికి ${a.price}. మిగతావి Compare ట్యాబ్‌లో ఉన్నాయి.`,
  compare: "Compare ట్యాబ్‌లో ఫ్లైట్లు, హోటళ్లు పక్కపక్కనే ఉన్నాయి. నచ్చినది Select చేయండి.",
  added: (t) => `ట్రిప్‌లో చేర్చాను. ఇప్పుడు మొత్తం ${t}.`,
  cheaper: (s, t) => `${s} ఆదా చేశాం! కొత్త మొత్తం ${t}.`,
  cheaperNone: (t) => `ఇదే అత్యంత చౌకైన ఎంపిక, మొత్తం ${t}.`,
  dayChanged: (a, n, t) => `${a ? "ఒక రోజు పెంచాను" : "ఒక రోజు తగ్గించాను"} — ఇప్పుడు ${n} రాత్రులు, మొత్తం ${t}.`,
  upgraded: (n, t) => `హోటల్‌ను ${n}కి అప్‌గ్రేడ్ చేశాను. కొత్త మొత్తం ${t}.`,
  confirmReady: (t) => `బుకింగ్ సారాంశం సిద్ధం, మొత్తం ${t}. కార్డుపై Confirm ✅ నొక్కండి, లేదా Edit ✏️ తో మార్చండి.`,
  cancelReady: (r) => `రద్దు చేస్తే ${r} తిరిగి వస్తుంది. నిర్ధారించడానికి కార్డుపై Confirm నొక్కండి.`,
  noBooking: "ఇప్పుడు నిర్ధారించిన బుకింగ్ లేదు. ముందుగా ట్రిప్ బుక్ చేద్దామా?",
  noTrip: "ఇంకా ట్రిప్ ప్లాన్ చేయలేదు. ఎక్కడికి వెళ్లాలో చెప్పండి.",
  rescue: (a) =>
    a.alt
      ? `క్షమించండి, ${a.orig} ${a.cancelled ? "రద్దయింది" : "ఆలస్యంగా ఉంది"}. చింతించకండి — ఉత్తమ ఎంపిక: ${a.alt}, ${a.altTime}కి${a.altDate ? ` (${a.altDate})` : ""}.${a.cabTime ? ` క్యాబ్ ${a.cabTime}కి మారుతుంది.` : ""}${a.checkIn ? ` హోటల్ చెక్-ఇన్ ${a.checkIn}.` : ""} Rescue కార్డులో ఎంచుకోండి.`
      : `క్షమించండి, ఈ ఇబ్బందికి. Rescue కార్డులో ఒక ఎంపికను ఎంచుకోండి.`,
  rebookReady: "రెస్క్యూ ప్లాన్ సిద్ధం. కార్డుపై Confirm నొక్కగానే కొత్త వోచర్లు వస్తాయి.",
  noted: (l) => `గుర్తుంచుకున్నాను: ${l}. ఇకపై సూచనలు దీని ప్రకారమే.`,
  unknown: "క్షమించండి, సరిగ్గా అర్థం కాలేదు. 'గోవా ట్రిప్ ప్లాన్ చేయి', 'చౌకగా చేయి', 'ఒక రోజు పెంచు' లేదా 'బుక్ చేయి' అనవచ్చు.",
  error: (m) => `క్షమించండి: ${m}`,
};

const bn: Phrases = {
  theme: { beach: "সমুদ্র সৈকত", heritage: "দুর্গ ও ঐতিহ্য", food: "খাবারের সফর", nature: "ব্যাকওয়াটার ও প্রকৃতি", city: "শহরের জীবন", culture: "শিল্প ও সংস্কৃতি" },
  greet: "নমস্কার! আমি সাথী। কোথায় ঘুরতে যেতে চান?",
  help: "আমি পুরো ট্রিপ প্ল্যান করে দিতে পারি। যেমন বলুন: 'কলকাতা থেকে গোয়া 3 রাত, 2 জন, বাজেট ₹50,000'।",
  recommend: (l) => `এই মরসুমে এগুলো দারুণ: ${l}। কোনটা পছন্দ, আর কোন শহর থেকে যাবেন?`,
  askOrigin: (d) => `${d} দারুণ পছন্দ! কোন শহর থেকে ফ্লাইট ধরবেন?`,
  askDestination: "অবশ্যই! কোথায় যেতে চান? গোয়া, জয়পুর, কোচির মতো বিকল্প আছে।",
  planned: (a) =>
    `${a.dest}-এর ${a.nights} রাতের ট্রিপ তৈরি: ${a.flight}, ${a.hotel}-এ থাকা, এয়ারপোর্ট ক্যাব আর সাইটসিয়িং সহ। মোট ${a.total}${a.over ? `, বাজেটের চেয়ে ${a.over} বেশি — 'সস্তা করো' বলুন` : a.budget ? `, আপনার ${a.budget} বাজেটের মধ্যে` : ""}। Itinerary ট্যাবে দেখুন।`,
  flights: (a) => `${a.from} থেকে ${a.to} ${a.date} তারিখে ${a.n}টি ফ্লাইট আছে। সবচেয়ে সস্তা ${a.airline} ${a.flightNo}, ${a.time}-এ, জনপ্রতি ${a.price}। Compare ট্যাবে তুলনা করুন।`,
  hotels: (a) => `${a.city}-তে সেরা: ${a.name}, ${a.stars} তারা, রেটিং ${a.rating}, প্রতি রাত ${a.price}। বাকিগুলো Compare ট্যাবে।`,
  compare: "Compare ট্যাবে ফ্লাইট আর হোটেল পাশাপাশি রাখা আছে। পছন্দেরটা Select করুন।",
  added: (t) => `ট্রিপে যোগ করেছি। এখন মোট ${t}।`,
  cheaper: (s, t) => `${s} বাঁচালাম! নতুন মোট ${t}।`,
  cheaperNone: (t) => `এটাই সবচেয়ে সাশ্রয়ী বিকল্প, মোট ${t}।`,
  dayChanged: (a, n, t) => `${a ? "একদিন বাড়ালাম" : "একদিন কমালাম"} — এখন ${n} রাত, মোট ${t}।`,
  upgraded: (n, t) => `হোটেল আপগ্রেড করে ${n} করেছি। নতুন মোট ${t}।`,
  confirmReady: (t) => `বুকিংয়ের সারাংশ তৈরি, মোট ${t}। কার্ডে Confirm ✅ চাপুন, অথবা Edit ✏️ দিয়ে বদলান।`,
  cancelReady: (r) => `বাতিল করলে ${r} ফেরত পাবেন। নিশ্চিত করতে কার্ডে Confirm চাপুন।`,
  noBooking: "এখন কোনো নিশ্চিত বুকিং নেই। আগে ট্রিপ বুক করবেন?",
  noTrip: "এখনও কোনো ট্রিপ প্ল্যান হয়নি। কোথায় যেতে চান বলুন।",
  rescue: (a) =>
    a.alt
      ? `দুঃখিত, ${a.orig} ${a.cancelled ? "বাতিল হয়েছে" : "দেরিতে চলছে"}। চিন্তা করবেন না — সেরা বিকল্প: ${a.alt}, ${a.altTime}-এ${a.altDate ? ` (${a.altDate})` : ""}।${a.cabTime ? ` ক্যাব ${a.cabTime}-এ সরানো হবে।` : ""}${a.checkIn ? ` হোটেল চেক-ইন ${a.checkIn}।` : ""} Rescue কার্ডে বেছে নিন।`
      : `দুঃখিত, এই অসুবিধার জন্য। Rescue কার্ডে একটি বিকল্প বেছে নিন।`,
  rebookReady: "রেসকিউ প্ল্যান তৈরি। কার্ডে Confirm চাপলেই নতুন ভাউচার পাবেন।",
  noted: (l) => `মনে রাখলাম: ${l}। এরপর থেকে পরামর্শ সেই অনুযায়ী দেব।`,
  unknown: "দুঃখিত, ঠিক বুঝতে পারিনি। বলতে পারেন: 'গোয়া ট্রিপ প্ল্যান করো', 'সস্তা করো', 'একদিন বাড়াও' বা 'বুক করো'।",
  error: (m) => `দুঃখিত: ${m}`,
};

export const PHRASES: Record<LangId, Phrases> = { en, hi, hinglish, ta, te, bn };
