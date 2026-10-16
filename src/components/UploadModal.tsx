import React, { useState, useRef, useEffect } from 'react';
import {
  X, UploadCloud, Check, Link2, Globe, Lock, ChevronLeft, ChevronRight,
  ImageIcon, Loader2, AlertTriangle, Baby, UserCheck, Play,
} from 'lucide-react';
import { Video } from '../types';
import { stageUpload, stageThumbnail, publishVideo, importVideo, getSimpleAuthUser } from '../services/db';

interface UploadModalProps {
  onClose: () => void;
  onSave: (v: Video) => void;
  currentUser?: { user_id: string; username: string; email: string } | null;
}

type Visibility = 'public' | 'unlisted' | 'private';

// Generate 3 real thumbnail options from the video file (YouTube-style)
async function generateThumbnails(file: File): Promise<string[]> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.src = url;
    const thumbs: string[] = [];
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 180;
    const ctx = canvas.getContext('2d');

    video.onloadedmetadata = async () => {
      const dur = video.duration || 1;
      for (const frac of [0.25, 0.5, 0.75]) {
        try {
          await new Promise<void>((res, rej) => {
            const to = setTimeout(() => rej(new Error('seek timeout')), 4000);
            video.onseeked = () => { clearTimeout(to); res(); };
            video.currentTime = Math.min(dur * frac, Math.max(0, dur - 0.1));
          });
          if (ctx) { ctx.drawImage(video, 0, 0, 320, 180); thumbs.push(canvas.toDataURL('image/jpeg', 0.7)); }
        } catch { /* skip failed frame */ }
      }
      URL.revokeObjectURL(url);
      resolve(thumbs);
    };
    video.onerror = () => { URL.revokeObjectURL(url); resolve([]); };
    setTimeout(() => resolve(thumbs), 12000); // safety
  });
}

const STEPS = ['التفاصيل', 'الوضوح', 'تم'];

