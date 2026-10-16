import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@libsql/client';
import multer from 'multer';
import fs from 'fs';
import dotenv from 'dotenv';
import axios from 'axios';
import crypto from 'crypto';

dotenv.config();

const app = express();
// Trust the first proxy (Railway / Vercel / nginx...) so req.ip is the real client IP
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;

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
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    // Only allow real video/image uploads — blocks scripts & executables
    const field = file.fieldname;
    const isVideo = file.mimetype.startsWith('video/');
    const isImage = file.mimetype.startsWith('image/');
    const ok =
      (field === 'video' && isVideo) ||
      (['thumbnail', 'avatar', 'banner'].includes(field) && isImage);
    if (!ok) {
      cb(new Error(`نوع الملف غير مسموح: ${file.mimetype || 'غير معروف'}`));
      return;
    }
    cb(null, true);
  }
});

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
    // Migration: password-hash column for real login (older databases lack it)
    try {
      await db.execute('ALTER TABLE users ADD COLUMN passwordHash TEXT');
    } catch {
      /* column already exists */
    }
    
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
        thumbPath TEXT,
        visibility TEXT DEFAULT 'public'
      )
    `);

    // Safe migration for DBs created before the visibility column existed
    try { await db.execute(`ALTER TABLE videos ADD COLUMN visibility TEXT DEFAULT 'public'`); } catch {}
    
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
    // YouTube-style visibility: public for everyone; unlisted/private only for the owner
    const uid = (req.query.uid as string) || '';
    const result = await db.execute(`
      SELECT v.*, u.avatar as currentAvatar
      FROM videos v
      LEFT JOIN users u ON v.userId = u.uid
      WHERE COALESCE(v.visibility, 'public') = 'public'
         OR v.userId = '${uid.replace(/'/g, "''")}'
      ORDER BY v.uploadTimestamp DESC
    `);
    const videos = result.rows.map(row => ({
      ...row,
      channelAvatar: row.currentAvatar || row.channelAvatar || DEFAULT_AVATAR,
      isShort: Boolean(row.isShort),
      likes: parseLikes(row.likes),
      views: String(row.viewsCount ?? 0)
    }));
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

app.post('/api/v1/videos', upload.fields([{ name: 'video' }, { name: 'thumbnail' }]), async (req, res) => {
  try {
    const { uid, title, description, category, isShort, duration, visibility } = req.body;
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
      thumbPath: thumbFile?.filename || null,
      visibility: ['public', 'unlisted', 'private'].includes(req.body.visibility) ? req.body.visibility : 'public'
    };

    await db.execute({
      sql: `INSERT INTO videos (id, title, description, category, isShort, duration, src, thumbnail, channelName, channelAvatar, userId, uploadTimestamp, uploadDate, viewsCount, likesCount, likes, videoPath, thumbPath, visibility)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        newVideo.id, newVideo.title, newVideo.description, newVideo.category, newVideo.isShort ? 1 : 0, newVideo.duration,
        newVideo.src, newVideo.thumbnail, newVideo.channelName, newVideo.channelAvatar, newVideo.userId,
        newVideo.uploadTimestamp, newVideo.uploadDate, 0, 0, '[]',
        newVideo.videoPath, newVideo.thumbPath, newVideo.visibility
      ]
    });

    res.json({ ...newVideo, likes: 0, views: '0' });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

