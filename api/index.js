const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const BIN_ID = '69cbcdc8aaba882197af4bcc';
const MASTER_KEY = '$2a$10$go25lr52o.r3GKWOrNSUiO6Gdv52kcAcNS56vMiiIhlM5yX3X2ON6';
const KLYNA_KEY = 'klyna-5x9k1koc';
const RPY_KEY = 'RPY-Y20IM0NS';

async function getDB() {
    const res = await axios.get(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: { 'X-Master-Key': MASTER_KEY }
    });
    return res.data.record;
}

async function updateDB(data) {
    await axios.put(`https://api.jsonbin.io/v3/b/${BIN_ID}`, data, {
        headers: { 'X-Master-Key': MASTER_KEY, 'Content-Type': 'application/json' }
    });
}

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        let db = await getDB();
        if (!db.users) db.users = {};
        if (db.users[username]) {
            if (db.users[username].password !== password) return res.json({ success: false, msg: 'Password salah' });
        } else {
            db.users[username] = { password, isPremium: false, chatCount: 0, lastDate: new Date().toDateString() };
            await updateDB(db);
        }
        res.json({ success: true, user: db.users[username] });
    } catch (e) { res.status(500).json({ success: false, msg: "Database Error" }); }
});

app.post('/api/chat', async (req, res) => {
    const { username, text } = req.body;
    let db = await getDB();
    let user = db.users[username];
    const today = new Date().toDateString();

    if (!user.isPremium) {
        if (user.lastDate !== today) {
            user.chatCount = 0;
            user.lastDate = today;
        }
        if (user.chatCount >= 50) return res.json({ result: "Limit chat harian (50) habis. Silahkan upgrade ke Premium hanya Rp500!" });
    }

    try {
        const response = await axios.get(`https://klyna-swart.vercel.app/api/chat?key=${KLYNA_KEY}&text=${encodeURIComponent(text)}`);
        // Perbaikan: Ambil properti 'result' atau 'data' sesuai format API Klyna
        const reply = typeof response.data === 'object' ? (response.data.result || response.data.reply || JSON.stringify(response.data)) : response.data;
        
        if (!user.isPremium) user.chatCount++;
        await updateDB(db);
        res.json({ result: reply });
    } catch (e) {
        res.json({ result: "Maaf, API Klyna sedang gangguan." });
    }
});

app.get('/api/pay-create', async (req, res) => {
    try {
        const r = await axios.get(`https://bior-beta.vercel.app/api/pay?key=${RPY_KEY}&amt=500`);
        res.json(r.data);
    } catch (e) { res.status(500).json({ success: false }); }
});

app.post('/api/pay-check', async (req, res) => {
    const { username, trxId } = req.body;
    try {
        const r = await axios.get(`https://bior-beta.vercel.app/api/pay?action=check&trxId=${trxId}`);
        if (r.data.paid) {
            let db = await getDB();
            db.users[username].isPremium = true;
            await updateDB(db);
            res.json({ success: true });
        } else { res.json({ success: false }); }
    } catch (e) { res.json({ success: false }); }
});

module.exports = app;
