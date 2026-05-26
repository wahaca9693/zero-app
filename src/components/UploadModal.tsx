import React, { useState } from 'react';
import { X, Upload, Check, Link, Sparkles, AlertTriangle, FileVideo, ImageIcon } from 'lucide-react';
import { Video } from '../types';
import { uploadVideo, importVideo, getSimpleAuthUser } from '../services/db';

interface UploadModalProps {
  onClose: () => void;
  onSave: (v: Video) => void;
  currentUser?: { user_id: string; username: string; email: string } | null;
}

const SAMPLE_MP4S = [
  {
    name: 'بث السيارات الرياضية والسوبارو السريعة 🚗',
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    thumb: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop&q=60'
  },
  {
    name: 'رحلة القطار فوق بحيرات سويسرا الخلابة 🏔️',
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    thumb: 'https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?w=800&auto=format&fit=crop&q=60'
  }
];

// Helper function to extract YouTube video ID from URL
function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function formatVideoDuration(dur: number): string {
  if (!dur || isNaN(dur) || dur === Infinity) return '';
  const hrs = Math.floor(dur / 3600);
  const mins = Math.floor((dur % 3600) / 60);
  const secs = Math.floor(dur % 60);
  let formatted = '';
  if (hrs > 0) formatted += (hrs < 10 ? '0' + hrs : hrs) + ':';
  formatted += (mins < 10 ? '0' + mins : mins) + ':';
  formatted += (secs < 10 ? '0' + secs : secs);
  return formatted;
}

