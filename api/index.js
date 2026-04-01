const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Konfigurasi Kunci & Database
const BIN_ID = '69cbcdc8aaba882197af4bcc';
const MASTER_KEY = '$2a$10$go25lr52o.r3GKWOrNSUiO6Gdv52kcAcNS56vMiiIhlM5yX3X2ON6';
const KLYNA_KEY = 'klyna-5x9k1koc';
const RPY_KEY = 'RPY-Y20IM0NS';

// --- HELPER DATABASE (JSONBin) ---
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

// --- ROUTES ---

// 1. Login & Register
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, msg: "Isi semua data" });

    let db = await getDB();
    if (!db.users) db.users = {};

    if (db.users[username]) {
        if (db.users[username].password !== password) {
            return res.json({ success: false, msg: "Password salah" });
        }
    } else {
        // Daftar user baru otomatis
        db.users[username] = {
            password: password,
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

// 2. Chat Logic dengan Limit & Premium Check
app.post('/api/chat', async (req, res) => {
    const { username, text } = req.body;
    let db = await getDB();
    let user = db.users[username];

    if (!user) return res.json({ result: "Sesi habis, silahkan login ulang." });

    const today = new Date().toDateString();

    // Logika Limit Harian untuk Free Tier
    if (!user.isPremium) {
        if (user.lastDate !== today) {
            user.chatCount = 0;
            user.lastDate = today;
        }
        if (user.chatCount >= 50) {
            return res.json({ 
                result: "Limit harian (50 chat) habis. Ayo upgrade ke Premium cuma Rp500 seumur hidup!",
                isPremium: false 
            });
        }
    }

    try {
        // Panggil API Klyna
        const response = await axios.get(`https://klyna-swart.vercel.app/api/chat`, {
            params: { key: KLYNA_KEY, text: text }
        });

        // Parsing Respon agar tidak [object Object]
        let reply = "";
        if (typeof response.data === 'string') {
            reply = response.data;
        } else {
            reply = response.data.result || response.data.reply || JSON.stringify(response.data);
        }

        // Tambah hitungan chat jika bukan premium
        if (!user.isPremium) {
            user.chatCount += 1;
        }

        await updateDB(db);
        res.json({ result: reply, isPremium: user.isPremium });

    } catch (error) {
        res.json({ result: "Maaf, Klyna AI sedang mengalami gangguan koneksi." });
    }
});

// 3. Create QRIS (Rp 500)
app.get('/api/pay-create', async (req, res) => {
    try {
        const response = await axios.get(`https://bior-beta.vercel.app/api/pay`, {
            params: { key: RPY_KEY, amt: 500 }
        });
        res.json(response.data);
    } catch (e) {
        res.status(500).json({ success: false, msg: "Gagal membuat QRIS" });
    }
});

// 4. Check Status Pembayaran
app.post('/api/pay-check', async (req, res) => {
    const { username, trxId } = req.body;
    try {
        const response = await axios.get(`https://bior-beta.vercel.app/api/pay`, {
            params: { action: 'check', trxId: trxId }
        });

        if (response.data.success && response.data.paid) {
            let db = await getDB();
            if (db.users[username]) {
                db.users[username].isPremium = true;
                await updateDB(db);
                return res.json({ success: true, msg: "Pembayaran Berhasil!" });
            }
        }
        res.json({ success: false, msg: "Belum dibayar" });
    } catch (e) {
        res.json({ success: false, msg: "Error pengecekan" });
    }
});

// Export untuk Vercel
module.exports = app;
