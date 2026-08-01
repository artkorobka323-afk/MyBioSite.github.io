// /api/comments.js
//
// GET  -> returns the shared list of comments (visible to every visitor)
// POST -> adds a comment, but only if this visitor's IP hasn't already
//         posted 3 comments. The limit is enforced server-side (based on
//         a salted hash of the IP, not the raw IP) so it can't be
//         bypassed by clearing localStorage or using another browser on
//         the same connection.
//
// Requires a Vercel KV (Upstash Redis) database connected to this
// project (Storage -> Create Database -> KV in the Vercel dashboard).

const crypto = require('crypto');
const { kv } = require('@vercel/kv');

const COMMENTS_LIST_KEY = 'profile:comments_list';
const COMMENT_COUNTS_KEY = 'profile:comment_counts_by_ip';
const MAX_COMMENTS_PER_IP = 3;
const MAX_STORED_COMMENTS = 500;
const MAX_NAME_LENGTH = 30;
const MAX_TEXT_LENGTH = 300;
const ALLOWED_AVATARS = ['a1', 'a2', 'a3'];

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

function hashIp(ip) {
    const salt = process.env.VIEWS_SALT || 'default-salt-change-me';
    return crypto.createHash('sha256').update(ip + salt).digest('hex');
}

async function handleGet(req, res) {
    const raw = await kv.lrange(COMMENTS_LIST_KEY, 0, -1);
    const comments = (raw || [])
        .map((entry) => {
            try {
                // @vercel/kv may already parse JSON values for us depending on version,
                // so accept both a string and an already-parsed object.
                return typeof entry === 'string' ? JSON.parse(entry) : entry;
            } catch (e) {
                return null;
            }
        })
        .filter(Boolean);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ comments });
}

async function handlePost(req, res) {
    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const name = String(body.name || '').trim().slice(0, MAX_NAME_LENGTH);
    const text = String(body.text || '').trim().slice(0, MAX_TEXT_LENGTH);
    const avatar = ALLOWED_AVATARS.includes(body.avatar) ? body.avatar : ALLOWED_AVATARS[0];

    if (!name || !text) {
        return res.status(400).json({ error: 'invalid_input', message: 'Name and comment text are required.' });
    }

    const ip = getClientIp(req);
    const hashedIp = hashIp(ip);

    // Atomically increment this IP's comment count and check the limit.
    const newCount = await kv.hincrby(COMMENT_COUNTS_KEY, hashedIp, 1);
    if (newCount > MAX_COMMENTS_PER_IP) {
        // Revert the increment since this comment is being rejected.
        await kv.hincrby(COMMENT_COUNTS_KEY, hashedIp, -1);
        return res.status(429).json({
            error: 'limit_reached',
            message: `Comment limit reached (${MAX_COMMENTS_PER_IP} per IP).`
        });
    }

    const comment = {
        id: crypto.randomUUID(),
        name,
        text,
        avatar,
        date: new Date().toISOString()
    };

    await kv.rpush(COMMENTS_LIST_KEY, JSON.stringify(comment));
    // Cap the stored list so it doesn't grow forever.
    await kv.ltrim(COMMENTS_LIST_KEY, -MAX_STORED_COMMENTS, -1);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ comment, remaining: MAX_COMMENTS_PER_IP - newCount });
}

module.exports = async (req, res) => {
    try {
        if (req.method === 'GET') return await handleGet(req, res);
        if (req.method === 'POST') return await handlePost(req, res);
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: 'method_not_allowed' });
    } catch (err) {
        console.error('comments api error:', err);
        return res.status(500).json({ error: 'comments_unavailable' });
    }
};
