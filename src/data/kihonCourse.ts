export type PracticeTask = {
  id: string
  label: string
  detail: string
  reps?: string
}

export type SelfCheck = {
  id: string
  label: string
}

export type KihonLesson = {
  id: string
  number: string
  title: string
  type: "principle" | "instructional" | "practice" | "assessment"
  duration: string
  description: string
  keyPoints: string[]
  practice: PracticeTask[]
  selfCheck: SelfCheck[]
  youtubeId: string
}

export type KihonModule = {
  id: string
  number: string
  title: string
  eyebrow: string
  description: string
  week: string
  lessons: KihonLesson[]
}

const basePractice = (focus: string): PracticeTask[] => [
  { id: "setup", label: "Set your position", detail: `Shizentai → Dachi → Yoi → Kamaete. Focus: ${focus}.`, reps: "3 rounds" },
  { id: "slow", label: "Controlled repetition", detail: "Perform the technique slowly enough to see and correct every part.", reps: "6 reps" },
  { id: "power", label: "Kiai Irete", detail: "Add breath, kime and controlled power without changing the mechanics.", reps: "10 reps" },
]

const baseCheck: SelfCheck[] = [
  { id: "stance", label: "Stable stance and balance" },
  { id: "posture", label: "Posture stays tall and controlled" },
  { id: "breath", label: "Breathing matches the movement" },
  { id: "mechanics", label: "Technique path is consistent" },
  { id: "recovery", label: "Naore / recovery is controlled" },
]

const technique = (
  id: string,
  number: string,
  title: string,
  start: string,
  focus: string,
  youtubeId = "l7humWGq1xM",
): KihonLesson => ({
  id,
  number,
  title,
  type: "instructional",
  duration: "1–3 min",
  description: `Learn ${title} from ${start}. The lesson moves from a slow technical demonstration into controlled and powered repetition.`,
  keyPoints: [
    start,
    "Show the starting position and chamber clearly.",
    focus,
    "Return to the original position with control.",
  ],
  practice: basePractice(focus),
  selfCheck: baseCheck,
  youtubeId,
})

