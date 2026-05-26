import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create tables
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        uid TEXT PRIMARY KEY,
        username TEXT,
        email TEXT,
        avatar TEXT,
        banner TEXT,
        description TEXT,
        subscriptions TEXT,
        ipAddress TEXT,
        createdAt INTEGER
      )
    `;

    await db.execute(`
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        category TEXT,
        isShort INTEGER DEFAULT 0,
        duration TEXT,
        src TEXT,
        thumbnail TEXT,
        channelName TEXT,
        channelAvatar TEXT,
        userId TEXT,
        uploadTimestamp INTEGER,
        uploadDate TEXT,
        viewsCount INTEGER DEFAULT 0,
        likesCount INTEGER DEFAULT 0,
        likes TEXT DEFAULT '[]'
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        videoId TEXT,
        userId TEXT,
        authorName TEXT,
        authorAvatar TEXT,
        text TEXT,
        timestamp INTEGER,
        dateString TEXT
      )
    `;

    await db.execute(`
      CREATE TABLE IF NOT EXISTS video_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        videoId TEXT,
        ipAddress TEXT,
        viewedAt INTEGER,
        userAgent TEXT
      )
    `);

    return res.json({ success: true, message: 'Tables created successfully' });
  } catch (error: any) {
    console.error('Init error:', error);
    return res.status(500).json({ error: error.message });
  }
}