// JagX Bot Pairing Server (Single Server Pairing Only)

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');

const PORT = process.env.PORT || 4260;
const PAIR_PREFIX = 'JagX';
const DATA_DIR = process.env.DATA_DIR || '/data';
const AUTO_PAIR_FILE = path.join(DATA_DIR, 'auto-pair.json');
const AUTO_PAIR_QR_FILE = path.join(DATA_DIR, 'auto-pair-qr.png');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Load or initialize the auto-pair file
function loadJson(file, fallback = {}) {
  if (fs.existsSync(file)) {
    try { return JSON.parse(fs.readFileSync(file)); } catch { return fallback; }
  }
  return fallback;
}
function saveJson(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 2)); }

// Generate secure code (JagX + 4 digits)
function generateJagXCode() { return PAIR_PREFIX + crypto.randomInt(1000, 9999); }

// AUTO-GENERATE PAIRING CODE + QR on first deploy
function autoGeneratePairing() {
  if (!fs.existsSync(AUTO_PAIR_FILE)) {
    const code = generateJagXCode();
    const expires = Date.now() + 24 * 60 * 60 * 1000; // 24hrs
    const autoPairing = { code, expires, paired: false };

    saveJson(AUTO_PAIR_FILE, autoPairing);

    // Generate QR code for quick mobile pairing
    const qrUrl = `https://katabump.com/pair?code=${code}`;
    qrcode.toFile(AUTO_PAIR_QR_FILE, qrUrl, { width: 300 }, err => {
      if (err) console.error("Auto QR generation failed", err);
      else console.log("Auto pairing QR generated:", AUTO_PAIR_QR_FILE);
    });
  }
}
autoGeneratePairing();

const app = express();
app.use(bodyParser.json());

// Get auto-pair info (code + QR)
app.get('/auto-pair', (req, res) => {
  let autoPairing = loadJson(AUTO_PAIR_FILE);
  let qrExists = fs.existsSync(AUTO_PAIR_QR_FILE);
  res.json({
    code: autoPairing.code,
    expires: autoPairing.expires,
    qr: qrExists ? `/auto-pair-qr` : null
  });
});

// Serve QR code image
app.get('/auto-pair-qr', (req, res) => {
  if (fs.existsSync(AUTO_PAIR_QR_FILE)) {
    res.sendFile(AUTO_PAIR_QR_FILE);
  } else {
    res.status(404).send('QR code not generated yet.');
  }
});

// Verify bot pairing
app.post('/verify-pair', (req, res) => {
  const { code, userPhone } = req.body;
  let autoPairing = loadJson(AUTO_PAIR_FILE);
  if (!autoPairing || !autoPairing.code) return res.status(404).json({ error: 'No pairing found.' });
  if (Date.now() > autoPairing.expires) return res.status(410).json({ error: 'Pairing code expired.' });
  if (autoPairing.code !== code) return res.status(401).json({ error: 'Invalid code.' });
  autoPairing.paired = true;
  autoPairing.userPhone = userPhone;
  saveJson(AUTO_PAIR_FILE, autoPairing);
  return res.json({ message: 'Successfully paired!', userPhone });
});

// Health check
app.get('/', (req, res) => {
  let autoPairing = loadJson(AUTO_PAIR_FILE);
  let qrExists = fs.existsSync(AUTO_PAIR_QR_FILE);
  res.send(`
    <h2>JagX Bot Pairing Server is running.</h2>
    <div>
      <strong>Auto Pairing Code:</strong> ${autoPairing.code || 'N/A'} <br/>
      <strong>Expires:</strong> ${autoPairing.expires ? new Date(autoPairing.expires).toUTCString() : 'N/A'} <br/>
      ${qrExists ? `<img src="/auto-pair-qr" width="200" />` : ''}
      <br>
      <a href="/auto-pair">API: /auto-pair</a>
    </div>
  `);
});

app.listen(PORT, () => {
  console.log(`JagX Bot Pairing Server running on port ${PORT}`);
});