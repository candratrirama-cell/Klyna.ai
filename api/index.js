const axios = require('axios');
const express = require('express');
const app = express();

app.use(express.json());

const BIN_ID = "69cbcdc8aaba882197af4bcc";
const MASTER_KEY = "$2a$10$go25lr52o.r3GKWOrNSUiO6Gdv52kcAcNS56vMiiIhlM5yX3X2ON6";
const KLYNA_API = "https://klyna-swart.vercel.app/api/chat?key=klyna-5x9k1koc";
const PAY_API = "https://bior-beta.vercel.app/api/pay";
const PAY_KEY = "RPY-Y20IM0NS";

// Helper: Ambil data dari JSONBin
async function getDb() {
    const res = await axios.get(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: { 'X-Master-Key': MASTER_KEY }
    });
    return res.data.record;
}

// Helper: Update data ke JSONBin
async function updateDb(newData) {
    await axios.put(`https://api.jsonbin.io/v3/b/${BIN_ID}`, newData, {
        headers: { 'X-Master-Key': MASTER_KEY, 'Content-Type': 'application/json' }
    });
}

// Endpoint: Chat
app.post('/api/chat', async (req, res) => {
    const { username, message } = req.body;
    let db = await getDb();
    let user = db.users[username];

    if (!user) return res.json({ error: "User tidak ditemukan" });

    // Cek Kuota
    const today = new Date().toDateString();
    if (user.lastReset !== today) {
        user.dailyRequests = 0;
        user.lastReset = today;
    }

    if (!user.isPremium && user.dailyRequests >= 50) {
        return res.json({ response: "Limit harian habis. Upgrade Premium Rp500 seumur hidup!" });
    }

    try {
        const response = await axios.get(`${KLYNA_API}&text=${encodeURIComponent(message)}`);
        user.dailyRequests += 1;
        await updateDb(db);
        res.json({ response: response.data });
    } catch (e) {
        res.status(500).json({ error: "Klyna API Error" });
    }
});

// Endpoint: Upgrade (Bikin QRIS)
app.get('/api/upgrade', async (req, res) => {
    try {
        const response = await axios.get(`${PAY_API}?key=${PAY_KEY}&amt=500`);
        res.json(response.data);
    } catch (e) {
        res.status(500).json({ error: "Gagal membuat QRIS" });
    }
});

module.exports = app;
