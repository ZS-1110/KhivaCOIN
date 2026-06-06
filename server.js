/**
 * KhivaCoin Airdrop Backend
 * Node.js + Express server
 *
 * ISHGA TUSHIRISH:
 * 1. npm install
 * 2. .env faylida SENDER_PRIVATE_KEY ni kiriting
 * 3. node server.js
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} = require('@solana/web3.js');
const {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} = require('@solana/spl-token');
const bs58 = require('bs58');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// ─── CONFIG ─────────────────────────────────────────────
const CONFIG = {
  // Solana RPC endpoint
  RPC_URL: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',

  // KIC Token contract manzili
  TOKEN_MINT: process.env.TOKEN_MINT || '8qSBA3eoypLJXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',

  // Har bir foydalanuvchiga beriladigan token miqdori
  // 2500 token * 10^9 (9 ta decimal)
  AIRDROP_AMOUNT: 2500 * 1_000_000_000,

  // Server porti
  PORT: process.env.PORT || 3001,
};

// ─── DATABASE (oddiy JSON fayl) ─────────────────────────
const DB_FILE = './claimed_wallets.json';

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ claimed: [], total_sent: 0 }));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function hasClaimed(wallet) {
  const db = loadDB();
  return db.claimed.some(c => c.wallet === wallet);
}

function recordClaim(wallet, txHash) {
  const db = loadDB();
  db.claimed.push({ wallet, txHash, date: new Date().toISOString() });
  db.total_sent += CONFIG.AIRDROP_AMOUNT;
  saveDB(db);
}

// ─── SOLANA SETUP ────────────────────────────────────────
function getSenderKeypair() {
  const privateKeyStr = process.env.SENDER_PRIVATE_KEY;
  if (!privateKeyStr) {
    throw new Error('SENDER_PRIVATE_KEY .env faylida yo\'q!');
  }
  // Base58 formatdagi private key
  const secretKey = bs58.decode(privateKeyStr);
  return Keypair.fromSecretKey(secretKey);
}

async function sendTokens(recipientAddress) {
  const connection = new Connection(CONFIG.RPC_URL, 'confirmed');
  const sender = getSenderKeypair();
  const mint = new PublicKey(CONFIG.TOKEN_MINT);
  const recipient = new PublicKey(recipientAddress);

  // Sender token account
  const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    sender,
    mint,
    sender.publicKey
  );

  // Recipient token account (yo'q bo'lsa yaratadi)
  const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    sender,        // fee to'lovchi
    mint,
    recipient
  );

  // Transfer
  const tx = new Transaction().add(
    createTransferInstruction(
      senderTokenAccount.address,
      recipientTokenAccount.address,
      sender.publicKey,
      CONFIG.AIRDROP_AMOUNT,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  const signature = await connection.sendTransaction(tx, [sender]);
  await connection.confirmTransaction(signature, 'confirmed');

  return signature;
}

// ─── API ENDPOINTS ───────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  const db = loadDB();
  res.json({
    status: 'ok',
    total_claimed: db.claimed.length,
    total_sent_kic: db.total_sent / 1_000_000_000,
    remaining: (200_000_000 - db.total_sent / 1_000_000_000),
  });
});

// Stats (frontend counter uchun)
app.get('/api/stats', (req, res) => {
  const db = loadDB();
  const totalSent = db.total_sent / 1_000_000_000;
  res.json({
    participants: db.claimed.length,
    total_supply: 200_000_000,
    distributed: totalSent,
    remaining: 200_000_000 - totalSent,
    percent: Math.round((totalSent / 200_000_000) * 100),
  });
});

// Ijtimoiy tarmoq tasdiqlash
// NOT: Bu yerda real API bilan tekshirish qo'shish mumkin (Twitter API, Telegram Bot API)
// Hozircha oddiy tasdiqlash — foydalanuvchi o'zi tasdiqlaydi
app.post('/api/verify-socials', (req, res) => {
  // Real loyihada bu yerda Twitter/Telegram API orqali
  // foydalanuvchi haqiqatan obuna bo'lganini tekshirish mumkin
  res.json({ success: true, message: 'Ijtimoiy tarmoqlar tasdiqlandi' });
});

// Claim endpoint
app.post('/api/claim', async (req, res) => {
  const { wallet } = req.body;

  // Validatsiya
  if (!wallet) {
    return res.status(400).json({ success: false, message: 'Hamyon manzili kerak' });
  }

  // Solana manzil formati tekshirish
  try {
    new PublicKey(wallet);
  } catch {
    return res.status(400).json({ success: false, message: 'Noto\'g\'ri hamyon manzili' });
  }

  // Allaqachon claim qilinganmi?
  if (hasClaimed(wallet)) {
    return res.status(400).json({
      success: false,
      message: 'Bu hamyon allaqachon airdrop olgan!'
    });
  }

  // Umumiy limit (200M token)
  const db = loadDB();
  const totalSent = db.total_sent / 1_000_000_000;
  if (totalSent + 2500 > 200_000_000) {
    return res.status(400).json({
      success: false,
      message: 'Airdrop tokenlar tugadi!'
    });
  }

  try {
    console.log(`[CLAIM] ${wallet} uchun ${CONFIG.AIRDROP_AMOUNT / 1e9} KIC yuborilmoqda...`);
    const txHash = await sendTokens(wallet);
    recordClaim(wallet, txHash);
    console.log(`[SUCCESS] TX: ${txHash}`);

    res.json({
      success: true,
      txHash,
      amount: 2500,
      message: '2,500 KIC muvaffaqiyatli yuborildi!'
    });
  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(500).json({
      success: false,
      message: 'Token yuborishda xato: ' + err.message
    });
  }
});

// ─── START ───────────────────────────────────────────────
app.listen(CONFIG.PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   KhivaCoin Airdrop Server           ║
║   Port: ${CONFIG.PORT}                        ║
║   RPC:  ${CONFIG.RPC_URL.slice(0,30)}...  ║
╚══════════════════════════════════════╝
  `);
});
