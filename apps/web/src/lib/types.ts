export type Lesson = {
  id: string;
  title: string;
  titleMm: string;
  description: string;
  preview: boolean;
  videoId: string;
  video: { duration: number };
};
export type Course = {
  priceMinor: number | null;
  currency: string;
  id: string;
  slug: string;
  title: string;
  titleMm: string;
  description: string;
  descriptionMm: string;
  instructor: string;
  thumbnail: string;
  category: string;
  status: string;
  updatedAt?: string;
  sections: {
    id: string;
    title: string;
    position: number;
    lessons: Lesson[];
  }[];
  quiz?: { id: string; published: boolean; questions?: Question[] } | null;
};
export type Question = {
  id?: string;
  prompt: string;
  options: string[];
  correctIndex?: number;
  explanation?: string;
};
export type Video = {
  id: string;
  title: string;
  duration: number;
  status: string;
  providerAssetId: string | null;
  localPath: string | null;
  updatedAt?: string;
  _count?: { lessons: number; progress: number };
  subtitles: { language: string; content: string; approved: boolean }[];
};
export type Notification = {
  id: string;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};
export type Attempt = {
  id: string;
  quizId: string;
  score: number;
  passed: boolean;
  createdAt: string;
  review: {
    prompt: string;
    chosen: number | null;
    correctIndex: number;
    explanation: string;
    options: string[];
  }[];
};
export type Member = {
  id: string;
  plan: string;
  startsAt: string;
  endsAt: string;
  revokedAt: string | null;
};
export type Progress = {
  videoId: string;
  position: number;
  watchedSeconds: number;
  completedAt: string | null;
  video: {
    title: string;
    duration: number;
    lessons: {
      id: string;
      title: string;
      section: { course: { title: string; slug: string } };
    }[];
  };
};
export type Dashboard = {
  progress: Progress[];
  attempts: Attempt[];
  notifications: Notification[];
  purchases: Purchase[];
  payments: {
    id: string;
    providerReference: string;
    plan: string;
    status: string;
    createdAt: string;
  }[];
};
export type Devices = {
  devices: {
    id: string;
    label: string;
    lastSeenAt: string;
    createdAt: string;
    current?: boolean;
  }[];
  replacementsRemaining: number;
};
export type Student = {
  id: string;
  displayName: string;
  email: string;
  role: string;
  suspended: boolean;
  accountType: string;
  purchases: Purchase[];
  _count: { devices: number };
};
export type Playback = {
  kind: "local" | "vdocipher";
  url?: string;
  embedUrl?: string;
  position?: number;
  sessionId?: string;
  watermark?: string;
  subtitles?: { language: string; url: string }[];
};

export type Purchase = {
  id: string;
  courseId: string;
  paymentReference: string;
  amountMinor: number;
  currency: string;
  purchasedAt: string;
  revokedAt: string | null;
  course: { id: string; title: string; slug: string; thumbnail?: string };
};
