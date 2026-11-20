import type { Lang } from "@/lib/types";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "ta-IN", label: "தமிழ்" },
  { code: "te-IN", label: "తెలుగు" },
  { code: "bn-IN", label: "বাংলা" },
];

interface Strings {
  greeting: string;
  placeholder: string;
  suggestions: string[];
  disruptionAlert: string;
}

export const STRINGS: Record<Lang, Strings> = {
  "en-IN": {
    greeting: "Namaste! I'm Saathi, your TBO travel consultant. Where would you like to go?",
    placeholder: "Ask Saathi… e.g. flights from Delhi to Goa",
    suggestions: ["Flights from Delhi to Goa next Friday for 2 people", "Find a 4 star hotel in Jaipur for this weekend", "Plan a 3 day Kochi trip with backwaters"],
    disruptionAlert: "I just got an alert about my booking. Please help me.",
  },
  "hi-IN": {
    greeting: "नमस्ते! मैं साथी हूँ, आपकी TBO ट्रैवल सलाहकार। आप कहाँ जाना चाहेंगे?",
    placeholder: "साथी से पूछिए… जैसे दिल्ली से गोवा की फ्लाइट",
    suggestions: ["अगले शुक्रवार दिल्ली से गोवा 2 लोगों के लिए फ्लाइट दिखाओ", "जयपुर में 4 स्टार होटल चाहिए", "कोच्चि की 3 दिन की यात्रा बनाओ"],
    disruptionAlert: "मेरी बुकिंग के बारे में अभी एक अलर्ट आया है। कृपया मदद कीजिए।",
  },
  "ta-IN": {
    greeting: "வணக்கம்! நான் சாதி, உங்கள் TBO பயண ஆலோசகர். எங்கே போக விரும்புகிறீர்கள்?",
    placeholder: "சாதியிடம் கேளுங்கள்… எ.கா. சென்னை முதல் கோவா விமானம்",
    suggestions: ["அடுத்த வெள்ளிக்கிழமை சென்னை முதல் கோவா 2 பேருக்கு விமானம்", "ஜெய்ப்பூரில் 4 நட்சத்திர ஹோட்டல்", "கொச்சி 3 நாள் பயணம் திட்டமிடுங்கள்"],
    disruptionAlert: "என் முன்பதிவு பற்றி ஒரு எச்சரிக்கை வந்தது. தயவுசெய்து உதவுங்கள்.",
  },
  "te-IN": {
    greeting: "నమస్కారం! నేను సాథీ, మీ TBO ట్రావెల్ కన్సల్టెంట్. మీరు ఎక్కడికి వెళ్లాలనుకుంటున్నారు?",
    placeholder: "సాథీని అడగండి… ఉదా. హైదరాబాద్ నుండి గోవా ఫ్లైట్",
    suggestions: ["వచ్చే శుక్రవారం హైదరాబాద్ నుండి గోవా 2 మందికి ఫ్లైట్", "జైపూర్‌లో 4 స్టార్ హోటల్", "కొచ్చి 3 రోజుల ట్రిప్ ప్లాన్ చేయండి"],
    disruptionAlert: "నా బుకింగ్ గురించి ఇప్పుడే అలర్ట్ వచ్చింది. దయచేసి సహాయం చేయండి.",
  },
  "bn-IN": {
    greeting: "নমস্কার! আমি সাথী, আপনার TBO ভ্রমণ পরামর্শদাতা। কোথায় যেতে চান?",
    placeholder: "সাথীকে জিজ্ঞাসা করুন… যেমন কলকাতা থেকে গোয়া ফ্লাইট",
    suggestions: ["আগামী শুক্রবার কলকাতা থেকে গোয়া ২ জনের ফ্লাইট", "জয়পুরে ৪ তারা হোটেল", "কোচিতে ৩ দিনের ট্রিপ পরিকল্পনা করুন"],
    disruptionAlert: "আমার বুকিং নিয়ে এইমাত্র একটি সতর্কবার্তা এসেছে। দয়া করে সাহায্য করুন।",
  },
};

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
export const hhmm = (iso: string) => iso.slice(11, 16);
export const dur = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