export const kihonModules: KihonModule[] = [
  {
    id: "foundations",
    number: "01",
    title: "Kihon Foundations",
    eyebrow: "THE SYSTEM",
    description: "Build awareness, stance, readiness and the GEKI Kihon Protocol before learning individual techniques.",
    week: "Week 1",
    lessons: [
      {
        id: "welcome",
        number: "01.1",
        title: "Welcome to GEKI Kihon",
        type: "principle",
        duration: "3 min",
        description: "Understand how to use the course: Watch → Understand → Drill → Practice → Self-check → Progress.",
        keyPoints: [
          "Kihon is practice, not just repetition.",
          "Technique comes before speed and power.",
          "Use the same practice protocol throughout the course.",
        ],
        practice: [
          { id: "watch", label: "Watch actively", detail: "Before moving, identify the stance, breathing and finish position." },
          { id: "reflection", label: "Write one intention", detail: "Choose one technical quality to protect during this course.", reps: "1 note" },
        ],
        selfCheck: [
          { id: "understand", label: "I understand the course progression" },
          { id: "intention", label: "I have one clear technical intention" },
        ],
        youtubeId: "l7humWGq1xM",
      },
      {
        id: "shizentai",
        number: "01.2",
        title: "Shizentai — Awareness Position",
        type: "instructional",
        duration: "2 min",
        description: "Develop relaxed awareness before moving into a stance.",
        keyPoints: ["Relax the shoulders.", "Breathe naturally.", "Stay balanced and ready to move."],
        practice: [
          { id: "hold", label: "Awareness hold", detail: "Stand tall, relaxed and aware of your surroundings.", reps: "3 × 30 sec" },
          { id: "reset", label: "Reset", detail: "Return to neutral breathing between holds.", reps: "3 rounds" },
        ],
        selfCheck: [
          { id: "relaxed", label: "Shoulders stay relaxed" },
          { id: "balanced", label: "Weight is balanced" },
          { id: "aware", label: "I can move without preparation tension" },
        ],
        youtubeId: "l7humWGq1xM",
      },
      {
        id: "dachi",
        number: "01.3",
        title: "Dachi — Stance",
        type: "instructional",
        duration: "3 min",
        description: "Learn the relationship between feet, knees, hips, spine and shoulders.",
        keyPoints: ["Feet establish the base.", "Knees track with the feet.", "Hips stay connected to the base."],
        practice: [
          { id: "sanchin", label: "Sanchin Dachi", detail: "Set the stance, breathe and hold the structure.", reps: "3 × 20 sec" },
          { id: "kiba", label: "Kiba Dachi", detail: "Maintain a stable base without collapsing the knees inward.", reps: "3 × 20 sec" },
          { id: "zenkutsu", label: "Zenkutsu Dachi", detail: "Practice the front stance with controlled posture.", reps: "3 × 20 sec" },
        ],
        selfCheck: baseCheck,
        youtubeId: "l7humWGq1xM",
      },
      {
        id: "yoi",
        number: "01.4",
        title: "Yoi — Get Ready",
        type: "instructional",
        duration: "2 min",
        description: "Make your transition into practice deliberate, balanced and repeatable.",
        keyPoints: ["Start from Shizentai.", "Move into Yoi without rushing.", "Finish with stable breathing."],
        practice: [
          { id: "yoi", label: "Yoi repetitions", detail: "Reset completely between repetitions.", reps: "10 reps" },
          { id: "breath", label: "Breath reset", detail: "Exhale during the transition and settle naturally.", reps: "10 reps" },
        ],
        selfCheck: baseCheck,
        youtubeId: "l7humWGq1xM",
      },
      {
        id: "kamaete",
        number: "01.5",
        title: "Kamaete — Get Stance",
        type: "instructional",
        duration: "2 min",
        description: "Build a consistent ready position that can lead directly into technique.",
        keyPoints: ["Hands arrive together with the stance.", "Shoulders remain relaxed.", "Finish ready to execute immediately."],
        practice: [
          { id: "repeat", label: "Kamaete", detail: "Move from Yoi into Kamaete and freeze the finish.", reps: "10 reps" },
          { id: "hold", label: "Static readiness", detail: "Hold Kamaete without unnecessary tension.", reps: "3 × 30 sec" },
        ],
        selfCheck: baseCheck,
        youtubeId: "l7humWGq1xM",
      },
      {
        id: "protocol",
        number: "01.6",
        title: "The GEKI Kihon Protocol",
        type: "principle",
        duration: "4 min",
        description: "Learn the complete sequence used throughout the course.",
        keyPoints: [
          "Shizentai → Dachi → Yoi → Kamaete.",
          "Technique → 6 controlled and slow repetitions.",
          "Kiai Irete → 10–20 repetitions with power.",
          "Naore → return and reset.",
        ],
        practice: [
          { id: "protocol-slow", label: "Full protocol", detail: "Choose one familiar technique and follow the full sequence.", reps: "3 rounds" },
          { id: "protocol-reflect", label: "Reflection", detail: "Write where your technique changed when speed or power increased.", reps: "1 note" },
        ],
        selfCheck: [
          { id: "sequence", label: "I can perform the full protocol without prompting" },
          { id: "control", label: "My slow and powerful versions stay mechanically consistent" },
          { id: "reset", label: "I finish with a clean Naore" },
        ],
        youtubeId: "l7humWGq1xM",
      },
    ],
  },
  {
    id: "upper-body",
    number: "02",
    title: "Upper-Body Kihon",
    eyebrow: "TSUKI & URAKEN",
    description: "Build the core punching and striking mechanics from Migi Sanchin Dachi.",
    week: "Week 2",
    lessons: [
      technique("chudan-tsuki", "02.1", "Chudan Tsuki", "Migi Sanchin Dachi → Yoi → Kamaete", "Drive the technique without losing the Sanchin base."),
      technique("jodan-tsuki", "02.2", "Jodan Tsuki", "Migi Sanchin Dachi → Yoi → Kamaete", "Keep the same body mechanics while changing the target level."),
      technique("ago-uchi", "02.3", "Ago Uchi", "Migi Sanchin Dachi → Yoi → Kamaete", "Rotate the body without lifting the shoulder."),
      technique("uraken-ago", "02.4", "Uraken Ago Uchi", "Migi Sanchin Dachi → Yoi → Kamaete", "Use the shortest clean path for the back-fist action."),
      technique("uraken-sayu", "02.5", "Uraken Sayu Uchi", "Migi Sanchin Dachi → Yoi → Kamaete", "Control the lateral path and recover cleanly."),
      technique("uraken-hizo", "02.6", "Uraken Hizo Uchi", "Migi Sanchin Dachi → Yoi → Kamaete", "Keep the strike compact and connected to the base."),
      technique("uraken-mawashi", "02.7", "Uraken Mawashi Uchi", "Migi Sanchin Dachi → Yoi → Kamaete", "Maintain structure while adding the circular path."),
    ],
  },
  {
    id: "close-range",
    number: "03",
    title: "Close-Range Kihon",
    eyebrow: "KIBA DACHI",
    description: "Develop close-range mechanics through Hiji Uchi and Shita Tsuki.",
    week: "Week 2",
    lessons: [
      technique("hiji-uchi", "03.1", "Hiji Uchi", "Kiba Dachi → Yoi → Kamaete", "Connect elbow action to the hips while keeping the shoulder organized."),
      technique("shita-tsuki", "03.2", "Shita Tsuki", "Kiba Dachi → Yoi → Kamaete", "Use the base and torso to create compact close-range power."),
    ],
  },
  {
    id: "uke",
    number: "04",
    title: "Uke Kihon",
    eyebrow: "DEFENSIVE STRUCTURE",
    description: "Build four core blocking patterns from Hidari Sanchin Dachi.",
    week: "Week 3",
    lessons: [
      technique("jodan-uke", "04.1", "Jodan Uke", "Hidari Sanchin Dachi → Yoi → Kamaete", "Keep the path clean and finish with a stable upper-body structure."),
      technique("chudan-uke", "04.2", "Chudan Uke", "Hidari Sanchin Dachi → Yoi → Kamaete", "Coordinate chamber, rotation and final position."),
      technique("uchi-uke", "04.3", "Uchi Uke", "Hidari Sanchin Dachi → Yoi → Kamaete", "Keep the elbow path controlled and connected to the torso."),
      technique("gedan-barai", "04.4", "Gedan Barai", "Hidari Sanchin Dachi → Yoi → Kamaete", "Finish with a strong base and organized shoulder position."),
    ],
  },
  {
    id: "kicking",
    number: "05",
    title: "Kicking Kihon",
    eyebrow: "GERI",
    description: "Build kick mechanics through chamber, extension, target, recovery and balance.",
    week: "Week 4",
    lessons: [
      technique("mae-keage", "05.1", "Mae Keage", "45° turn → Hidari Zenkutsu Dachi → Morote Gedan Barai → Yoi → Kamaete", "Own the chamber and return without losing balance."),
      technique("uchi-mawashi", "05.2", "Uchi Mawashi Geri", "45° turn → Hidari Zenkutsu Dachi → Morote Gedan Barai → Yoi → Kamaete", "Control the circular path from inside to outside."),
      technique("soto-mawashi", "05.3", "Soto Mawashi Geri", "45° turn → Hidari Zenkutsu Dachi → Morote Gedan Barai → Yoi → Kamaete", "Control the circular path from outside to inside."),
      technique("hiza-geri", "05.4", "Hiza Geri", "45° turn → Hidari Zenkutsu Dachi → Morote Gedan Barai → Yoi → Kamaete", "Drive the knee with stable posture and a clean recovery."),
      technique("mae-geri", "05.5", "Mae Geri", "45° turn → Hidari Zenkutsu Dachi → Morote Gedan Barai → Yoi → Kamaete", "Chamber, extend and recoil without tipping the body."),
      technique("yoko-keage", "05.6", "Yoko Keage", "45° turn → Hidari Zenkutsu Dachi → Morote Gedan Barai → Yoi → Kamaete", "Maintain alignment while lifting and snapping the kick."),
      technique("kensetsu-geri", "05.7", "Kensetsu Geri", "45° turn → Hidari Zenkutsu Dachi → Morote Gedan Barai → Yoi → Kamaete", "Keep the supporting side stable and recover under control."),
      technique("yoko-geri", "05.8", "Yoko Geri", "45° turn → Hidari Zenkutsu Dachi → Morote Gedan Barai → Yoi → Kamaete", "Own the chamber and lateral line before extending."),
      technique("ushiro-geri", "05.9", "Ushiro Geri", "45° turn → Hidari Zenkutsu Dachi → Morote Gedan Barai → Yoi → Kamaete", "Turn the body without losing the target line or balance."),
      technique("mawashi-geri", "05.10", "Mawashi Geri", "45° turn → Hidari Zenkutsu Dachi → Morote Gedan Barai → Yoi → Kamaete", "Coordinate hip rotation, chamber, extension and recovery."),
    ],
  },
  {
    id: "ido",
    number: "06",
    title: "Kihon Ido & Combinations",
    eyebrow: "MOVEMENT",
    description: "Carry Kihon mechanics into movement, combinations and simple application.",
    week: "Week 5",
    lessons: [
      {
        id: "ido-basics",
        number: "06.1",
        title: "Kihon Ido — Foundations",
        type: "instructional",
        duration: "3 min",
        description: "Learn to preserve Kamaete, posture and balance while moving.",
        keyPoints: ["Move the base without standing taller.", "Keep Kamaete stable.", "Finish every step ready to execute."],
        practice: [
          { id: "forward", label: "Forward movement", detail: "Step forward without changing your posture.", reps: "10 reps" },
          { id: "back", label: "Backward movement", detail: "Step backward with the same control.", reps: "10 reps" },
          { id: "lateral", label: "Lateral movement", detail: "Move left and right while maintaining readiness.", reps: "10 reps each" },
        ],
        selfCheck: baseCheck,
        youtubeId: "l7humWGq1xM",
      },
      {
        id: "ido-hand",
        number: "06.2",
        title: "Hand Techniques While Moving",
        type: "instructional",
        duration: "3 min",
        description: "Connect movement with Chudan Tsuki, Jodan Tsuki and other hand techniques.",
        keyPoints: ["Step and technique arrive together.", "Do not let the stance collapse.", "Recover to ready position."],
        practice: [
          { id: "step-tsuki", label: "Step + Tsuki", detail: "Move forward and perform Chudan Tsuki with one coordinated action.", reps: "3 × 10" },
          { id: "reset", label: "Reset line", detail: "Return to the starting line with control.", reps: "3 rounds" },
        ],
        selfCheck: baseCheck,
        youtubeId: "l7humWGq1xM",
      },
      {
        id: "ido-kick",
        number: "06.3",
        title: "Kicks While Moving",
        type: "instructional",
        duration: "3 min",
        description: "Carry the same chamber and recovery standards into moving kicks.",
        keyPoints: ["Protect the support side.", "Land in a usable stance.", "Do not sacrifice balance for reach."],
        practice: [
          { id: "mae", label: "Step + Mae Geri", detail: "Move, kick and recover without changing posture.", reps: "3 × 10" },
          { id: "mawashi", label: "Step + Mawashi Geri", detail: "Repeat with circular kick mechanics.", reps: "3 × 10" },
        ],
        selfCheck: baseCheck,
        youtubeId: "l7humWGq1xM",
      },
      {
        id: "combinations",
        number: "06.4",
        title: "GEKI Kihon Combinations",
        type: "practice",
        duration: "4 min",
        description: "Connect techniques into simple movement combinations.",
        keyPoints: ["Preserve technical quality between techniques.", "Finish every combination balanced.", "Keep power under control."],
        practice: [
          { id: "c1", label: "Combination 01", detail: "Chudan Tsuki → Chudan Tsuki.", reps: "3 × 6" },
          { id: "c2", label: "Combination 02", detail: "Jodan Tsuki → Chudan Tsuki.", reps: "3 × 6" },
          { id: "c3", label: "Combination 03", detail: "Chudan Tsuki → Mae Geri.", reps: "3 × 6" },
          { id: "c4", label: "Combination 04", detail: "Uraken → Chudan Tsuki → Mae Geri.", reps: "3 × 6" },
        ],
        selfCheck: [
          { id: "flow", label: "Transitions are smooth" },
          { id: "balance", label: "Balance remains stable between techniques" },
          { id: "quality", label: "The final technique is as clean as the first" },
        ],
        youtubeId: "l7humWGq1xM",
      },
    ],
  },
  {
    id: "kata",
    number: "07",
    title: "Kata Foundation & Assessment",
    eyebrow: "KATA",
    description: "Carry the same Kihon standards into Taikyoku and Sokugi Taikyoku, then test your full foundation.",
    week: "Week 6",
    lessons: [
      ...(["Taikyoku Sono Ichi", "Taikyoku Sono Ni", "Taikyoku Sono San", "Sokugi Taikyoku Sono Ichi", "Sokugi Taikyoku Sono Ni", "Sokugi Taikyoku Sono San"] as const).map((title, index): KihonLesson => ({
        id: title.toLowerCase().replaceAll(" ", "-"),
        number: `07.${index + 1}`,
        title,
        type: "instructional",
        duration: "5–8 min",
        description: `Learn ${title} as a Kihon-to-Kata transition: embusen, stance, technique, turns, rhythm and finish.`,
        keyPoints: [
          "Understand the embusen before adding speed.",
          "Keep stance and technique standards from Kihon.",
          "Practice slowly before full-speed execution.",
          "Finish with controlled breathing and awareness.",
        ],
        practice: [
          { id: "slow-kata", label: "Slow kata", detail: "Walk through the sequence with deliberate transitions.", reps: "3 rounds" },
          { id: "normal-kata", label: "Normal kata", detail: "Perform at normal training speed while preserving mechanics.", reps: "3 rounds" },
          { id: "video", label: "Record yourself", detail: "Record one clean attempt for self-review.", reps: "1 take" },
        ],
        selfCheck: [
          { id: "embusen", label: "Embusen is consistent" },
          { id: "stance", label: "Stances remain stable" },
          { id: "technique", label: "Techniques remain clear" },
          { id: "rhythm", label: "Rhythm and breathing are controlled" },
        ],
        youtubeId: "l7humWGq1xM",
      })),
      {
        id: "final-assessment",
        number: "07.7",
        title: "GEKI Kihon Level 1 Assessment",
        type: "assessment",
        duration: "8–10 min",
        description: "Use the final assessment to review your technique, consistency, movement and kata foundation.",
        keyPoints: [
          "Perform the selected stances and basic hand techniques.",
          "Demonstrate four Uke patterns.",
          "Demonstrate five selected kicks.",
          "Perform an Ido combination.",
          "Perform Taikyoku 1–3 and selected Sokugi Taikyoku.",
        ],
        practice: [
          { id: "stance-test", label: "Stance test", detail: "Demonstrate Shizentai, Sanchin Dachi, Kiba Dachi and Zenkutsu Dachi.", reps: "1 clean set" },
          { id: "kihon-test", label: "Kihon test", detail: "Choose techniques from the course and perform them using the GEKI Protocol.", reps: "1 clean set" },
          { id: "kata-test", label: "Kata test", detail: "Perform the assigned kata without stopping.", reps: "1 take" },
          { id: "reflection", label: "Final reflection", detail: "Write your strongest quality and your biggest technical priority for the next training block.", reps: "1 note" },
        ],
        selfCheck: [
          { id: "consistency", label: "My technique is repeatable under control" },
          { id: "power", label: "I can add Kiai without losing mechanics" },
          { id: "movement", label: "I can move without losing posture" },
          { id: "kata", label: "My kata reflects my Kihon standards" },
          { id: "reflection", label: "I know what I need to improve next" },
        ],
        youtubeId: "l7humWGq1xM",
      },
    ],
  },
]

export const kihonWeeks = [
  { week: "01", title: "Foundations", focus: "Shizentai, Dachi, Yoi, Kamaete + the GEKI Protocol" },
  { week: "02", title: "Upper Body", focus: "Tsuki, Ago Uchi, Uraken + close-range striking" },
  { week: "03", title: "Uke", focus: "Jodan Uke, Chudan Uke, Uchi Uke, Gedan Barai" },
  { week: "04", title: "Kicking", focus: "Chamber, extension, balance and recovery across 10 kicks" },
  { week: "05", title: "Movement", focus: "Kihon Ido + simple GEKI combinations" },
  { week: "06", title: "Kata + Test", focus: "Taikyoku 1–3, Sokugi Taikyoku 1–3 + assessment" },
]

export const allKihonLessons = kihonModules.flatMap((module) => module.lessons)
export const totalKihonLessons = allKihonLessons.length
