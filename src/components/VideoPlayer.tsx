import React, { useState, useEffect, useRef } from 'react';
import { ThumbsUp, ThumbsDown, Bookmark, ChevronLeft, X, Download, Check, Trash2, Share2, CornerUpLeft, MoreVertical, WifiOff, RefreshCw, Send, Sparkles } from 'lucide-react';
import { 
  incrementView, toggleLikeVideo, getComments, addComment, toggleSubscriptionToUser, deleteVideo 
} from '../services/db';
import { auth } from '../lib/firebase';
import { Video, Comment, DownloadedItem } from '../types';
import ShareModal from './ShareModal';

// Extract YouTube ID from URL helper
function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

interface VideoPlayerProps {
  video: Video;
  downloadStatus: DownloadedItem | undefined;
  onDownload: () => void;
  onDeleteDownload: () => void;
  isOffline: boolean;
  onGoBack: () => void;
  onRelatedSelect: (v: Video) => void;
  allVideos: Video[];
  // Callbacks for global state
  onUpdateVideoStats?: (videoId: string, updatedFields: Partial<Video>) => void;
  onUpdateChannelSubscription?: (channelName: string, isSubscribed: boolean, subscribersText: string) => void;
  onChannelClick?: (channelName: string) => void;
  onToggleSave?: (videoId: string) => void;
  onDelete?: (videoId: string) => void;
  isSaved?: boolean;
}

