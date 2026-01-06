const express = require('express');
const Client = require('bitcoin-core');
const axios = require('axios');
const path = require('path');

const app = express();
const port = process.env.APP_PORT || 3015;

const bch = new Client({
    host: process.env.BCH_RPC_HOST || 'host.docker.internal',
    port: process.env.BCH_RPC_PORT || 8332,
    username: process.env.BCH_RPC_USER || 'admin',
    password: process.env.BCH_RPC_PASS || 'password'
});

app.use(express.static('public'));

app.get('/api/stats', async (req, res) => {
    try {
        const [bc, net, mem, priceRes, networkTipRes] = await Promise.all([
            bch.getBlockchainInfo(),
            bch.getNetworkInfo(),
            bch.getMempoolInfo(),
            axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin-cash&vs_currencies=usd'),
            // Fetching the global best block height for health comparison
            axios.get('https://blockchain.info/q/getblockcount') 
        ]);

        const localHeight = bc.blocks;
        const networkHeight = parseInt(networkTipRes.data);
        const diff = networkHeight - localHeight;
        const version = net.subversion

        res.json({
            blocks: localHeight,
            networkBlocks: networkHeight,
            peers: net.connections,
            mempool: mem.size,
            price: priceRes.data['bitcoin-cash'].usd,
            // Health Logic: Healthy if diff <= 1 block
            health: diff <= 1 ? 'Healthy' : (diff > 50 ? 'Syncing' : 'Lagging'),
            diff: diff,
            version: version
        });
    } catch (error) {
        res.status(500).json({ health: 'Offline' });
    }
});

app.listen(port, () => console.log(`BCH Dash listening on port ${port}`));
