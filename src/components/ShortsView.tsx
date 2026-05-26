import { useState, useRef, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare, Share2, Download, Check, Volume2, VolumeX, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
import { Video, DownloadedItem } from '../types';
import { toggleLikeVideo, getSimpleAuthUser } from '../services/db';
import { auth } from '../lib/firebase';

interface ShortsViewProps {
  shorts: Video[];
  downloadStatusList: Record<string, DownloadedItem | undefined>;
  onDownload: (v: Video) => void;
  onDeleteDownload: (id: string) => void;
  isOffline: boolean;
  currentUser?: { user_id: string; username: string; email: string } | null;
}

export default function ShortsView({
  shorts,
  downloadStatusList,
  onDownload,
  onDeleteDownload,
  isOffline,
  currentUser
}: ShortsViewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [likedShorts, setLikedShorts] = useState<Record<string, boolean>>({});
  const [dislikedShorts, setDislikedShorts] = useState<Record<string, boolean>>({});
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const activeShort = shorts[activeIndex];

  useEffect(() => {
    // Play active index video, pause others
    videoRefs.current.forEach((video, index) => {
      if (video) {
        if (index === activeIndex) {
          video.muted = isMuted;
          video.play().catch(err => console.log('Autoplay blocked', err));
        } else {
          video.pause();
        }
      }
    });
  }, [activeIndex, isMuted, shorts]);

  if (shorts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center" id="no-shorts-fallback">
        <Sparkles className="w-12 h-12 text-red-500 animate-bounce mb-3" />
        <h3 className="text-lg font-bold">لا توجد مقاطع قصيرة</h3>
        <p className="text-gray-400 text-sm">تفقد الأقسام الأخرى للتطبيق لحين توفر مقاطع جديدة.</p>
      </div>
    );
  }

  const handleNext = () => {
    if (activeIndex < shorts.length - 1) {
      setActiveIndex(activeIndex + 1);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const handleLike = async (id: string) => {
    const user = currentUser || (auth.currentUser ? { user_id: auth.currentUser.uid } : null) || getSimpleAuthUser();
    if (!user) {
      alert('⚠️ يرجى تسجيل الدخول أولاً!');
      return;
    }
    
    try {
      await toggleLikeVideo(id, user.user_id);
    } catch (err) {}
    
    setLikedShorts(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
    setDislikedShorts(prev => ({ ...prev, [id]: false }));
  };

  const handleDislike = (id: string) => {
    setDislikedShorts(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
    setLikedShorts(prev => ({ ...prev, [id]: false }));
  };

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)] relative" id="shorts-main-viewer">
      {/* Desktop Navigation Helper columns */}
      <div className="absolute right-4 md:right-10 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30">
        <button
          onClick={handlePrev}
          disabled={activeIndex === 0}
          className={`p-3 rounded-full border border-[#272727] bg-[#121212]/85 hover:bg-[#272727] text-white active:scale-95 transition-all ${
            activeIndex === 0 ? 'opacity-40 cursor-not-allowed' : ''
          }`}
          title="المقطع السابق"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
        <button
          onClick={handleNext}
          disabled={activeIndex === shorts.length - 1}
          className={`p-3 rounded-full border border-[#272727] bg-[#121212]/85 hover:bg-[#272727] text-white active:scale-95 transition-all ${
            activeIndex === shorts.length - 1 ? 'opacity-40 cursor-not-allowed' : ''
          }`}
          title="المقطع التالي"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-stretch gap-4 md:gap-6 w-full max-w-[480px] h-full" id={`short-player-${activeShort?.id}`}>
        {/* Short Card Area */}
        <div className="flex-1 relative rounded-3xl bg-black border border-[#272727] overflow-hidden group shadow-2xl">
          {/* Audio toggle overlay */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all scale-90 group-hover:scale-100"
            id="btn-shorts-audio-toggle"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* HTML5 video element */}
          <video
            ref={el => { videoRefs.current[activeIndex] = el; }}
            src={(downloadStatusList[activeShort?.id]?.status === 'completed' && downloadStatusList[activeShort?.id]?.blobUrl) 
              ? downloadStatusList[activeShort?.id]?.blobUrl 
              : (activeShort?.src || undefined)
            }
            loop
            playsInline
            autoPlay
            className="w-full h-full object-cover"
            poster={activeShort?.thumbnail || undefined}
            id={`video-element-short-${activeShort?.id}`}
          />

          {/* Bottom detail text overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-6 pt-10 text-right text-white space-y-3 z-10">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-[#272727] bg-[#3a3a3a]">
                <img src={activeShort?.channelAvatar || undefined} alt={activeShort?.channelName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div>
                <h4 className="text-sm font-bold">{activeShort?.channelName}</h4>
                <p className="text-[10px] text-red-400 font-bold">نشط الآن</p>
              </div>
            </div>

            <h3 className="text-sm font-medium leading-relaxed font-sans pr-1">
              {activeShort?.title}
            </h3>
            
            <p className="text-[11px] text-gray-400 line-clamp-1 opacity-80 select-text">
              {activeShort?.description}
            </p>

            <span className="inline-block bg-white/10 backdrop-blur-md text-[10px] text-white px-2.5 py-0.5 rounded-full font-bold">
              ⚡ مقطع قصير (Short)
            </span>
          </div>

          {/* Loading view of download overlay */}
          {downloadStatusList[activeShort?.id]?.status === 'downloading' && (
            <div className="absolute top-4 left-4 z-20 bg-blue-600/90 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
              <span>تحميل {downloadStatusList[activeShort?.id]?.progress}%</span>
            </div>
          )}
        </div>

        {/* Right Interactions Sidebar (Standard Shorts vertical layout) */}
        <div className="flex flex-col justify-end items-center gap-5 pb-8 select-none z-20" id="shorts-reactions-bar">
          {/* Like */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => handleLike(activeShort?.id)}
              className={`p-3.5 rounded-full shadow-lg border transition-all active:scale-90 ${
                likedShorts[activeShort?.id] 
                  ? 'bg-red-600 border-red-500 text-white' 
                  : 'bg-[#1c1c1c] border-[#272727] text-gray-200 hover:bg-[#272727]'
              }`}
            >
              <ThumbsUp className="w-5 h-5 fill-current" />
            </button>
            <span className="text-xs text-gray-400 mt-1 font-mono font-bold">
              {likedShorts[activeShort?.id] ? 'تم الإعجاب' : 'أعجبني'}
            </span>
          </div>

          {/* Dislike */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => handleDislike(activeShort?.id)}
              className={`p-3.5 rounded-full shadow-lg border transition-all active:scale-90 ${
                dislikedShorts[activeShort?.id]
                  ? 'bg-rose-950 border-rose-800 text-rose-400'
                  : 'bg-[#1c1c1c] border-[#272727] text-gray-200 hover:bg-[#272727]'
              }`}
            >
              <ThumbsDown className="w-5 h-5" />
            </button>
            <span className="text-xs text-gray-400 mt-1">ديسلايك</span>
          </div>

          {/* Comment mockup link */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => {
                const comment = prompt('اكتب تعليقك السريع على الشورتس:');
                if (comment) {
                  alert('تم نشر تعليقك بنجاح! شكراً لمكافأتنا بصوتك 🙌');
                }
              }}
              className="p-3.5 rounded-full bg-[#1c1c1c] border border-[#272727] hover:bg-[#272727] text-gray-200 shadow-lg active:scale-90 transition-all"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <span className="text-xs text-gray-400 mt-1 font-mono font-bold">٢٣٤</span>
          </div>

          {/* Download feature for Shorts inside viewer */}
          <div className="flex flex-col items-center">
            {downloadStatusList[activeShort?.id]?.status === 'completed' ? (
              <button
                onClick={() => onDeleteDownload(activeShort?.id)}
                className="p-3.5 rounded-full bg-green-600 border border-green-500 text-white shadow-lg active:scale-90 transition-all hover:bg-red-600 hover:border-red-500"
                title="تم الحفظ للتشغيل أوفلاين. اضغط لحذفه."
              >
                <Check className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => onDownload(activeShort)}
                disabled={isOffline || downloadStatusList[activeShort?.id]?.status === 'downloading'}
                className={`p-3.5 rounded-full shadow-lg border transition-all active:scale-90 ${
                  isOffline 
                    ? 'bg-neutral-800 border-neutral-700 text-neutral-600 cursor-not-allowed'
                    : 'bg-[#1c1c1c] border-red-500/20 text-red-500 hover:bg-neutral-800'
                }`}
                title="تنزيل الشورتس أوفلاين"
              >
                <Download className="w-5 h-5 animate-pulse" />
              </button>
            )}
            <span className="text-xs text-gray-400 mt-1 font-bold">
              {downloadStatusList[activeShort?.id]?.status === 'completed' ? 'تنزيل آمن' : 'تنزيل'}
            </span>
          </div>

          {/* Share */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => {
                navigator.clipboard.writeText(activeShort?.src);
                alert('تم نسخ رابط الشورتس لمشاركته في ثوانٍ 🌟');
              }}
              className="p-3.5 rounded-full bg-[#1c1c1c] border border-[#272727] hover:bg-[#272727] text-gray-200"
            >
              <Share2 className="w-5 h-5" />
            </button>
            <span className="text-xs text-gray-400 mt-1">مشاركة</span>
          </div>
        </div>
      </div>
    </div>
  );
}