export default function VideoPlayer({
  video,
  downloadStatus,
  onDownload,
  onDeleteDownload,
  isOffline,
  onGoBack,
  onRelatedSelect,
  allVideos,
  onUpdateVideoStats,
  onUpdateChannelSubscription,
  onChannelClick,
  onToggleSave,
  onDelete,
  isSaved
}: VideoPlayerProps) {
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [showCommentsDrawer, setShowCommentsDrawer] = useState(false);
  const [likesCount, setLikesCount] = useState(video.likes);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribersText, setSubscribersText] = useState(video.subscribers);
  const [viewsText, setViewsText] = useState(video.views);
  const [showDesc, setShowDesc] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentVal, setNewCommentVal] = useState('');
  
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Initialize likes/comments when video changes
  useEffect(() => {
    // 1. Fetch Comments from Backend Database
    const loadComments = async () => {
      try {
        const data = await getComments(video.id);
        setComments(data as any);
      } catch (err) {
        console.error("Failed comments loading", err);
        setComments([]);
      }
    };

    loadComments();

    // Check subscribed status
    const subscribed = video.subscribed !== undefined ? !!video.subscribed : (localStorage.getItem(`sub_${video.channelName}`) === 'true');
    setIsSubscribed(subscribed);

    // Set like/view/subscriber states from incoming video parameters
    setLiked(!!video.liked);
    setLikesCount(video.likes);
    setSubscribersText(video.subscribers);
    setViewsText(video.views);

    // 2. Increment view count dynamically on backend
    const recordView = async () => {
      try {
        const newViews = await incrementView(video.id);
        if (newViews) {
          setViewsText(newViews.toString());
          if (onUpdateVideoStats) onUpdateVideoStats(video.id, { views: newViews.toString() });
        }
      } catch (err) {
        console.error("Failed to register view play", err);
      }
    };

    if (!isOffline) {
      recordView();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [video.id, isOffline]);

  const handleLike = async () => {
    if (!auth.currentUser) {
      alert('⚠️ يرجى تسجيل الدخول أولاً لتسجيل الإعجاب بالفيديوهات حياً!');
      return;
    }

    try {
      const res = await toggleLikeVideo(video.id, auth.currentUser.uid);
      if (res) {
        setLiked(res.hasLiked);
        if (res.hasLiked) setDisliked(false);
        setLikesCount(res.totalLikes);
        if (onUpdateVideoStats) {
          onUpdateVideoStats(video.id, { liked: res.hasLiked, likes: res.totalLikes });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDislike = async () => {
    if (!auth.currentUser) {
      alert('⚠️ يرجى تسجيل الدخول أولاً للمشاركة برأيك!');
      return;
    }
    
    // Toggle internal dislike state
    const nextDisliked = !disliked;
    setDisliked(nextDisliked);
    
    // Mutual exclusivity
    if (nextDisliked && liked) {
      // Opt out of like
      await handleLike(); // This will toggle the like off via API
    }
  };

  const handleSubscribe = async () => {
    if (!auth.currentUser) {
      alert('⚠️ يرجى تسجيل الدخول للاشتراك بالقنوات');
      return;
    }
    const nextSub = !isSubscribed;

    // Optimistically update local states
    setIsSubscribed(nextSub);
    localStorage.setItem(`sub_${video.channelName}`, nextSub ? 'true' : 'false');

    try {
      const subs = await toggleSubscriptionToUser(auth.currentUser.uid, video.channelName);
      if (subs) {
        setIsSubscribed(subs.includes(video.channelName));
        if (onUpdateChannelSubscription) {
          onUpdateChannelSubscription(video.channelName, subs.includes(video.channelName), 'تحديث حقيقي');
        }
      }
    } catch (err) {
      console.error("Failed subscribing call", err);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentVal.trim()) return;
    if (!auth.currentUser) {
      alert('يرجى تسجيل الدخول لتتمكن من إضافة تعليق');
      return;
    }

    try {
      const newComment = await addComment(video.id, auth.currentUser.uid, newCommentVal.trim());
      setComments(prev => [newComment as any, ...prev]);
      setNewCommentVal('');
    } catch (err) {
      console.error(err);
      alert('فشل التعليق. يرجى التحقق من اتصال قاعدة البيانات.');
    }
  };

  const handleDeleteVideo = async () => {
    if (confirm('هل أنت متأكد من رغبتك في حذف هذا الفيديو نهائياً من قاعدة البيانات والتخزين؟ لا يمكن التراجع عن هذه الخطوة!')) {
      if (isDownloading) {
        alert('لا يمكن حذف الفيديو أثناء تحميله للكمبيوتر!');
        return;
      }
      try {
        if (onDelete) {
          await onDelete(video.id);
        } else {
          await deleteVideo(video.id);
        }
        
        // Remove v=... from URL
        const newUrl = window.location.origin + window.location.pathname;
        window.history.pushState({ path: newUrl }, '', newUrl);

        onGoBack();
      } catch (err) {
        console.error(err);
        alert('❌ حدث خطأ أثناء محاولة حذف الفيديو. تأكد من أنك صاحب الفيديو.');
      }
    }
  };

  // Check if we have offline video playable
  const isDownloaded = downloadStatus?.status === 'completed';
  const isDownloading = downloadStatus?.status === 'downloading';
  const downloadProgress = downloadStatus?.progress || 0;
  
  // Decide the source URL: if downloaded, use local Object URL, else use live url
  const videoSourceUrl = isDownloaded && downloadStatus?.blobUrl ? downloadStatus.blobUrl : video.src;
  
  // Detect if this is a YouTube video URL
  const ytId = getYouTubeId(videoSourceUrl) || getYouTubeId(video.src);

  // Show error screen if offline AND not downloaded
  const showOfflineUnsupported = isOffline && !isDownloaded;

  const relatedVideos = allVideos
    .filter(v => v.id !== video.id && !v.isShort)
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-white pb-10" id={`video-player-container-${video.id}`}>
      {/* Right Column: Player, Video Info, Actions, Comments */}
      <div className="lg:col-span-2 space-y-4">
        {/* Playable Wrapper */}
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-lg border border-[#272727]">
          {showOfflineUnsupported ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#141414] text-center p-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500">
                <WifiOff className="w-8 h-8" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="text-lg font-bold">هذا الفيديو غير متوفر أوفلاين</h3>
                <p className="text-sm text-gray-400">
                  أنت مفعّل "وضع الطيران غير المتصل". لم يتم تحميل هذا الفيديو للاستعراض بلا إنترنت مسبقاً.
                </p>
              </div>
              <button
                onClick={onDownload}
                className="flex items-center gap-2 bg-red-600 text-white font-bold py-2 px-5 rounded-full hover:bg-red-700 transition-colors shadow-md shadow-red-600/20"
              >
                <Download className="w-4 h-4" />
                <span>تحميله عند الاتصال بالإنترنت</span>
              </button>
            </div>
          ) : (
            ytId ? (
              <iframe
                src={`https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`}
                title={video.title}
                frameBorder="0"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full"
                id="youtube-video-player"
              />
            ) : (
              <video
                ref={videoRef}
                src={videoSourceUrl || undefined}
                controls
                autoPlay
                className="w-full h-full"
                poster={video.thumbnail || undefined}
                playsInline
                id="html5-video-player"
              />
            )
          )}
        </div>

        {/* Video Title */}
        <h1 className="text-base md:text-lg font-black leading-snug select-text text-right px-1 mt-3 text-white">{video.title}</h1>

        {/* Dynamic Metadata Subtitle (views, upload date, tags, and clickable expandable trigger) */}
        <div 
          onClick={() => setShowDesc(!showDesc)}
          className="text-xs text-gray-400 font-medium flex flex-wrap items-center gap-2 mt-1 px-1 cursor-pointer select-none hover:text-white transition-colors justify-start text-right"
          dir="rtl"
        >
          <span className="font-bold">{viewsText}</span>
          <span className="text-gray-600">•</span>
          <span>{video.uploadDate || 'قبل أيام'}</span>
          <span className="text-gray-600">•</span>
          <span className="text-red-500 font-semibold">#{video.category ? video.category.replace(/\s+/g, '_') : 'سينما'}</span>
          <span className="text-white font-extrabold cursor-pointer hover:underline inline-flex items-center gap-0.5">
            {showDesc ? ' ...عرض أقل' : ' ...المزيد'}
          </span>
        </div>

        {/* Expandable detailed description pane */}
        {showDesc && (
          <div 
            className="bg-[#181818] border border-neutral-800/80 p-4 rounded-2xl text-right animate-fade-in text-xs space-y-2.5 leading-relaxed text-gray-300 mb-2"
            dir="rtl"
          >
            <div className="font-extrabold text-white text-xs mb-1">وصف الفيديو التفصيلي:</div>
            <p className="whitespace-pre-line text-xs font-medium leading-relaxed">{video.description}</p>
            <div className="text-[10px] text-gray-500 pt-2 border-t border-neutral-800/60 flex items-center justify-between">
              <span>القسم: {video.category}</span>
              <span>رمز المقطع: {video.id}</span>
            </div>
          </div>
        )}

        {/* Channels & Action Pill Bar Scrolling Strip */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-3.5 pt-1.5 scrollbar-none justify-start select-none border-b border-neutral-900" dir="rtl">
          {/* Channel Block & Subscribe Option */}
          <div className="flex items-center gap-2 shrink-0">
            <div 
              onClick={() => onChannelClick && onChannelClick(video.channelName)}
              className="w-9 h-9 rounded-full overflow-hidden border border-[#272727] bg-[#3a3a3a] cursor-pointer hover:ring-2 hover:ring-red-500/50 transition-all shrink-0"
              title={`عرض ملف قناة ${video.channelName}`}
            >
              <img 
                src={video.channelAvatar || undefined} 
                alt={video.channelName} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60'; }}
              />
            </div>
            <div className="flex flex-col text-right shrink-0">
              <span 
                onClick={() => onChannelClick && onChannelClick(video.channelName)}
                className="text-xs font-bold text-white hover:underline cursor-pointer truncate max-w-[100px]"
              >
                {video.channelName}
              </span>
              <span className="text-[10px] text-gray-500">{subscribersText}</span>
            </div>
            
            <button
              onClick={handleSubscribe}
              className={`mr-1 px-3 py-1.5 text-[11px] font-black rounded-full transition-all active:scale-95 cursor-pointer shrink-0 ${
                isSubscribed 
                  ? 'bg-[#272727] text-gray-300 hover:bg-neutral-800 border border-neutral-800/60 font-bold flex items-center gap-1' 
                  : 'bg-white text-black hover:bg-gray-200'
              }`}
            >
              {isSubscribed ? (
                <span className="flex items-center gap-1 text-[10px]">
                  <span>🔔</span>
                  <span>مشترك</span>
                  <span className="text-[8px] opacity-60">∨</span>
                </span>
              ) : 'اشتراك'}
            </button>
          </div>

          <div className="h-5 w-px bg-neutral-800 shrink-0 self-center mx-1"></div>

          {/* Unified Likes/Dislikes split pill */}
          <div className="flex items-center bg-[#272727] border border-neutral-800/80 hover:bg-[#323232] rounded-full h-9 transition-colors shrink-0">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-all active:scale-95 rounded-r-full h-full ${
                liked ? 'text-red-500 bg-red-500/5' : 'text-gray-300 hover:text-white'
              }`}
              id="btn-like-video-modified"
            >
              <ThumbsUp className={`w-3.5 h-3.5 ${liked ? 'fill-red-500' : ''}`} />
              <span className="font-mono text-[11px]">{likesCount.toLocaleString()}</span>
            </button>
            <div className="w-[1px] h-4 bg-neutral-700/60"></div>
            <button
              onClick={handleDislike}
              className={`flex items-center px-3 py-2 text-xs font-bold transition-all active:scale-95 rounded-l-full h-full ${
                disliked ? 'text-neutral-400 bg-neutral-800' : 'text-gray-400 hover:text-white'
              }`}
            >
              <ThumbsDown className={`w-3.5 h-3.5 ${disliked ? 'fill-neutral-400 text-neutral-400' : ''}`} />
            </button>
          </div>

          {/* Share Pill */}
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 px-3.5 h-9 bg-[#272727] hover:bg-[#323232] border border-neutral-800/65 rounded-full text-xs text-gray-300 hover:text-white shrink-0 font-bold transition-colors select-none cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 rotate-180" />
            <span>مشاركة</span>
          </button>

          {/* Save / Library Pill */}
          <button
            onClick={() => {
              if (onToggleSave) onToggleSave(video.id);
            }}
            className={`flex items-center gap-1.5 px-3.5 h-9 ${isSaved ? 'bg-red-600 hover:bg-red-700 text-white border-transparent' : 'bg-[#272727] hover:bg-[#323232] text-gray-300 border border-neutral-800/65'} rounded-full text-xs hover:text-white shrink-0 font-bold transition-colors select-none cursor-pointer`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-white' : ''}`} />
            <span>{isSaved ? 'محفوظ' : 'حفظ'}</span>
          </button>

          {auth.currentUser && (video as any).userId === auth.currentUser.uid && (
            <button
              onClick={handleDeleteVideo}
              className="flex items-center gap-1.5 px-3.5 h-9 bg-red-900 border border-red-500/30 hover:bg-red-700 text-white rounded-full text-xs shrink-0 font-bold transition-colors select-none cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>أمسح الفيديو حقاً</span>
            </button>
          )}

          {/* Interactive Downloader Pill */}
          {isDownloaded ? (
            <button
              onClick={onDeleteDownload}
              className="flex items-center gap-1.5 px-3.5 h-9 text-xs font-bold rounded-full bg-green-650 hover:bg-red-650 text-white transition-all active:scale-95 group shadow-md shadow-green-600/10 cursor-pointer shrink-0"
              title="اضغط لحذف التحميل من الذاكرة المحلية"
            >
              <Check className="w-3.5 h-3.5 text-white group-hover:hidden animate-pulse" />
              <Trash2 className="w-3.5 h-3.5 text-white hidden group-hover:inline" />
              <span className="group-hover:hidden">محفـوظ بالجهـاز</span>
              <span className="hidden group-hover:inline">حذف الفيديو المحمل</span>
            </button>
          ) : isDownloading ? (
            <div className="flex items-center gap-1.5 px-3.5 h-9 text-xs font-bold rounded-full bg-blue-600/20 border border-blue-500 text-blue-400 shrink-0">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>تنزيل {downloadProgress}%</span>
            </div>
          ) : (
            <button
              onClick={onDownload}
              disabled={isOffline}
              className={`flex items-center gap-1.5 px-3.5 h-9 text-xs font-bold rounded-full transition-all active:scale-95 border shrink-0 cursor-pointer ${
                isOffline 
                  ? 'bg-[#1a1a1a] border-neutral-800 text-gray-600 cursor-not-allowed'
                  : 'bg-white hover:bg-gray-200 text-black shadow-md shadow-white/5'
              }`}
              title={isOffline ? "غير متوفر التحميل في وضع عدم الاتصال" : "تحميل بدون إنترنت"}
            >
              <Download className="w-3.5 h-3.5 text-red-600" />
              <span>تنزيل</span>
            </button>
          )}
        </div>

        {/* Slick Navigation Shortcuts for smooth jump scroll */}
        <div className="bg-[#141414] border border-neutral-800/80 rounded-xl p-3 flex flex-row items-center justify-between gap-2 shadow-md" id="video-easy-navigation-panel">
          <div className="flex items-center gap-2 text-right">
            <Sparkles className="w-3.5 h-3.5 text-red-500 animate-pulse" />
            <span className="text-[10px] text-gray-300 font-bold">شريط الوصول السريع للتسهيل</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowCommentsDrawer(true)}
              type="button"
              className="px-2.5 py-1 bg-[#1c1c1c] border border-neutral-800 hover:bg-neutral-800 text-[10px] font-bold text-gray-200 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1 select-none"
            >
              💬 افتح التعليقات
            </button>
            <button
              onClick={() => {
                document.getElementById('related-videos-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              type="button"
              className="px-2.5 py-1 bg-[#1c1c1c] border border-neutral-800 hover:bg-neutral-800 text-[10px] font-bold text-gray-200 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1 select-none"
            >
              🍿 المقترحات
            </button>
          </div>
        </div>

        {/* Share Modal */}
      {showShareModal && (
        <ShareModal 
          videoUrl={window.location.origin + window.location.pathname + '?v=' + video.id}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* CLICK-DEPENDENT SPECIAL COMMENTS TRIGGER SECTION (Identical to Mobile Youtube App) */}
        <div 
          onClick={() => setShowCommentsDrawer(true)}
          className="bg-[#212121] hover:bg-[#2c2c2c] rounded-2xl p-4 cursor-pointer border border-[#2d2d2d]/30 transition-all text-right space-y-3.5 shadow-xl hover:shadow-2xl select-none"
          id="comments-trigger-card"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white">التعليقات</span>
              <span className="text-[11px] text-gray-400 font-mono font-bold bg-[#2d2d2d] px-2.5 py-0.5 rounded-full">{comments.length}</span>
            </div>
            <ChevronLeft className="w-4 h-4 text-gray-400" />
          </div>

          {comments.length > 0 ? (
            <div className="flex items-center gap-3 bg-[#161616]/70 p-3 rounded-xl border border-[#262626]">
              <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-neutral-800">
                <img 
                  src={comments[0].authorAvatar || undefined || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60'} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer" 
                  alt="" 
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60'; }}
                />
              </div>
              <p className="text-xs text-gray-300 truncate flex-1 text-right font-medium">
                {comments[0].text}
              </p>
            </div>
          ) : (
            <div className="text-xs text-gray-500 font-bold py-1">
              لا توجد تعليقات بعد. اضغط لعرض التعليقات وكتابة أول تعليق! ✨
            </div>
          )}
        </div>

        {/* THE SLIDING SIDEBAR/DRAWER OVERLAY WITH THE SAME PREMIUM COMMENTS UX */}
        {showCommentsDrawer && (
          <div 
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center animate-fade-in p-0 md:p-4 text-right"
            dir="rtl"
            id="comments-drawer-overlay"
          >
            {/* Backdrop Click Close */}
            <div className="absolute inset-0" onClick={() => setShowCommentsDrawer(false)}></div>

            {/* Panel Container */}
            <div 
              className="relative bg-[#161616] w-full md:max-w-xl h-[85vh] md:h-[75vh] rounded-t-3xl md:rounded-2xl border-t md:border border-neutral-800 flex flex-col overflow-hidden shadow-2xl z-10 animate-slide-up"
              id="comments-slider-drawer-body"
            >
              {/* Header Title Bar */}
              <div className="flex items-center justify-between p-4.5 border-b border-neutral-800 shrink-0 bg-[#1d1d1d]">
                <div className="flex items-center gap-2">
                  <span className="text-base font-black text-white">التعليقات</span>
                  <span className="text-xs text-gray-400 font-mono font-bold bg-[#2d2d2d] px-2.5 py-0.5 rounded-full">{comments.length}</span>
                </div>
                
                <button 
                  onClick={() => setShowCommentsDrawer(false)}
                  className="p-1.5 hover:bg-neutral-800 rounded-full transition-colors text-gray-400 hover:text-white cursor-pointer"
                  title="إغلاق التعليقات"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable list inside panel */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {/* Submit comment inside drawer is highly accessible */}
                <form onSubmit={handlePostComment} className="flex gap-2.5 bg-[#1c1c1c] p-3 rounded-xl border border-neutral-800 mb-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-[#272727] bg-[#3a3a3a]">
                    <img 
                      src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=60" 
                      alt="حسابي" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      placeholder="إضافة تعليق علني..."
                      value={newCommentVal || ''}
                      onChange={e => setNewCommentVal(e.target.value)}
                      className="flex-1 bg-transparent border-b border-neutral-800 focus:border-red-600 focus:outline-none text-xs py-1 placeholder-gray-500 text-white font-medium"
                      id="comment-input-drawer"
                    />
                    <button 
                      type="submit"
                      disabled={!newCommentVal.trim()}
                      className={`p-2 rounded-full transition-all shrink-0 ${
                        newCommentVal.trim() 
                          ? 'bg-red-600 text-white active:scale-95 cursor-pointer' 
                          : 'text-gray-500 bg-neutral-900 cursor-not-allowed'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>

                {/* Listing of comments */}
                {comments.length > 0 ? (
                  <div className="space-y-4 pt-1">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3 text-sm select-text border-b border-neutral-900/60 pb-3" id={`drawer-comment-card-${comment.id}`}>
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-neutral-800">
                          <img 
                            src={comment.authorAvatar || undefined || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60'} 
                            alt={comment.authorName} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60'; }}
                          />
                        </div>

                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{comment.authorName}</span>
                            <span className="text-[10px] text-gray-500">{comment.timestamp}</span>
                          </div>
                          
                          <p className="text-gray-300 leading-relaxed text-xs text-right font-normal">{comment.text}</p>
                          
                          <div className="flex items-center gap-3 pt-1 text-[10px] text-gray-500 font-medium">
                            <button className="flex items-center gap-1 hover:text-white transition-colors">
                              <ThumbsUp className="w-3 h-3" />
                              <span className="font-mono">{comment.likes}</span>
                            </button>
                            <span className="text-gray-800">•</span>
                            <button className="hover:text-white transition-colors">رد</button>
                          </div>

                          {/* Replies within the drawer */}
                          {comment.replies && comment.replies.length > 0 && (
                            <div className="mt-2 pr-3 border-r border-red-500/20 space-y-2">
                              {comment.replies.map((reply) => (
                                <div key={reply.id} className="flex gap-2 text-[11px]" id={`drawer-reply-${reply.id}`}>
                                  <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-neutral-800">
                                    <img src={reply.authorAvatar || undefined} alt={reply.authorName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className="font-bold text-white text-[10px]">{reply.authorName}</span>
                                      <span className="text-[9px] text-gray-500">{reply.timestamp}</span>
                                    </div>
                                    <p className="text-gray-300 leading-normal text-[11px] font-normal">{reply.text}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 space-y-2 text-gray-500 font-bold">
                    <span className="text-3xl block">💬</span>
                    <span className="text-xs">لا يوجد أي تعليق حالياً</span>
                    <p className="text-[10px] text-gray-650">كن أول المقترحين بترك تعليق يدعم المبدع!</p>
                  </div>
                )}
              </div>

              {/* Secure synchronization warning signature */}
              <div className="p-3 bg-[#111111] border-t border-neutral-800 shrink-0 text-center text-[10px] text-gray-400">
                ✨ يتم مزامنة جميع التعليقات حياً بقاعدة علمية
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Left Column: Related Videos Stream */}
      <div className="space-y-4" id="related-videos-section">
        <h3 className="text-base font-bold pr-1">الفيديوهات المقترحة</h3>
        <div className="space-y-3.5">
          {relatedVideos.map((rev) => {
            const revIsDownloaded = localStorage.getItem(`download_${rev.id}`) === 'completed';
            return (
              <div 
                key={rev.id}
                onClick={() => onRelatedSelect(rev)}
                className="flex gap-3 bg-[#121212] hover:bg-[#1c1c1c] p-2 rounded-xl border border-[#1e1e1e] cursor-pointer group transition-all"
                id={`related-video-${rev.id}`}
              >
                {/* Thumb */}
                <div className="relative w-32 aspect-video rounded-lg overflow-hidden shrink-0 bg-neutral-900">
                  <img 
                    src={rev.thumbnail || undefined} 
                    alt={rev.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute bottom-1 left-1 bg-black/80 font-mono text-[10px] px-1 rounded text-white">
                    {rev.duration}
                  </span>
                  {revIsDownloaded && (
                    <span className="absolute top-1 right-1 bg-green-600 p-0.5 rounded-full text-white">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <h4 className="text-xs font-bold leading-normal text-white group-hover:text-red-400 transition-colors line-clamp-2">
                    {rev.title}
                  </h4>
                  <p className="text-[11px] text-gray-400 truncate">{rev.channelName}</p>
                  <div className="text-[10px] text-gray-500 flex items-center gap-1 font-mono">
                    <span>{rev.views}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* 📥 Beautiful Floating Download Status Emotional Card Tracker */}
      {isDownloading && (
        <div className="fixed bottom-6 left-6 z-50 bg-[#161616]/95 border-2 border-green-500/30 rounded-2xl p-4 shadow-2xl flex items-center gap-3.5 max-w-sm animate-bounce shadow-green-500/10 text-right backdrop-blur-md" dir="rtl">
          <div className="w-11 h-11 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 relative shrink-0">
            <span className="text-xl animate-bounce">📥</span>
            <span className="absolute inset-0 rounded-full border border-green-500 animate-ping opacity-50"></span>
          </div>
          <div className="flex-1 min-w-[160px]">
            <span className="text-xs font-black text-white block">جاري تحميل هذا الفيديو الآن...</span>
            <span className="text-[10px] text-gray-400 block truncate mt-0.5">{video.title}</span>
            <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-2 overflow-hidden border border-neutral-700">
              <div className="bg-gradient-to-r from-green-500 to-emerald-400 h-full transition-all duration-300" style={{ width: `${downloadProgress}%` }}></div>
            </div>
            <div className="flex justify-between items-center mt-1 text-[10px] font-bold">
              <span className="text-green-400 font-mono">{downloadProgress}%</span>
              <span className="text-gray-500">حفظ بدون إنترنت 📼</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
