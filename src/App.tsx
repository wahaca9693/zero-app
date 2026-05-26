import { useState, useEffect } from 'react';
import { WifiOff, Search, Sparkles, Plus, AlertTriangle, Play, Flame, Heart, Download, Zap, RefreshCw, CheckCircle, Home, User, ArrowRight, MoreVertical, BellRing, ChevronDown, Users, Bookmark, History } from 'lucide-react';
import { Video, DownloadedItem, ActiveTab } from './types';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import VideoCard from './components/VideoCard';
import VideoPlayer from './components/VideoPlayer';
import ShortsView from './components/ShortsView';
import DownloadsView from './components/DownloadsView';
import UploadModal from './components/UploadModal';
import AccountView from './components/AccountView';
import { getVideos, getUserProfile, getUserSubscriptions, getSimpleAuthUser } from './services/db';
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

export default function App() {
  // Navigation & Sizing
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Offline State (extremely innovative simulation)
  const [isOffline, setIsOffline] = useState(false);
  
  // Videos Data
  const [videosList, setVideosList] = useState<Video[]>([]);
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected single video for player view
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  // Selected channel profile to view completely
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  
  // Custom User Profile State (Live Authentication)
  const [currentUser, setCurrentUser] = useState<{ user_id: number; username: string; email: string } | null>(null);

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
              setCurrentUser({ user_id: user.uid as any, username: profile.username, email: profile.email, ...profile });
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
        const sVideos = await getVideos();
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
    const sVideos = await getVideos();
    setVideosList(sVideos as any);
  };

  const handleLogout = async () => {
    await auth.signOut();
    setCurrentUser(null);
    showToast(`🚪 تم تسجيل الخروج بنجاح.`);
    setActiveTab('home');

    // Reload default videos
    const sVideos = await getVideos();
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
      const res = await fetch(`/api/v1/videos/${videoId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('فشل الحذف من الخادم');
      
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
    <div className="min-h-screen bg-[#0F0F0F] text-white flex flex-col font-sans relative selection:bg-red-600 selection:text-white" id="main-layout-root">
      
      {/* Dynamic Toast Notification popup */}
      {notification && (
        <div 
          className="fixed bottom-6 right-6 z-55 bg-neutral-900 border-r-4 border-red-500 text-white px-5 py-4 rounded-xl shadow-2xl max-w-sm flex items-center gap-3 animate-slide-in text-right font-medium"
          id="toast-notification"
        >
          <Zap className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />
          <span className="text-sm leading-snug">{notification}</span>
        </div>
      )}

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
          const termUser = localStorage.getItem('youtube_token');
          if (!termUser) {
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
          downloadCount={completeDownloadsCount}
        />

        {/* Main Content View Frame */}
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden min-h-[calc(100vh-3.5rem)]" id="main-content-canvas">
          
          {/* A. If a video is SELECTED to play (Detail view context) */}
          {selectedVideo ? (
            <div className="space-y-4">
              <button
                onClick={() => {
                  setSelectedVideo(null);
                  const newUrl = window.location.origin + window.location.pathname;
                  window.history.pushState({ path: newUrl }, '', newUrl);
                }}
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#1f1f1f] hover:bg-[#2b2b2b] text-gray-300 font-bold text-xs rounded-lg transition-colors border border-gray-800"
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
                  <button className="hover:bg-neutral-800 p-1.5 rounded-full transition-colors cursor-pointer">
                    <MoreVertical className="w-6 h-6 text-white" />
                  </button>
                  <button className="hover:bg-neutral-800 p-1.5 rounded-full transition-colors cursor-pointer">
                    <Search className="w-6 h-6 text-white" />
                  </button>
                </div>
                <button
                  onClick={() => setSelectedChannel(null)}
                  className="hover:bg-neutral-800 p-1.5 rounded-full transition-colors cursor-pointer shrink-0"
                >
                  <ArrowRight className="w-6 h-6 text-white" />
                </button>
              </div>

              {/* Profile Info */}
              <div className="px-4 md:px-8 mt-2 max-w-5xl mx-auto">
                <div className="flex items-center gap-4">
                  <div className="flex-1 flex flex-col justify-center gap-0.5">
                     <h2 className="text-2xl sm:text-[26px] font-bold text-white leading-tight">{selectedChannel}</h2>
                     <span className="text-lg text-white font-bold" dir="ltr">Abdellatif Said</span>
                     <span className="text-[13px] text-gray-400 mt-1">
                       @{selectedChannel?.toLowerCase().replace(/\s+/g, '')}A
                     </span>
                     <span className="text-[13px] text-gray-400 mt-0.5 whitespace-nowrap">
                       {videosList.find(v => v.channelName === selectedChannel)?.subscribers || '58 ألف'} مشترك • {videosList.filter(v => v.channelName === selectedChannel).length} فيديو
                     </span>
                  </div>
                  <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full overflow-hidden shrink-0 ml-2">
                     <img src={videosList.find(v => v.channelName === selectedChannel)?.channelAvatar || undefined || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=60'} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                  </div>
                </div>

                {/* Description */}
                <p className="mt-4 text-[13px] text-gray-300 leading-relaxed text-right line-clamp-2">
                  مرحباً بك في قناة {selectedChannel}! هنا تجد كل ما تحتاجه لتطوير مهاراتك التقنية وتحقيق النجاح في عالم الإنترنت. نقدم دروساً <span className="text-white font-bold cursor-pointer">...المزيد</span>
                </p>

                {/* Links */}
                <a href="#" className="inline-block mt-2 text-[13px] text-white hover:underline font-bold max-w-full truncate text-right w-full" dir="ltr">
                  abdellatifsaid.com و 39 روابط إضافية
                </a>

                {/* Buttons Component */}
                <div className="flex items-center gap-2 mt-5">
                   <button 
                     onClick={() => handleUpdateChannelSubscription(selectedChannel || '', !subscriptions.includes(selectedChannel || ''), '')}
                     className={`flex-[2] ${subscriptions.includes(selectedChannel || '') ? 'bg-[#272727] hover:bg-[#3f3f3f] text-white' : 'bg-white hover:bg-gray-200 text-black'} py-2 rounded-full text-[13px] font-bold flex justify-center items-center gap-2 transition-colors cursor-pointer h-9 shrink-0`}
                   >
                     {subscriptions.includes(selectedChannel || '') ? (
                       <>
                         <ChevronDown className="w-4 h-4 text-white" />
                         <span>تم الاشتراك</span>
                         <BellRing className="w-4 h-4 text-white" />
                       </>
                     ) : (
                       <span>اشتراك</span>
                     )}
                   </button>
                   <button className="flex-1 bg-[#272727] hover:bg-[#3f3f3f] py-2 rounded-full text-[13px] font-bold text-white flex justify-center items-center gap-2 transition-colors cursor-pointer h-9 shrink-0">
                     <Users className="w-5 h-5 text-white" />
                     <span>المنتدى</span>
                   </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-6 mt-6 border-b border-neutral-800 px-4 md:px-8 overflow-x-auto scrollbar-none max-w-5xl mx-auto">
                <button className="pb-3 text-sm font-bold text-white border-b-2 border-white whitespace-nowrap shrink-0 px-1">الفيديوهات</button>
                <button className="pb-3 text-sm font-bold text-gray-400 whitespace-nowrap shrink-0 hover:text-gray-200 px-1">Shorts</button>
                <button className="pb-3 text-sm font-bold text-gray-400 whitespace-nowrap shrink-0 hover:text-gray-200 px-1">قوائم التشغيل</button>
                <button className="pb-3 text-sm font-bold text-gray-400 whitespace-nowrap shrink-0 hover:text-gray-200 px-1">المنشورات</button>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 mt-4 px-4 md:px-8 max-w-5xl mx-auto">
                <button className="bg-white text-black px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer shrink-0">الأحدث</button>
                <button className="bg-[#272727] text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:bg-[#3f3f3f] shrink-0 border border-transparent">الرائجة</button>
                <button className="bg-[#272727] text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:bg-[#3f3f3f] shrink-0 border border-transparent">الأقدم</button>
              </div>

              {/* Horizontal List of Videos */}
               <div className="mt-4 px-0 max-w-5xl mx-auto flex flex-col gap-0 pb-10">
                  {videosList.filter(v => v.channelName === selectedChannel).length === 0 ? (
                    <div className="py-12 text-center text-sm text-gray-400 rounded-2xl w-full">
                      لا توجد فيديوهات بعد.
                    </div>
                  ) : (
                    videosList.filter(v => v.channelName === selectedChannel).map(vid => (
                      <div 
                        key={vid.id} 
                        onClick={() => handleSelectVideoToPlay(vid)}
                        className="flex items-start gap-3 w-full cursor-pointer active:bg-neutral-900 transition-colors py-2 px-3 group"
                      >
                         <div className="relative w-40 h-[90px] sm:w-[200px] sm:h-[113px] shrink-0 rounded-lg overflow-hidden bg-neutral-900 shadow-md">
                           <img src={vid.thumbnail || undefined} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                           <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[11px] text-white font-mono font-bold">
                             {vid.duration}
                           </div>
                         </div>
                         <div className="flex-1 min-w-0 flex flex-col text-right h-[90px] sm:h-[113px] justify-start py-0.5 relative">
                           <h3 className="text-[13px] sm:text-base font-medium text-white line-clamp-2 leading-snug group-hover:text-red-400 transition-colors pl-6 mb-1">
                             {vid.title}
                           </h3>
                           <button className="absolute left-0 top-0 text-white shrink-0 p-1 opacity-70 hover:opacity-100 hover:bg-neutral-800 rounded-full" onClick={(e) => {e.stopPropagation();}}>
                             <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
                           </button>
                           <div className="text-[11px] sm:text-[13px] text-gray-400 mt-0 flex items-center gap-1 font-medium flex-wrap">
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
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1" id="categories-slider">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
                          activeCategory === cat
                            ? 'bg-white text-[#0f0f0f]'
                            : 'bg-[#272727] text-white hover:bg-[#3f3f3f]'
                        }`}
                        id={`category-pill-${cat}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Videos Grid display */}
                  {filteredVideos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-3" id="no-videos-empty">
                      <Search className="w-10 h-10 text-red-500 animate-pulse" />
                      <h3 className="text-lg font-bold">لم نجد أي فيديوهات مطابقة</h3>
                      <p className="text-sm text-gray-400">حاول البحث باستخدام كلمة مفتاحية أخرى أو تصفية فئة بديلة.</p>
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
                  <div className="bg-[#121212] p-4 rounded-xl border border-[#272727] space-y-3">
                    <span className="text-[11px] text-gray-500 font-bold block">القنوات المشترك بها من قاعدة البيانات</span>
                    {subscriptions.length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-xs">
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
                              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-red-500/10 group-hover:border-red-600 transition-all bg-neutral-900 object-cover active:scale-95 duration-100">
                                <img 
                                  src={channel.channelAvatar || undefined} 
                                  className="w-full h-full object-cover animate-fade-in" 
                                  alt="" 
                                  referrerPolicy="no-referrer" 
                                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60'; }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-400 group-hover:text-white line-clamp-1 max-w-[70px] font-bold">
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
                    <span className="text-xs text-green-500 font-semibold">• متصل بقاعدة البيانات حياً</span>
                  </div>

                  {/* Regular Feed Grid */}
                  {subscriptions.length === 0 ? (
                    <div className="text-center py-20 text-gray-400 text-sm">
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
                  <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                    <h2 className="text-xl font-bold">سجل المشاهدة الأخير</h2>
                    <span className="text-xs text-gray-400">يتم ترتيبها بحسب الأحدث مشاهدة</span>
                  </div>

                  {historyIds.length === 0 ? (
                    <div className="text-center py-20 text-gray-400 text-sm">
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
                  <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                    <h2 className="text-xl font-bold">الفيديوهات التي أعجبتني</h2>
                    <span className="text-xs text-red-400 font-bold flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                      <span>{likedVideoIds.length} فيديوهات ممتعة</span>
                    </span>
                  </div>

                  {likedVideoIds.length === 0 ? (
                    <div className="text-center py-20 text-gray-400 text-sm">
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
                      <div className="p-6 bg-[#161616] text-sm text-gray-400 rounded-2xl">
                        لم يتم تخزين أي فيديوهات بعد. حملها من الرئيسية لتظهر لتشغيلها والإنترنت مقطوع.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {downloadsList.filter(d => d.status === 'completed').slice(0, 3).map(item => (
                          <div 
                             key={item.id} 
                             onClick={() => handleSelectVideoToPlay(item.video)}
                             className="bg-[#121212] p-3 rounded-xl border border-[#232323] hover:shadow-lg transition-all cursor-pointer flex gap-3.5 items-center group"
                          >
                            <img src={item.video.thumbnail || undefined} className="w-16 rounded-md aspect-video object-cover" alt="" referrerPolicy="no-referrer" />
                            <div>
                              <h4 className="text-xs font-bold line-clamp-1 group-hover:text-red-400">{item.video.title}</h4>
                              <p className="text-[10px] text-gray-500 mt-1">{item.fileSize}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Part 2: Uploaded Videos segment */}
                  <div className="space-y-3">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                      <Plus className="w-5 h-5 text-red-500 bg-red-500/10 p-0.5 rounded-full border border-red-500/20" />
                      <span>قناتك الخاصة وفيديوهاتك المرفوعة</span>
                    </h2>
                    {videosList.filter(v => v.id.toString().startsWith('custom-')).length === 0 ? (
                      <div className="p-6 bg-[#161616] text-sm text-gray-400 rounded-2xl flex items-center justify-between">
                        <span>لم تقم برفع أي فيديو خاص بك حتى الآن هل تود تجربة ذلك؟</span>
                        <button 
                          onClick={() => {
                            const termUser = localStorage.getItem('youtube_token');
                            if (!termUser) {
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
                            className="bg-[#121212] p-3 rounded-xl border border-[#232323] hover:shadow-lg transition-all cursor-pointer flex gap-3.5 items-center group"
                          >
                            <img src={vid.thumbnail || undefined} className="w-16 rounded-md aspect-video object-cover" alt="" referrerPolicy="no-referrer" />
                            <div>
                              <h4 className="text-xs font-bold line-clamp-1 group-hover:text-red-400">{vid.title}</h4>
                              <p className="text-[10px] text-gray-500 mt-1">{vid.category}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Part 3: Saved Videos */}
                  <div className="space-y-3">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                      <Bookmark className="w-5 h-5 text-red-500" />
                      <span>المحفوظات (المشاهدة لاحقاً) ({savedVideoIds.length})</span>
                    </h2>
                    {savedVideoIds.length === 0 ? (
                      <div className="p-6 bg-[#161616] text-sm text-gray-400 rounded-2xl">
                        لم تقم بحفظ أي فيديوهات لمشاهدتها لاحقاً.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {videosList.filter(v => savedVideoIds.includes(v.id)).slice(0, 3).map(vid => (
                          <div 
                            key={vid.id} 
                            onClick={() => handleSelectVideoToPlay(vid)}
                            className="bg-[#121212] p-3 rounded-xl border border-[#232323] hover:shadow-lg transition-all cursor-pointer flex gap-3.5 items-center group"
                          >
                            <img src={vid.thumbnail || undefined} className="w-16 rounded-md aspect-video object-cover" alt="" referrerPolicy="no-referrer" />
                            <div className="flex-1">
                              <h4 className="text-xs font-bold line-clamp-1 group-hover:text-red-400">{vid.title}</h4>
                              <p className="text-[10px] text-gray-500 mt-1">{vid.channelName}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Part 4: Liked Videos Summary */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <Heart className="w-5 h-5 text-red-500" />
                        <span>فيديوهات أعجبتني ({likedVideoIds.length})</span>
                      </h2>
                      <button onClick={() => setActiveTab('liked')} className="text-sm font-bold text-blue-400 hover:text-blue-300">
                        عرض الكل
                      </button>
                    </div>
                    {likedVideoIds.length === 0 ? (
                      <div className="p-6 bg-[#161616] text-sm text-gray-400 rounded-2xl">
                        لم تضع إعجاباً لأي فيديو بعد.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {videosList.filter(v => likedVideoIds.includes(v.id)).slice(0, 3).map(vid => (
                          <div 
                            key={vid.id} 
                            onClick={() => handleSelectVideoToPlay(vid)}
                            className="bg-[#121212] p-3 rounded-xl border border-[#232323] hover:shadow-lg transition-all cursor-pointer flex gap-3.5 items-center group"
                          >
                            <img src={vid.thumbnail || undefined} className="w-16 rounded-md aspect-video object-cover" alt="" referrerPolicy="no-referrer" />
                            <div className="flex-1">
                              <h4 className="text-xs font-bold line-clamp-1 group-hover:text-red-400">{vid.title}</h4>
                              <p className="text-[10px] text-gray-500 mt-1">{vid.channelName}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Part 5: History Summary */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <History className="w-5 h-5 text-red-500" />
                        <span>سجل المشاهدة</span>
                      </h2>
                      <button onClick={() => setActiveTab('history')} className="text-sm font-bold text-blue-400 hover:text-blue-300">
                        عرض الكل
                      </button>
                    </div>
                    {historyIds.length === 0 ? (
                      <div className="p-6 bg-[#161616] text-sm text-gray-400 rounded-2xl">
                        لا يوجد أي سجل مشاهدات.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {videosList.filter(v => historyIds.some(h => h.id === v.id)).slice(0, 3).map(vid => (
                          <div 
                            key={vid.id} 
                            onClick={() => handleSelectVideoToPlay(vid)}
                            className="bg-[#121212] p-3 rounded-xl border border-[#232323] hover:shadow-lg transition-all cursor-pointer flex gap-3.5 items-center group"
                          >
                            <img src={vid.thumbnail || undefined} className="w-16 rounded-md aspect-video object-cover" alt="" referrerPolicy="no-referrer" />
                            <div className="flex-1">
                              <h4 className="text-xs font-bold line-clamp-1 group-hover:text-red-400">{vid.title}</h4>
                              <p className="text-[10px] text-gray-500 mt-1">{vid.channelName}</p>
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
            </div>
          )}
        </main>
      </div>

      {/* Styled Footer copyright block */}
      <footer className="bg-[#0b0b0b] border-t border-[#222222] py-4 pb-20 md:pb-4 text-center text-xs text-gray-500 space-y-1 select-none flex flex-col items-center justify-center font-sans" id="app-footer">
        <p className="flex items-center gap-1 font-bold text-gray-400">
          YouTube Clone - 100% Database Powered © ٢٠٢٦
        </p>
        <p className="text-[11px] text-gray-500">
          مطور بنظام الأوفلاين الذكي ومبني باستخدام تقنية React و IndexedDB مع قاعدة بيانات متكاملة
        </p>
      </footer>

      {/* Mobile Bottom Navigation Bar styled identically to the official YouTube App (RTL) */}
      <div 
        className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#0F0F0F] border-t border-[#272727] flex items-center justify-around z-40 px-2 pb-1 text-white" 
        id="mobile-bottom-bar"
      >
        {/* الرئيسية */}
        <button 
          onClick={() => { setSelectedVideo(null); setActiveTab('home'); }}
          className={`flex flex-col items-center justify-center w-14 h-full gap-0.5 select-none ${
            activeTab === 'home' ? 'text-white' : 'text-gray-400'
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
            activeTab === 'shorts' ? 'text-white' : 'text-gray-400'
          }`}
          id="m-nav-shorts"
        >
          <Zap className="w-5 h-5 mx-auto" />
          <span className="text-[9px] font-medium leading-none">Shorts</span>
        </button>

        {/* Create / Upload */}
        <button 
          onClick={() => {
            const savedToken = localStorage.getItem('youtube_token');
            if (!savedToken) {
              setNotification('⚠️ يرجى تسجيل الدخول أولاً كصانع محتوى لتستطيع رفع الفيديوهات إلى قاعدة البيانات!');
              setTimeout(() => setNotification(null), 3500);
              setActiveTab('account');
            } else {
              setShowUploadModal(true);
            }
          }}
          className="flex items-center justify-center w-11 h-11 bg-[#272727] active:scale-90 hover:bg-[#3f3f3f] rounded-full border border-neutral-800 transition-all"
          title="رفع فيديو جديد"
          id="m-nav-upload"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>

        {/* الاشتراكات */}
        <button 
          onClick={() => { setSelectedVideo(null); setActiveTab('subscriptions'); }}
          className={`flex flex-col items-center justify-center w-14 h-full gap-0.5 select-none ${
            activeTab === 'subscriptions' ? 'text-white' : 'text-gray-400'
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
            activeTab === 'account' ? 'text-white' : 'text-gray-400'
          }`}
          id="m-nav-you"
        >
            {currentUser?.username ? (
            <div className={`w-5 h-5 rounded-full bg-[#cc1111] overflow-hidden flex items-center justify-center text-[9px] font-black text-white hover:scale-105 border ${
              activeTab === 'account' ? 'border-white' : 'border-transparent'
            }`}>
              {currentUser.username.substring(0, 2).toUpperCase()}
            </div>
          ) : currentUser ? (
            <div className={`w-5 h-5 rounded-full bg-[#cc1111] overflow-hidden flex items-center justify-center text-[9px] font-black text-white hover:scale-105 border ${
              activeTab === 'account' ? 'border-white' : 'border-transparent'
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
