// JagX WhatsApp Bot - Single Server Pairing Only

require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const Jimp = require('jimp');

const PAIR_SERVER = process.env.PAIR_SERVER || 'http://localhost:4260';
const jagxName = '🤖 JagX 🤖';
const XP = {};
const QUIZZES = [
  { question: "Capital of France?", answer: "Paris" },
  { question: "2 + 2?", answer: "4" },
  { question: "First president of USA?", answer: "George Washington" },
];
const assets = {
  profile: path.join(__dirname, '../assets/jagx-profile.png'),
  meme: path.join(__dirname, '../assets/meme-template.png'),
  sticker: path.join(__dirname, '../assets/sticker-template.png'),
  aiImage: path.join(__dirname, '../assets/ai-generated-image.png')
};

function addXP(jid, amount = 10) {
  XP[jid] = (XP[jid] || 0) + amount;
  return XP[jid];
}

async function getPairingCodeFromServer() {
  try {
    const res = await axios.get(`${PAIR_SERVER}/auto-pair`);
    return res.data;
  } catch (e) {
    return null;
  }
}

async function verifyPairCodeOnServer(code, phone) {
  try {
    const res = await axios.post(`${PAIR_SERVER}/verify-pair`, { code, userPhone: phone });
    return res.data;
  } catch (e) {
    return null;
  }
}

