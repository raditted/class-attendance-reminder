/**
 * ============================================================
 * test.ts — Script Testing (Claude created this for us <3)
 * ============================================================
 * Run with:
 *   bun run test.ts [mode]
 *
 * All modes:
 *   bun run test.ts schedule   → Check schedule filter logic (without sending WA)
 *   bun run test.ts send       → Send 1 real WA message (connection verification)
 *   bun run test.ts simulate   → Simulate all trigger times this week (default)
 * ============================================================
 */

export {};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Session {
  time: string;
  course_code: string;
  course_name: string;
  type: "TE" | "PR";
  lecturer_code: string;
  lecturer: string;
  room: string;
}

interface DaySchedule {
  day: string;
  sessions: Session[];
}

interface Schedule {
  class_name: string;
  schedule: DaySchedule[];
}

// ─── Load Config ──────────────────────────────────────────────────────────────

const scheduleData: Schedule = await Bun.file("./data/schedule.json").json();
const API_URL    = process.env.GO_WA_API_URL ?? "http://localhost:1100/send/message"; // default port is 3000 btw
const GROUP_JID  = process.env.GROUP_JID;
const GO_WA_AUTH = process.env.GO_WA_AUTH ?? "";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildMessage = (session: Session, day: string): string => {
  const typeLabel = session.type === "TE" ? "Teori" : "Praktikum";
  const [start, end] = session.time.split("-");
  return [
    `⚠️ *THIS IS TEST* ⚠️`,
    ``,
    `*Matkul* : ${session.course_name}`,
    `*Tipe*   : ${typeLabel}`,
    `*Dosen*  : ${session.lecturer}`,
    `*Ruangan*: ${session.room}`,
    `*Jam*    : ${start} – ${end}`,
    ``,
    `📋 *Janlup isi absensi!*`,
  ].join("\n");
};

/** Get the first session per course_code for a specific day & time */
const findSessions = (day: string, time: string): Session[] => {
  const todaySchedule = scheduleData.schedule.find((d) => d.day === day);
  if (!todaySchedule) return [];

  const seen = new Set<string>();
  const result: Session[] = [];

  for (const session of todaySchedule.sessions) {
    const sessionStart = session.time.split("-")[0];
    if (sessionStart === time && !seen.has(session.course_code)) {
      seen.add(session.course_code);
      result.push(session);
    }
  }
  return result;
};

// ─── Terminal Colors ────────────────────────────────────────────────────────────

