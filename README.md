# KhivaCoin Airdrop Tizimi

## Fayllar
- `index.html` — Frontend sayt (foydalanuvchilar ko'radi)
- `server.js` — Backend server (tokenlarni yuboradi)
- `.env.example` — Sozlamalar namunasi
- `claimed_wallets.json` — Claim qilganlar ro'yxati (avtomatik yaratiladi)

---

## Ishga Tushirish

### 1. Node.js o'rnating
https://nodejs.org (v18 yoki yuqori)

### 2. Paketlarni o'rnating
```
npm install
```

### 3. .env fayl yarating
```
cp .env.example .env
```
Keyin `.env` faylini oching va:
- `SENDER_PRIVATE_KEY` — airdrop hamyonining private key
- `TOKEN_MINT` — KIC token to'liq contract manzili

### 4. Serverni ishga tushiring
```
node server.js
```

### 5. Frontend ni joylashtiring
`index.html` ni Netlify, Vercel yoki istalgan hosting'ga joylang.
`index.html` ichidagi `BACKEND_URL` ni serveringiz manziliga o'zgartiring.

---

## Xavfsizlik
- `.env` faylini hech kimga bermang
- `.env` ni Git'ga yuklamang (.gitignore ga qo'shing)
- Server ishga tushgandan so'ng `claimed_wallets.json` ni zaxiralang
