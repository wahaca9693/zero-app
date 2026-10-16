import { auth } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut
} from 'firebase/auth';

// Simple Turso-based authentication (email + password, verified server-side with scrypt)
// Backend base URL: set VITE_API_URL (e.g. https://zero-app-backend.onrender.com)
// when the API runs on a separate host. Defaults to same-origin (Vercel).
const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/v1`;

const SIMPLE_AUTH_KEY = 'youtube_auth_user';

// Register — creates the user in Turso (fails if the email is already taken)
export const simpleTursoRegister = async (email, username, password) => {
  try {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanName = String(username || '').trim();
    if (!cleanEmail || !cleanName) throw new Error('يرجى إكمال البريد الإلكتروني واسم المستخدم');
    if (!password || String(password).length < 6) throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');

    // Email must be unique — no duplicate rows
    const existing = await fetch(`${API_BASE}/users/by-email?email=${encodeURIComponent(cleanEmail)}`);
    if (existing.ok) {
      throw new Error('📧 هذا البريد الإلكتروني مسجل بالفعل. سجل الدخول بدلاً من إنشاء حساب جديد.');
    }

    // Generate a simple UID
    const uid = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create user in Turso database (password is hashed server-side with scrypt, never stored raw)
    const response = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, username: cleanName, email: cleanEmail, password: String(password) })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'فشل في إنشاء الحساب');
    }

    // Store auth in localStorage
    const userData = { uid, username: cleanName, email: cleanEmail };
    localStorage.setItem(SIMPLE_AUTH_KEY, JSON.stringify(userData));

    return userData;
  } catch (e: any) {
    console.error('Register error:', e);
    throw new Error(e.message || 'حدث خطأ أثناء إنشاء الحساب');
  }
};

// Login — verifies email+password against the server (real check, no fake sessions)
export const simpleTursoLogin = async (email, password) => {
  try {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !password) throw new Error('أدخل البريد الإلكتروني وكلمة المرور');

    const response = await fetch(`${API_BASE}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password: String(password) })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || '🔐 خطأ في بيانات الدخول');
    }

    const profile = await response.json();

    // Store auth in localStorage
    const userData = { uid: profile.uid, username: profile.username, email: profile.email };
    localStorage.setItem(SIMPLE_AUTH_KEY, JSON.stringify(userData));

    return userData;
  } catch (e: any) {
    console.error('Login error:', e);
    throw new Error(e.message || 'حدث خطأ أثناء تسجيل الدخول');
  }
};

// Check if user is logged in (simple mode)
export const getSimpleAuthUser = () => {
  try {
    const stored = localStorage.getItem(SIMPLE_AUTH_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

// Logout (simple mode)
export const simpleTursoLogout = () => {
  localStorage.removeItem(SIMPLE_AUTH_KEY);
};

const handleApiError = async (error: any) => {
  console.error("API Error:", error);
  let message = error.message || String(error);

  if (error instanceof Response) {
    try {
      const data = await error.json();
      message = data.error || data.message || message;
    } catch (e) {
      message = `Server returned ${error.status}: ${error.statusText}`;
    }
  }

  if (message.includes('offline') || message.includes('network-error') || message.includes('failed-to-fetch')) {
    throw new Error('🌐 لا يمكن الاتصال بالخادم، يبدو أنك في وضع عدم الاتصال أو هناك مشكلة في الشبكة.');
  }
  if (message.includes('quota-exceeded')) {
    throw new Error('⚠️ تم تجاوز سعة التخزين المتاحة. يرجى الانتظار أو ترقية الخطة.');
  }
  
  throw new Error(`⚠️ ${message || 'حدث خطأ في الاتصال بقاعدة البيانات. يرجى المحاولة لاحقاً.'}`);
};

export const registerUser = async (email, password, username) => {
  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCred.user, { displayName: username });
    
    // Sync to Turso
    await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: userCred.user.uid, username, email })
    });

    return userCred.user;
  } catch (e: any) {
    if (e.code === 'auth/email-already-in-use') {
      throw new Error('📧 هذا البريد الإلكتروني مسجل بالفعل.');
    }
    await handleApiError(e);
  }
};

export const loginUser = async (email, password) => {
  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const user = userCred.user;
    
    // Ensure Turso record exists
    const profile = await getUserProfile(user.uid);
    if (!profile) {
      await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          uid: user.uid, 
          username: user.displayName || email.split('@')[0], 
          email: user.email 
        })
      });
    }
    
    return user;
  } catch (e: any) {
    if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
      throw new Error('🔐 خطأ في بيانات الدخول، يرجى التأكد من البريد الإلكتروني وكلمة المرور.');
    }
    throw new Error('🔐 حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة لاحقاً.');
  }
};

export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    await handleApiError(e);
  }
};

