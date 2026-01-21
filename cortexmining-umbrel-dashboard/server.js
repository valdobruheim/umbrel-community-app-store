const express = require('express');
const net = require('net');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3099;
const DATA_FILE = path.join(__dirname, 'cortex-data', 'miners.json');

// Simple "database" for miners
// const miners = [
//     { name: "AvalonQ-01", ip: "192.168.1.71", type: "avalon" },
//     { name: "NerdQAxe-01", ip: "192.168.1.31", type: "nerdaxe" }
// ];

app.use(express.json());
app.use(express.static('public'));

// Helper: Read miners from file
const getMiners = () => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
};

// Helper: Save miners to file
const saveMiners = (miners) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(miners, null, 2));
};

// --- MINER API ROUTES ---

// Get all miners with their live stats
app.get('/api/stats', async (req, res) => {
    const miners = getMiners();
    const results = await Promise.all(miners.map(async (m) => {
        let stats = null;
        try {
            if (m.type === 'avalon') {
                stats = await queryAvalon(m.ip);
            } else {
                stats = await queryNerdaxe(m.ip);
            }
        } catch (e) { stats = null; }
        return { ...m, stats, online: !!stats };
    }));
    res.json(results);
});

// Add a new miner
app.post('/api/miners', (req, res) => {
    const { name, ip, type } = req.body;
    if (!name || !ip || !type) return res.status(400).json({ error: 'Missing data' });

    const miners = getMiners();
    const newMiner = { id: Date.now(), name, ip, type };
    miners.push(newMiner);
    saveMiners(miners);
    
    res.json({ success: true, miner: newMiner });
});

// Delete a miner
app.delete('/api/miners/:id', (req, res) => {
    let miners = getMiners();
    miners = miners.filter(m => m.id != req.params.id);
    saveMiners(miners);
    res.json({ success: true });
});

// Helper to query Avalon Q via TCP Socket (Port 4028)
const queryAvalon = (ip) => {
    return new Promise((resolve) => {
        const client = new net.Socket();
        let response = '';

        client.setTimeout(2000);
        client.connect(4028, ip, () => {
            // Requesting summary in JSON format
            client.write(JSON.stringify({ command: "summary" }));
        });

        client.on('data', (data) => {
            response += data.toString().replace(/\0/g, '');
        });

        client.on('end', () => {
            try { resolve(JSON.parse(response)); } 
            catch { resolve(null); }
        });

        client.on('error', () => resolve(null));
        client.on('timeout', () => { client.destroy(); resolve(null); });
    });
};


function parseAvalonResponse(rawStr) {
    const sections = rawStr.split('|');
    const result = {};

    sections.forEach(section => {
        if (!section.includes(',')) return;
        
        // Split section name (e.g., SUMMARY) from its data
        const parts = section.split(',');
        const sectionNamePart = parts[0].split('=');
        const sectionName = sectionNamePart.length > 1 ? sectionNamePart[0] : parts[0];
        
        const data = {};
        parts.forEach(kv => {
            const [key, value] = kv.split('=');
            if (key && value) {
                // Convert to number if possible, otherwise keep as string
                data[key] = isNaN(value) ? value : parseFloat(value);
            }
        });
        
        // Avalon often has multiple STATS, so we store them in an array
        if (!result[sectionName]) result[sectionName] = [];
        result[sectionName].push(data);
    });
    return result;
}

// Helper to query NerdAxe via HTTP API
//const queryNerdaxe = async (ip) => {
// try {
//        const res = await axios.get(`http://${ip}/api/stats`, { timeout: 2000 });
//        return res.data;
//    } catch { return null; }
//};

async function queryNerdaxe(ip) {
    try {
        // NerdAxes/Bitaxes usually expose a JSON API over port 80
        const response = await axios.get(`http://${ip}/api/system/info`, { timeout: 3000 });
        const data = response.data;

        // Map the NerdAxe fields to the ones your dashboard expects
        return {
            hashrate: data.hashRate || 0, // usually in GH/s
            asicTemp: data.temp || 0,
            vrTemp: data.vrTemp || 0,
            power: data.power || 0,
            voltage: data.voltage || 0,
            current: data.current || 0,
            fanRpm: data.fanrpm || 0,
            fanSpeed: data.fanspeed || 0,
            uptime: data.uptimeSeconds || 0,
            bestDiff: data.bestDiff || 0,
            bestSessionDiff: data.bestSessionDiff || 0
        };
    } catch (e) {
        // Fallback: Some firmware versions use /api/stats
        try {
            const altResponse = await axios.get(`http://${ip}/api/stats`, { timeout: 2000 });
            return {
                hashrate: altResponse.data.hashRate,
                temp: altResponse.data.temp,
                fan: altResponse.data.fanSpeed
            };
        } catch (err) {
            console.error(`NerdAxe ${ip} offline`);
            return null;
        }
    }
}

// Unified API Endpoint
app.get('/api/stats', async (req, res) => {
    const results = await Promise.all(miners.map(async (m) => {
        const stats = m.type === 'avalon' ? await queryAvalon(m.ip) : await queryNerdaxe(m.ip);
        return { ...m, stats, online: !!stats };
    }));
    res.json(results);
});

app.use(express.static('public')); // Serve your index.html from a 'public' folder
app.listen(PORT, () => console.log(`Cortex active on http://localhost:${PORT}`));