export default function UploadModal({ onClose, onSave }: UploadModalProps) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('تقنية');
  const [duration, setDuration] = useState('');
  
  // Choose between file upload, URL inputs, or direct YouTube import
  const [uploadType, setUploadType] = useState<'file' | 'url' | 'youtube'>('file');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  const [videoUrl, setVideoUrl] = useState('');
  const [thumbUrl, setThumbUrl] = useState('');

  // YouTube Specific States
  const [ytInputUrl, setYtInputUrl] = useState('');
  const [fetchingYt, setFetchingYt] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto scrape metadata from YouTube oEmbed protocol
  const handleFetchYoutube = async () => {
    if (!ytInputUrl.trim()) {
      setError('الرجاء إدخال رابط فيديو يوتيوب صحيح أولاً!');
      return;
    }
    const ytId = getYouTubeId(ytInputUrl);
    if (!ytId) {
      setError('رابط اليوتيوب غير صالح! يرجى إدخال رابط مثل https://www.youtube.com/watch?v=... أو https://youtu.be/...');
      return;
    }
    
    setFetchingYt(true);
    setError(null);
    try {
      const resp = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${ytId}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.title) {
          setTitle(data.title);
        }
        if (data.author_name) {
          setDesc(`فيديو مستورد حقيقي من منصة يوتيوب لصانع المحتوى الأصلي: ${data.author_name}. تم استدعاؤه بنجاح ويعمل بجودة كاملة.`);
        } else {
          setDesc(`فيديو مستورد حقيقي تفاعلي من يوتيوب بجودة عالية.`);
        }
        setThumbUrl(`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`);
        setVideoUrl(`https://www.youtube.com/watch?v=${ytId}`);
        // Duration is now auto-scraped on the server-side during import for maximum accuracy
        setDuration('بانتظار التحليل...'); 
      } else {
        // Fallback
        setTitle(`فيديو يوتيوب مستورد (${ytId})`);
        setDesc('مقطع فيديو مميز تم استيراده تلقائياً بواسطة الرابط.');
        setThumbUrl(`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`);
        setVideoUrl(`https://www.youtube.com/watch?v=${ytId}`);
      }
    } catch (err) {
      // Fallback
      setTitle(`فيديو يوتيوب مميز (${ytId})`);
      setDesc('مقطع فيديو تفاعلي حقيقي تم استدعاؤه برابط مباشر.');
      setThumbUrl(`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`);
      setVideoUrl(`https://www.youtube.com/watch?v=${ytId}`);
    } finally {
      setFetchingYt(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (uploadType === 'youtube' && !videoUrl.trim()) {
      // Auto run fetch if inputs were pasted but not fetched
      const ytId = getYouTubeId(ytInputUrl);
      if (ytId) {
        setVideoUrl(`https://www.youtube.com/watch?v=${ytId}`);
        if (!thumbUrl) setThumbUrl(`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`);
        if (!title) setTitle(`فيديو يوتيوب (${ytId})`);
      } else {
        setError('الرجاء إدخال رابط يوتيوب صالح واستدعاؤه أولاً!');
        return;
      }
    }

    if (!title.trim() || !desc.trim()) {
      setError('يرجى كتابة عنوان ووصف للفيديو أولاً!');
      return;
    }

    if (uploadType === 'file' && !videoFile) {
      setError('الرجاء اختيار ملف فيديو .mp4 حقيقي لرفعه');
      return;
    }

    if (uploadType === 'url' && !videoUrl.trim()) {
      setError('يرجى تزويد رابط بث صالح ومفتوح لملف الفيديو');
      return;
    }

    setUploading(true);

    try {
      // Use the passed currentUser prop instead of Firebase auth
      if (!currentUser || !currentUser.user_id) {
        setError('يجب تسجيل الدخول لنشر الفيديو');
        setUploading(false);
        return;
      }

      let videoData;
      if (uploadType === 'file') {
        videoData = await uploadVideo(currentUser.user_id, {
          title: title.trim(),
          description: desc.trim(),
          category,
          duration: duration.trim() || '00:00',
          videoUrl: '',
          thumbnailUrl: thumbUrl.trim() || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&auto=format&fit=crop&q=60',
          isShort: false
        }, videoFile, thumbnailFile);
      } else {
        // Handle URL or YouTube imports using the server-side downloader
        videoData = await importVideo(currentUser.user_id, {
          title: title.trim(),
          description: desc.trim(),
          category,
          duration: duration.trim() || '00:00',
          videoUrl: videoUrl.trim(),
          thumbnailUrl: thumbUrl.trim(),
          isShort: false
        });
      }

      onSave(videoData as any);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ غير متوقع أثناء معالجة الرفع بقاعدة البيانات.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in text-right text-white">
      <div className="relative w-full max-w-lg bg-[#161616] border border-[#272727] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header bar */}
        <div className="flex items-center justify-between p-5 border-b border-[#272727]">
          <button 
            type="button"
            onClick={onClose}
            className="p-1 px-3 text-xs bg-neutral-800 hover:bg-neutral-700 hover:text-red-500 rounded-lg select-none transition-colors"
          >
            إغلاق
          </button>
          
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-red-500 animate-bounce" />
            <h3 className="text-base font-black">رفع فيديو جديد لقاعدة البيانات حياً</h3>
          </div>
        </div>

        {/* Content pane */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4.5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500 font-bold">
              ⚠️ {error}
            </div>
          )}

          {/* Title input */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-bold block">عنوان وموضوع الفيديو *</label>
            <input
              type="text"
              required
              placeholder="مثال: مراجعة شاملة للسيارة الجديدة ومواصفاتها الفنية"
              value={title || ''}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#1e1e1e] border border-[#272727] focus:border-red-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder-gray-600 text-white"
            />
          </div>

          {/* Description input */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-bold block">الوصف بالتفصيل *</label>
            <textarea
              required
              placeholder="اكتب ماذا سيتحدّث عنه مقطع الفيديو الخاص بك بالتفصيل..."
              value={desc || ''}
              rows={3}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full bg-[#1e1e1e] border border-[#272727] focus:border-red-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder-gray-600 text-white resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Category selection */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-bold block">التصنيف</label>
              <select
                value={category || ''}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-[#272727] focus:border-red-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none text-white appearance-none cursor-pointer"
              >
                <option value="تقنية">تقنية 💻</option>
                <option value="سفر">سفر ✈️</option>
                <option value="طبيعة">طبيعة 🌲</option>
                <option value="ألعاب">ألعاب 🎮</option>
                <option value="طبخ">طبخ 🍳</option>
              </select>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-bold block">المدة الزمنية (تحسب تلقائياً - مثال: 03:15)</label>
              <input
                type="text"
                value={duration || ''}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="00:00"
                className="w-full bg-[#1e1e1e] border border-[#272727] focus:border-red-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none placeholder-gray-600 text-white"
                dir="ltr"
              />
            </div>
          </div>

          {/* Toggle upload type */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#121212] rounded-xl border border-[#272727]" id="upload-type-tabs">
            <button
              type="button"
              onClick={() => setUploadType('file')}
              className={`py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all ${
                uploadType === 'file' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              📂 رفع ملف محلي
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadType('url');
                if (!videoUrl) {
                  setVideoUrl(SAMPLE_MP4S[0].src);
                  setThumbUrl(SAMPLE_MP4S[0].thumb);
                }
              }}
              className={`py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all ${
                uploadType === 'url' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              🔗 روابط مباشرة
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadType('youtube');
              }}
              className={`py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-all ${
                uploadType === 'youtube' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              📺 استيراد يوتيوب
            </button>
          </div>

          {uploadType === 'file' ? (
            <div key="upload-file-wrapper" className="space-y-3.5 bg-neutral-900/40 p-4 rounded-xl border border-neutral-800">
              {/* Select Video file input */}
              <div className="space-y-1.5 flex-1">
                <label className="text-xs text-gray-300 font-black flex items-center gap-1.5">
                  <FileVideo className="w-4 h-4 text-red-500" />
                  <span>ملف الفيديو (.MP4 أو .mov) *</span>
                </label>
                <input
                  key="file-video-input-element"
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      setVideoFile(file);
                      if (!title) setTitle(file.name.split('.')[0]);
                      
                      // Auto-calculate video duration
                      const videoEl = document.createElement('video');
                      videoEl.preload = 'metadata';
                      
                      const onMetadata = () => {
                        let durationSeconds = videoEl.duration;
                        if (durationSeconds === Infinity) {
                          videoEl.currentTime = 1e101;
                          videoEl.ontimeupdate = () => {
                            videoEl.ontimeupdate = null;
                            const formatted = formatVideoDuration(videoEl.duration);
                            if (formatted) setDuration(formatted);
                            URL.revokeObjectURL(videoEl.src);
                          };
                        } else {
                          const formatted = formatVideoDuration(durationSeconds);
                          if (formatted) setDuration(formatted);
                          URL.revokeObjectURL(videoEl.src);
                        }
                      };
                      
                      videoEl.onloadedmetadata = onMetadata;
                      videoEl.src = URL.createObjectURL(file);
                    }
                  }}
                  className="w-full text-xs text-gray-400 file:ml-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700 cursor-pointer"
                />
                {videoFile && (
                  <span className="text-[10px] text-green-500 font-bold block">
                    ✓ تم اختيار "{videoFile.name}" ({(videoFile.size / 1024 / 1024).toFixed(1)} ميجابايت)
                  </span>
                )}
              </div>

              {/* Select Thumbnail Image file input */}
              <div className="space-y-1.5 flex-1">
                <label className="text-xs text-gray-300 font-black flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-red-500" />
                  <span>صورة الغلاف (Thumbnail Image)</span>
                </label>
                <input
                  key="file-thumb-input-element"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setThumbnailFile(e.target.files[0]);
                    }
                  }}
                  className="w-full text-xs text-gray-400 file:ml-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-800 file:text-white hover:file:bg-neutral-700 cursor-pointer"
                />
                {thumbnailFile && (
                  <span className="text-[10px] text-green-500 font-bold block">
                    ✓ تم اختيار صورة غلاف مخصصة بقاعدة البيانات.
                  </span>
                )}
              </div>
            </div>
          ) : uploadType === 'url' ? (
            <div key="upload-url-wrapper" className="space-y-3.5 bg-[#121212]/50 p-4 rounded-xl border border-neutral-800/80">
              {/* Preset buttons */}
              <div className="space-y-1">
                <span className="text-[10px] text-gray-500 font-bold">قوالب الفيدوهات الجاهزة التجريبية:</span>
                <div className="flex gap-2">
                  {SAMPLE_MP4S.map((tmpl, index) => (
                    <button
                      type="button"
                      key={index}
                      onClick={() => {
                        setVideoUrl(tmpl.src);
                        setThumbUrl(tmpl.thumb);
                        if (!title) setTitle(tmpl.name.replace(/🚗|🏔️/, ''));
                      }}
                      className={`text-[10px] bg-neutral-900 border px-2 py-1 rounded-md transition-colors ${
                        videoUrl === tmpl.src ? 'border-red-500 text-red-400' : 'border-neutral-800 text-gray-400'
                      }`}
                    >
                      بث {index + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* URL streams inputs */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-bold block">رابط بث الفيديو المباشر (Direct Video Stream URL)</label>
                <input
                  key="url-video-input-element"
                  type="url"
                  placeholder="https://example.com/stream.mp4"
                  value={videoUrl || ''}
                  onChange={(e) => {
                    const newUrl = e.target.value;
                    setVideoUrl(newUrl);
                    
                    if (newUrl) {
                      const videoEl = document.createElement('video');
                      videoEl.crossOrigin = 'anonymous';
                      videoEl.preload = 'metadata';
                      videoEl.onloadedmetadata = () => {
                        let durationSeconds = videoEl.duration;
                        if (durationSeconds === Infinity) {
                          videoEl.currentTime = 1e101;
                          videoEl.ontimeupdate = () => {
                            videoEl.ontimeupdate = null;
                            const formatted = formatVideoDuration(videoEl.duration);
                            if (formatted) setDuration(formatted);
                          };
                        } else {
                          const formatted = formatVideoDuration(durationSeconds);
                          if (formatted) setDuration(formatted);
                        }
                      };
                      // ignore errors silently for CORS/invalid urls
                      videoEl.onerror = () => {};
                      videoEl.src = newUrl;
                    }
                  }}
                  className="w-full bg-[#1b1b1b] border border-neutral-800 focus:border-red-600 rounded-lg px-3 py-2 text-xs font-mono text-left text-white focus:outline-none"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-bold block">رابط صورة الغلاف (Banner Image URL)</label>
                <input
                  key="url-thumb-input-element"
                  type="url"
                  placeholder="https://example.com/banner.jpg"
                  value={thumbUrl || ''}
                  onChange={(e) => setThumbUrl(e.target.value)}
                  className="w-full bg-[#1b1b1b] border border-neutral-800 focus:border-red-600 rounded-lg px-3 py-2 text-xs font-mono text-left text-white focus:outline-none"
                  dir="ltr"
                />
              </div>
            </div>
          ) : (
            <div key="upload-youtube-wrapper" className="space-y-3.5 bg-red-950/10 p-4 rounded-xl border border-red-500/10">
              <div className="space-y-1">
                <label className="text-xs text-red-400 font-bold block">رابط فيديو يوتيوب الحقيقي *</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={ytInputUrl}
                    onChange={(e) => setYtInputUrl(e.target.value)}
                    className="flex-1 bg-[#1b1b1b] border border-neutral-800 focus:border-red-600 rounded-lg px-3 py-2 text-xs font-mono text-left text-white focus:outline-none"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    disabled={fetchingYt}
                    onClick={handleFetchYoutube}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all active:scale-95 shrink-0 disabled:bg-neutral-850"
                  >
                    {fetchingYt ? 'جاري السحب...' : 'تحميل واستدعاء تلقائي ⚡'}
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  ألصق رابط الفيديو من يوتيوب واضغط "استدعاء". سيقوم الخادم بسحب الفيديو وتخزينه في قاعدة البيانات محلياً لضمان سرعة التشغيل!
                </p>
              </div>

              {videoUrl && (
                <div className="p-2.5 bg-green-500/10 border border-green-500/20 rounded-xl text-[10px] text-green-400 font-bold space-y-1.5" dir="rtl">
                  <div>✓ تم استيراد الفيديو بنجاح: {getYouTubeId(videoUrl)}</div>
                  <div className="flex items-center gap-2">
                    {thumbUrl && (
                      <img src={thumbUrl || undefined} className="w-16 h-10 object-cover rounded border border-neutral-800" alt="" referrerPolicy="no-referrer" />
                    )}
                    <div className="truncate flex-1">
                      <strong>المشغل:</strong> محاكي يوتيوب الذكي سيعرض البث المباشر فور التشغيل!
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submission block */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={uploading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-neutral-800 text-white font-black py-3 rounded-xl hover:shadow-lg hover:shadow-red-500/10 transition-all font-sans cursor-pointer flex items-center justify-center gap-2 text-sm shadow-md"
            >
              {uploading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                  <span>جاري رفع ونشر الفيديو لقاعدة البيانات...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>انشر بقناتك الآن للعامة 🚀</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
