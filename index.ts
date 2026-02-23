import { Cron } from "croner";

/*
* Types
*/
interface Session {
  time: string;        // "HH.MM-HH.MM"
  course_code: string;
  course_name: string;
  type: "TE" | "PR";  // TE = Theory, PR = Practical
  lecturer_code: string;
  lecturer: string;
  room: string;
}

interface DaySchedule {
  day: string;         // "SENIN" (Monday) | "SELASA" (Tuesday) | etc.
  sessions: Session[];
}

interface Schedule {
  academic_year: string;
  semester: string;
  class_name: string;
  schedule: DaySchedule[];
}

/* 
* Config
*/
const API_URL    = process.env.GO_WA_API_URL ?? "http://localhost:1100/send/message";
const GROUP_JID  = process.env.GROUP_JID;
const GO_WA_USER = process.env.GO_WA_USERNAME ?? "";
const GO_WA_PASS = process.env.GO_WA_PASSWORD ?? "";
const GO_WA_AUTH = `Basic ${btoa(`${GO_WA_USER}:${GO_WA_PASS}`)}`;

if (!GROUP_JID) {
  console.error("err: Can't find GROUP_JID in .env!");
  process.exit(1);
}

if (!GO_WA_USER || !GO_WA_PASS) {
  console.error("err: Can't find GO_WA_USERNAME or GO_WA_PASSWORD in .env!");
  process.exit(1);
}

// Load Schedule Data
const scheduleData: Schedule = await Bun.file("./data/schedule.json").json();


// Mapping to Indonesian
const DAY_MAP: Record<string, string> = {
  Sunday:    "MINGGU",
  Monday:    "SENIN",
  Tuesday:   "SELASA",
  Wednesday: "RABU",
  Thursday:  "KAMIS",
  Friday:    "JUMAT",
  Saturday:  "SABTU",
};

// Get today's day in Indonesian
const getTodayIndo = (): string => {
  const dayEn = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "Asia/Jakarta",
  });
  return DAY_MAP[dayEn] ?? dayEn;
};

/**
 * getCurrentTime: get the current time in “HH.MM” format according to the time zone
 * ex: 09:20 → "09.20"
 */
const getCurrentTime = (): string => {
  const now = new Date();
  const hh = now.toLocaleString("en-US", { hour: "2-digit",   hour12: false, timeZone: "Asia/Jakarta" });
  const mm = now.toLocaleString("en-US", { minute: "2-digit", timeZone: "Asia/Jakarta" });
  return `${hh.padStart(2, "0")}.${mm.padStart(2, "0")}`;
};

// Search for sessions that start now, one per "course_code"  (first session only)
const findSessionsToNotify = (day: string, currentTime: string): Session[] => {
  const todaySchedule = scheduleData.schedule.find((d) => d.day === day);
  if (!todaySchedule) return [];

  const seenCourseCodes = new Set<string>();
  const result: Session[] = [];

  for (const session of todaySchedule.sessions) {
    const sessionStart = session.time.split("-")[0];
    if (sessionStart === currentTime && !seenCourseCodes.has(session.course_code)) {
      seenCourseCodes.add(session.course_code);
      result.push(session);
    }
  }

  return result;
};

/*
*Cache
*/ 
const sentCache = new Set<string>();
let _lastDay = "";

// Clear the cache every new day
const resetCacheIfNewDay = (): void => {
  const today = new Date().toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" });
  if (_lastDay !== today) {
    sentCache.clear();
    _lastDay = today;
    console.log(`! The cache has been cleared for the day. ${today}`);
  }
};

// Send message to Go-WA API
const buildMessage = (session: Session, day: string): string => {
  const typeLabel = session.type === "TE" ? "Teori" : "Praktikum";
  const [start, end] = session.time.split("-");

  return [
    `⚠️ *ALERTA ALERTA* ⚠️`,
    ``,
    `*Matkul* : ${session.course_name}`,
    `*Tipe*   : ${typeLabel}`,
    `*Dosen*  : ${session.lecturer}`,
    `*Ruangan*: ${session.room}`,
    `*Jam*    : ${start} - ${end}`,
    ``,
    `Attendance Link:\n*https://akademik.polban.ac.id/*`,
  ].join("\n");
};

const sendReminder = async (session: Session, day: string): Promise<void> => {
  const message = buildMessage(session, day);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": GO_WA_AUTH,
      },
      body: JSON.stringify({ phone: GROUP_JID, message, is_forwarded: false,  mentions: ["@everyone"] }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Failed to send: (${res.status}): ${body}`);
    } else {
      console.log(`Reminder Success [${day}] ${session.course_name} (${session.time})`);
    }
  } catch (err) {
    console.error(`Error connect to Go-WA:`, err);
  }
};

/* 
*Corny J*b 🌽🥀
*/
const checkAndNotify = async (): Promise<void> => {
  resetCacheIfNewDay();

  const today = getTodayIndo();
  const now   = getCurrentTime();

  const sessions = findSessionsToNotify(today, now);

  for (const session of sessions) {
    const cacheKey = `${today}-${session.course_code}`;

    if (sentCache.has(cacheKey)) continue;

    sentCache.add(cacheKey);
    await sendReminder(session, today);
  }
};

/*
*Scheduler
*/
console.log("Bot is online...");
console.log(`API  : ${API_URL}`);
console.log(`Group : ${GROUP_JID}`);
console.log(`Check every minute...calm twin\n`);

new Cron("0 * * * * *", { timezone: "Asia/Jakarta" }, checkAndNotify);