import { useState, useEffect } from 'react';
import { WifiOff, Search, Sparkles, Plus, AlertTriangle, Play, Flame, Heart, Download, Zap, RefreshCw, CheckCircle, Home, User, ArrowRight, MoreVertical, BellRing, ChevronDown, Users, Bookmark, History } from 'lucide-react';
import { Video, DownloadedItem, ActiveTab } from './types';
import { motion, AnimatePresence } from 'motion/react';
import SettingsView from './components/SettingsView';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import VideoCard from './components/VideoCard';
import VideoPlayer from './components/VideoPlayer';
import ShortsView from './components/ShortsView';
import DownloadsView from './components/DownloadsView';
import UploadModal from './components/UploadModal';
import AccountView from './components/AccountView';
import { getVideos, getUserProfile, getUserSubscriptions, getSimpleAuthUser, simpleTursoLogout } from './services/db';
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  getDownloads, 
  saveDownload, 
  deleteDownload, 
  getUploads, 
  saveUpload,
  addToHistory,
  getHistory,
  getLikedVideos,
  toggleSubscription,
  getSubscriptions,
  toggleSave,
  getSavedVideos
} from './utils/db';

const CATEGORIES = ['الكل', 'تقنية', 'سفر', 'طبيعة', 'ألعاب', 'طبخ'];

interface CurrentUser {
  user_id: string;
  username: string;
  email: string;
  avatar?: string;
  banner?: string;
  description?: string;
  [key: string]: any;
}

