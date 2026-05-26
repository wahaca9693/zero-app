import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@libsql/client';
import multer from 'multer';
import fs from 'fs';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = 3000;

// Setup Turso Client
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

// Create uploads directory if not exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

app.use(express.json());

// Helper: Get real IP behind proxy
function getRealIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return (forwarded as string).split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// Helper: Detect VPN/Proxy usage
async function detectVPN(ip: string, userAgent: string): Promise<{isVPN: boolean, message: string}> {
  // Allow localhost/private IPs
  if (ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return { isVPN: false, message: '' };
  }
  
  // Check common VPN/Proxy indicators in headers
  if (userAgent.includes('Opera') || userAgent.includes('Nord') || 
      userAgent.includes('ExpressVPN') || userAgent.includes(' ProtonVPN') ||
      userAgent.includes('TunnelBear') || userAgent.includes('Hotspot Shield') ||
      userAgent.includes('CyberGhost') || userAgent.includes('HideMyAss') ||
      userAgent.includes('Surfshark') || userAgent.includes('PureVPN')) {
    return { isVPN: true, message: 'تم الكشف عن استخدام VPN. يرجى إيقاف VPN لاستخدام الموقع.' };
  }
  
  return { isVPN: false, message: '' };
}

// Middleware: Block VPN and one account per IP
app.use(async (req, res, next) => {
  const clientIp = getRealIp(req);
  const userAgent = req.headers['user-agent'] || '';
  (req as any).clientIp = clientIp;
  
  // Skip middleware for existing server routes that need DB
  if (!db) {
    return next();
  }
  
  // Skip for non-POST user routes (login/update)
  if (req.path.endsWith('/users') && req.method === 'PUT') {
    return next();
  }
  
  // Check for VPN usage
  const vpnCheck = await detectVPN(clientIp, userAgent);
  if (vpnCheck.isVPN) {
    return res.status(403).json({ 
      error: vpnCheck.message,
      vpnDetected: true,
      instruction: 'يرجى إيقاف VPN ثم أعد تحميل الصفحة'
    });
  }
  
  // Check if requesting account creation - enforce one account per IP
  if (req.path.includes('register') || (req.path === '/api/v1/users' && req.method === 'POST')) {
    try {
      const existingUser = await db.execute({
        sql: 'SELECT uid, ipAddress FROM users WHERE ipAddress = ?',
        args: [clientIp]
      });
      if (existingUser.rows.length > 0) {
        return res.status(403).json({ 
          error: 'تم إنشاء حساب واحد بالفعل من هذا الاتصال. لا يمكن إنشاء حسابات أخرى.',
          vpnDetected: false
        });
      }
    } catch (e) {
      // Continue if table doesn't exist yet
    }
  }
  next();
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[API] ${req.method} ${req.path}`);
  }
  next();
});
app.use('/uploads', express.static(uploadsDir));

// Initialize Database Tables
async function initDB() {
  try {
    // Users table - with IP tracking and one account per IP
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
        createdAt INTEGER,
        lastLogin INTEGER,
        isVPN INTEGER DEFAULT 0
      )
    `);
    
    // Videos table - with real view/like tracking
    await db.execute(`
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        category TEXT,
        isShort INTEGER,
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
        likes TEXT,
        videoPath TEXT,
        thumbPath TEXT
      )
    `);
    
    // Views table - track each view with IP and timestamp
    await db.execute(`
      CREATE TABLE IF NOT EXISTS video_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        videoId TEXT,
        ipAddress TEXT,
        viewedAt INTEGER,
       userAgent TEXT
      )
    `);
    
    // Comments table
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
    `);
    console.log('Turso Database initialized');
  } catch (err) {
    console.error('Failed to initialize Turso:', err);
  }
}

// API Routes
app.get('/api/v1/videos', async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT v.*, u.avatar as currentAvatar
      FROM videos v
      LEFT JOIN users u ON v.userId = u.uid
      ORDER BY v.uploadTimestamp DESC
    `);
    const videos = result.rows.map(row => ({
      ...row,
      channelAvatar: row.currentAvatar || row.channelAvatar || DEFAULT_AVATAR,
      isShort: Boolean(row.isShort),
      likes: JSON.parse(row.likes as string || '[]')
    }));
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

