const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// CONFIGURATION (Ganti jika perlu)
const BIN_ID = '69cbcdc8aaba882197af4bcc';
const MASTER_KEY = '$2a$10$go25lr52o.r3GKWOrNSUiO6Gdv52kcAcNS56vMiiIhlM5yX3X2ON6';
const KLYNA_KEY = 'klyna-5x9k1koc';
const RPY_KEY = 'RPY-Y20IM0NS';

// Database Helper
async function getDB() {
    try {
        const res = await axios.get(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            headers: { 'X-Master-Key': MASTER_KEY }
        });
        return res.data.record;
    } catch (e) { 
        return { users: {} }; 
    }
}

async function updateDB(data) {
    try {
        await axios.put(`https://api.jsonbin.io/v3/b/${BIN_ID}`, data, {
            headers: { 
                'X-Master-Key': MASTER_KEY, 
                'Content-Type': 'application/json' 
            }
        });
        return true;
    } catch (e) { 
        return false; 
    }
}

// ENDPOINT: LOGIN / REGISTER
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, msg: "Isi semua data!" });

    let db = await getDB();
    if (!db.users) db.users = {};

    if (db.users[username]) {
        if (db.users[username].password !== password) {
            return res.json({ success: false, msg: "Password salah!" });
        }
    } else {
        // Otomatis Register jika user baru
        db.users[username] = { 
            password, 
            isPremium: false, 
            chatCount: 0, 
            lastDate: new Date().toDateString() 
        };
        await updateDB(db);
    }

    res.json({ 
        success: true, 
        user: { 
            username, 
            isPremium: db.users[username].isPremium 
        } 
    });
});

// ENDPOINT: CHAT WITH LIMIT & PREMIUM CHECK
app.post('/api/chat', async (req, res) => {
    const { username, text } = req.body;
    let db = await getDB();
    let user = db.users[username];

    if (!user) return res.json({ result: "Sesi habis, silakan login ulang." });

    const today = new Date().toDateString();

    // Logika Limit Harian untuk Free User
    if (!user.isPremium) {
        if (user.lastDate !== today) {
            user.chatCount = 0;
            user.lastDate = today;
        }

        if (user.chatCount >= 50) {
            return res.json({ 
                result: "LIMIT_REACHED", 
                msg: "Limit harian (50 chat) kamu sudah habis! Upgrade ke Premium sekarang, harga launching hanya Rp500 seumur hidup." 
            });
        }
    }

    try {
        const response = await axios.get(`https://klyna-swart.vercel.app/api/chat?key=${KLYNA_KEY}&text=${encodeURIComponent(text)}`);
        let reply = response.data.result || response.data.reply || (typeof response.data === 'string' ? response.data : "Gagal memproses pesan.");
        
        // Tambahkan hitungan chat jika bukan premium
        if (!user.isPremium) {
            user.chatCount++;
        }

        await updateDB(db);
        res.json({ result: reply, isPremium: user.isPremium });
    } catch (e) {
        res.json({ result: "Server sedang sibuk atau API Down." });
    }
});

// ENDPOINT: CREATE QRIS PAYMENT
app.get('/api/pay-create', async (req, res) => {
    try {
        const r = await axios.get(`https://bior-beta.vercel.app/api/pay?key=${RPY_KEY}&amt=500`);
        res.json(r.data);
    } catch (e) {
        res.status(500).json({ error: "Gagal membuat pembayaran." });
    }
});

// ENDPOINT: CHECK PAYMENT STATUS
app.post('/api/pay-check', async (req, res) => {
    const { username, trxId } = req.body;
    try {
        const r = await axios.get(`https://bior-beta.vercel.app/api/pay?action=check&trxId=${trxId}`);
        
        if (r.data.success && r.data.paid) {
            let db = await getDB();
            if (db.users[username]) {
                db.users[username].isPremium = true;
                await updateDB(db);
                res.json({ success: true });
            } else {
                res.json({ success: false, msg: "User tidak ditemukan." });
            }
        } else {
            res.json({ success: false });
        }
    } catch (e) {
        res.json({ success: false });
    }
});

module.exports = app;