const c = {
  reset:  "\x1b[0m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  cyan:   "\x1b[36m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
};

const log = (color: string, label: string, msg: string): void => {
  console.log(`${color}${c.bold}[${label}]${c.reset} ${msg}`);
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODE 1: schedule — Test schedule filter logic (WITHOUT sending WA)
// ═══════════════════════════════════════════════════════════════════════════════

const testScheduleLogic = async (): Promise<void> => {
  console.log(`\n${c.bold}${c.cyan}═══════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}${c.cyan}  MODE: Uji Logika Jadwal (Dry Run)    ${c.reset}`);
  console.log(`${c.bold}${c.cyan}═══════════════════════════════════════${c.reset}\n`);

  const testCases: [string, string][] = [
    ["SENIN",  "09.20"],
    ["SENIN",  "10.00"], // 2nd SDA session → should SKIP
    ["SELASA", "08.00"],
    ["SELASA", "09.20"],
    ["SELASA", "10.00"], // SDA PR continuation → should SKIP
    ["SELASA", "12.30"],
    ["SELASA", "15.10"], // Proyek 2 continuation → should SKIP
    ["RABU",   "08.00"],
    ["RABU",   "09.20"],
    ["RABU",   "13.10"],
    ["KAMIS",  "10.40"],
    ["JUMAT",  "13.40"],
    ["JUMAT",  "15.30"],
    ["SENIN",  "07.00"], // none → should be empty
  ];

  let triggered = 0;

  for (const [day, time] of testCases) {
    const sessions = findSessions(day, time);

    if (sessions.length === 0) {
      log(c.dim, "SKIP", `${day} ${time} → tidak ada trigger`);
    } else {
      for (const s of sessions) {
        log(c.green, "TRIGGER", `${day} ${time} → ${s.course_name} (${s.type}) | ${s.room}`);
        triggered++;
      }
    }
  }

  console.log(`\n${c.green}${c.bold}✔ Selesai.${c.reset} ${triggered} trigger ditemukan dari ${testCases.length} test case.`);
  console.log(`${c.dim}(Tidak ada pesan WA yang dikirim)\n${c.reset}`);
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODE 2: send — Send 1 real dummy WA message
// ═══════════════════════════════════════════════════════════════════════════════

const testSendMessage = async (): Promise<void> => {
  console.log(`\n${c.bold}${c.yellow}═══════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}${c.yellow}  MODE: Test Kirim Pesan Nyata ke WA   ${c.reset}`);
  console.log(`${c.bold}${c.yellow}═══════════════════════════════════════${c.reset}\n`);

  if (!GROUP_JID) {
    log(c.red, "ERROR", "GROUP_JID belum diset di .env!");
    process.exit(1);
  }

  const dummySession: Session = {
    time:          "00.00-00.40",
    course_code:   "TEST",
    course_name:   "HelloWorld",
    type:          "TE",
    lecturer_code: "TEST",
    lecturer:      "C. Kirk",
    room:          "Backroom",
  };

  const message = buildMessage(dummySession, "TEST");

  console.log(`${c.cyan}Pesan yang akan dikirim:${c.reset}`);
  console.log(`${c.dim}─────────────────────────────${c.reset}`);
  console.log(message);
  console.log(`${c.dim}─────────────────────────────${c.reset}\n`);
  console.log(`${c.cyan}Tujuan :${c.reset} ${GROUP_JID}`);
  console.log(`${c.cyan}API URL:${c.reset} ${API_URL}\n`);

  try {
    const res = await fetch(API_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": GO_WA_AUTH,
      },
      body:   JSON.stringify({ phone: GROUP_JID, message, is_forwarded: false }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.text();

    if (res.ok) {
      log(c.green, "SUCCESS", `Pesan terkirim! Response: ${body}`);
    } else {
      log(c.red, "FAILED", `HTTP ${res.status} — ${body}`);
    }
  } catch (err: any) {
    log(c.red, "ERROR", `Tidak bisa konek ke Go-WA: ${err.message}`);
    console.log(`\n${c.yellow}Tips troubleshoot:${c.reset}`);
    console.log("  • Pastikan server Go-WhatsApp sudah berjalan");
    console.log("  • Cek GO_WA_API_URL di .env sudah benar");
    console.log("  • Coba buka di browser:", API_URL.replace("/send/message", ""));
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODE 3: simulate — Show all triggers that will fire each day
// ═══════════════════════════════════════════════════════════════════════════════

const testSimulate = async (): Promise<void> => {
  console.log(`\n${c.bold}${c.cyan}═══════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}${c.cyan}  MODE: Simulasi Jadwal Seminggu        ${c.reset}`);
  console.log(`${c.bold}${c.cyan}═══════════════════════════════════════${c.reset}\n`);

  const days = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT"];
  let totalTriggers = 0;

  for (const day of days) {
    const dayData = scheduleData.schedule.find((d) => d.day === day);
    if (!dayData) continue;

    const uniqueStartTimes = [
      ...new Set(dayData.sessions.map((s) => s.time.split("-")[0]))
    ].sort();

    console.log(`${c.bold}${c.yellow}📅 ${day}${c.reset}`);

    for (const time of uniqueStartTimes) {
      const sessions = findSessions(day, time);
      for (const s of sessions) {
        const typeLabel = s.type === "TE" ? "Teori    " : "Praktikum";
        console.log(
          `  ${c.green}▶ ${time}${c.reset}  ${typeLabel}  ${c.bold}${s.course_name}${c.reset}  ${c.dim}(${s.room})${c.reset}`
        );
        totalTriggers++;
      }
    }
    console.log();
  }

  console.log(`${c.bold}Total notifikasi per minggu: ${totalTriggers}${c.reset}`);
  console.log(`${c.dim}(Tidak ada pesan WA yang dikirim)\n${c.reset}`);
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODE 4: next — Show the nearest upcoming trigger from now
// ═══════════════════════════════════════════════════════════════════════════════

const DAY_MAP: Record<string, string> = {
  Sunday:    "MINGGU",
  Monday:    "SENIN",
  Tuesday:   "SELASA",
  Wednesday: "RABU",
  Thursday:  "KAMIS",
  Friday:    "JUMAT",
  Saturday:  "SABTU",
};

const DAY_ORDER = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT"];

/** Convert "HH.MM" string to total minutes for easy comparison */
const timeToMinutes = (time: string): number => {
  const [hh, mm] = time.split(".").map(Number);
  return hh * 60 + mm;
};

const testNext = async (): Promise<void> => {
  console.log(`\n${c.bold}${c.cyan}═══════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}${c.cyan}  MODE: Next Trigger Preview           ${c.reset}`);
  console.log(`${c.bold}${c.cyan}═══════════════════════════════════════${c.reset}\n`);

  const now = new Date();

  // Current day & time
  const todayEn  = now.toLocaleDateString("en-US", { weekday: "long", timeZone: "Asia/Jakarta" });
  const todayIndo = DAY_MAP[todayEn] ?? todayEn;
  const currentHH = now.toLocaleString("en-US", { hour: "2-digit", hour12: false, timeZone: "Asia/Jakarta" });
  const currentMM = now.toLocaleString("en-US", { minute: "2-digit", timeZone: "Asia/Jakarta" });
  const currentTime = `${currentHH.padStart(2, "0")}.${currentMM.padStart(2, "0")}`;
  const currentMinutes = timeToMinutes(currentTime);

  console.log(`${c.cyan}Now     :${c.reset} ${todayIndo}, ${currentTime} WIB\n`);

  // Collect all upcoming triggers across the week starting from today
  type Trigger = { day: string; time: string; session: Session; minutesFromNow: number };
  const upcoming: Trigger[] = [];

  const todayIndex = DAY_ORDER.indexOf(todayIndo);

  // Search today + remaining days this week
  for (let i = 0; i < DAY_ORDER.length; i++) {
    const dayIndex = (todayIndex + i) % DAY_ORDER.length;
    const day = DAY_ORDER[dayIndex];
    const dayData = scheduleData.schedule.find((d) => d.day === day);
    if (!dayData) continue;

    const seen = new Set<string>();
    const uniqueStartTimes = [
      ...new Set(dayData.sessions.map((s) => s.time.split("-")[0]))
    ].sort();

    for (const time of uniqueStartTimes) {
      const sessionMinutes = timeToMinutes(time);

      // Skip times that have already passed today
      if (i === 0 && sessionMinutes <= currentMinutes) continue;

      const sessions = findSessions(day, time);
      for (const s of sessions) {
        if (seen.has(s.course_code)) continue;
        seen.add(s.course_code);

        // Minutes from now (add 1440 * day offset for future days)
        const minutesFromNow = (i * 1440) + sessionMinutes - (i === 0 ? currentMinutes : 0);
        upcoming.push({ day, time, session: s, minutesFromNow });
      }
    }
  }

  if (upcoming.length === 0) {
    log(c.yellow, "INFO", "No more triggers found for the rest of this week.");
    return;
  }

  // Sort by proximity
  upcoming.sort((a, b) => a.minutesFromNow - b.minutesFromNow);

  // Show the next trigger
  const next = upcoming[0];
  const hoursAway = Math.floor(next.minutesFromNow / 60);
  const minsAway  = next.minutesFromNow % 60;
  const etaStr    = hoursAway > 0 ? `${hoursAway}h ${minsAway}m` : `${minsAway}m`;
  const typeLabel = next.session.type === "TE" ? "Teori" : "Praktikum";
  const [start, end] = next.session.time.split("-");

  console.log(`${c.bold}${c.green}⚡ Next Trigger${c.reset}`);
  console.log(`${c.dim}─────────────────────────────────────${c.reset}`);
  console.log(`  ${c.bold}Day     :${c.reset} ${next.day}`);
  console.log(`  ${c.bold}Time    :${c.reset} ${start} – ${end} WIB`);
  console.log(`  ${c.bold}Course  :${c.reset} ${next.session.course_name}`);
  console.log(`  ${c.bold}Type    :${c.reset} ${typeLabel}`);
  console.log(`  ${c.bold}Lecturer:${c.reset} ${next.session.lecturer}`);
  console.log(`  ${c.bold}Room    :${c.reset} ${next.session.room}`);
  console.log(`  ${c.bold}ETA     :${c.reset} ${c.yellow}${etaStr} from now${c.reset}`);
  console.log(`${c.dim}─────────────────────────────────────${c.reset}\n`);

  // Show next 3 upcoming after that
  if (upcoming.length > 1) {
    console.log(`${c.bold}Upcoming after that:${c.reset}`);
    for (const t of upcoming.slice(1, 4)) {
      const h = Math.floor(t.minutesFromNow / 60);
      const m = t.minutesFromNow % 60;
      const eta = h > 0 ? `${h}h ${m}m` : `${m}m`;
      const [s] = t.session.time.split("-");
      console.log(
        `  ${c.dim}▶${c.reset} ${t.day} ${s}  ${c.bold}${t.session.course_name}${c.reset}  ${c.dim}(${eta} from now)${c.reset}`
      );
    }
    console.log();
  }
};

// ─── Main Entry ───────────────────────────────────────────────────────────────

const mode = process.argv[2] ?? "simulate";

switch (mode) {
  case "schedule":
    await testScheduleLogic();
    break;
  case "send":
    await testSendMessage();
    break;
  case "simulate":
    await testSimulate();
    break;
  case "next":
    await testNext();
    break;
  default:
    console.log(`\n${c.red}Mode tidak dikenal: "${mode}"${c.reset}\n`);
    console.log("Gunakan salah satu:");
    console.log("  bun run test.ts simulate   → lihat semua trigger jadwal (default)");
    console.log("  bun run test.ts schedule   → uji logika filter (dry run detail)");
    console.log("  bun run test.ts send       → kirim pesan dummy nyata ke WA");
    console.log("  bun run test.ts next       → preview trigger terdekat dari sekarang\n");
    process.exit(1);
}