export default function UploadModal({ onClose, onSave, currentUser }: UploadModalProps) {
  const [step, setStep] = useState(0); // 0 = select file
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [staged, setStaged] = useState<{ videoPath: string; src: string; thumbPath: string | null; originalName: string } | null>(null);

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('تقنية');
  const [audience, setAudience] = useState<'kids' | 'notkids'>('notkids');
  const [visibility, setVisibility] = useState<Visibility>('public');

  const [thumbOptions, setThumbOptions] = useState<string[]>([]);
  const [thumbLoading, setThumbLoading] = useState(false);
  const [selectedThumb, setSelectedThumb] = useState<number>(0);
  const [customThumbFile, setCustomThumbFile] = useState<File | null>(null);
  const [customThumbUrl, setCustomThumbUrl] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const user = currentUser || getSimpleAuthUser();
  const uid: string | undefined = (currentUser as any)?.user_id || (user as any)?.uid || (user as any)?.user_id;

  // Start the real upload the moment a file is chosen (YouTube uploads in background)
  const handleFileChosen = async (file: File) => {
    if (!file.type.startsWith('video/')) { setError('الرجاء اختيار ملف فيديو صالح'); return; }
    setError(null);
    setVideoFile(file);
    setStaged(null);
    setUploadPct(0);
    setUploading(true);
    setTitle((t) => t || file.name.replace(/\.[^.]+$/, '').slice(0, 100));
    // Generate real thumbnails in parallel
    setThumbLoading(true);
    generateThumbnails(file).then((ts) => { setThumbOptions(ts); setThumbLoading(false); });
    try {
      const result = await stageUpload(file, null, setUploadPct);
      setStaged({ videoPath: result.videoPath, src: result.src, thumbPath: result.thumbPath, originalName: result.originalName });
      setUploadPct(100);
    } catch (e: any) {
      setError(e.message || 'فشل رفع الملف');
    } finally {
      setUploading(false);
    }
  };

  const handleCustomThumb = (f: File) => {
    if (!f.type.startsWith('image/')) return;
    setCustomThumbFile(f);
    const reader = new FileReader();
    reader.onload = () => setCustomThumbUrl(reader.result as string);
    reader.readAsDataURL(f);
    // Staged to the server at publish time (see handlePublish)
  };

  const handleImport = async () => {
    if (!importUrl.trim()) { setError('أدخل رابط الفيديو أولاً'); return; }
    if (!uid) { setError('يجب تسجيل الدخول أولاً'); return; }
    setImporting(true); setError(null);
    try {
      const v = await importVideo(uid, {
        title: title.trim() || 'فيديو مستورد', description: desc.trim(), category,
        duration: '00:00', videoUrl: importUrl.trim(), thumbnailUrl: '', isShort: false,
      });
      setPublished(v as any);
      setStep(3);
    } catch (e: any) { setError(e.message || 'فشل الاستيراد'); }
    finally { setImporting(false); }
  };

  const handlePublish = async () => {
    setError(null);
    if (!uid) { setError('يجب تسجيل الدخول لنشر الفيديو'); return; }
    if (!title.trim()) { setError('أدخل عنواناً للفيديو أولاً'); return; }
    if (uploading || !staged) { setError('انتظر اكتمال رفع الملف أولاً...'); return; }
    setPublishing(true);
    try {
      // Resolve final thumbnail: custom upload wins, else chosen auto frame
      let thumbPath = staged.thumbPath;
      if (customThumbUrl && customThumbFile) {
        const r = await stageThumbnail(customThumbFile);
        thumbPath = r.thumbPath;
      } else if (thumbOptions[selectedThumb]) {
        // Upload the chosen auto-generated frame as the thumbnail
        const blob = await (await fetch(thumbOptions[selectedThumb])).blob();
        const r = await stageThumbnail(new File([blob], 'thumb.jpg', { type: 'image/jpeg' }));
        thumbPath = r.thumbPath;
      }
      const v = await publishVideo(uid, {
        title: title.trim(), description: desc.trim(), category, isShort: false,
        duration: '00:00', videoPath: staged.videoPath, thumbPath, visibility,
      });
      setPublished(v as any);
      setStep(3);
    } catch (e: any) { setError(e.message || 'فشل النشر'); }
    finally { setPublishing(false); }
  };

  const videoLink = published ? `${window.location.origin}${window.location.pathname}?v=${published.id}` : '';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" dir="rtl">
      <div className="relative w-full max-w-2xl bg-[#212121] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-white">

        {/* YouTube-style header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3d3d3d]">
          <h3 className="text-lg font-medium">
            {step === 0 ? 'رفع فيديو' : step === 3 ? 'تم النشر' : STEPS[step - 1]}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors" aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator (YouTube Studio style) */}
        {step >= 1 && step <= 2 && (
          <div className="flex items-center gap-2 px-6 pt-4">
            {STEPS.slice(0, 2).map((s, i) => (
              <React.Fragment key={s}>
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${
                    step > i + 1 ? 'bg-green-600' : step === i + 1 ? 'bg-[#3ea6ff]' : 'bg-[#3d3d3d] text-neutral-400'
                  }`}>
                    {step > i + 1 ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </span>
                  <span className={`text-sm ${step === i + 1 ? 'font-bold' : 'text-neutral-400'}`}>{s}</span>
                </div>
                {i === 0 && <div className="flex-1 h-px bg-[#3d3d3d] mx-2" />}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Real upload progress bar (YouTube style) */}
        {(uploading || staged) && step < 3 && (
          <div className="px-6 pt-3">
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
              <span>{uploading ? `جارٍ الرفع... ${uploadPct}%` : 'اكتمل الرفع ✓'}</span>
              <span className="truncate max-w-[60%]">{videoFile?.name}</span>
            </div>
            <div className="h-1.5 bg-[#3d3d3d] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${uploadPct === 100 ? 'bg-green-500' : 'bg-[#3ea6ff]'}`}
                style={{ width: `${uploadPct}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mx-6 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* ============ STEP 0: SELECT FILE (YouTube upload dialog) ============ */}
        {step === 0 && (
          <div className="p-8 flex flex-col items-center text-center">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFileChosen(f); }}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
                dragOver ? 'border-[#3ea6ff] bg-[#3ea6ff]/5' : 'border-[#3d3d3d] hover:border-neutral-500'
              }`}
            >
              <div className="w-32 h-32 mx-auto rounded-full bg-[#3d3d3d] flex items-center justify-center mb-5">
                {uploading
                  ? <Loader2 className="w-12 h-12 text-[#3ea6ff] animate-spin" />
                  : <UploadCloud className="w-12 h-12 text-neutral-400" />}
              </div>
              <p className="text-sm text-neutral-400 mb-4">اسحب ملف الفيديو وأفلته هنا أو</p>
              <span className="inline-block px-6 py-2.5 bg-[#3ea6ff] hover:bg-[#65b8ff] text-[#0f0f0f] font-bold text-sm rounded-full transition-colors">
                اختيار الملفات
              </span>
              <input
                ref={fileInputRef} type="file" accept="video/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChosen(f); }}
              />
            </div>
            <p className="text-xs text-neutral-500 mt-5 leading-relaxed max-w-md">
              بنشر الفيديو أنت توافق على شروط الاستخدام. يُمنع نشر محتوى مسروق أو مخالف.
            </p>
            <button onClick={() => setShowImport(!showImport)} className="mt-3 text-xs text-[#3ea6ff] hover:underline">
              أو استيراد من رابط مباشر
            </button>
            {showImport && (
              <div className="w-full mt-3 flex gap-2">
                <input
                  value={importUrl} onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://example.com/video.mp4"
                  className="flex-1 bg-[#121212] border border-[#3d3d3d] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#3ea6ff]"
                  dir="ltr"
                />
                <button
                  onClick={handleImport} disabled={importing}
                  className="px-5 py-2.5 bg-[#3ea6ff] text-[#0f0f0f] text-sm font-bold rounded-full disabled:opacity-50"
                >
                  {importing ? 'جارٍ...' : 'استيراد'}
                </button>
              </div>
            )}
            {staged && (
              <button
                onClick={() => setStep(1)}
                className="mt-6 px-8 py-2.5 bg-white text-black font-bold text-sm rounded-full hover:bg-neutral-200 transition-colors"
              >
                متابعة إلى التفاصيل
              </button>
            )}
          </div>
        )}

        {/* ============ STEP 1: DETAILS (YouTube Studio) ============ */}
        {step === 1 && (
          <div className="p-6 overflow-y-auto flex-1">
            <div className="flex gap-5 flex-col md:flex-row">
              {/* Live preview */}
              <div className="md:w-64 shrink-0">
                <div className="rounded-xl overflow-hidden bg-black aspect-video relative">
                  {videoFile
                    ? <video src={URL.createObjectURL(videoFile)} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                    : <div className="w-full h-full flex items-center justify-center"><Play className="w-8 h-8 text-neutral-500" /></div>}
                </div>
                <p className="text-xs text-neutral-500 mt-2 truncate">{videoFile?.name}</p>
              </div>
              <div className="flex-1 space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-sm font-medium">العنوان <span className="text-neutral-500">(مطلوب)</span></label>
                    <span className="text-xs text-neutral-500">{title.length}/100</span>
                  </div>
                  <input
                    value={title} onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                    placeholder="أضف عنواناً يصف الفيديو"
                    className="w-full bg-transparent border border-[#3d3d3d] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#3ea6ff] placeholder-neutral-600"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-sm font-medium">الوصف</label>
                    <span className="text-xs text-neutral-500">{desc.length}/5000</span>
                  </div>
                  <textarea
                    value={desc} onChange={(e) => setDesc(e.target.value.slice(0, 5000))}
                    placeholder="أخبر المشاهدين عن الفيديو"
                    rows={4}
                    className="w-full bg-transparent border border-[#3d3d3d] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#3ea6ff] placeholder-neutral-600 resize-none"
                  />
                </div>
                {/* Thumbnails — YouTube style */}
                <div>
                  <label className="text-sm font-medium block mb-2">الصورة المصغرة</label>
                  <div className="flex gap-2 flex-wrap">
                    {thumbLoading && <span className="text-xs text-neutral-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> جارٍ توليد الصور...</span>}
                    {thumbOptions.map((t, i) => (
                      <button
                        key={i} type="button"
                        onClick={() => { setSelectedThumb(i); setCustomThumbUrl(null); }}
                        className={`relative w-28 aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                          selectedThumb === i && !customThumbUrl ? 'border-[#3ea6ff]' : 'border-transparent hover:border-neutral-500'
                        }`}
                      >
                        <img src={t} className="w-full h-full object-cover" alt={`صورة ${i + 1}`} />
                      </button>
                    ))}
                    {customThumbUrl && (
                      <button
                        type="button"
                        className="relative w-28 aspect-video rounded-lg overflow-hidden border-2 border-[#3ea6ff]"
                      >
                        <img src={customThumbUrl} className="w-full h-full object-cover" alt="مخصصة" />
                      </button>
                    )}
                    <label className="w-28 aspect-video rounded-lg border-2 border-dashed border-[#3d3d3d] hover:border-neutral-500 flex flex-col items-center justify-center gap-1 cursor-pointer text-neutral-500 hover:text-neutral-300 transition-colors">
                      <ImageIcon className="w-5 h-5" />
                      <span className="text-[10px]">تحميل صورة</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCustomThumb(f); }} />
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-1.5">الفئة</label>
                    <select
                      value={category} onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-[#121212] border border-[#3d3d3d] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#3ea6ff]"
                    >
                      {['تقنية', 'سفر', 'طبيعة', 'ألعاب', 'طبخ', 'تعليم', 'ترفيه', 'رياضة', 'موسيقى', 'أخرى'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">الجمهور</label>
                    <div className="flex gap-2">
                      <button
                        type="button" onClick={() => setAudience('notkids')}
                        className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                          audience === 'notkids' ? 'bg-[#3ea6ff]/15 border-[#3ea6ff] text-[#3ea6ff]' : 'border-[#3d3d3d] text-neutral-400'
                        }`}
                      >
                        <UserCheck className="w-4 h-4" /> ليس للأطفال
                      </button>
                      <button
                        type="button" onClick={() => setAudience('kids')}
                        className={`flex-1 px-3 py-2.5 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
                          audience === 'kids' ? 'bg-[#3ea6ff]/15 border-[#3ea6ff] text-[#3ea6ff]' : 'border-[#3d3d3d] text-neutral-400'
                        }`}
                      >
                        <Baby className="w-4 h-4" /> للأطفال
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ STEP 2: VISIBILITY (YouTube Studio) ============ */}
        {step === 2 && (
          <div className="p-6 overflow-y-auto flex-1">
            <h4 className="font-medium mb-1">الوضوح</h4>
            <p className="text-xs text-neutral-500 mb-4">اختر من يستطيع مشاهدة الفيديو</p>
            <div className="border border-[#3d3d3d] rounded-xl overflow-hidden">
              {([
                { id: 'public' as Visibility, icon: Globe, title: 'عام', desc: 'يمكن للجميع مشاهدة الفيديو والبحث عنه' },
                { id: 'unlisted' as Visibility, icon: Link2, title: 'غير مدرج', desc: 'يمكن لأي شخص لديه الرابط مشاهدته' },
                { id: 'private' as Visibility, icon: Lock, title: 'خاص', desc: 'أنت فقط تستطيع مشاهدة الفيديو' },
              ]).map((opt) => (
                <button
                  key={opt.id} type="button" onClick={() => setVisibility(opt.id)}
                  className={`w-full flex items-center gap-4 p-4 text-right transition-colors border-b border-[#3d3d3d] last:border-0 ${
                    visibility === opt.id ? 'bg-[#3ea6ff]/10' : 'hover:bg-white/5'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    visibility === opt.id ? 'border-[#3ea6ff]' : 'border-neutral-500'
                  }`}>
                    {visibility === opt.id && <span className="w-2.5 h-2.5 rounded-full bg-[#3ea6ff]" />}
                  </span>
                  <opt.icon className="w-5 h-5 text-neutral-400 shrink-0" />
                  <span>
                    <span className="block text-sm font-medium">{opt.title}</span>
                    <span className="block text-xs text-neutral-500 mt-0.5">{opt.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ============ STEP 3: DONE ============ */}
        {step === 3 && published && (
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-green-600/15 flex items-center justify-center mb-4">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <h4 className="text-lg font-medium mb-1">تم نشر الفيديو بنجاح!</h4>
            <p className="text-sm text-neutral-400 mb-5 line-clamp-1 max-w-full">{published.title}</p>
            <div className="w-full flex items-center gap-2 bg-[#121212] border border-[#3d3d3d] rounded-lg px-4 py-2.5 mb-4">
              <span className="flex-1 text-xs text-neutral-400 truncate" dir="ltr">{videoLink}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(videoLink); }}
                className="text-xs text-[#3ea6ff] font-bold hover:underline shrink-0"
              >
                نسخ الرابط
              </button>
            </div>
            <button
              onClick={() => { if (published) onSave(published); }}
              className="px-8 py-2.5 bg-[#3ea6ff] text-[#0f0f0f] font-bold text-sm rounded-full hover:bg-[#65b8ff] transition-colors"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* Footer nav */}
        {step >= 1 && step <= 2 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#3d3d3d]">
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1 px-4 py-2 text-sm text-neutral-300 hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronRight className="w-4 h-4" /> رجوع
            </button>
            {step === 1 ? (
              <button
                onClick={() => title.trim() ? setStep(2) : setError('أدخل عنواناً للفيديو أولاً')}
                className="flex items-center gap-1 px-6 py-2 bg-[#3ea6ff] text-[#0f0f0f] text-sm font-bold rounded-full hover:bg-[#65b8ff] transition-colors"
              >
                التالي <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handlePublish} disabled={publishing}
                className="px-8 py-2 bg-[#3ea6ff] text-[#0f0f0f] text-sm font-bold rounded-full hover:bg-[#65b8ff] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
                {publishing ? 'جارٍ النشر...' : 'نشر'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
