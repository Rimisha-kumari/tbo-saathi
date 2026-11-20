import { LANG_IDS, LANG_META, type LangId } from "@/lib/lang";

export const LANGS: { code: LangId; label: string }[] = LANG_IDS.map((code) => ({ code, label: LANG_META[code].label }));

interface Strings {
  greeting: string;
  placeholder: string;
  suggestions: string[];
  disruptionAlert: string;
  compareHotels: string;
  makeCheaper: string;
  addDay: string;
  removeDay: string;
  upgradeHotel: string;
  reviewBook: string;
  booked: (pnr: string, paid: string) => string;
  updated: (pnr: string) => string;
  cancelled: (refund: string) => string;
  rescued: (pnr: string) => string;
  editHint: string;
}

export const STRINGS: Record<LangId, Strings> = {
  en: {
    greeting: "Namaste! I'm Saathi, your TBO travel consultant. Where would you like to go?",
    placeholder: "Ask Saathi… e.g. plan a Goa trip for 2 under ₹50k",
    suggestions: ["Plan a 3-night Goa trip from Delhi for 2, budget ₹50,000", "Suggest a heritage getaway for this weekend", "I prefer window seats, veg meals and 4-star hotels"],
    disruptionAlert: "I just got an alert about my booking. Please help me.",
    compareHotels: "Compare the hotels side by side",
    makeCheaper: "Make it cheaper",
    addDay: "Add 1 day",
    removeDay: "Remove 1 day",
    upgradeHotel: "Upgrade my hotel",
    reviewBook: "Please book this trip",
    booked: (p, a) => `Booked! Your PNR is ${p}, ${a} paid. Vouchers are in My Bookings.`,
    updated: (p) => `Done — booking ${p} is updated and your vouchers are reissued.`,
    cancelled: (r) => `Your booking is cancelled. A refund of ${r} is on its way.`,
    rescued: (p) => `All sorted! Booking ${p} is rescued — new vouchers with updated cab and check-in times are ready.`,
    editHint: "No problem — adjust the trip in the Itinerary tab, then ask me to book again.",
  },
  hi: {
    greeting: "नमस्ते! मैं साथी हूँ, आपकी TBO ट्रैवल सलाहकार। आप कहाँ जाना चाहेंगे?",
    placeholder: "साथी से पूछिए… जैसे ₹50,000 में गोवा ट्रिप",
    suggestions: ["दिल्ली से गोवा की 3 रात की ट्रिप प्लान करो, 2 लोग, बजट ₹50,000", "इस वीकेंड कोई विरासत वाली जगह सुझाओ", "मुझे खिड़की वाली सीट, शाकाहारी खाना और 4 स्टार होटल चाहिए"],
    disruptionAlert: "मेरी बुकिंग के बारे में अभी एक अलर्ट आया है। कृपया मदद कीजिए।",
    compareHotels: "होटलों की तुलना करो",
    makeCheaper: "इसे सस्ता करो",
    addDay: "एक दिन बढ़ाओ",
    removeDay: "एक दिन कम करो",
    upgradeHotel: "होटल अपग्रेड करो",
    reviewBook: "यह ट्रिप बुक करो",
    booked: (p, a) => `बुकिंग हो गई! आपका PNR ${p} है, ${a} भुगतान हुआ। वाउचर My Bookings में हैं।`,
    updated: (p) => `हो गया — बुकिंग ${p} अपडेट हो गई और नए वाउचर जारी हो गए।`,
    cancelled: (r) => `आपकी बुकिंग रद्द हो गई। ${r} का रिफ़ंड भेजा जा रहा है।`,
    rescued: (p) => `सब ठीक हो गया! बुकिंग ${p} बचा ली गई — नई कैब और चेक-इन समय वाले वाउचर तैयार हैं।`,
    editHint: "कोई बात नहीं — Itinerary टैब में बदलाव कीजिए, फिर मुझसे दोबारा बुक करने को कहिए।",
  },
  hinglish: {
    greeting: "Namaste! Main Saathi hoon, aapki TBO travel consultant. Kahan jaana hai?",
    placeholder: "Saathi se poochiye… jaise ₹50k mein Goa trip",
    suggestions: ["Delhi se Goa 3 raat ki trip plan karo, 2 log, budget ₹50k", "Is weekend koi heritage jagah suggest karo", "Mujhe window seat, veg khana aur 4 star hotel chahiye"],
    disruptionAlert: "Meri booking ke baare mein abhi alert aaya hai. Please help kijiye.",
    compareHotels: "Hotels compare karo",
    makeCheaper: "Isse sasta karo",
    addDay: "Ek din badhao",
    removeDay: "Ek din kam karo",
    upgradeHotel: "Hotel upgrade karo",
    reviewBook: "Ye trip book karo",
    booked: (p, a) => `Booking ho gayi! Aapka PNR ${p} hai, ${a} paid. Vouchers My Bookings mein hain.`,
    updated: (p) => `Ho gaya — booking ${p} update ho gayi aur naye vouchers issue ho gaye.`,
    cancelled: (r) => `Aapki booking cancel ho gayi. ${r} ka refund process ho raha hai.`,
    rescued: (p) => `Sab set! Booking ${p} rescue ho gayi — nayi cab aur check-in timing wale vouchers ready hain.`,
    editHint: "Koi baat nahi — Itinerary tab mein changes kijiye, phir dobara book karne ko boliye.",
  },
  ta: {
    greeting: "வணக்கம்! நான் சாதி, உங்கள் TBO பயண ஆலோசகர். எங்கே செல்ல விரும்புகிறீர்கள்?",
    placeholder: "சாதியிடம் கேளுங்கள்… எ.கா. ₹50,000க்குள் கோவா பயணம்",
    suggestions: ["சென்னையிலிருந்து கோவா 3 இரவு பயணம் திட்டமிடு, 2 பேர், பட்ஜெட் ₹50,000", "இந்த வார இறுதிக்கு ஒரு பாரம்பரிய இடம் பரிந்துரை செய்", "எனக்கு ஜன்னல் இருக்கை, சைவ உணவு, 4 நட்சத்திர ஹோட்டல் வேண்டும்"],
    disruptionAlert: "என் முன்பதிவு பற்றி ஒரு எச்சரிக்கை வந்தது. தயவுசெய்து உதவுங்கள்.",
    compareHotels: "ஹோட்டல்களை ஒப்பிடு",
    makeCheaper: "இதை மலிவாக்கு",
    addDay: "ஒரு நாள் சேர்",
    removeDay: "ஒரு நாள் குறை",
    upgradeHotel: "ஹோட்டலை மேம்படுத்து",
    reviewBook: "இந்த பயணத்தை புக் செய்",
    booked: (p, a) => `முன்பதிவு முடிந்தது! உங்கள் PNR ${p}, ${a} செலுத்தப்பட்டது. வவுச்சர்கள் My Bookings-இல் உள்ளன.`,
    updated: (p) => `முடிந்தது — முன்பதிவு ${p} புதுப்பிக்கப்பட்டது, புதிய வவுச்சர்கள் வழங்கப்பட்டன.`,
    cancelled: (r) => `உங்கள் முன்பதிவு ரத்து செய்யப்பட்டது. ${r} திருப்பி அனுப்பப்படுகிறது.`,
    rescued: (p) => `எல்லாம் சரியாகிவிட்டது! முன்பதிவு ${p} மீட்கப்பட்டது — புதிய கார் மற்றும் செக்-இன் நேரங்களுடன் வவுச்சர்கள் தயார்.`,
    editHint: "பரவாயில்லை — Itinerary டேபில் மாற்றுங்கள், பிறகு மீண்டும் புக் செய்யச் சொல்லுங்கள்.",
  },
  te: {
    greeting: "నమస్కారం! నేను సాథీ, మీ TBO ట్రావెల్ కన్సల్టెంట్. మీరు ఎక్కడికి వెళ్లాలనుకుంటున్నారు?",
    placeholder: "సాథీని అడగండి… ఉదా. ₹50,000లో గోవా ట్రిప్",
    suggestions: ["హైదరాబాద్ నుండి గోవా 3 రాత్రుల ట్రిప్ ప్లాన్ చేయి, 2 మంది, బడ్జెట్ ₹50,000", "ఈ వీకెండ్‌కి ఒక వారసత్వ ప్రదేశం సూచించు", "నాకు విండో సీటు, శాకాహార భోజనం, 4 స్టార్ హోటల్ కావాలి"],
    disruptionAlert: "నా బుకింగ్ గురించి ఇప్పుడే అలర్ట్ వచ్చింది. దయచేసి సహాయం చేయండి.",
    compareHotels: "హోటళ్లను పోల్చు",
    makeCheaper: "దీన్ని చౌకగా చేయి",
    addDay: "ఒక రోజు పెంచు",
    removeDay: "ఒక రోజు తగ్గించు",
    upgradeHotel: "హోటల్ అప్‌గ్రేడ్ చేయి",
    reviewBook: "ఈ ట్రిప్ బుక్ చేయి",
    booked: (p, a) => `బుకింగ్ పూర్తయింది! మీ PNR ${p}, ${a} చెల్లించారు. వోచర్లు My Bookingsలో ఉన్నాయి.`,
    updated: (p) => `పూర్తయింది — బుకింగ్ ${p} అప్‌డేట్ అయింది, కొత్త వోచర్లు జారీ అయ్యాయి.`,
    cancelled: (r) => `మీ బుకింగ్ రద్దయింది. ${r} రీఫండ్ పంపుతున్నాం.`,
    rescued: (p) => `అంతా సరిచేశాం! బుకింగ్ ${p} రక్షించబడింది — కొత్త క్యాబ్, చెక్-ఇన్ సమయాలతో వోచర్లు సిద్ధం.`,
    editHint: "పర్వాలేదు — Itinerary ట్యాబ్‌లో మార్చండి, తర్వాత మళ్లీ బుక్ చేయమని చెప్పండి.",
  },
  bn: {
    greeting: "নমস্কার! আমি সাথী, আপনার TBO ভ্রমণ পরামর্শদাতা। কোথায় যেতে চান?",
    placeholder: "সাথীকে জিজ্ঞাসা করুন… যেমন ₹50,000-এ গোয়া ট্রিপ",
    suggestions: ["কলকাতা থেকে গোয়া 3 রাতের ট্রিপ প্ল্যান করো, 2 জন, বাজেট ₹50,000", "এই সপ্তাহান্তে কোনো ঐতিহ্যের জায়গা পরামর্শ দাও", "আমার জানালার সিট, নিরামিষ খাবার আর 4 তারা হোটেল চাই"],
    disruptionAlert: "আমার বুকিং নিয়ে এইমাত্র একটি সতর্কবার্তা এসেছে। দয়া করে সাহায্য করুন।",
    compareHotels: "হোটেলগুলোর তুলনা করো",
    makeCheaper: "এটা সস্তা করো",
    addDay: "একদিন বাড়াও",
    removeDay: "একদিন কমাও",
    upgradeHotel: "হোটেল আপগ্রেড করো",
    reviewBook: "এই ট্রিপ বুক করো",
    booked: (p, a) => `বুকিং হয়ে গেছে! আপনার PNR ${p}, ${a} পেমেন্ট হয়েছে। ভাউচার My Bookings-এ আছে।`,
    updated: (p) => `হয়ে গেছে — বুকিং ${p} আপডেট হয়েছে, নতুন ভাউচার ইস্যু হয়েছে।`,
    cancelled: (r) => `আপনার বুকিং বাতিল হয়েছে। ${r} ফেরত পাঠানো হচ্ছে।`,
    rescued: (p) => `সব ঠিক হয়ে গেছে! বুকিং ${p} উদ্ধার করা হয়েছে — নতুন ক্যাব ও চেক-ইন সময়ের ভাউচার তৈরি।`,
    editHint: "কোনো সমস্যা নেই — Itinerary ট্যাবে বদলান, তারপর আবার বুক করতে বলুন।",
  },
};

/** The one-click Hindi demo prompt (always Hindi, regardless of the selected language). */
export const PLAN_GOA_HINDI = "दिल्ली से गोवा की 3 रात की ट्रिप प्लान करो, 2 लोग, बजट ₹50,000";

export const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const hhmm = (iso: string) => iso.slice(11, 16);
export const dur = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
export const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
