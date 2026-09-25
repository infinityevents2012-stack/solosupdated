export interface Post {
  id: string;
  user: string;
  avatar: string;
  image: string;
  caption: string;
  likes: number;
  liked: boolean;
  time: string;
  location?: string;
}

export interface Story {
  id: string;
  user: string;
  avatar: string;
  seen: boolean;
  media?: string[];
  postedAgo?: number; // hours ago
}

export interface Conversation {
  id: string;
  user: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
}

export interface ProfileViewer {
  id: string;
  user: string;
  avatar: string;
  viewedAt: string;
  online: boolean;
}

const av = (seed: string) =>
  `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=000000`;

const img = (seed: string) =>
  `https://picsum.photos/seed/${seed}/800/1000`;

export const stories: Story[] = [
  { id: "you", user: "Your story", avatar: av("you"), seen: false },
  { id: "1", user: "aarav", avatar: av("aarav"), seen: false, postedAgo: 2, media: [img("st-aarav-1"), img("st-aarav-2"), img("st-aarav-3")] },
  { id: "2", user: "priya_", avatar: av("priya"), seen: false, postedAgo: 5, media: [img("st-priya-1"), img("st-priya-2")] },
  { id: "3", user: "rohan.k", avatar: av("rohan"), seen: false, postedAgo: 8, media: [img("st-rohan-1")] },
  { id: "4", user: "ishita", avatar: av("ishita"), seen: true, postedAgo: 14, media: [img("st-ishita-1"), img("st-ishita-2")] },
  { id: "5", user: "kabir", avatar: av("kabir"), seen: false, postedAgo: 1, media: [img("st-kabir-1"), img("st-kabir-2"), img("st-kabir-3"), img("st-kabir-4")] },
  { id: "6", user: "meera", avatar: av("meera"), seen: true, postedAgo: 20, media: [img("st-meera-1")] },
  { id: "7", user: "arjun", avatar: av("arjun"), seen: false, postedAgo: 6, media: [img("st-arjun-1"), img("st-arjun-2")] },
];

export const conversations: Conversation[] = [
  { id: "c1", user: "aarav", avatar: av("aarav"), lastMessage: "yo what's the plan tonight?", time: "2m", unread: 2, online: true },
  { id: "c2", user: "priya_", avatar: av("priya"), lastMessage: "sent you the pic ✨", time: "18m", unread: 0, online: true },
  { id: "c3", user: "rohan.k", avatar: av("rohan"), lastMessage: "haha okay I'm down", time: "1h", unread: 0, online: false },
  { id: "c4", user: "ishita", avatar: av("ishita"), lastMessage: "see u at the cafe", time: "3h", unread: 1, online: true },
  { id: "c5", user: "kabir", avatar: av("kabir"), lastMessage: "🔥🔥", time: "yesterday", unread: 0, online: false },
  { id: "c6", user: "meera", avatar: av("meera"), lastMessage: "Voice call · 4:21", time: "2d", unread: 0, online: false },
];

export const profileViewers: ProfileViewer[] = [
  { id: "v1", user: "ananya", avatar: av("ananya"), viewedAt: "12 min ago", online: true },
  { id: "v2", user: "vivaan", avatar: av("vivaan"), viewedAt: "1 hr ago", online: true },
  { id: "v3", user: "diya", avatar: av("diya"), viewedAt: "3 hr ago", online: false },
  { id: "v4", user: "advait", avatar: av("advait"), viewedAt: "5 hr ago", online: true },
  { id: "v5", user: "saanvi", avatar: av("saanvi"), viewedAt: "yesterday", online: false },
  { id: "v6", user: "reyansh", avatar: av("reyansh"), viewedAt: "yesterday", online: false },
  { id: "v7", user: "myra", avatar: av("myra"), viewedAt: "2 days ago", online: true },
  { id: "v8", user: "vihaan", avatar: av("vihaan"), viewedAt: "2 days ago", online: false },
];

export const posts: Post[] = [
  {
    id: "p1",
    user: "aarav",
    avatar: av("aarav"),
    image: img("mumbai1"),
    caption: "Late nights in Bandra ✨",
    likes: 1284,
    liked: false,
    time: "2h",
    location: "Mumbai, India",
  },
  {
    id: "p2",
    user: "priya_",
    avatar: av("priya"),
    image: img("delhi2"),
    caption: "Chai & monsoon ☔",
    likes: 892,
    liked: false,
    time: "4h",
    location: "Delhi",
  },
  {
    id: "p3",
    user: "rohan.k",
    avatar: av("rohan"),
    image: img("goa3"),
    caption: "Weekend escape 🌊",
    likes: 2341,
    liked: true,
    time: "6h",
    location: "Goa",
  },
  {
    id: "p4",
    user: "ishita",
    avatar: av("ishita"),
    image: img("blr4"),
    caption: "Sunset chasers 🌅",
    likes: 567,
    liked: false,
    time: "8h",
    location: "Bengaluru",
  },
];

export const explorePosts = Array.from({ length: 21 }).map((_, i) => ({
  id: `e${i}`,
  image: img(`explore${i}`),
}));

export interface NearbyUser {
  id: string;
  username: string;
  avatar: string;
  distance: number; // km
  lat: number;
  lng: number;
}

// Centered near Mumbai for demo
export const nearbyUsers: NearbyUser[] = Array.from({ length: 18 }).map(
  (_, i) => {
    const angle = (i / 18) * Math.PI * 2;
    const dist = 0.5 + Math.random() * 45;
    const lat = 19.076 + Math.cos(angle) * (dist / 111);
    const lng = 72.8777 + Math.sin(angle) * (dist / 111);
    const names = [
      "ananya",
      "vivaan",
      "diya",
      "advait",
      "saanvi",
      "reyansh",
      "myra",
      "vihaan",
      "aanya",
      "ayaan",
      "kiara",
      "arnav",
      "navya",
      "ishaan",
      "anika",
      "krishna",
      "siya",
      "veer",
    ];
    return {
      id: `n${i}`,
      username: names[i],
      avatar: av(names[i]),
      distance: Math.round(dist * 10) / 10,
      lat,
      lng,
    };
  }
);