export default function App() {
  // Navigation & Sizing
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  );
  
  // Offline State (extremely innovative simulation)
  const [isOffline, setIsOffline] = useState(false);
  // Real backend reachability (honest indicator — not a hardcoded "live" label)
  const [apiOnline, setApiOnline] = useState(true);
  
  // Videos Data
  const [videosList, setVideosList] = useState<Video[]>([]);
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected single video for player view
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  // Selected channel profile to view completely
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  
  // Custom User Profile State (Live Authentication)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Modals & Downloads State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [downloadsList, setDownloadsList] = useState<DownloadedItem[]>([]);
  
  // Users Likes / History IDs
  const [historyIds, setHistoryIds] = useState<{ id: string; watchedAt: Date }[]>([]);
  const [likedVideoIds, setLikedVideoIds] = useState<string[]>([]);
  
  // Subscriptions & Saved
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [savedVideoIds, setSavedVideoIds] = useState<string[]>([]);
  
  // Notifications
  const [notification, setNotification] = useState<string | null>(null);

  // 1. Initial Load of videos, uploads, & IndexedDB databases
  useEffect(() => {
    // Honest backend connectivity probe (drives the "database status" indicator)
    const probeApi = async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch(`/api/v1/videos`, { signal: ctrl.signal });
        clearTimeout(t);
        setApiOnline(r.ok);
      } catch {
        setApiOnline(false);
      }
    };
    probeApi();
    const probeTimer = setInterval(probeApi, 30000);
    async function loadData() {
      try {
        const localDownloads = await getDownloads();
        const localHistory = await getHistory();
        const localLikes = await getLikedVideos();
        const localSubscriptions = await getSubscriptions();
        const localSaved = await getSavedVideos();

        setDownloadsList(localDownloads);
        setHistoryIds(localHistory);
        setLikedVideoIds(localLikes);
        setSubscriptions(localSubscriptions);
        setSavedVideoIds(localSaved);


        // Verify active user authorization on startup (Firebase)
        onAuthStateChanged(auth, async (user) => {
          if (user) {
            let profile = await getUserProfile(user.uid);
            if (!profile) {
              // Auto-sync if missing in Turso but exists in Firebase
              await fetch('/api/v1/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  uid: user.uid, 
                  username: user.displayName || user.email?.split('@')[0] || 'User', 
                  email: user.email 
                })
              });
              profile = await getUserProfile(user.uid);
            }

            if (profile) {
              setCurrentUser({ user_id: user.uid, username: profile.username, email: profile.email, ...profile });
              const subs = await getUserSubscriptions(user.uid);
              setSubscriptions(subs);
            }
          } else {
            setCurrentUser(null);
          }
        });

        // Also check for simple Turso-based auth
        const simpleUser = getSimpleAuthUser();
        if (simpleUser) {
          // Validate user still exists in Turso
          const profile = await getUserProfile(simpleUser.uid);
          if (profile) {
            setCurrentUser({ user_id: simpleUser.uid, username: profile.username, email: profile.email });
          }
        }

        // Fetch videos from Firebase
        const sVideos = await getVideos(currentUser?.user_id);
        setVideosList(sVideos as any);

        // --- Deep Linking Optimization ---
        const urlParams = new URLSearchParams(window.location.search);
        const videoId = urlParams.get('v');
        if (videoId) {
          const videoToLoad = (sVideos as Video[]).find(v => v.id === videoId);
          if (videoToLoad) {
            setSelectedVideo(videoToLoad);
            showToast(`🚀 جاري تحميل الفيديو من الرابط المباشر...`);
          }
        }
      } catch (err) {
        console.error('Failed to initialize database assets', err);
        // Fallback default load
        setVideosList([]);
      }
    }
    loadData();
    return () => clearInterval(probeTimer);
  }, []);

  // Sync details if liked or history updates
  const syncLikesAndHistory = async () => {
    const freshHistory = await getHistory();
    const freshLikes = await getLikedVideos();
    setHistoryIds(freshHistory);
    setLikedVideoIds(freshLikes);
  };

  // Synchronize stats dynamically with database in real-time
  const handleUpdateVideoStats = (videoId: string, updatedFields: Partial<Video>) => {
    setVideosList(prev => prev.map(v => v.id === videoId ? { ...v, ...updatedFields } : v));
    setSelectedVideo(prev => prev && prev.id === videoId ? { ...prev, ...updatedFields } : prev);
  };

  const handleUpdateChannelSubscription = async (channelName: string, isSubscribed: boolean, subscribersText: string) => {
    try {
      await toggleSubscription(channelName);
      const freshSubscriptions = await getSubscriptions();
      setSubscriptions(freshSubscriptions);
      setVideosList(prev => prev.map(v => v.channelName === channelName ? { ...v, subscribed: isSubscribed, subscribers: subscribersText } : v));
      setSelectedVideo(prev => prev && prev.channelName === channelName ? { ...prev, subscribed: isSubscribed, subscribers: subscribersText } : prev);
      showToast(isSubscribed ? `🔔 قمت بالاشتراك في قناة ${channelName} وسيتم إبلاغك بكل جديد!` : `🔕 تم إلغاء اشتراكك في ${channelName}.`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleSaveVideo = async (videoId: string) => {
    try {
      await toggleSave(videoId);
      const freshSaved = await getSavedVideos();
      setSavedVideoIds(freshSaved);
      showToast(freshSaved.includes(videoId) ? '📥 تم حفظ الفيديو في مكتبتك لتتمكن من الرجوع إليه لاحقاً!' : '📤 تم إزالة الفيديو من مكتبتك.');
    } catch (err) {
      console.error(err);
    }
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // 2. Real Download handler with Chunk-by-Chunk fetch streaming!
  const handleDownloadVideo = async (video: Video) => {
    if (isOffline) {
      showToast('⚠️ لا يمكنك بدء تحميلات جديدة في وضع عدم الاتصال بالإنترنت!');
      return;
    }

    // Check if progress/completed already
    const existing = downloadsList.find(d => d.id === video.id);
    if (existing?.status === 'completed') {
      showToast('✨ تم تحميل هذا الفيديو مسبقاً وهو متوفر أوفلاين!');
      return;
    }

    showToast(`⏳ بدء عملية تحميل: "${video.title}"...`);

    const tempDownload: DownloadedItem = {
      id: video.id,
      video: video,
      downloadedAt: new Date(),
      status: 'downloading',
      progress: 0,
      fileSize: 'جاري الحساب...'
    };

    // Update state immediate to show loader
    setDownloadsList(prev => [...prev.filter(d => d.id !== video.id), tempDownload]);

    try {
      // Begin fetching chunk-by-chunk using standard fetch
      const resp = await fetch(video.src);
      if (!resp.ok) throw new Error('Network error code ' + resp.status);

      const contentLength = parseInt(resp.headers.get('Content-Length') || '10485760', 10); // 10MB approx mock limit
      const reader = resp.body?.getReader();
      
      if (!reader) {
        throw new Error('ReadableStream not supported in mock env');
      }

      let receivedLength = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        // Calculate progress steps
        const currentProgress = Math.min(Math.round((receivedLength / contentLength) * 100), 99);
        
        // Update state progress
        setDownloadsList(prev => {
          return prev.map(dl => {
            if (dl.id === video.id) {
              return { ...dl, progress: currentProgress };
            }
            return dl;
          });
        });
      }

      // Consolidate blob chunks
      const videoBlob = new Blob(chunks, { type: 'video/mp4' });
      const kbSize = Math.round(videoBlob.size / 1024);
      const computedSize = kbSize > 1024 
        ? `${(kbSize / 1024).toFixed(1)} ميجابايت` 
        : `${kbSize} كيلوبايت`;

      const completedDownload: DownloadedItem = {
        id: video.id,
        video: video,
        downloadedAt: new Date(),
        blob: videoBlob,
        fileSize: computedSize,
        status: 'completed',
        progress: 100
      };

      // Save to IndexedDB persistence
      await saveDownload(completedDownload);
      
      // Update state downloads array with blobUrl references
      const freshDownloads = await getDownloads();
      setDownloadsList(freshDownloads);
      
      showToast(`✅ اكتمل التحميل! "${video.title}" متاح أوفلاين الآن (${computedSize})`);
    } catch (e) {
      console.error('Fetch download failed', e);
      showToast(`❌ فشل تحميل الفيديو. يرجى محاولة رابط بث آخر مقيد CORS.`);
      
      // Mark as failed
      setDownloadsList(prev => {
        return prev.map(dl => {
          if (dl.id === video.id) {
            return { ...dl, status: 'failed', progress: 0 };
          }
          return dl;
        });
      });
    }
  };

  const handleDeleteDownload = async (id: string) => {
    try {
      await deleteDownload(id);
      const fresh = await getDownloads();
      setDownloadsList(fresh);
      showToast('🗑️ تم إزالة الفيديو المحمل من الذاكرة المحلية بنجاح.');
    } catch (err) {
      console.error('Failed deleting key from DB', err);
    }
  };

  // 3. User Mock Upload handler
  const handleSaveUploadedVideo = async (video: Video) => {
    try {
      setVideosList(prev => [video, ...prev]);
      setShowUploadModal(false);
      showToast(`🎉 مبروك! تم نشر مقطعك "${video.title}" بنجاح في قناتك بقاعدة البيانات.`);
      setActiveTab('account');
    } catch (e) {
      console.error('Upload DB save failure', e);
    }
  };

  // Auth logins success and logouts dispatchers
  const handleLoginSuccess = async (user: any) => {
    setCurrentUser(user);
    showToast(`👋 مرحباً بك يا ${user.username}! تم تشغيل حساب المبدع بنجاح.`);
    setActiveTab('home');

    // Reload videos list to update personalized like indicator maps
    const sVideos = await getVideos(currentUser?.user_id);
    setVideosList(sVideos as any);
  };

  const handleLogout = async () => {
    await auth.signOut();
    simpleTursoLogout(); // clear the persisted session so reload stays logged out
    setCurrentUser(null);
    setSubscriptions([]);
    showToast(`🚪 تم تسجيل الخروج بنجاح.`);
    setSelectedVideo(null);
    setSelectedChannel(null);
    setActiveTab('account'); // land on the login form so the logout is visible

    // Reload default videos
    const sVideos = await getVideos(currentUser?.user_id);
    setVideosList(sVideos as any);
  };

  // Active playing selector & History register
  const handleSelectVideoToPlay = async (video: Video) => {
    setSelectedVideo(video);
    
    // Update URL without reloading page for sharing
    const newUrl = window.location.origin + window.location.pathname + '?v=' + video.id;
    window.history.pushState({ path: newUrl }, '', newUrl);

    try {
      await addToHistory(video.id);
      await syncLikesAndHistory();
    } catch (e) {
      console.error(e);
    }
  };

  // Filter regular videos (dismiss shorts in home grid)
  const handleDeleteVideoFromFeed = async (videoId: string) => {
    try {
      if (!currentUser) {
        showToast('⚠️ يرجى تسجيل الدخول أولاً لحذف الفيديو.');
        return;
      }
      const res = await fetch(`/api/v1/videos/${videoId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser.user_id })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'فشل الحذف من الخادم');
      }
      
      setVideosList(prev => prev.filter(v => v.id !== videoId));
      showToast('🗑️ تم حذف الفيديو بنجاح من قاعدة البيانات للجميع!');
    } catch (err) {
      console.error(err);
      showToast('❌ فشل حذف الفيديو. حاول مرة أخرى.');
      throw err;
    }
  };

  const regularVideos = videosList.filter(v => !v.isShort);
  const shortVideos = videosList.filter(v => v.isShort);

  // Filter outputs
  const filteredVideos = regularVideos.filter(v => {
    const isCategoryMatch = activeCategory === 'الكل' || v.category === activeCategory;
    const isSearchMatch = searchQuery === '' || 
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      v.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.channelName.toLowerCase().includes(searchQuery.toLowerCase());
    return isCategoryMatch && isSearchMatch;
  });

  // Calculate download counts
  const completeDownloadsCount = downloadsList.filter(d => d.status === 'completed').length;

  return (
    <div className="min-h-screen bg-[var(--yt-bg)] text-[var(--yt-text)] flex flex-col font-sans relative" id="main-layout-root">
      
      {/* Dynamic Toast Notification popup */}
      <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-6 right-6 z-[60] bg-[var(--yt-bg-elev)] text-[var(--yt-text)] px-5 py-3.5 rounded-xl max-w-sm flex items-center gap-3 text-right font-medium"
          style={{ boxShadow: 'var(--yt-shadow)' }}
          id="toast-notification"
        >
          <Zap className="w-5 h-5 text-[var(--yt-red)] shrink-0" />
          <span className="text-sm leading-snug">{notification}</span>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Upload Video Modal overlay overlay */}
      {showUploadModal && (
        <UploadModal 
          onClose={() => setShowUploadModal(false)}
          onSave={handleSaveUploadedVideo}
          currentUser={currentUser}
        />
      )}

      {/* 1. Header Toolbar */}
      <Navbar 
        onSearch={(q) => {
          setSearchQuery(q);
          setSelectedVideo(null); // Return to grid
          setSelectedChannel(null); // Return to grid
          setActiveTab('home');
        }}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onOpenUpload={() => {
          if (!currentUser) {
            showToast('⚠️ يرجى تسجيل الدخول أولاً كصانع محتوى لتستطيع النشر بقاعدة البيانات!');
            setActiveTab('account');
            setSelectedChannel(null);
          } else {
            setShowUploadModal(true);
          }
        }}
        onGoHome={() => {
          setSelectedVideo(null);
          setSelectedChannel(null);
          setActiveTab('home');
        }}
        currentUser={currentUser}
        onGoToAccount={() => {
          setSelectedVideo(null);
          setSelectedChannel(null);
          setActiveTab('account');
        }}
      />

      {/* Offline Status Sticky bar */}
      {isOffline && (
        <div className="bg-red-600 text-white py-1 flex items-center justify-center gap-2 text-xs font-bold select-none text-center">
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>تنبيه: أنت الآن تستخدم تطبيق يوتيوب تفعيلاً لوضع عدم الاتصال. لن تعمل سوى الفيديوهات المحملة في "الفيديوهات المحملة".</span>
          <button 
            onClick={() => { setIsOffline(false); showToast('🌐 تم الاتصال بالإنترنت مجدداً!'); }} 
            className="underline ml-2 hover:text-gray-200"
          >
            اضغط للاتصال بالنت
          </button>
        </div>
      )}

      {/* 2. Content Layout (Sidebar + Main panel) */}
      <div className="flex-1 flex" id="main-frame-panel">
        
        {/* Collapsible Sidebar */}
        <Sidebar 
          activeTab={activeTab}
          onChangeTab={(tab) => {
            setActiveTab(tab);
            setSelectedVideo(null); // clear detail context
            setSelectedChannel(null); // clear channel context
            // Close the sidebar automatically on mobile/tablet screen sizes
            if (window.innerWidth < 1024) {
              setSidebarOpen(false);
            }
          }}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          downloadCount={completeDownloadsCount}
        />

        {/* Main Content View Frame */}
        <main className="flex-1 px-4 md:px-6 pt-4 overflow-x-hidden min-h-[calc(100vh-3.5rem)]" id="main-content-canvas">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedVideo ? `watch-${selectedVideo.id}` : selectedChannel ? `channel-${selectedChannel}` : `tab-${activeTab}`}
              initial={{ opacity: 0, y: 28, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.995 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
          {/* A. If a video is SELECTED to play (Detail view context) */}
          {selectedVideo ? (
            <div className="space-y-4">
              <button
                onClick={() => {
                  setSelectedVideo(null);
                  const newUrl = window.location.origin + window.location.pathname;
                  window.history.pushState({ path: newUrl }, '', newUrl);
                }}
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-[var(--yt-chip)] hover:bg-[#2b2b2b] text-[var(--yt-text)] font-bold text-xs rounded-lg transition-colors border border-[var(--yt-border)]"
              >
                <span>← العودة لقسم {activeTab === 'home' ? 'الرئيسية' : 'المكتبة'}</span>
              </button>

              <VideoPlayer 
                video={selectedVideo}
                downloadStatus={downloadsList.find(d => d.id === selectedVideo.id)}
                onDownload={() => handleDownloadVideo(selectedVideo)}
                onDeleteDownload={() => handleDeleteDownload(selectedVideo.id)}
                isOffline={isOffline}
                onGoBack={() => setSelectedVideo(null)}
                onRelatedSelect={handleSelectVideoToPlay}
                allVideos={videosList}
                onUpdateVideoStats={handleUpdateVideoStats}
                onUpdateChannelSubscription={handleUpdateChannelSubscription}
                onToggleSave={handleToggleSaveVideo}
                onDelete={handleDeleteVideoFromFeed}
                isSaved={savedVideoIds.includes(selectedVideo.id)}
                onChannelClick={(chanName) => {
                  setSelectedVideo(null);
                  setSelectedChannel(chanName);
                }}
                currentUser={currentUser}
              />
            </div>
          ) : selectedChannel ? (
            /* C. If a CHANNEL/USER PROFILE is SELECTED to view */
            <div className="animate-fade-in w-full pb-20 md:pb-0 bg-[#0f0f0f] min-h-screen text-right" id="channel-profile-canvas" dir="rtl">
              {/* Header Bar */}
              <div className="flex items-center justify-between py-3 px-4 sticky top-0 bg-[#0f0f0f]/95 backdrop-blur z-20 border-b border-neutral-900 md:border-none">
                <div className="flex items-center gap-4 shrink-0">
                  <button className="hover:bg-[var(--yt-chip-hover)] p-1.5 rounded-full transition-colors cursor-pointer">
                    <MoreVertical className="w-6 h-6 text-[var(--yt-text)]" />
                  </button>
                  <button className="hover:bg-[var(--yt-chip-hover)] p-1.5 rounded-full transition-colors cursor-pointer">
                    <Search className="w-6 h-6 text-[var(--yt-text)]" />
                  </button>
                </div>
                <button
                  onClick={() => setSelectedChannel(null)}
                  className="hover:bg-[var(--yt-chip-hover)] p-1.5 rounded-full transition-colors cursor-pointer shrink-0"
                >
                  <ArrowRight className="w-6 h-6 text-[var(--yt-text)]" />
                </button>
              </div>

              {/* Profile Info */}
              <div className="px-4 md:px-8 mt-2 max-w-5xl mx-auto">
                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col justify-center gap-0.5">
                     <h2 className="text-2xl sm:text-[26px] font-bold text-[var(--yt-text)] leading-tight">{selectedChannel}</h2>
                     <span className="text-[13px] text-[var(--yt-text-2)] mt-1" dir="ltr">
                       @{selectedChannel?.toLowerCase().replace(/\s+/g, '')}
                     </span>
                     <span className="text-[13px] text-[var(--yt-text-2)] mt-0.5 whitespace-nowrap">
                       {videosList.filter(v => v.channelName === selectedChannel).length} فيديو
                     </span>
                  </div>
                  <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full overflow-hidden shrink-0 ml-2">
                     <img src={videosList.find(v => v.channelName === selectedChannel)?.channelAvatar || undefined || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=60'} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                  </div>
                </div>

                {/* Description */}
                <p className="mt-4 text-[13px] text-[var(--yt-text)] leading-relaxed text-right line-clamp-2">
                  مرحباً بك في قناة {selectedChannel}! تابع أحدث الفيديوهات المنشورة هنا أولاً بأول.
                </p>

                {/* Buttons Component */}
                <div className="flex items-center gap-2 mt-5">
                   <button 
                     onClick={() => handleUpdateChannelSubscription(selectedChannel || '', !subscriptions.includes(selectedChannel || ''), '')}
                     className={`flex-[2] ${subscriptions.includes(selectedChannel || '') ? 'bg-[var(--yt-chip)] hover:bg-[#3f3f3f] text-[var(--yt-text)]' : 'bg-white hover:bg-gray-200 text-black'} py-2 rounded-full text-[13px] font-bold flex justify-center items-center gap-2 transition-colors cursor-pointer h-9 shrink-0`}
                   >
                     {subscriptions.includes(selectedChannel || '') ? (
                       <>
                         <ChevronDown className="w-4 h-4 text-[var(--yt-text)]" />
                         <span>تم الاشتراك</span>
                         <BellRing className="w-4 h-4 text-[var(--yt-text)]" />
                       </>
                     ) : (
                       <span>اشتراك</span>
                     )}
                   </button>
                   <button className="flex-1 bg-[var(--yt-chip)] hover:bg-[#3f3f3f] py-2 rounded-full text-[13px] font-bold text-[var(--yt-text)] flex justify-center items-center gap-2 transition-colors cursor-pointer h-9 shrink-0">
                     <Users className="w-5 h-5 text-[var(--yt-text)]" />
                     <span>المنتدى</span>
                   </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-6 mt-6 border-b border-[var(--yt-border)] px-4 md:px-8 overflow-x-auto scrollbar-none max-w-5xl mx-auto">
                <button className="pb-3 text-sm font-bold text-[var(--yt-text)] border-b-2 border-white whitespace-nowrap shrink-0 px-1">الفيديوهات</button>
                <button className="pb-3 text-sm font-bold text-[var(--yt-text-2)] whitespace-nowrap shrink-0 hover:text-gray-200 px-1">Shorts</button>
                <button className="pb-3 text-sm font-bold text-[var(--yt-text-2)] whitespace-nowrap shrink-0 hover:text-gray-200 px-1">قوائم التشغيل</button>
                <button className="pb-3 text-sm font-bold text-[var(--yt-text-2)] whitespace-nowrap shrink-0 hover:text-gray-200 px-1">المنشورات</button>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 mt-4 px-4 md:px-8 max-w-5xl mx-auto">
                <button className="bg-white text-black px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer shrink-0">الأحدث</button>
                <button className="bg-[var(--yt-chip)] text-[var(--yt-text)] px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:bg-[#3f3f3f] shrink-0 border border-transparent">الرائجة</button>
                <button className="bg-[var(--yt-chip)] text-[var(--yt-text)] px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:bg-[#3f3f3f] shrink-0 border border-transparent">الأقدم</button>
              </div>

              {/* Horizontal List of Videos */}
               <div className="mt-4 px-0 max-w-5xl mx-auto flex flex-col gap-0 pb-10">
                  {videosList.filter(v => v.channelName === selectedChannel).length === 0 ? (
                    <div className="py-12 text-center text-sm text-[var(--yt-text-2)] rounded-2xl w-full">
                      لا توجد فيديوهات بعد.
                    </div>
                  ) : (
                    videosList.filter(v => v.channelName === selectedChannel).map(vid => (
                      <div 
                        key={vid.id} 
                        onClick={() => handleSelectVideoToPlay(vid)}
                        className="flex items-start gap-3 w-full cursor-pointer active:bg-[var(--yt-bg-elev)] transition-colors py-2 px-3 group"
                      >
                         <div className="relative w-40 h-[90px] sm:w-[200px] sm:h-[113px] shrink-0 rounded-lg overflow-hidden bg-[var(--yt-bg-elev)] shadow-md">
                           <img src={vid.thumbnail || undefined} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                           <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[11px] text-white font-mono font-bold">
                             {vid.duration}
                           </div>
                         </div>
                         <div className="flex-1 min-w-0 flex flex-col text-right h-[90px] sm:h-[113px] justify-start py-0.5 relative">
                           <h3 className="text-[13px] sm:text-base font-medium text-[var(--yt-text)] line-clamp-2 leading-snug group-hover:text-[var(--yt-red)] transition-colors pl-6 mb-1">
                             {vid.title}
                           </h3>
                           <button className="absolute left-0 top-0 text-[var(--yt-text)] shrink-0 p-1 opacity-70 hover:opacity-100 hover:bg-[var(--yt-chip-hover)] rounded-full" onClick={(e) => {e.stopPropagation();}}>
                             <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
                           </button>
                           <div className="text-[11px] sm:text-[13px] text-[var(--yt-text-2)] mt-0 flex items-center gap-1 font-medium flex-wrap">
                              <span>{vid.views || '2.1 ألف'} مشاهدة</span>
                              <span>•</span>
                              <span>{vid.uploadDate || 'قبل 4 ساعات'}</span>
                           </div>
                         </div>
                      </div>
                    ))
                  )}
               </div>
            </div>
          ) : (
            /* B. Dynamic Router Tabs mapping sidebar content */
            <div>
              {activeTab === 'home' && (
                <div className="space-y-6" id="home-view">
                  {/* Category Pills Slider */}
                  <div className="flex items-center gap-3 overflow-x-auto pb-3 scrollbar-none -mx-1 px-1" id="categories-slider">
                    {CATEGORIES.map((cat) => (
                      <motion.button
                        key={cat}
                        layout
                        whileTap={{ scale: 0.94 }}
                        onClick={() => setActiveCategory(cat)}
                        className={`yt-chip px-3 py-1.5 rounded-lg text-sm font-medium shrink-0 cursor-pointer whitespace-nowrap ${
                          activeCategory === cat ? 'yt-chip-active' : ''
                        }`}
                        id={`category-pill-${cat}`}
                      >
                        {cat}
                      </motion.button>
                    ))}
                  </div>

                  {/* Videos Grid display */}
                  {filteredVideos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-3" id="no-videos-empty">
                      <Search className="w-10 h-10 text-red-500 animate-pulse" />
                      <h3 className="text-lg font-bold">لم نجد أي فيديوهات مطابقة</h3>
                      <p className="text-sm text-[var(--yt-text-2)]">حاول البحث باستخدام كلمة مفتاحية أخرى أو تصفية فئة بديلة.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {filteredVideos.map((vid) => (
                        <VideoCard 
                          key={vid.id}
                          video={vid}
                          onSelect={() => handleSelectVideoToPlay(vid)}
                          downloadStatus={downloadsList.find(d => d.id === vid.id)}
                          onDownload={(e) => { e.stopPropagation(); handleDownloadVideo(vid); }}
                          onDeleteDownload={(e) => { e.stopPropagation(); handleDeleteDownload(vid.id); }}
                          isOffline={isOffline}
                          onChannelClick={(chanName) => setSelectedChannel(chanName)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'shorts' && (
                <ShortsView 
                  shorts={shortVideos}
                  downloadStatusList={downloadsList.reduce((acc, current) => {
                    acc[current.id] = current;
                    return acc;
                  }, {} as Record<string, DownloadedItem | undefined>)}
                  onDownload={handleDownloadVideo}
                  onDeleteDownload={handleDeleteDownload}
                  isOffline={isOffline}
                  currentUser={currentUser}
                />
              )}

              {activeTab === 'subscriptions' && (
                <div className="space-y-6" id="subscriptions-view">
                  {/* Subscriptions Horizontal list of channels */}
                  <div className="bg-[var(--yt-bg-elev)] p-4 rounded-xl border border-[var(--yt-border)] space-y-3">
                    <span className="text-[11px] text-[var(--yt-text-2)] font-bold block">القنوات المشترك بها من قاعدة البيانات</span>
                    {subscriptions.length === 0 ? (
                      <div className="text-center py-6 text-[var(--yt-text-2)] text-xs">
                        لم تشترك بأي قناة حتى الآن.
                      </div>
                    ) : (
                      <div className="flex items-center gap-5 overflow-x-auto pb-1 -mx-1" id="channels-slider">
                        {Array.from(new Map(videosList.filter(v => subscriptions.includes(v.channelName)).map(v => [v.channelName, v])).values()).map((channelItem: any) => {
                          const channel = channelItem as Video;
                          return (
                            <div 
                              key={channel.id} 
                              onClick={() => setSelectedChannel(channel.channelName)}
                              className="flex flex-col items-center gap-1 shrink-0 cursor-pointer group text-center block"
                              title={`فتح قناة ${channel.channelName}`}
                            >
                              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-red-500/10 group-hover:border-red-600 transition-all bg-[var(--yt-bg-elev)] object-cover active:scale-95 duration-100">
                                <img 
                                  src={channel.channelAvatar || undefined} 
                                  className="w-full h-full object-cover animate-fade-in" 
                                  alt="" 
                                  referrerPolicy="no-referrer" 
                                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60'; }}
                                />
                              </div>
                              <span className="text-[10px] text-[var(--yt-text-2)] group-hover:text-[var(--yt-text)] line-clamp-1 max-w-[70px] font-bold">
                                {channel.channelName}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Videos title */}
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold">أحدث المنشورات من قنواتك المفضلة</h2>
                    {(!isOffline && apiOnline) ? (
                      <span className="text-xs text-green-500 font-semibold">• متصل بقاعدة البيانات حياً</span>
                    ) : (
                      <span className="text-xs text-[var(--yt-text-2)] font-semibold">• غير متصل — يعرض المحتوى المحلي</span>
                    )}
                  </div>

                  {/* Regular Feed Grid */}
                  {subscriptions.length === 0 ? (
                    <div className="text-center py-20 text-[var(--yt-text-2)] text-sm">
                      ليس لديك أية اشتراكات حالياً لعرض المحتوى الخاص بها.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {regularVideos.filter(vid => subscriptions.includes(vid.channelName)).map((vid) => (
                        <VideoCard 
                          key={vid.id}
                          video={vid}
                          onSelect={() => handleSelectVideoToPlay(vid)}
                          downloadStatus={downloadsList.find(d => d.id === vid.id)}
                          onDownload={(e) => { e.stopPropagation(); handleDownloadVideo(vid); }}
                          onDeleteDownload={(e) => { e.stopPropagation(); handleDeleteDownload(vid.id); }}
                          isOffline={isOffline}
                          onChannelClick={(chanName) => setSelectedChannel(chanName)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'downloads' && (
                <DownloadsView 
                  downloads={downloadsList}
                  onSelectVideo={handleSelectVideoToPlay}
                  onDeleteDownload={handleDeleteDownload}
                  isOffline={isOffline}
                  onToggleOffline={() => {
                    const nextOffline = !isOffline;
                    setIsOffline(nextOffline);
                    showToast(nextOffline 
                      ? '🔌 تم تفعيل وضع الطيران غير المتصل! اختبر تشغيل الكنز المحمل الآن.' 
                      : '🌐 تم الدخول في وضع التغطية والاتصال المباشر بالنت.'
                    );
                  }}
                />
              )}

              {activeTab === 'history' && (
                <div className="space-y-6" id="history-view">
                  <div className="flex items-center justify-between border-b border-[var(--yt-border)] pb-3">
                    <h2 className="text-xl font-bold">سجل المشاهدة الأخير</h2>
                    <span className="text-xs text-[var(--yt-text-2)]">يتم ترتيبها بحسب الأحدث مشاهدة</span>
                  </div>

                  {historyIds.length === 0 ? (
                    <div className="text-center py-20 text-[var(--yt-text-2)] text-sm">
                      سجلك فارغ تماماً. الفيديوهات التي تشاهدها ستظهر هنا تلقائياً لسرعة العثور عليها مجدداً.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {videosList
                        .filter(v => historyIds.some(h => h.id === v.id))
                        .map((vid) => (
                          <VideoCard 
                            key={vid.id}
                            video={vid}
                            onSelect={() => handleSelectVideoToPlay(vid)}
                            downloadStatus={downloadsList.find(d => d.id === vid.id)}
                            onDownload={(e) => { e.stopPropagation(); handleDownloadVideo(vid); }}
                            onDeleteDownload={(e) => { e.stopPropagation(); handleDeleteDownload(vid.id); }}
                            isOffline={isOffline}
                            onChannelClick={(chanName) => setSelectedChannel(chanName)}
                          />
                        ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'liked' && (
                <div className="space-y-6" id="liked-view">
                  <div className="flex items-center justify-between border-b border-[var(--yt-border)] pb-3">
                    <h2 className="text-xl font-bold">الفيديوهات التي أعجبتني</h2>
                    <span className="text-xs text-red-400 font-bold flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                      <span>{likedVideoIds.length} فيديوهات ممتعة</span>
                    </span>
                  </div>

                  {likedVideoIds.length === 0 ? (
                    <div className="text-center py-20 text-[var(--yt-text-2)] text-sm">
                      لم تضع أي إعجاب بالقلب على أي فيديو بعد تفاعل الآن بالحب!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {videosList
                        .filter(v => likedVideoIds.includes(v.id))
                        .map((vid) => (
                          <VideoCard 
                            key={vid.id}
                            video={vid}
                            onSelect={() => handleSelectVideoToPlay(vid)}
                            downloadStatus={downloadsList.find(d => d.id === vid.id)}
                            onDownload={(e) => { e.stopPropagation(); handleDownloadVideo(vid); }}
                            onDeleteDownload={(e) => { e.stopPropagation(); handleDeleteDownload(vid.id); }}
                            isOffline={isOffline}
                            onChannelClick={(chanName) => setSelectedChannel(chanName)}
                          />
                        ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'library' && (
                <div className="space-y-8" id="library-view">
                  {/* Part 1: Downloads section summary */}
                  <div className="space-y-3">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Download className="w-5 h-5 text-red-500" />
                      <span>الفيديوهات المحملة أوفلاين ({completeDownloadsCount})</span>
                    </h2>
                    {downloadsList.length === 0 ? (
                      <div className="p-6 bg-[var(--yt-bg-elev)] text-sm text-[var(--yt-text-2)] rounded-2xl">
                        لم يتم تخزين أي فيديوهات بعد. حملها من الرئيسية لتظهر لتشغيلها والإنترنت مقطوع.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {downloadsList.filter(d => d.status === 'completed').slice(0, 3).map(item => (
                          <div 
                             key={item.id} 
                             onClick={() => handleSelectVideoToPlay(item.video)}
                             className="bg-[var(--yt-bg-elev)] p-3 rounded-xl border border-[var(--yt-border)] hover:shadow-lg transition-all cursor-pointer flex gap-3.5 items-center group"
                          >
                            <img src={item.video.thumbnail || undefined} className="w-16 rounded-md aspect-video object-cover" alt="" referrerPolicy="no-referrer" />
                            <div>
                              <h4 className="text-xs font-bold line-clamp-1 group-hover:text-[var(--yt-red)]">{item.video.title}</h4>
                              <p className="text-[10px] text-[var(--yt-text-2)] mt-1">{item.fileSize}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Part 2: Uploaded Videos segment */}
                  <div className="space-y-3">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--yt-text)]">
                      <Plus className="w-5 h-5 text-red-500 bg-red-500/10 p-0.5 rounded-full border border-red-500/20" />
                      <span>قناتك الخاصة وفيديوهاتك المرفوعة</span>
                    </h2>
                    {videosList.filter(v => v.id.toString().startsWith('custom-')).length === 0 ? (
                      <div className="p-6 bg-[var(--yt-bg-elev)] text-sm text-[var(--yt-text-2)] rounded-2xl flex items-center justify-between">
                        <span>لم تقم برفع أي فيديو خاص بك حتى الآن هل تود تجربة ذلك؟</span>
                        <button 
                          onClick={() => {
                            if (!currentUser) {
                              showToast('⚠️ يرجى تسجيل الدخول أولاً لتستطيع النشر بقاعدة البيانات!');
                              setActiveTab('account');
                            } else {
                              setShowUploadModal(true);
                            }
                          }} 
                          className="bg-red-600 px-4 py-1.5 text-xs text-white rounded-full font-bold hover:bg-red-700"
                        >
                          رفع أول فيديو 🎬
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {videosList.filter(v => v.id.toString().startsWith('custom-')).map(vid => (
                          <div 
                            key={vid.id} 
                            onClick={() => handleSelectVideoToPlay(vid)}
                            className="bg-[var(--yt-bg-elev)] p-3 rounded-xl border border-[var(--yt-border)] hover:shadow-lg transition-all cursor-pointer flex gap-3.5 items-center group"
                          >
                            <img src={vid.thumbnail || undefined} className="w-16 rounded-md aspect-video object-cover" alt="" referrerPolicy="no-referrer" />
                            <div>
                              <h4 className="text-xs font-bold line-clamp-1 group-hover:text-[var(--yt-red)]">{vid.title}</h4>
                              <p className="text-[10px] text-[var(--yt-text-2)] mt-1">{vid.category}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Part 3: Saved Videos */}
                  <div className="space-y-3">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--yt-text)]">
                      <Bookmark className="w-5 h-5 text-red-500" />
                      <span>المحفوظات (المشاهدة لاحقاً) ({savedVideoIds.length})</span>
                    </h2>
                    {savedVideoIds.length === 0 ? (
                      <div className="p-6 bg-[var(--yt-bg-elev)] text-sm text-[var(--yt-text-2)] rounded-2xl">
                        لم تقم بحفظ أي فيديوهات لمشاهدتها لاحقاً.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {videosList.filter(v => savedVideoIds.includes(v.id)).slice(0, 3).map(vid => (
                          <div 
                            key={vid.id} 
                            onClick={() => handleSelectVideoToPlay(vid)}
                            className="bg-[var(--yt-bg-elev)] p-3 rounded-xl border border-[var(--yt-border)] hover:shadow-lg transition-all cursor-pointer flex gap-3.5 items-center group"
                          >
                            <img src={vid.thumbnail || undefined} className="w-16 rounded-md aspect-video object-cover" alt="" referrerPolicy="no-referrer" />
                            <div className="flex-1">
                              <h4 className="text-xs font-bold line-clamp-1 group-hover:text-[var(--yt-red)]">{vid.title}</h4>
                              <p className="text-[10px] text-[var(--yt-text-2)] mt-1">{vid.channelName}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Part 4: Liked Videos Summary */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--yt-text)]">
                        <Heart className="w-5 h-5 text-red-500" />
                        <span>فيديوهات أعجبتني ({likedVideoIds.length})</span>
                      </h2>
                      <button onClick={() => setActiveTab('liked')} className="text-sm font-bold text-blue-400 hover:text-blue-300">
                        عرض الكل
                      </button>
                    </div>
                    {likedVideoIds.length === 0 ? (
                      <div className="p-6 bg-[var(--yt-bg-elev)] text-sm text-[var(--yt-text-2)] rounded-2xl">
                        لم تضع إعجاباً لأي فيديو بعد.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {videosList.filter(v => likedVideoIds.includes(v.id)).slice(0, 3).map(vid => (
                          <div 
                            key={vid.id} 
                            onClick={() => handleSelectVideoToPlay(vid)}
                            className="bg-[var(--yt-bg-elev)] p-3 rounded-xl border border-[var(--yt-border)] hover:shadow-lg transition-all cursor-pointer flex gap-3.5 items-center group"
                          >
                            <img src={vid.thumbnail || undefined} className="w-16 rounded-md aspect-video object-cover" alt="" referrerPolicy="no-referrer" />
                            <div className="flex-1">
                              <h4 className="text-xs font-bold line-clamp-1 group-hover:text-[var(--yt-red)]">{vid.title}</h4>
                              <p className="text-[10px] text-[var(--yt-text-2)] mt-1">{vid.channelName}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Part 5: History Summary */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--yt-text)]">
                        <History className="w-5 h-5 text-red-500" />
                        <span>سجل المشاهدة</span>
                      </h2>
                      <button onClick={() => setActiveTab('history')} className="text-sm font-bold text-blue-400 hover:text-blue-300">
                        عرض الكل
                      </button>
                    </div>
                    {historyIds.length === 0 ? (
                      <div className="p-6 bg-[var(--yt-bg-elev)] text-sm text-[var(--yt-text-2)] rounded-2xl">
                        لا يوجد أي سجل مشاهدات.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {videosList.filter(v => historyIds.some(h => h.id === v.id)).slice(0, 3).map(vid => (
                          <div 
                            key={vid.id} 
                            onClick={() => handleSelectVideoToPlay(vid)}
                            className="bg-[var(--yt-bg-elev)] p-3 rounded-xl border border-[var(--yt-border)] hover:shadow-lg transition-all cursor-pointer flex gap-3.5 items-center group"
                          >
                            <img src={vid.thumbnail || undefined} className="w-16 rounded-md aspect-video object-cover" alt="" referrerPolicy="no-referrer" />
                            <div className="flex-1">
                              <h4 className="text-xs font-bold line-clamp-1 group-hover:text-[var(--yt-red)]">{vid.title}</h4>
                              <p className="text-[10px] text-[var(--yt-text-2)] mt-1">{vid.channelName}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'account' && (
                <AccountView
                  onLoginSuccess={handleLoginSuccess}
                  onLogout={handleLogout}
                  currentUser={currentUser}
                  uploadedVideos={videosList}
                  onSelectVideo={handleSelectVideoToPlay}
                  onDeleteVideo={handleDeleteVideoFromFeed}
                  isOffline={isOffline}
                  onToggleOffline={() => {
                    const next = !isOffline;
                    setIsOffline(next);
                    showToast(next 
                      ? '🔌 تم تفعيل وضع عدم الاتصال (أوفلاين) - للتشغيل والتحميل أوفلاين!' 
                      : '🌐 تم الرجوع للوضع المتصل بالإنترنت!'
                    );
                  }}
                />
              )}
              {activeTab === 'settings' && (
                <SettingsView
                  onGoToAccount={() => setActiveTab('account')}
                />
              )}
            </div>
          )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Styled Footer copyright block */}
      <footer className="border-t border-[var(--yt-border)] py-4 pb-20 md:pb-4 text-center text-xs text-[var(--yt-text-2)] space-y-1 select-none flex flex-col items-center justify-center font-sans" id="app-footer">
        <p className="flex items-center gap-1 font-medium">
          YouTLibre © ٢٠٢٦
        </p>
      </footer>

      {/* Mobile Bottom Navigation Bar styled identically to the official YouTube App (RTL) */}
      <div 
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[var(--yt-bg)] border-t border-[var(--yt-border)] flex items-center justify-around z-40 px-2 text-[var(--yt-text)]" 
        id="mobile-bottom-bar"
      >
        {/* الرئيسية */}
        <button 
          onClick={() => { setSelectedVideo(null); setActiveTab('home'); }}
          className={`flex flex-col items-center justify-center w-14 h-full gap-0.5 select-none ${
            activeTab === 'home' ? 'text-[var(--yt-text)]' : 'text-[var(--yt-text-2)]'
          }`}
          id="m-nav-home"
        >
          <Home className="w-5 h-5 mx-auto" />
          <span className="text-[9px] font-medium leading-none">الرئيسية</span>
        </button>

        {/* Shorts */}
        <button 
          onClick={() => { setSelectedVideo(null); setActiveTab('shorts'); }}
          className={`flex flex-col items-center justify-center w-14 h-full gap-0.5 select-none ${
            activeTab === 'shorts' ? 'text-[var(--yt-text)]' : 'text-[var(--yt-text-2)]'
          }`}
          id="m-nav-shorts"
        >
          <Zap className="w-5 h-5 mx-auto" />
          <span className="text-[9px] font-medium leading-none">Shorts</span>
        </button>

        {/* Create / Upload */}
        <button 
          onClick={() => {
            if (!currentUser) {
              setNotification('⚠️ يرجى تسجيل الدخول أولاً كصانع محتوى لتستطيع رفع الفيديوهات إلى قاعدة البيانات!');
              setTimeout(() => setNotification(null), 3500);
              setActiveTab('account');
            } else {
              setShowUploadModal(true);
            }
          }}
          className="flex items-center justify-center w-11 h-11 bg-[var(--yt-chip)] active:scale-90 hover:bg-[var(--yt-chip-hover)] rounded-full transition-all"
          title="رفع فيديو جديد"
          id="m-nav-upload"
        >
          <Plus className="w-6 h-6 text-[var(--yt-text)]" />
        </button>

        {/* الاشتراكات */}
        <button 
          onClick={() => { setSelectedVideo(null); setActiveTab('subscriptions'); }}
          className={`flex flex-col items-center justify-center w-14 h-full gap-0.5 select-none ${
            activeTab === 'subscriptions' ? 'text-[var(--yt-text)]' : 'text-[var(--yt-text-2)]'
          }`}
          id="m-nav-subs"
        >
          <CheckCircle className="w-5 h-5 mx-auto" />
          <span className="text-[9px] font-medium leading-none font-sans">الاشتراكات</span>
        </button>

        {/* أنت (Account overview) */}
        <button 
          onClick={() => { setSelectedVideo(null); setActiveTab('account'); }}
          className={`flex flex-col items-center justify-center w-14 h-full gap-0.5 select-none ${
            activeTab === 'account' ? 'text-[var(--yt-text)]' : 'text-[var(--yt-text-2)]'
          }`}
          id="m-nav-you"
        >
            {currentUser?.username ? (
            <div className={`w-5 h-5 rounded-full bg-[var(--yt-red)] overflow-hidden flex items-center justify-center text-[9px] font-black text-[var(--yt-text)] hover:scale-105 border ${
              activeTab === 'account' ? 'border-[var(--yt-text)]' : 'border-transparent'
            }`}>
              {currentUser.username.substring(0, 2).toUpperCase()}
            </div>
          ) : currentUser ? (
            <div className={`w-5 h-5 rounded-full bg-[var(--yt-red)] overflow-hidden flex items-center justify-center text-[9px] font-black text-[var(--yt-text)] hover:scale-105 border ${
              activeTab === 'account' ? 'border-[var(--yt-text)]' : 'border-transparent'
            }`}>
              ??
            </div>
          ) : (
            <User className="w-5 h-5 mx-auto" />
          )}
          <span className="text-[9px] font-medium leading-none">أنت</span>
        </button>
      </div>
    </div>
  );
}
