# class-attendance-reminder

A WhatsApp attendance reminder bot for class 1A-D3, built with Bun JS. Automatically sends a message to a WhatsApp group at the start of each class session based on a schedule file.

---

> 🚨 This project is powered by [go-whatsapp-web-multidevice](https://github.com/aldinokemal/go-whatsapp-web-multidevice) by [@aldinokemal](https://github.com/aldinokemal).
> Huge thanks for building and maintaining such a great open-source WhatsApp bridge: this project would not exist without it.

---

## How It Works

Every minute, the bot reads the current day and time from the system clock, then looks up `data/schedule.json` for any session starting at that exact time. If a match is found, it sends a reminder message to the configured WhatsApp group via the Go-WA REST API.

- Only the first session per course per day triggers a notification, preventing repeated messages for back-to-back sessions of the same course.
- An in-memory cache prevents duplicate sends within the same day.
- Schedule data is loaded once at startup. Restart the bot after editing `schedule.json`.

## Project Structure

```
.
├── data/
│   └── schedule.json     - Class schedule data
├── index.ts              - Main bot script
├── test.ts               - Testing utilities
├── package.json
├── .env                  - Your config (created from .env.example)
└── .env.example
```

## Setup

### 1. Requirements

- [Bun](https://bun.sh) installed
- [go-whatsapp-web-multidevice](https://github.com/aldinokemal/go-whatsapp-web-multidevice) running on a server with WhatsApp connected

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Description |
|---|---|
| `GO_WA_API_URL` | Full URL to the Go-WA send message endpoint |
| `GO_WA_USERNAME` | Go-WA Basic Auth username |
| `GO_WA_PASSWORD` | Go-WA Basic Auth password |
| `GROUP_JID` | WhatsApp group ID (format: `number@g.us`) |

> **Finding `GROUP_JID`:** Open the Go-WA web UI, send a message to your group, then inspect the network request: the `phone` field in the payload is your group ID.

> **Finding credentials:** Check how Go-WA was started on your server. The `--basic-auth` flag or `APP_BASIC_AUTH` environment variable contains `username:password`.

### 4. Run the bot

```bash
bun run start
```

## Testing

Before running the bot in production, use `test.ts` to verify everything works:

```bash
# Preview all sessions that will trigger notifications this week (no WA sent)
bun run test.ts simulate

# Run through test cases to verify filter and anti-spam logic (no WA sent)
bun run test.ts schedule

# Send a real dummy message to your WhatsApp group (verifies connection)
bun run test.ts send

# Preview the next upcoming trigger from current time, plus 3 sessions after it
bun run test.ts next
```

> Recommended order: `simulate` → `schedule` → `send` → then run `index.ts`

### Example output of `next`

```
Now     : SELASA, 08.00 WIB

⚡ Next Trigger
─────────────────────────────────────
  Day     : SELASA
  Time    : 09.20 – 10.00 WIB
  Course  : Struktur Data & Algoritma
  Type    : Praktikum
  Lecturer: Wendi Wirasta
  Room    : D107-Lab. RPL
  ETA     : 1h 20m from now
─────────────────────────────────────

Upcoming after that:
  ▶ SELASA 12.30  Proyek 2 : Pengembangan Aplikasi Berbasis Library  (4h 30m from now)
  ▶ RABU   08.00  Komputasi Kognitif  (24h 0m from now)
  ▶ RABU   09.20  Matematika Diskrit 1  (25h 20m from now)
```

## Example Message

```
⚠️ ALERTA ALERTA ⚠️

Matkul : Struktur Data & Algoritma
Tipe   : Praktikum
Dosen  : Wendi Wirasta
Ruangan: D107-Lab. RPL
Jam    : 09.20 – 10.00

Attendance Link: 
https://akademik.polban.ac.id/
```

## Run with Docker

The easiest way to run the bot: no need to install Bun manually.

### Using Docker Compose

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

> Make sure your `.env` file is already filled in before running `docker compose up`.

Updating `schedule.json` does not require rebuilding the image: it is mounted as a volume. Just restart the container:

```bash
docker compose restart
```

If you change `index.ts` or any other code, rebuild the image first:

```bash
docker compose up -d --build
```

---

## Running in the Background (without Docker)

Using PM2 to keep the bot alive after closing the terminal:

```bash
npm install -g pm2
pm2 start "bun run start" --name class-attendance-reminder
pm2 save
pm2 startup
```

Useful PM2 commands:

```bash
pm2 status                           # check bot status
pm2 logs class-attendance-reminder   # view logs
pm2 restart class-attendance-reminder # restart (required after editing schedule.json)
pm2 stop class-attendance-reminder   # stop the bot
```

## License

MIT