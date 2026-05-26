import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Shield, Sparkles, LogOut, Film, Trash2, Heart, History, Video, Calendar, ArrowLeft, Wifi, CloudOff, Edit3, Camera, Image, Save, X, RefreshCw } from 'lucide-react';

import { registerUser, loginUser, updateUserProfile, getUserProfile, simpleTursoRegister, simpleTursoLogin, simpleTursoLogout, getSimpleAuthUser } from '../services/db';
import { wipeDatabase } from '../utils/wipeDatabase';

const AVATAR_PRESETS = [
  { name: 'تصميم تقني', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80' },
  { name: 'افتراضي عصري', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80' },
  { name: 'ألعاب نيون', url: 'https://images.unsplash.com/photo-1560169897-fc0cdbdfa4d5?w=150&auto=format&fit=crop&q=80' },
  { name: 'سيدة أعمال', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80' },
  { name: 'سفر وطبيعة', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
  { name: 'صانع محتوى', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' }
];

const BANNER_PRESETS = [
  { name: 'غروب الشفق', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200' },
  { name: 'فضاء النجوم', url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200' },
  { name: 'ألعاب نيون', url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200' },
  { name: 'طبيعة جبلية', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200' }
];

interface AccountViewProps {
  onLoginSuccess: (user: any, token: string) => void;
  onLogout: () => void;
  currentUser: any;
  uploadedVideos: any[];
  onSelectVideo: (video: any) => void;
  onDeleteVideo: (id: string) => void;
  isOffline: boolean;
  onToggleOffline: () => void;
}

export default function AccountView({
  onLoginSuccess,
  onLogout,
  currentUser,
  uploadedVideos,
  onSelectVideo,
  onDeleteVideo,
  isOffline,
  onToggleOffline
}: AccountViewProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Profile Customization / Settings states (تعديل وتخصيص الحساب)
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editBannerUrl, setEditBannerUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Setup initial edit values when user loads
  useEffect(() => {
    if (currentUser) {
      setEditUsername(currentUser.username || '');
      setEditDescription(currentUser.description || '');
      setEditAvatarUrl(currentUser.avatar || '');
      setEditBannerUrl(currentUser.banner || '');
    }
  }, [currentUser, showEditProfile]);

  const resetForm = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setError(null);
    setSuccessMsg(null);
  };

  // Use simple Turso-based authentication
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isRegister) {
        const user = await simpleTursoRegister(email, username);
        setSuccessMsg('🎉 تم إنشاء حسابك بنجاح! جاري تحويلك...');
        setTimeout(async () => {
          onLoginSuccess({ user_id: user.uid, username: user.username, email: user.email }, '');
        }, 1500);
      } else {
        const user = await simpleTursoLogin(email, password);
        setSuccessMsg('✅ تم تسجيل الدخول بنجاح! مرحباً بعودتك.');
        setTimeout(async () => {
          onLoginSuccess({ user_id: user.uid, username: user.username, email: user.email }, '');
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || 'لا يمكن الاتصال بقاعدة البيانات. يرجى التحقق من اتصالك.');
      console.error('Authentication Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const dbUrl = await updateUserProfile(currentUser.user_id, {
        username: editUsername.trim(),
        description: editDescription.trim(),
        avatarUrl: editAvatarUrl,
        bannerUrl: editBannerUrl
      }, avatarFile, bannerFile);

      setProfileSuccess('🎉 تم تحديث بيانات قناتك وصورتك الشخصية بنجاح!');
      
      // Dispatch immediately up-to state
      const profile = await getUserProfile(currentUser.user_id);
      onLoginSuccess({ user_id: currentUser.user_id, ...profile }, '');
      
      setTimeout(() => {
        setProfileSuccess(null);
        setShowEditProfile(false);
      }, 1500);

    } catch (err: any) {
      setProfileError(err.message || 'لا يمكن المزامنة مع قاعدة البيانات الحية للأسف.');
    } finally {
      setSavingProfile(false);
    }
  };

  if (currentUser) {
    // Logged in user channel view
    const myVideos = uploadedVideos.filter(v => v.channelName === currentUser.username);

    return (
      <div className="space-y-6 animate-fade-in max-w-5xl mx-auto" id="user-profile-view">
        
        {/* Decorative Channel Banner */}
        <div 
          className="relative h-32 md:h-44 rounded-2xl overflow-hidden bg-gradient-to-r from-red-800 via-neutral-900 to-red-950 border border-neutral-800 bg-cover bg-center" 
          style={currentUser.banner ? { backgroundImage: `url(${currentUser.banner})` } : {}}
          id="channel-banner"
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
          <div className="absolute inset-0 flex items-center px-6 md:px-12 justify-between">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-red-600 border-4 border-neutral-950 flex items-center justify-center font-bold text-xl md:text-3xl text-white shadow-2xl overflow-hidden">
                {currentUser.avatar ? (
                  <img 
                    src={`${currentUser.avatar}?t=${Date.now()}`} 
                    className="w-full h-full object-cover" 
                    alt="" 
                    referrerPolicy="no-referrer"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60'; }} 
                  />
                ) : (
                  currentUser.username ? currentUser.username.substring(0, 2) : '??'
                )}
              </div>
              <div>
                <h2 className="text-lg md:text-2xl font-black text-white">{currentUser.username}</h2>
                <p className="text-xs text-gray-300 mt-1">{currentUser.email}</p>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-2 bg-red-600/10 border border-red-500/20 rounded-md text-[10px] text-red-500 font-bold">
                  <Shield className="w-3 h-3" />
                  قناة موثقة من الإدارة
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={async () => {
                  if (confirm('تأكيد التنظيف الشامل لقاعدة البيانات؟ سيتم حذف جميع المقاطع المرفوعة وملفات الفيديو من التخزين (Firebase Storage) لتحرير المساحة!')) {
                    try {
                      await wipeDatabase();
                      alert('✅ تم مسح جميع البيانات وتحرير مساحة التخزين بنجاح!');
                      window.location.reload();
                    } catch (e: any) {
                      alert('❌ فشل التنظيف: ' + e.message);
                    }
                  }
                }}
                className="px-4 py-2 bg-red-900 border border-red-500/50 text-white rounded-full text-xs font-bold transition-all duration-150 flex items-center gap-2 cursor-pointer hover:bg-black hover:border-red-600 shadow-lg shadow-red-900/20"
                title="حل مشكلة تجاوز سعة التخزين (Quota Exceeded)"
              >
                <Trash2 className="w-4 h-4" />
                <span>تحرير مساحة التخزين</span>
              </button>

              <button
                onClick={() => {
                  if (confirm('هل تريد مسح الكاش المحلي وتهيئته؟ قد يساعد هذا في حل مشاكل الاتصال (Offline Error)')) {
                    window.indexedDB.deleteDatabase('firestore/[DEFAULT]/rwaq-1ec72/main');
                    alert('تم طلب مسح الكاش. سيتم إعادة تحميل الصفحة للتفعيل.');
                    window.location.reload();
                  }
                }}
                className="px-4 py-2 bg-neutral-800 border border-neutral-700 text-gray-300 rounded-full text-xs font-bold transition-all duration-150 flex items-center gap-2 cursor-pointer hover:bg-neutral-700"
              >
                <RefreshCw className="w-4 h-4" />
                <span>مسح الكاش المحلي</span>
              </button>

              <button
                onClick={() => setShowEditProfile(!showEditProfile)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                  showEditProfile 
                    ? 'bg-neutral-800 text-white hover:bg-neutral-700 border border-neutral-700' 
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {showEditProfile ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                <span>{showEditProfile ? 'إلغاء التعديل' : 'تخصيص القناة'}</span>
              </button>

              <button
                onClick={onLogout}
                className="px-4 py-2 bg-neutral-950/60 hover:bg-neutral-900 text-gray-300 hover:text-white rounded-full border border-neutral-800 text-xs font-bold transition-all duration-150 flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-red-500" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </div>

        {/* Profile Customization / Editor Form Drawer (تعديل وتخصيص القناة بالكامل) */}
        {showEditProfile && (
          <form 
            onSubmit={handleSaveProfile} 
            className="bg-[#121212] border-2 border-red-600/30 rounded-2xl p-6 space-y-6 animate-fade-in shadow-2xl relative"
            id="profile-customizer-form"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-red-500 animate-pulse" />
                <h3 className="text-base font-black text-white">تخصيص شكل القناة والبيانات بقاعدة البيانات</h3>
              </div>
              <span className="text-[10px] bg-red-500/10 text-red-500 font-bold px-2.5 py-1 rounded-full border border-red-500/15">
                تحديث حي 100%
              </span>
            </div>

            {profileError && (
              <div className="bg-red-500/5 border-r-4 border-red-600 p-3 text-red-400 text-xs font-bold rounded-lg bg-red-950/20">
                ⚠️ {profileError}
              </div>
            )}

            {profileSuccess && (
              <div className="bg-green-500/5 border-r-4 border-green-500 p-3 text-green-400 text-xs font-bold rounded-lg animate-pulse">
                {profileSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Profile Details Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5">اسم القناة المتألق الجديد:</label>
                  <div className="relative">
                    <User className="absolute right-3.5 top-3 w-4 h-4 text-gray-500" />
                    <input 
                      type="text" 
                      required
                      value={editUsername} 
                      onChange={(e) => setEditUsername(e.target.value)}
                      placeholder="مثال: مبدع العرب، قيمر محترف..." 
                      className="w-full pr-10 pl-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1 block">تغيير الاسم سوف يحدث تلقائياً جميع فيديوهاتك السابقة في المنصة!</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5">وصف القناة / السيرة الذاتية (About):</label>
                  <textarea 
                    value={editDescription} 
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                    placeholder="اكتب شيئاً عن قناتك والمحتوى الرائع الذي تنشره هنا..." 
                    className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-red-500 resize-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Media Settings Column */}
              <div className="space-y-5">
                {/* 1. Avatar modification block */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2">تحديث الصورة الشخصية للرمز التعريفي:</label>
                  
                  {/* Avatar upload option selection tabs */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-neutral-900/60 p-3 rounded-xl border border-neutral-800 flex flex-col items-center justify-center relative">
                      <Camera className="w-5 h-5 text-gray-400 mb-1" />
                      <span className="text-[10px] text-gray-400 font-bold mb-1">رفع ملف صورة</span>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setAvatarFile(e.target.files[0]);
                            setEditAvatarUrl(''); // overwrite direct input url when file uploaded
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                      />
                      {avatarFile && (
                        <span className="text-[10px] text-green-500 font-bold bg-green-500/10 px-1.5 py-0.5 rounded truncate max-w-full">
                          📂 {avatarFile.name}
                        </span>
                      )}
                    </div>

                    <div className="bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-800 space-y-1.5">
                      <span className="text-[9px] text-neutral-400 block font-bold">أو أدخل رابطاً مباشراً للصورة:</span>
                      <input 
                        type="url" 
                        value={editAvatarUrl}
                        onChange={(e) => {
                          setEditAvatarUrl(e.target.value);
                          setAvatarFile(null); // overwrite local uploaded files 
                        }}
                        placeholder="https://..." 
                        className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-[10px] text-gray-300 focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  {/* Exquisite template avatar presets choice */}
                  <span className="text-[10px] text-gray-500 font-bold block mb-1.5">أو اختر رمزاً تعبيرياً فائق الجودة بضغطة زر:</span>
                  <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-none scroll-smooth">
                    {AVATAR_PRESETS.map((p, idx) => (
                      <button 
                        key={idx}
                        type="button"
                        onClick={() => {
                          setEditAvatarUrl(p.url);
                          setAvatarFile(null);
                        }}
                        className={`flex flex-col items-center shrink-0 p-1.5 rounded-xl border-2 transition-all active:scale-95 ${
                          editAvatarUrl === p.url ? 'border-red-600 bg-red-600/10' : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900'
                        }`}
                      >
                        <img src={p.url} className="w-10 h-10 rounded-full object-cover mb-1" alt="" referrerPolicy="no-referrer" />
                        <span className="text-[9px] text-gray-400 font-medium">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Banner modification block */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-2">تحديث غلاف القناة (Banner Cover Image):</label>
                  
                  {/* Banner Upload controls choice tabs */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-neutral-900/60 p-3 rounded-xl border border-neutral-800 flex flex-col items-center justify-center relative">
                      <Image className="w-5 h-5 text-gray-400 mb-1" />
                      <span className="text-[10px] text-gray-400 font-bold mb-1">رفع صورة الغلاف</span>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setBannerFile(e.target.files[0]);
                            setEditBannerUrl(''); // overwrite direct input url when file uploaded
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                      />
                      {bannerFile && (
                        <span className="text-[10px] text-green-500 font-bold bg-green-500/10 px-1.5 py-0.5 rounded truncate max-w-full">
                          📂 {bannerFile.name}
                        </span>
                      )}
                    </div>

                    <div className="bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-800 space-y-1.5">
                      <span className="text-[9px] text-neutral-400 block font-bold">أو انسخ رابط غلاف ويب جاهز:</span>
                      <input 
                        type="url" 
                        value={editBannerUrl}
                        onChange={(e) => {
                          setEditBannerUrl(e.target.value);
                          setBannerFile(null); // overwrite local uploaded file
                        }}
                        placeholder="https://..." 
                        className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded text-[10px] text-gray-300 focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  {/* Preset customized banners */}
                  <span className="text-[10px] text-gray-500 font-bold block mb-1.5">أو تفضل باختيار خلفية بروفايل مذهلة من المكتبة:</span>
                  <div className="flex gap-2 bg-neutral-950 p-2 rounded-xl overflow-x-auto scrollbar-none scroll-smooth">
                    {BANNER_PRESETS.map((b, idx) => (
                      <button 
                        key={idx}
                        type="button"
                        onClick={() => {
                          setEditBannerUrl(b.url);
                          setBannerFile(null);
                        }}
                        className={`flex flex-col shrink-0 p-1 rounded-lg border-2 transition-all active:scale-95 ${
                          editBannerUrl === b.url ? 'border-red-600 bg-red-600/10' : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900'
                        }`}
                      >
                        <img src={b.url} className="w-16 h-8 rounded object-cover mb-1" alt="" referrerPolicy="no-referrer" />
                        <span className="text-[8px] text-gray-400">{b.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

              </div>

            </div>

            {/* Submission triggers action strip */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
              <button 
                type="button"
                onClick={() => setShowEditProfile(false)}
                className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-gray-400 hover:text-white rounded-xl text-xs font-bold select-none cursor-pointer border border-neutral-800"
              >
                إلغاء التعديل
              </button>

              <button 
                type="submit"
                disabled={savingProfile}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl text-xs font-black shadow-lg shadow-red-600/10 flex items-center gap-2 select-none cursor-pointer"
              >
                {savingProfile ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>جاري الحفظ الآمن وسحب البيانات...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>حفظ وتحديث القناة بالكامل ✨</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

        {/* Offline Mode Controller Card */}
        <div className="bg-[#121212] border border-neutral-800 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg" id="offline-mode-control-card-logged-in">
          <div className="flex items-center gap-3.5 text-right w-full md:w-auto">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isOffline ? 'bg-red-600/10 text-red-500' : 'bg-green-600/10 text-green-500'
            }`}>
              {isOffline ? <CloudOff className="w-5 h-5 animate-pulse" /> : <Wifi className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">إعدادات الاتصال بالإنترنت</h3>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                {isOffline 
                  ? 'أنت تتصفح حالياً بوضع عدم الاتصال بالشبكة (أوفلاين) - لن تعمل سوى الفيديوهات المحملة مسبقاً' 
                  : 'أنت متصل بالإنترنت وموصول بقاعدة البيانات الحية'
                }
              </p>
            </div>
          </div>

          <button
            onClick={onToggleOffline}
            className={`w-full md:w-auto px-5 py-2.5 rounded-xl font-bold text-xs select-none transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 border ${
              isOffline
                ? 'bg-red-600 text-white border-red-500 hover:bg-red-700 shadow-md shadow-red-600/20'
                : 'bg-green-600/10 text-green-500 border-green-500 hover:bg-green-600/20'
            }`}
          >
            {isOffline ? (
              <>
                <Wifi className="w-4 h-4" />
                <span>تبديل إلى: متصل بالإنترنت (تشغيل الشبكة)</span>
              </>
            ) : (
              <>
                <CloudOff className="w-4 h-4" />
                <span>تبديل إلى: وضع أوفلاين (وضع الطيران)</span>
              </>
            )}
          </button>
        </div>

        {/* Channels Grid Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Channel stats cardboard */}
          <div className="lg:col-span-1 bg-[#121212] rounded-2xl p-5 border border-neutral-800 space-y-4">
            <h3 className="text-sm font-black text-gray-400 border-b border-neutral-800 pb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-red-500" />
              <span>تفاصيل القناة الحالية</span>
            </h3>

            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">اسم القناة:</span>
                <span className="font-bold text-white">{currentUser.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">معرف الحساب (ID):</span>
                <span className="font-mono text-xs text-gray-300 px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 rounded">
                  {currentUser.user_id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">المرتبة والامتيازات:</span>
                <span className="font-bold text-amber-500">ناشر ومبدع محتوى</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">الفيديوهات المرفوعة:</span>
                <span className="font-black text-red-500">{myVideos.length} فيديو</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">تاريخ الانضمام:</span>
                <span className="text-gray-300 text-xs flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                  <span>٢٠٢٦/٠٥/٢٥</span>
                </span>
              </div>
            </div>

            <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 space-y-2">
              <span className="text-xs text-green-500 font-bold block">🔒 اتصال مشفر وآمن</span>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                حسابك محمي بالكامل ويتم تشفير كلمات المرور الخاصة بك على خوادم قاعدة بيانات يوتيوب طبق الأصل.
              </p>
            </div>
          </div>

          {/* Videos currently uploaded by user column */}
          <div className="lg:col-span-2 bg-[#121212] rounded-2xl p-5 border border-neutral-800 flex flex-col min-h-[300px]">
            <h3 className="text-sm font-black text-gray-400 border-b border-neutral-800 pb-2 flex items-center gap-2 mb-4">
              <Film className="w-4 h-4 text-red-500" />
              <span>فيديوهاتك المرفوعة لقاعدة البيانات ({myVideos.length})</span>
            </h3>

            {myVideos.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                <Video className="w-12 h-12 text-neutral-700 animate-bounce" />
                <div>
                  <h4 className="font-bold text-gray-300">لم ترفع أي فيديو بقناتك بعد</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm">
                    اضغط على زر "رفع فيديو" في الأعلى لنشر أول مقاطعك حياً على قاعدة البيانات المشتركة بين الجميع!
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {myVideos.map(vid => (
                  <div
                    key={vid.id}
                    onClick={() => onSelectVideo(vid)}
                    className="p-3 bg-neutral-900 hover:bg-[#1a1a1a] rounded-xl border border-neutral-800/80 cursor-pointer group flex gap-3 transition-all"
                  >
                    <div className="relative w-24 shrink-0 aspect-video rounded-md overflow-hidden bg-black">
                      <img 
                        src={vid.thumbnail || undefined} 
                        className="w-full h-full object-cover" 
                        alt="" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=300&auto=format&fit=crop&q=60'; }}
                      />
                      <span className="absolute bottom-1 right-1 bg-black/85 text-[9px] px-1 font-mono rounded text-white">{vid.duration}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="text-xs font-bold line-clamp-2 text-white group-hover:text-red-400 transition-colors leading-relaxed">
                          {vid.title}
                        </h4>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm(`هل أنت متأكد من رغبتك في حذف فيديو "${vid.title}" نهائياً؟ لا يمكن التراجع!`)) {
                              const btn = e.currentTarget;
                              btn.disabled = true;
                              btn.style.opacity = '0.5';
                              try {
                                await onDeleteVideo(vid.id);
                              } finally {
                                btn.disabled = false;
                                btn.style.opacity = '1';
                              }
                            }
                          }}
                          className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all disabled:cursor-not-allowed"
                          title="حذف الفيديو نهائياً"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gray-400">
                        <span className="bg-red-500/10 text-red-500 px-1 rounded text-[9px] font-bold">{vid.category}</span>
                        <span>•</span>
                        <span>{vid.views}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    );
  }

  // Auth screen layout (Sign In / Register)
  return (
    <div className="max-w-md mx-auto space-y-6 my-8" id="auth-and-offline-container">
      
      {/* Offline Mode Controller Card when Logged Out */}
      <div className="bg-[#121212] border border-neutral-800 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 shadow-lg text-center" id="offline-mode-control-card-logged-out">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isOffline ? 'bg-red-600/10 text-red-500' : 'bg-green-600/10 text-green-500'
        }`}>
          {isOffline ? <CloudOff className="w-5 h-5 animate-pulse" /> : <Wifi className="w-5 h-5" />}
        </div>
        <div>
          <h3 className="font-bold text-sm text-white">إعدادات الاتصال بالإنترنت</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
            {isOffline 
              ? 'أنت تتصفح حالياً بوضع عدم الاتصال بالشبكة (أوفلاين)' 
              : 'أنت متصل بالإنترنت وموصول بقاعدة البيانات المشتركة'
            }
          </p>
        </div>

        <button
          onClick={onToggleOffline}
          type="button"
          className={`w-full px-4 py-2 rounded-xl font-bold text-xs select-none transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 border ${
            isOffline
              ? 'bg-red-600 text-white border-red-500 hover:bg-red-700 shadow-md shadow-red-600/20'
              : 'bg-green-600/10 text-green-500 border-green-500 hover:bg-green-600/20'
          }`}
        >
          {isOffline ? (
            <>
              <Wifi className="w-3.5 h-3.5" />
              <span>تبديل كلي للاتصال السحابي بالإنترنت (تشغيل)</span>
            </>
          ) : (
            <>
              <CloudOff className="w-3.5 h-3.5" />
              <span>تبديل كلي كوضع أوفلاين (وضع الطيران)</span>
            </>
          )}
        </button>
      </div>

      <div className="bg-[#121212] border border-neutral-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl animate-fade-in" id="auth-box-container">
      
      {/* Visual Header Branding */}
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center justify-center w-12 h-9 bg-red-600 rounded-xl mb-2">
          <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[8px] border-r-white transform -translate-x-[1px]"></div>
        </div>
        <h2 className="text-xl font-black text-white">
          {isRegister ? 'إنشاء حساب صانع محتوى' : 'تسجيل الدخول لقناة يوتيوب'}
        </h2>
        <p className="text-xs text-gray-400">
          {isRegister 
            ? 'احصل على قناتك الشخصية مجاناً الآن وابدأ برفع ونشر الفيديوهات!' 
            : 'قم بتسجيل الدخول لتستطيع رفع المقاطع والتفاعل بالتعليقات والإعجابات حياً!'
          }
        </p>
      </div>

      {/* Auth Toggle Tabs (with exact glowing underscore / شخطه تحت) */}
      <div className="grid grid-cols-2 border-b border-neutral-800 relative" id="auth-tabs">
        <button
          onClick={() => { setIsRegister(false); resetForm(); }}
          className={`py-3 text-sm font-bold transition-all relative ${
            !isRegister ? 'text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <span>تسجيل الدخول</span>
          {!isRegister && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 shadow-md shadow-red-500/50" id="active-tab-underline"></span>
          )}
        </button>

        <button
          onClick={() => { setIsRegister(true); resetForm(); }}
          className={`py-3 text-sm font-bold transition-all relative ${
            isRegister ? 'text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <span>إنشاء حساب جديد</span>
          {isRegister && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 shadow-md shadow-red-500/50" id="active-tab-underline"></span>
          )}
        </button>
      </div>

      {/* Alerts Block */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500 font-medium leading-relaxed">
          ⚠️ {error}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-xs text-green-500 font-medium leading-relaxed">
          {successMsg}
        </div>
      )}

      {/* Form Fields inputs */}
      <form onSubmit={handleSubmit} className="space-y-4.5" id="auth-credentials-form">
        
        {isRegister && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400">اسم المستخدم (القناة)</label>
            <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 focus-within:border-red-600 transition-all text-right">
              <User className="w-4 h-4 text-neutral-500 shrink-0 ml-2" />
              <input
                key="register-username-input-element"
                type="text"
                required
                value={username || ''}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="مثال: عرب تيك"
                className="w-full bg-transparent focus:outline-none text-sm text-white"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-400">البريد الإلكتروني</label>
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 focus-within:border-red-600 transition-all text-right">
            <Mail className="w-4 h-4 text-neutral-500 shrink-0 ml-2" />
            <input
              key="auth-email-input-element"
              type="email"
              required
              value={email || ''}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full bg-transparent focus:outline-none text-sm text-white text-left"
              dir="ltr"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-gray-400">كلمة المرور المشفرة</label>
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 focus-within:border-red-600 transition-all text-right">
            <Lock className="w-4 h-4 text-neutral-500 shrink-0 ml-2" />
            <input
              key="auth-password-input-element"
              type="password"
              required
              value={password || ''}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••••"
              className="w-full bg-transparent focus:outline-none text-sm text-white text-left"
              dir="ltr"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 active:scale-98 text-white rounded-xl py-3 text-sm font-black transition-all cursor-pointer shadow-lg shadow-red-600/10 flex items-center justify-center gap-2 mt-6"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/35 border-t-white rounded-full animate-spin"></span>
          ) : (
            <>
              <span>{isRegister ? 'تسجيل وإنشاء القناة الجديدة' : 'تسجيل الدخول الآمن'}</span>
            </>
          )}
        </button>
      </form>

      {/* Security disclaimer footer */}
      <div className="text-center pt-2">
        <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 font-bold justify-center">
          <Shield className="w-3.5 h-3.5 text-red-600" />
          تطبيق يوتيوب صُنع لغرض المحاكاة الواقعية وموصول بقاعدة بيانات Express
        </span>
      </div>

      </div>
    </div>
  );
}
