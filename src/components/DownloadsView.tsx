import { Download, Play, Trash2, WifiOff, RefreshCw, FolderDown, Zap, ShieldAlert, Check } from 'lucide-react';
import { DownloadedItem, Video } from '../types';

interface DownloadsViewProps {
  downloads: DownloadedItem[];
  onSelectVideo: (v: Video) => void;
  onDeleteDownload: (id: string) => void;
  isOffline: boolean;
  onToggleOffline: () => void;
}

export default function DownloadsView({
  downloads,
  onSelectVideo,
  onDeleteDownload,
  isOffline,
  onToggleOffline
}: DownloadsViewProps) {
  
  const completedDownloads = downloads.filter(d => d.status === 'completed');

  return (
    <div className="space-y-6 text-white text-right pb-10" id="downloads-view-cabinet">
      {/* 1. Header Information banner */}
      <div className="bg-gradient-to-l from-red-600/10 via-neutral-900 to-neutral-900 border border-[#272727] p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-red-600/20 text-red-500 rounded-xl border border-red-500/20">
            <FolderDown className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">مكتبة فيديوهاتك المحملة أوفلاين</h2>
            <p className="text-xs text-gray-400 mt-1">
              يتم تخزين هذه الفيديوهات كملفات حقيقية (Blobs) في ذاكرة المتصفح الداخلية (IndexedDB). ستشتغل محلياً حتى لو قمت بفصل الإنترنت بالكامل!
            </p>
          </div>
        </div>

        {/* Action Toggle to quickly test how offline works! */}
        <button
          onClick={onToggleOffline}
          className={`px-5 py-2.5 rounded-full font-bold text-sm select-none transition-all duration-200 active:scale-95 flex items-center gap-2 ${
            isOffline 
              ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/10' 
              : 'bg-[#222] hover:bg-[#333] border border-[#444] text-gray-300'
          }`}
          id="btn-fast-offline-tester"
        >
          <span>{isOffline ? 'اتصل بالإنترنت مجدداً' : 'اختبر المود الأوفلاين الآن 🔌'}</span>
          <Zap className="w-4 h-4 text-amber-400" />
        </button>
      </div>

      {completedDownloads.length === 0 ? (
        /* Empty layout */
        <div className="flex flex-col items-center justify-center p-14 border border-[#272727] border-dashed rounded-3xl bg-[#121212] py-20 text-center space-y-4" id="downloads-empty-panel">
          <div className="w-16 h-16 rounded-full bg-[#1c1c1c] border border-[#272727] flex items-center justify-center text-gray-500">
            <Download className="w-8 h-8 text-red-500 animate-pulse" />
          </div>
          <div className="space-y-1.5 max-w-sm">
            <h3 className="text-lg font-bold">لا يوجد فيديوهات محملة أوفلاين</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              اختر أي فيديو تفضله من قائمة الفيديوهات واضغط على زر "تحميل لمشاهدتها دون إنترنت" لتبدأ رحلتك التخزينية.
            </p>
          </div>
          <button 
            onClick={onToggleOffline} 
            className="text-xs font-bold bg-neutral-900 border border-[#2d2d2d] py-2 px-6 rounded-full text-red-500 hover:bg-neutral-800 transition-colors"
          >
            تصفح الرئيسية للتحميل
          </button>
        </div>
      ) : (
        /* Downloads Grid list style */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {completedDownloads.map((item) => {
            const vid = item.video;
            return (
              <div 
                key={item.id}
                className="group relative flex flex-col bg-[#121212] rounded-2xl overflow-hidden hover:bg-[#1a1a1a] border border-[#1e1e1e] hover:border-[#2b2b2b] hover:shadow-xl transition-all duration-300"
                id={`download-card-${item.id}`}
              >
                {/* Thumb with Play Icon Overlay */}
                <div 
                  onClick={() => onSelectVideo(vid)}
                  className="relative aspect-video w-full bg-neutral-900 overflow-hidden cursor-pointer"
                >
                  <img src={vid.thumbnail || undefined} alt={vid.title} className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300" referrerPolicy="no-referrer" />
                  
                  {/* Badge */}
                  <span className="absolute bottom-2 left-2 bg-black/80 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded text-white text-left">
                    {vid.duration}
                  </span>

                  <span className="absolute top-2 right-2 bg-green-600/90 text-white font-bold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-green-500/10">
                    <Check className="w-3 h-3" />
                    <span>جاهز أوفلاين ({item.fileSize})</span>
                  </span>

                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                    <div className="p-3 bg-red-600 rounded-full scale-90 group-hover:scale-100 transition-transform">
                      <Play className="w-5 h-5 fill-white" />
                    </div>
                  </div>
                </div>

                {/* Details info */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 
                      onClick={() => onSelectVideo(vid)}
                      className="text-sm font-bold text-white line-clamp-2 leading-relaxed cursor-pointer hover:text-red-400 transition-colors"
                    >
                      {vid.title}
                    </h3>

                    <div className="flex items-center gap-2 mt-2">
                      <img src={vid.channelAvatar || undefined} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" referrerPolicy="no-referrer" />
                      <span className="text-xs text-gray-400">{vid.channelName}</span>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="mt-4 pt-3 border-t border-[#1e1e1e] flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 font-mono">
                      تاريخ التحميل: {new Date(item.downloadedAt).toLocaleDateString('ar-EG')}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteDownload(item.id);
                      }}
                      className="p-1 px-3 bg-red-600/10 hover:bg-red-600 border border-red-500/15 text-red-500 hover:text-white text-xs font-bold rounded-lg transition-all duration-200 flex items-center gap-1 active:scale-95"
                      title="حذف الفيديو من الذاكرة المحلية لجولتك الرياضية"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف الملف</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Local storage metadata diagnostic warning */}
      <div className="bg-[#121212] p-4 border border-[#272727] rounded-xl flex items-start gap-3.5 max-w-2xl">
        <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-gray-200">ملاحظة أمنية وفنية حول التخزين:</h4>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            تطبيقنا مجهز بألياف تشفير خفيفة لتخزين البث الرقمي بجودة متفوقة وبأمان كامل. لا تفقد بياناتك المحملة إلا بمجرد قيامك بمسح ملفات تعريف الارتباط أو الذاكرة المخبأة للمتصفح (Cache/IndexedDB).
          </p>
        </div>
      </div>
    </div>
  );
}
