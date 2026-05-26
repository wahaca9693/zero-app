import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

// Get Videos
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { method, url } = req;
    const path = url?.split('?')[0] || '';

    // Videos endpoints
    if (path === '/' || path === '/videos') {
      if (method === 'GET') {
        const result = await db.execute('SELECT * FROM videos ORDER BY uploadTimestamp DESC');
        return res.json(result.rows);
      }
      if (method === 'POST') {
        const { title, description, category, src, thumbnail, channelName, duration, isShort } = req.body;
        const id = `vid_${Date.now()}`;
        await db.execute(
          `INSERT INTO videos (id, title, description, category, src, thumbnail, channelName, duration, isShort, viewsCount, likesCount, likes, uploadTimestamp, uploadDate, userId, videoPath, thumbPath, currentAvatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, '[]', ?, ?, ?, NULL, NULL, NULL)`,
          [id, title, description, category, src, thumbnail, channelName, duration || '0:00', isShort || false, Date.now(), new Date().toLocaleDateString('ar-SA'), req.body.uid || 'guest']
        );
        return res.json({ success: true, id });
      }
    }

    // Video by ID
    if (path.startsWith('/videos/')) {
      const videoId = path.split('/')[2];
      
      if (method === 'GET') {
        const result = await db.execute('SELECT * FROM videos WHERE id = ?', [videoId]);
        return res.json(result.rows[0] || null);
      }
      
      if (method === 'DELETE') {
        await db.execute('DELETE FROM videos WHERE id = ?', [videoId]);
        return res.json({ success: true });
      }
    }

    // Like endpoint
    if (path.includes('/like')) {
      const videoId = path.split('/')[2];
      const { uid } = req.body;
      const video = await db.execute('SELECT * FROM videos WHERE id = ?', [videoId]);
      
      if (video.rows.length === 0) {
        return res.status(404).json({ error: 'Video not found' });
      }
      
      const videoData = video.rows[0];
      let likes = JSON.parse((videoData.likes as string) || '[]');
      const userKey = uid || req.connection?.remoteAddress || 'unknown';
      
      // Toggle like/unlike
      if (likes.includes(userKey)) {
        likes = likes.filter((l: string) => l !== userKey);
      } else {
        likes.push(userKey);
      }
      
      await db.execute('UPDATE videos SET likes = ?, likesCount = ? WHERE id = ?', [
        JSON.stringify(likes), likes.length, videoId
      ]);
      
      return res.json({ hasLiked: likes.includes(userKey), totalLikes: likes.length });
    }

    // Users endpoints
    if (path === '/users' && method === 'POST') {
      const { uid, username, avatar, description, ipAddress } = req.body;
      
      // Check existing account per IP
      if (ipAddress) {
        const existing = await db.execute('SELECT uid FROM users WHERE ipAddress = ?', [ipAddress]);
        if (existing.rows.length > 0) {
          return res.status(403).json({ error: 'تم إنشاء حساب واحد بالفعل من هذا الاتصال' });
        }
      }
      
      await db.execute(
        `INSERT OR REPLACE INTO users (uid, username, avatar, description, ipAddress, subscriptions) VALUES (?, ?, ?, ?, ?, '[]')`,
        [uid, username, avatar || '', description || '', ipAddress || '']
      );
      return res.json({ success: true });
    }

    // Serve static files (optional - for uploaded files)
    if (method === 'GET' && path.startsWith('/uploads/')) {
      const filePath = path.replace('/uploads/', '');
      // In production, you'd serve from S3 or similar
      return res.status(404).json({ error: 'File not found' });
    }

    return res.json({ error: 'Endpoint not found' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}