export const getUserProfile = async (uid) => {
  try {
    const res = await fetch(`${API_BASE}/users/${uid}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw res;
    }
    return await res.json();
  } catch (e) {
    await handleApiError(e);
  }
};

export const updateUserProfile = async (uid, data, avatarFile, bannerFile) => {
  try {
    const formData = new FormData();
    formData.append('username', data.username);
    formData.append('description', data.description);
    if (avatarFile) formData.append('avatar', avatarFile);
    else if (data.avatarUrl) formData.append('avatarUrl', data.avatarUrl);
    if (bannerFile) formData.append('banner', bannerFile);
    else if (data.bannerUrl) formData.append('bannerUrl', data.bannerUrl);

    const res = await fetch(`${API_BASE}/users/${uid}/update`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw res;
    const result = await res.json();

    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { 
        displayName: data.username,
        photoURL: result.avatar
      });
    }

    return { avatar: result.avatar, banner: result.banner };
  } catch (e) {
    await handleApiError(e);
  }
};

// VIDEOS
export const getVideos = async (uid?: string) => {
  try {
    const q = uid ? `?uid=${encodeURIComponent(uid)}` : '';
    const res = await fetch(`${API_BASE}/videos${q}`);
    if (!res.ok) throw res;
    return await res.json();
  } catch (e) {
    await handleApiError(e);
  }
};

// YouTube-style staged upload, step 1: send the raw file with REAL XHR
// progress events (fetch can't report upload progress).
export const stageUpload = (
  videoFile: File,
  thumbnailFile: File | null,
  onProgress: (pct: number) => void,
): Promise<{ videoPath: string; src: string; thumbPath: string | null; thumbnail: string | null; originalName: string; size: number }> => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('video', videoFile);
    if (thumbnailFile) formData.append('thumbnail', thumbnailFile);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/uploads`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('رد غير صالح من الخادم')); }
      } else {
        try { reject(new Error(JSON.parse(xhr.responseText).error || 'فشل الرفع')); }
        catch { reject(new Error('فشل رفع الملف')); }
      }
    };
    xhr.onerror = () => reject(new Error('انقطع الاتصال أثناء الرفع'));
    xhr.send(formData);
  });
};

// Stage a thumbnail image alone.
export const stageThumbnail = (thumbnailFile: File): Promise<{ thumbPath: string; thumbnail: string }> => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('thumbnail', thumbnailFile);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/uploads/thumbnail`);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('رد غير صالح من الخادم')); }
      } else { reject(new Error('فشل رفع الصورة')); }
    };
    xhr.onerror = () => reject(new Error('انقطع الاتصال أثناء الرفع'));
    xhr.send(formData);
  });
};
export const publishVideo = async (uid: string, data: {
  title: string; description: string; category: string; isShort: boolean;
  duration: string; videoPath: string; thumbPath: string | null;
  visibility: 'public' | 'unlisted' | 'private';
}) => {
  const res = await fetch(`${API_BASE}/videos/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, ...data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل نشر الفيديو');
  }
  return res.json();
};

export const uploadVideo = async (uid, data, videoFile, thumbnailFile) => {
  try {
    const formData = new FormData();
    formData.append('uid', uid);
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('category', data.category);
    formData.append('isShort', String(data.isShort));
    formData.append('duration', data.duration || '00:00');
    if (videoFile) formData.append('video', videoFile);
    if (thumbnailFile) formData.append('thumbnail', thumbnailFile);

    const res = await fetch(`${API_BASE}/videos`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw res;
    const result = await res.json();
    return result;
  } catch (e) {
    await handleApiError(e);
  }
};

export const importVideo = async (uid, data) => {
  try {
    const res = await fetch(`${API_BASE}/videos/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid,
        url: data.videoUrl,
        title: data.title,
        description: data.description,
        category: data.category,
        thumbnailUrl: data.thumbnailUrl,
        duration: data.duration,
        isShort: data.isShort
      })
    });
    if (!res.ok) throw res;
    return await res.json();
  } catch (e) {
    await handleApiError(e);
  }
};

export const deleteVideo = async (videoId: string, currentUser?: { user_id: string } | null) => {
  try {
    const res = await fetch(`${API_BASE}/videos/${videoId}`, {
      method: 'DELETE',
      headers: currentUser ? { 'Content-Type': 'application/json' } : {},
      body: currentUser ? JSON.stringify({ uid: currentUser.user_id }) : undefined
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Delete failed' }));
      throw new Error(err.error || 'Delete failed');
    }
  } catch (e) {
    await handleApiError(e);
  }
};

export const incrementView = async (videoId) => {
  try {
    const res = await fetch(`${API_BASE}/videos/${videoId}/view`, { method: 'POST' });
    if (!res.ok) throw res;
    const data = await res.json();
    return data.viewsCount;
  } catch (e) {
    return null;
  }
};

export const toggleLikeVideo = async (videoId, uid) => {
  try {
    const res = await fetch(`${API_BASE}/videos/${videoId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid })
    });
    if (!res.ok) throw res;
    return await res.json();
  } catch (e) {
    await handleApiError(e);
  }
};

export const getComments = async (videoId) => {
  try {
    const res = await fetch(`${API_BASE}/videos/${videoId}/comments`);
    if (!res.ok) throw res;
    return await res.json();
  } catch (e) {
    await handleApiError(e);
  }
};

export const addComment = async (videoId, uid, text) => {
  try {
    const res = await fetch(`${API_BASE}/videos/${videoId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, text })
    });
    if (!res.ok) throw res;
    return await res.json();
  } catch (e) {
    await handleApiError(e);
  }
};

export const toggleSubscriptionToUser = async (myUid, channelName) => {
  try {
    const res = await fetch(`${API_BASE}/users/${myUid}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName })
    });
    if (!res.ok) throw res;
    const data = await res.json();
    return data.subscriptions;
  } catch (e) {
    await handleApiError(e);
  }
};

export const getUserSubscriptions = async (uid) => {
  try {
    const res = await fetch(`${API_BASE}/users/${uid}`);
    if (!res.ok) {
      if (res.status === 404) return [];
      throw res;
    }
    const user = await res.json();
    return user.subscriptions || [];
  } catch (e) {
    await handleApiError(e);
  }
};