// YouTube-style staged upload, step 1: receive the raw file FIRST (with real
// XHR progress on the client), metadata comes later at publish time.
app.post('/api/v1/uploads', upload.fields([{ name: 'video' }, { name: 'thumbnail' }]), async (req, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const videoFile = files.video?.[0];
    if (!videoFile) return res.status(400).json({ error: 'ملف الفيديو مطلوب' });
    const thumbFile = files.thumbnail?.[0];
    res.json({
      videoPath: `/uploads/${videoFile.filename}`,
      src: `/uploads/${videoFile.filename}`,
      thumbPath: thumbFile ? `/uploads/${thumbFile.filename}` : null,
      thumbnail: thumbFile ? `/uploads/${thumbFile.filename}` : null,
      originalName: videoFile.originalname,
      size: videoFile.size,
    });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

// Stage a thumbnail image alone (used when the user picks a custom/auto thumbnail at publish time)
app.post('/api/v1/uploads/thumbnail', upload.fields([{ name: 'thumbnail' }]), async (req, res) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const thumbFile = files.thumbnail?.[0];
    if (!thumbFile) return res.status(400).json({ error: 'ملف الصورة مطلوب' });
    res.json({
      thumbPath: `/uploads/${thumbFile.filename}`,
      thumbnail: `/uploads/${thumbFile.filename}`,
    });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

// YouTube-style staged upload, step 2: publish metadata + visibility for
// previously staged files. Creates the real video row (views/likes/subs all real).
app.post('/api/v1/videos/publish', async (req, res) => {
  try {
    const { uid, title, description, category, isShort, duration, videoPath, thumbPath, visibility } = req.body as any;
    if (!uid || !title?.trim()) return res.status(400).json({ error: 'البيانات ناقصة' });
    if (!videoPath) return res.status(400).json({ error: 'ملف الفيديو غير مرفوع بعد' });

    const userRes = await db.execute({ sql: 'SELECT * FROM users WHERE uid = ?', args: [uid] });
    const user = userRes.rows[0] as any;
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول لنشر الفيديو' });

    const vis = ['public', 'unlisted', 'private'].includes(visibility) ? visibility : 'public';
    const vId = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newVideo = {
      id: vId,
      title: String(title).trim(),
      description: String(description || '').trim(),
      category: category || 'تقنية',
      isShort: isShort === true || isShort === 'true',
      duration: duration || '00:00',
      src: videoPath,
      thumbnail: thumbPath || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&auto=format&fit=crop&q=60',
      channelName: user.username || 'GUEST',
      channelAvatar: (user.avatar as string) || DEFAULT_AVATAR,
      userId: uid,
      uploadTimestamp: Date.now(),
      uploadDate: new Date().toLocaleDateString('ar-EG'),
      visibility: vis,
      videoPath: videoPath.replace('/uploads/', ''),
      thumbPath: thumbPath ? thumbPath.replace('/uploads/', '') : null,
    };

    await db.execute({
      sql: `INSERT INTO videos (id, title, description, category, isShort, duration, src, thumbnail, channelName, channelAvatar, userId, uploadTimestamp, uploadDate, viewsCount, likesCount, likes, videoPath, thumbPath, visibility)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        newVideo.id, newVideo.title, newVideo.description, newVideo.category, newVideo.isShort ? 1 : 0, newVideo.duration,
        newVideo.src, newVideo.thumbnail, newVideo.channelName, newVideo.channelAvatar, newVideo.userId,
        newVideo.uploadTimestamp, newVideo.uploadDate, 0, 0, '[]',
        newVideo.videoPath, newVideo.thumbPath, newVideo.visibility,
      ]
    });

    res.json({ ...newVideo, likes: 0, views: '0' });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60';

// Normalize the stored likes JSON array into a plain count for the frontend
function parseLikes(raw: unknown): number {
  try {
    const arr = JSON.parse((raw as string) || '[]');
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

app.post('/api/v1/users', async (req, res) => {
  const { uid, username, email, password } = req.body as { uid?: string; username?: string; email?: string; password?: string };
  if (!uid || !username?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'البيانات ناقصة: uid و username و email مطلوبة' });
  }
  try {
    // Hash the password with scrypt — only stored for brand-new accounts, never raw
    let passwordHash: string | null = null;
    if (password) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
      passwordHash = `${salt}:${hash}`;
    }
    const clientIp = (req as any).clientIp || 'unknown';
    await db.execute({
      sql: `INSERT INTO users (uid, username, email, avatar, banner, subscriptions, passwordHash, ipAddress, createdAt, lastLogin)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(uid) DO UPDATE SET
              username = excluded.username,
              email = excluded.email,
              lastLogin = excluded.lastLogin`,
      args: [uid, username.trim(), email.trim().toLowerCase(), DEFAULT_AVATAR, '', '[]', passwordHash, clientIp, Date.now(), Date.now()]
    });
    // Never overwrite an existing password hash or IP on re-sync
    await db.execute({
      sql: `UPDATE users SET
              passwordHash = COALESCE(passwordHash, ?),
              ipAddress = COALESCE(ipAddress, ?)
            WHERE uid = ?`,
      args: [passwordHash, clientIp, uid]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

// Public lookup by email (used by the login form — 404 when unknown).
// NOTE: defined BEFORE '/api/v1/users/:uid' so Express doesn't treat 'by-email' as a uid.
app.get('/api/v1/users/by-email', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email is required' });
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE lower(email) = ?',
      args: [email]
    });
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];
    res.json({
      ...user,
      avatar: user.avatar || DEFAULT_AVATAR,
      banner: user.banner || '',
      subscriptions: JSON.parse(user.subscriptions as string || '[]')
    });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

// Real password login (scrypt, timing-safe compare)
app.post('/api/v1/users/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'البريد وكلمة المرور مطلوبان' });
    }
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE lower(email) = ?',
      args: [email.trim().toLowerCase()]
    });
    if (result.rows.length === 0) {
      return res.status(401).json({ error: '🔐 خطأ في بيانات الدخول، يرجى التأكد من البريد الإلكتروني وكلمة المرور.' });
    }
    const user = result.rows[0];

    // Legacy accounts created before passwords existed: first login claims the account
    if (!user.passwordHash) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
      await db.execute({
        sql: 'UPDATE users SET passwordHash = ?, lastLogin = ? WHERE uid = ?',
        args: [`${salt}:${hash}`, Date.now(), user.uid]
      });
    } else {
      const [salt, stored] = String(user.passwordHash).split(':');
      const hash = crypto.scryptSync(String(password), salt || '', 64).toString('hex');
      const ok = !!stored && stored.length === hash.length &&
        crypto.timingSafeEqual(Buffer.from(stored, 'hex'), Buffer.from(hash, 'hex'));
      if (!ok) {
        return res.status(401).json({ error: '🔐 خطأ في بيانات الدخول، يرجى التأكد من البريد الإلكتروني وكلمة المرور.' });
      }
      await db.execute({ sql: 'UPDATE users SET lastLogin = ? WHERE uid = ?', args: [Date.now(), user.uid] });
    }

    res.json({
      uid: user.uid,
      username: user.username,
      email: user.email,
      avatar: user.avatar || DEFAULT_AVATAR,
      banner: user.banner || '',
      subscriptions: JSON.parse(user.subscriptions as string || '[]')
    });
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
    } else if (req.body.avatarUrl) {
      avatarUrl = String(req.body.avatarUrl);
    }
    if (files.banner?.[0]) {
      bannerUrl = `/uploads/${files.banner[0].filename}`;
    } else if (req.body.bannerUrl) {
      bannerUrl = String(req.body.bannerUrl);
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
    // Protected: requires the server-side ADMIN_SECRET — never open to the public
    const secret = process.env.ADMIN_SECRET;
    if (!secret) {
      return res.status(503).json({ error: 'لم يتم إعداد كلمة مرور الإدارة (ADMIN_SECRET) على الخادم' });
    }
    if (req.headers['x-admin-secret'] !== secret) {
      return res.status(403).json({ error: 'غير مصرح: كلمة مرور الإدارة غير صحيحة' });
    }
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
  const MAX_BYTES = 1024 * 1024 * 1024; // 1GB safety cap for imported files
  let downloaded = 0;
  response.data.on('data', (chunk: Buffer) => {
    downloaded += chunk.length;
    if (downloaded > MAX_BYTES) {
      response.data.destroy();
      writer.destroy();
    }
  });
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      if (downloaded > MAX_BYTES) {
        fs.unlink(destPath, () => {});
        reject(new Error('الملف أكبر من الحد المسموح (1GB)'));
      } else {
        resolve(destPath);
      }
    });
    writer.on('error', reject);
    response.data.on('error', reject);
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

    res.json({ ...newVideo, likes: 0, views: '0' });
  } catch (err) {
    console.error('Import Error:', err);
    res.status(500).json({ error: (err as any).message });
  }
});

// Multer / upload error handler -> clean JSON instead of a crash
app.use(((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!err) return next();
  if (err instanceof multer.MulterError || /نوع الملف غير مسموح/.test(err.message || '')) {
    return res.status(400).json({ error: `فشل الرفع: ${err.message}` });
  }
  return next(err);
}) as express.ErrorRequestHandler);

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
