import { auth } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut
} from 'firebase/auth';

const API_BASE = '/api/v1';

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
    if (bannerFile) formData.append('banner', bannerFile);

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
export const getVideos = async () => {
  try {
    const res = await fetch(`${API_BASE}/videos`);
    if (!res.ok) throw res;
    return await res.json();
  } catch (e) {
    await handleApiError(e);
  }
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

export const deleteVideo = async (videoId) => {
  try {
    const res = await fetch(`${API_BASE}/videos/${videoId}`, { method: 'DELETE' });
    if (!res.ok) throw res;
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
