import type { Language } from "@geki/contracts";
// Burmese copy should receive native-speaker editorial review before launch.
const myanmar: Record<string, string> = {
  Home: "ပင်မစာမျက်နှာ",
  Courses: "သင်တန်းများ",
  "About GEKI": "GEKI အကြောင်း",
  Membership: "အဖွဲ့ဝင်သက်တမ်း",
  "Sign in": "အကောင့်ဝင်ရန်",
  "Get started": "စတင်ရန်",
  "My Academy": "ကျွန်ုပ်၏ အကယ်ဒမီ",
  Overview: "အကျဉ်းချုပ်",
  "My Learning": "ကျွန်ုပ်၏ သင်ယူမှု",
  "Course Library": "သင်တန်းစာကြည့်တိုက်",
  "My Devices": "ကျွန်ုပ်၏ စက်ပစ္စည်းများ",
  Notifications: "အသိပေးချက်များ",
  Settings: "ဆက်တင်များ",
  "Sign out": "အကောင့်ထွက်ရန်",
  Learning: "သင်ယူမှု",
  Library: "စာကြည့်တိုက်",
  "Account help": "အကောင့်အကူအညီ",
  "Free lesson": "အခမဲ့သင်ခန်းစာ",
  "YOUR ACADEMY": "သင်၏ အကယ်ဒမီ",
  Administration: "စီမံခန့်ခွဲမှု",
  "Your next lesson is waiting.": "နောက်သင်ခန်းစာကို ဆက်လက်လေ့လာနိုင်ပါသည်။",
  "Your progress is kept safe.": "သင်ယူမှုမှတ်တမ်းများကို သိမ်းဆည်းထားပါသည်။",
  "Verify email": "အီးမေးလ် အတည်ပြုရန်",
  "Verify your email to access paid learning.":
    "အဖွဲ့ဝင်သင်ခန်းစာများအတွက် အီးမေးလ်ကို အတည်ပြုပါ။",
  "Start learning": "စတင်သင်ယူရန်",
  "Watch free lesson": "အခမဲ့သင်ခန်းစာ ကြည့်ရန်",
  "Start course": "သင်တန်းစတင်ရန်",
  "Explore membership": "အဖွဲ့ဝင်သက်တမ်း ကြည့်ရန်",
  "All lessons open to active members":
    "သက်တမ်းရှိအဖွဲ့ဝင်များအတွက် သင်ခန်းစာအားလုံးကို ဖွင့်ထားပါသည်။",
  "Your course curriculum": "သင်တန်းအစီအစဉ်",
  "Final course quiz": "သင်တန်းနောက်ဆုံး စစ်ဆေးမေးခွန်းများ",
  "Included with membership": "အဖွဲ့ဝင်သက်တမ်းတွင် ပါဝင်ပါသည်။",
  "Free preview": "အခမဲ့ အစမ်းကြည့်ရန်",
};
export function translate(language: Language, key: string) {
  return language === "mm" ? myanmar[key] || key : key;
}
