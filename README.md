# JagX WhatsApp Bot — Single Server Pairing

## How It Works

- The **pairing server** generates a single pairing code (and QR) for the bot deployed on the same host.
- **No remote removal, no external pairings, no multi-bot management.**
- Bot fetches code from `/auto-pair`, verifies with `/verify-pair`, and starts.

## Quick Start

1. **Deploy pairing server** (`src/pairing-server.js`) to your bot host (Katabump, BotHosting, Render, etc).
2. **Deploy bot** (`src/bot.js`) on the same host or with `PAIR_SERVER` pointing to server URL.
3. Start bot, scan or input code/QR as prompted.

## Endpoints

- `/auto-pair` — returns JSON `{ code, expires, qr }`
- `/auto-pair-qr` — serves QR image
- `/verify-pair` — verifies code + phone

## Features

- Single server pairing (code or QR)
- Games: `.rps`, `.quiz`, `.level`
- Media: `.meme`, `.sticker+`, `.aiimg`
- Status: Anti-delete, View-once recovery
- Admin: `.kick`, `.promote`, `.broadcast`

## Environment Variables

```env
PAIR_SERVER=http://localhost:4260
BOT_PHONE=1234567890
DATA_DIR=/data
```

**All pairing management is local to the bot server.**

---