async function startBot(pairCode, phone) {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, printQRInTerminal: true });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid) return;
    const sender = msg.key.participant || msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    addXP(sender);

    // Menu/help
    if (/^\.(menu|help)$/i.test(text)) {
      await sock.sendMessage(sender, {
        text: `
${jagxName}
Commands:
.menu / .help - Show menu
.rps - Rock Paper Scissors
.quiz - Trivia quiz
.level - Show your XP/level
.meme <top>|<bottom> - Meme generator
.sticker+ <text> - Custom sticker
.aiimg <prompt> - AI image demo
.pairinfo - Bot pairing QR/code
.features - List all features
.status - Bot status
.viewonce - See last 'view once' media
.antidelete - Recover deleted messages

Admin:
.kick <number> - Kick user (admin)
.promote <number> - Promote user (admin)
.demote <number> - Demote user (admin)
.broadcast <text> - Owner broadcast
`
      });
    }

    // Show all features
    if (/^\.features$/i.test(text)) {
      await sock.sendMessage(sender, {
        text: `
Main Features:
- Single server pairing via code or QR
- Games (RPS, Quiz, XP, Level)
- Media tools (Meme, Sticker, AI image)
- Status, Anti-delete, View-once recovery
- Admin panel: kick, promote, broadcast, etc.
- Pairing info via .pairinfo
`
      });
    }

    // Show bot status
    if (/^\.status$/i.test(text)) {
      await sock.sendMessage(sender, { text: `JagX Bot is running. Pairing server: ${PAIR_SERVER}\nXP enabled.` });
    }

    // Show pairing info (code and QR)
    if (/^\.pairinfo$/i.test(text)) {
      const info = await getPairingCodeFromServer();
      if (!info || !info.code) {
        await sock.sendMessage(sender, { text: 'No pairing code available.' });
      } else {
        await sock.sendMessage(sender, { text: `Pairing Code: ${info.code}\nExpires: ${new Date(info.expires).toLocaleString()}` });
        if (info.qr) await sock.sendMessage(sender, { image: { url: `${PAIR_SERVER}${info.qr}` }, caption: 'Scan this QR to pair!' });
      }
    }

    // Game: Rock Paper Scissors
    if (/^\.rps$/i.test(text)) {
      const choices = ['rock', 'paper', 'scissors'];
      const botChoice = choices[Math.floor(Math.random() * choices.length)];
      await sock.sendMessage(sender, { text: `🤖 I choose: ${botChoice}` });
    }

    // Game: Quiz
    if (/^\.quiz$/i.test(text)) {
      const q = QUIZZES[Math.floor(Math.random() * QUIZZES.length)];
      await sock.sendMessage(sender, { text: `Quiz: ${q.question}\nReply with .answer <your answer>` });
      msg.__quizAnswer = q.answer;
    }

    // Game: Answer
    if (/^\.answer /.test(text) && msg.__quizAnswer) {
      const ans = text.replace('.answer ', '').trim();
      if (ans.toLowerCase() === msg.__quizAnswer.toLowerCase()) {
        addXP(sender, 50);
        await sock.sendMessage(sender, { text: '🎉 Correct! +50 XP' });
      } else {
        await sock.sendMessage(sender, { text: '❌ Incorrect. Try again!' });
      }
      delete msg.__quizAnswer;
    }

    // XP/Level
    if (/^\.level$/i.test(text)) {
      const xp = XP[sender] || 0;
      const level = Math.floor(xp / 100);
      await sock.sendMessage(sender, { text: `XP: ${xp}\nLevel: ${level}` });
    }

    // Media: Meme generator
    if (/^\.meme /.test(text)) {
      const [top, bottom] = text.replace('.meme ', '').split('|').map(x => x.trim());
      const meme = await Jimp.read(assets.meme);
      const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
      meme.print(font, 20, 20, top, 360);
      meme.print(font, 20, 260, bottom, 360);
      await meme.writeAsync('assets/generated-meme.png');
      await sock.sendMessage(sender, { image: { url: 'assets/generated-meme.png' }, caption: `${top}\n${bottom}` });
    }

    // Media: Custom sticker
    if (/^\.sticker\+ /.test(text)) {
      const stickerText = text.replace('.sticker+ ', '');
      const sticker = await Jimp.read(assets.sticker);
      const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
      sticker.print(font, 0, 80, {
        text: stickerText,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
      }, 320, 60);
      await sticker.writeAsync('assets/generated-sticker.png');
      await sock.sendMessage(sender, { sticker: fs.readFileSync('assets/generated-sticker.png') });
    }

    // Media: AI image demo
    if (/^\.aiimg /.test(text)) {
      await sock.sendMessage(sender, { image: { url: assets.aiImage }, caption: 'AI generated image (demo)' });
    }

    // Status: Anti-delete, View once
    if (/^\.viewonce$/i.test(text)) {
      await sock.sendMessage(sender, { text: "View once recovery: (demo) Last media recovered." });
    }
    if (/^\.antidelete$/i.test(text)) {
      await sock.sendMessage(sender, { text: "Anti-delete: (demo) Last deleted message recovered." });
    }

    // Admin (stub)
    if (/^\.kick /.test(text)) {
      await sock.sendMessage(sender, { text: "Kick (demo): User removed." });
    }
    if (/^\.promote /.test(text)) {
      await sock.sendMessage(sender, { text: "Promote (demo): User promoted." });
    }
    if (/^\.demote /.test(text)) {
      await sock.sendMessage(sender, { text: "Demote (demo): User demoted." });
    }
    if (/^\.broadcast /.test(text)) {
      const msgText = text.replace('.broadcast ', '');
      await sock.sendMessage(sender, { text: `[Broadcast]: ${msgText}` });
    }
  });

  sock.ev.on('creds.update', saveCreds);
  console.log('JagX Bot started!');
}

// ---- MAIN: Get pairing code from server, verify, then start bot ----
async function main() {
  // Fetch pairing code from server
  const info = await getPairingCodeFromServer();
  if (!info || !info.code) {
    console.error("No pairing code from server. Make sure the server is running!");
    process.exit(1);
  }
  console.log(`Pairing Code: ${info.code}`);
  if (info.qr) console.log("Scan this QR to complete pairing:", `${PAIR_SERVER}${info.qr}`);

  // Phone number for bot instance (use env or static)
  const phone = process.env.BOT_PHONE || '1234567890';

  // Simulate a user entering/scanning QR or code
  const verifyRes = await verifyPairCodeOnServer(info.code, phone);
  if (!verifyRes || !verifyRes.message) {
    console.error("Pairing failed. Check code and server.");
    process.exit(1);
  }
  console.log("Successfully paired with server!");

  // Start WhatsApp bot
  await startBot(info.code, phone);
}

main();