app.post('/api/v1/videos', upload.fields([{ name: 'video' }, { name: 'thumbnail' }]), async (req, res) => {
  try {
    const { uid, title, description, category, isShort, duration } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    const vId = `vid_${Date.now()}`;
    const videoFile = files.video?.[0];
    const thumbFile = files.thumbnail?.[0];

    // Get user data
    const userRes = await db.execute({
      sql: 'SELECT * FROM users WHERE uid = ?',
      args: [uid]
    });
    const user = userRes.rows[0];

    const videoUrl = videoFile ? `/uploads/${videoFile.filename}` : '';
    const thumbnailUrl = thumbFile ? `/uploads/${thumbFile.filename}` : '';

    const newVideo = {
      id: vId,
      title,
      description,
      category,
      isShort: isShort === 'true',
      duration: duration || '00:00',
      src: videoUrl || req.body.videoUrl || '',
      thumbnail: thumbnailUrl || req.body.thumbnailUrl || '',
      channelName: user?.username || 'GUEST',
      channelAvatar: (user?.avatar as string) || DEFAULT_AVATAR,
      userId: uid,
      uploadTimestamp: Date.now(),
      uploadDate: new Date().toLocaleDateString('ar-EG'),
      viewsCount: 0,
      likesCount: 0,
      likes: [] as string[],
      videoPath: videoFile?.filename || null,
      thumbPath: thumbFile?.filename || null
    };

    await db.execute({
      sql: `INSERT INTO videos (id, title, description, category, isShort, duration, src, thumbnail, channelName, channelAvatar, userId, uploadTimestamp, uploadDate, viewsCount, likesCount, likes, videoPath, thumbPath)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        newVideo.id, newVideo.title, newVideo.description, newVideo.category, newVideo.isShort ? 1 : 0, newVideo.duration,
        newVideo.src, newVideo.thumbnail, newVideo.channelName, newVideo.channelAvatar, newVideo.userId,
        newVideo.uploadTimestamp, newVideo.uploadDate, 0, 0, '[]',
        newVideo.videoPath, newVideo.thumbPath
      ]
    });

    res.json(newVideo);
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60';

app.post('/api/v1/users', async (req, res) => {
  const { uid, username, email } = req.body;
  try {
    await db.execute({
      sql: `INSERT INTO users (uid, username, email, avatar, banner, subscriptions) 
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(uid) DO UPDATE SET 
              username = excluded.username,
              email = excluded.email`,
      args: [uid, username, email, DEFAULT_AVATAR, '', '[]']
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

app.get('/api/v1/users/:uid', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE uid = ?',
      args: [req.params.uid]
    });
    if (result.rows.length > 0) {
      const user = result.rows[0];
      res.json({
        ...user,
        avatar: user.avatar || DEFAULT_AVATAR,
        banner: user.banner || '',
        subscriptions: JSON.parse(user.subscriptions as string || '[]')
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

app.post('/api/v1/users/:uid/update', upload.fields([{ name: 'avatar' }, { name: 'banner' }]), async (req, res) => {
  try {
    const { uid } = req.params;
    const { username, description } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    const userRes = await db.execute({
      sql: 'SELECT * FROM users WHERE uid = ?',
      args: [uid]
    });
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = userRes.rows[0];
    let avatarUrl = (user.avatar as string) || '';
    let bannerUrl = (user.banner as string) || '';

    if (files.avatar?.[0]) {
      avatarUrl = `/uploads/${files.avatar[0].filename}`;
    }
    if (files.banner?.[0]) {
      bannerUrl = `/uploads/${files.banner[0].filename}`;
    }

    await db.execute({
      sql: 'UPDATE users SET username = ?, description = ?, avatar = ?, banner = ? WHERE uid = ?',
      args: [username, description, avatarUrl, bannerUrl, uid]
    });

    res.json({ success: true, avatar: avatarUrl, banner: bannerUrl });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

app.post('/api/v1/videos/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const { uid, ipAddress } = req.body;
    const clientIp = ipAddress || req.ip || req.socket.remoteAddress || 'unknown';
    const vRes = await db.execute({ sql: 'SELECT * FROM videos WHERE id = ?', args: [id] });
    if (vRes.rows.length === 0) return res.status(404).json({ error: 'Video not found' });

    const video = vRes.rows[0];
    let likes = JSON.parse(video.likes as string || '[]') as string[];
    
    // Toggle like/unlike
    const userKey = uid || clientIp;
    if (likes.includes(userKey)) {
      // Unlike - remove
      likes = likes.filter(l => l !== userKey);
    } else {
      // Like - add
      likes.push(userKey);
    }

    await db.execute({
      sql: 'UPDATE videos SET likes = ?, likesCount = ? WHERE id = ?',
      args: [JSON.stringify(likes), likes.length, id]
    });

    res.json({ hasLiked: likes.includes(userKey), totalLikes: likes.length });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

app.get('/api/v1/videos/:id/comments', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM comments WHERE videoId = ? ORDER BY timestamp DESC',
      args: [req.params.id]
    });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

app.post('/api/v1/videos/:id/comments', async (req, res) => {
  try {
    const { id: videoId } = req.params;
    const { uid, text } = req.body;
    const cId = `cmt_${Date.now()}`;

    const userRes = await db.execute({ sql: 'SELECT * FROM users WHERE uid = ?', args: [uid] });
    const user = userRes.rows[0];

    const newComment = {
      id: cId,
      videoId,
      userId: uid,
      authorName: user?.username as string || 'GUEST',
      authorAvatar: (user?.avatar as string) || '',
      text,
      timestamp: Date.now(),
      dateString: new Date().toISOString()
    };

    await db.execute({
      sql: 'INSERT INTO comments (id, videoId, userId, authorName, authorAvatar, text, timestamp, dateString) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [newComment.id, newComment.videoId, newComment.userId, newComment.authorName, newComment.authorAvatar, newComment.text, newComment.timestamp, newComment.dateString]
    });

    res.json(newComment);
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

app.post('/api/v1/videos/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const now = Date.now();
    
    // Check if this IP already viewed this video in last hour (anti-fraud)
    const existingView = await db.execute({
      sql: `SELECT * FROM video_views WHERE videoId = ? AND ipAddress = ? AND viewedAt > ?`,
      args: [id, clientIp, now - 3600000] // 1 hour cooldown
    });
    
    if (existingView.rows.length === 0) {
      // New valid view - record it
      await db.execute({
        sql: 'INSERT INTO video_views (videoId, ipAddress, viewedAt, userAgent) VALUES (?, ?, ?, ?)',
        args: [id, clientIp, now, userAgent]
      });
      
      // Update videos set count based on unique IPs
      await db.execute({
        sql: `UPDATE videos SET viewsCount = (
          SELECT COUNT(DISTINCT ipAddress) FROM video_views WHERE videoId = ?
        ) WHERE id = ?`,
        args: [id, id]
      });
    }
    
    const res2 = await db.execute({ sql: 'SELECT viewsCount FROM videos WHERE id = ?', args: [id] });
    res.json({ viewsCount: res2.rows[0]?.viewsCount || 0 });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

app.delete('/api/v1/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { uid } = req.body as { uid?: string };
    const vRes = await db.execute({ sql: 'SELECT * FROM videos WHERE id = ?', args: [id] });
    if (vRes.rows.length === 0) return res.status(404).json({ error: 'Video not found' });
    
    const video = vRes.rows[0];
    
    // Server-side ownership check - only owner can delete
    if (uid && video.userId !== uid) {
      return res.status(403).json({ error: 'ليس لديك إذن لحذف هذا الفيديو' });
    }
    if (!uid) {
      return res.status(401).json({ error: 'يرجى تسجيل الدخول أولاً' });
    }
    
    // Delete files if they exist
    if (video.videoPath) {
      const p = path.join(process.cwd(), 'uploads', video.videoPath as string);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    if (video.thumbPath) {
      const p = path.join(process.cwd(), 'uploads', video.thumbPath as string);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    await db.execute({ sql: 'DELETE FROM videos WHERE id = ?', args: [id] });
    await db.execute({ sql: 'DELETE FROM comments WHERE videoId = ?', args: [id] });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

app.post('/api/v1/users/:uid/subscribe', async (req, res) => {
  try {
    const { uid } = req.params;
    const { channelName } = req.body;
    const userRes = await db.execute({ sql: 'SELECT * FROM users WHERE uid = ?', args: [uid] });
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = userRes.rows[0];
    let subscriptions = JSON.parse(user.subscriptions as string || '[]') as string[];
    if (subscriptions.includes(channelName)) {
      subscriptions = subscriptions.filter(s => s !== channelName);
    } else {
      subscriptions.push(channelName);
    }

    await db.execute({
      sql: 'UPDATE users SET subscriptions = ? WHERE uid = ?',
      args: [JSON.stringify(subscriptions), uid]
    });

    res.json({ success: true, subscriptions });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

app.post('/api/v1/admin/wipe', async (req, res) => {
  try {
    await db.execute('DELETE FROM videos');
    await db.execute('DELETE FROM users');
    await db.execute('DELETE FROM comments');
    
    // Clear uploads
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
      if (file !== '.gitkeep') {
        fs.unlinkSync(path.join(uploadsDir, file));
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

async function downloadFile(url: string, destPath: string): Promise<string> {
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    timeout: 30000, // 30 seconds timeout
  });

  const writer = fs.createWriteStream(destPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(destPath));
    writer.on('error', reject);
  });
}

app.post('/api/v1/videos/import', async (req, res) => {
  try {
    const { url, uid, title, description, category, thumbnailUrl, duration, isShort } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const vId = `vid_import_${Date.now()}`;
    const videoFilename = `${vId}.mp4`;
    const videoDest = path.join(uploadsDir, videoFilename);
    
    const thumbFilename = thumbnailUrl ? `${vId}_thumb.jpg` : null;
    const thumbDest = thumbFilename ? path.join(uploadsDir, thumbFilename) : null;

    // Get user data
    const userRes = await db.execute({
      sql: 'SELECT * FROM users WHERE uid = ?',
      args: [uid]
    });
    const user = userRes.rows[0];

    // Attempt to download video
    console.log(`Starting import download for: ${url}`);
    
    // Scrape duration for YouTube links
    let scrapedDuration = duration;
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      try {
        const ytId = url.includes('v=') ? url.split('v=')[1].split('&')[0] : url.split('/').pop();
        const { data: html } = await axios.get(`https://www.youtube.com/watch?v=${ytId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const durationMatch = html.match(/"lengthSeconds":"(\d+)"/);
        if (durationMatch) {
          const totalSeconds = parseInt(durationMatch[1]);
          const mins = Math.floor(totalSeconds / 60);
          const secs = totalSeconds % 60;
          scrapedDuration = `${mins < 10 ? '0' + mins : mins}:${secs < 10 ? '0' + secs : secs}`;
          console.log(`Scraped duration: ${scrapedDuration}`);
        }
      } catch (err) {
        console.warn('Failed to scrape duration from YouTube page', err);
      }
    }
    
    // We only download if it's a direct mp4 link or similar.
    // If it's a YouTube link, we might want to use a downloader BUT 
    // for this demo we will simulate the download if it's a direct link.
    // In a real prod app, use a service like Cobalt or yt-dlp.
    
    let finalVideoUrl = url;
    let videoPath = null;

    if (url.includes('.mp4') || url.includes('.mov') || url.includes('commondatastorage')) {
      try {
        await downloadFile(url, videoDest);
        finalVideoUrl = `/uploads/${videoFilename}`;
        videoPath = videoFilename;
        console.log(`Video downloaded successfully to ${videoDest}`);
      } catch (err) {
        console.warn('Failed to download video file on server, using fallback external URL', err);
      }
    }

    let finalThumbnailUrl = thumbnailUrl || '';
    let thumbPath = null;
    if (thumbnailUrl && (thumbnailUrl.includes('.jpg') || thumbnailUrl.includes('.png') || thumbnailUrl.includes('.webp'))) {
      try {
        if (thumbDest) {
          await downloadFile(thumbnailUrl, thumbDest);
          finalThumbnailUrl = `/uploads/${thumbFilename}`;
          thumbPath = thumbFilename;
          console.log(`Thumbnail downloaded successfully to ${thumbDest}`);
        }
      } catch (err) {
        console.warn('Failed to download thumbnail on server', err);
      }
    }

    const newVideo = {
      id: vId,
      title: title || 'فيديو مستورد',
      description: description || '',
      category: category || 'عام',
      isShort: isShort === true || isShort === 'true',
      duration: scrapedDuration || duration || '00:00',
      src: finalVideoUrl,
      thumbnail: finalThumbnailUrl || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&auto=format&fit=crop&q=60',
      channelName: user?.username || 'GUEST',
      channelAvatar: (user?.avatar as string) || DEFAULT_AVATAR,
      userId: uid,
      uploadTimestamp: Date.now(),
      uploadDate: new Date().toLocaleDateString('ar-EG'),
      viewsCount: 0,
      likesCount: 0,
      likes: '[]',
      videoPath: videoPath,
      thumbPath: thumbPath
    };

    await db.execute({
      sql: `INSERT INTO videos (id, title, description, category, isShort, duration, src, thumbnail, channelName, channelAvatar, userId, uploadTimestamp, uploadDate, viewsCount, likesCount, likes, videoPath, thumbPath)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        newVideo.id, newVideo.title, newVideo.description, newVideo.category, newVideo.isShort ? 1 : 0, newVideo.duration,
        newVideo.src, newVideo.thumbnail, newVideo.channelName, newVideo.channelAvatar, newVideo.userId,
        newVideo.uploadTimestamp, newVideo.uploadDate, 0, 0, '[]',
        newVideo.videoPath, newVideo.thumbPath
      ]
    });

    res.json(newVideo);
  } catch (err) {
    console.error('Import Error:', err);
    res.status(500).json({ error: (err as any).message });
  }
});

// Catch-all for API routes before SPA fallback
app.all('/api/v1/*', (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// Serve frontend assets
async function startServer() {
  await initDB();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`YouTube Flare Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
