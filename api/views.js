// /api/views.js
//
// Counts profile views by IP address: each unique visitor IP is counted
// once, no matter how many times they reload the page. The raw IP is
// never stored — only a salted SHA-256 hash of it — so this doesn't
// keep a personally identifiable log of visitors.
//
// Requires a Vercel KV (Upstash Redis) database connected to this
// project. In the Vercel dashboard: Storage -> Create Database -> KV,
// then connect it to this project. That automatically sets the
// KV_REST_API_URL / KV_REST_API_TOKEN env vars this function needs.
//
// Optional: set a VIEWS_SALT env var (any random string) to make the
// IP hashes unique to your deployment.

const crypto = require('crypto');
const { kv } = require('@vercel/kv');

const UNIQUE_IPS_SET = 'profile:unique_view_ips';

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // x-forwarded-for can be a comma-separated list; the first entry
        // is the original client.
        return forwarded.split(',')[0].trim();
    }
    return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

function hashIp(ip) {
    const salt = process.env.VIEWS_SALT || 'default-salt-change-me';
    return crypto.createHash('sha256').update(ip + salt).digest('hex');
}

module.exports = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');

    try {
        const ip = getClientIp(req);
        const hashed = hashIp(ip);

        // sadd returns 1 if this hash was newly added, 0 if it was already there
        const isNewView = await kv.sadd(UNIQUE_IPS_SET, hashed);
        const total = await kv.scard(UNIQUE_IPS_SET);

        return res.status(200).json({
            views: total,
            countedThisRequest: isNewView === 1
        });
    } catch (err) {
        console.error('views api error:', err);
        return res.status(500).json({ error: 'views_unavailable' });
    }
};
