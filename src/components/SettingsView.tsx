import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Moon, Sun, Play, Bell, Database, Trash2, Info, ChevronLeft, Check, HardDriveDownload, History, User } from 'lucide-react';
import { useTheme } from '../theme';
import { getDownloads, deleteDownload, getHistory, clearHistory } from '../utils/db';

interface SettingsViewProps {
  onGoToAccount: () => void;
}

const AUTOPLAY_KEY = 'youtlibre_autoplay';
const NOTIF_KEY = 'youtlibre_notifications';

function Row({ icon, title, desc, control }: { icon: ReactNode; title: string; desc?: string; control: ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-[var(--yt-border)] last:border-0">
      <div className="w-10 h-10 rounded-full bg-[var(--yt-chip)] flex items-center justify-center text-[var(--yt-text)] shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-[var(--yt-text)]">{title}</h4>
        {desc && <p className="text-xs text-[var(--yt-text-2)] mt-0.5 leading-relaxed">{desc}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={() => onChange(!on)}
      className={`w-11 h-6 rounded-full p-0.5 flex justify-start transition-colors duration-200 ${on ? 'bg-[var(--yt-blue)]' : 'bg-[var(--yt-chip-hover)]'}`}
      role="switch"
      aria-checked={on}
    >
      <motion.span
        animate={{ x: on ? -20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className="block w-5 h-5 rounded-full bg-white shadow shrink-0"
      />
    </motion.button>
  );
}

function Segmented<T extends string>({ options, value, onChange }: { options: { v: T; label: string; icon?: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex bg-[var(--yt-chip)] rounded-full p-1 gap-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`relative flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            value === o.v ? 'text-[var(--yt-chip-active-text)]' : 'text-[var(--yt-text)]'
          }`}
        >
          {value === o.v && (
            <motion.span
              layoutId="seg-bg"
              className="absolute inset-0 rounded-full bg-[var(--yt-chip-active-bg)]"
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            />
          )}
          <span className="relative flex items-center gap-1.5">{o.icon}{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function SettingsView({ onGoToAccount }: SettingsViewProps) {
  const { theme, setTheme } = useTheme();
  const [autoplay, setAutoplay] = useState(() => {
    try { return localStorage.getItem(AUTOPLAY_KEY) !== '0'; } catch { return true; }
  });
  const [notif, setNotif] = useState(() => {
    try { return localStorage.getItem(NOTIF_KEY) === '1'; } catch { return false; }
  });
  const [dlCount, setDlCount] = useState(0);
  const [histCount, setHistCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refreshCounts = async () => {
    try {
      const dls = await getDownloads();
      setDlCount(dls.filter(d => d.status === 'completed').length);
      const h = await getHistory();
      setHistCount(h.length);
    } catch {}
  };

  useEffect(() => { refreshCounts(); }, []);

  useEffect(() => {
    if (msg) {
      const t = setTimeout(() => setMsg(null), 3000);
      return () => clearTimeout(t);
    }
  }, [msg]);

  const handleAutoplay = (v: boolean) => {
    setAutoplay(v);
    try { localStorage.setItem(AUTOPLAY_KEY, v ? '1' : '0'); } catch {}
  };

  const handleNotif = async (v: boolean) => {
    if (v && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setMsg('لم يتم السماح بالإشعارات من المتصفح');
        return;
      }
    }
    setNotif(v);
    try { localStorage.setItem(NOTIF_KEY, v ? '1' : '0'); } catch {}
    if (v) setMsg('تم تفعيل الإشعارات');
  };

  const clearDownloads = async () => {
    if (!confirm('حذف جميع الفيديوهات المحملة من جهازك؟')) return;
    setBusy(true);
    try {
      const dls = await getDownloads();
      for (const d of dls) await deleteDownload(d.id);
      await refreshCounts();
      setMsg('تم حذف جميع التنزيلات');
    } finally { setBusy(false); }
  };

  const clearHist = async () => {
    if (!confirm('مسح سجل المشاهدة بالكامل؟')) return;
    setBusy(true);
    try {
      await clearHistory();
      await refreshCounts();
      setMsg('تم مسح السجل');
    } finally { setBusy(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-3xl mx-auto pb-16"
      id="settings-view"
    >
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold text-[var(--yt-text)] mb-6"
      >
        الإعدادات
      </motion.h1>

      {msg && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-center gap-2 bg-[var(--yt-chip)] text-[var(--yt-text)] text-sm font-medium px-4 py-3 rounded-xl"
        >
          <Check className="w-4 h-4 text-green-500" />
          {msg}
        </motion.div>
      )}

      {/* Appearance */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-8"
      >
        <h2 className="text-base font-medium text-[var(--yt-text)] mb-2">المظهر</h2>
        <div className="bg-[var(--yt-bg-elev)] rounded-2xl px-5 border border-[var(--yt-border)]">
          <Row
            icon={theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            title="مظهر التطبيق"
            desc="اختر بين الوضع الداكن والفاتح — يتذكر التطبيق اختيارك"
            control={
              <Segmented
                value={theme}
                onChange={setTheme}
                options={[
                  { v: 'dark', label: 'داكن', icon: <Moon className="w-4 h-4" /> },
                  { v: 'light', label: 'فاتح', icon: <Sun className="w-4 h-4" /> },
                ]}
              />
            }
          />
        </div>
      </motion.section>

      {/* Playback */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <h2 className="text-base font-medium text-[var(--yt-text)] mb-2">التشغيل</h2>
        <div className="bg-[var(--yt-bg-elev)] rounded-2xl px-5 border border-[var(--yt-border)]">
          <Row
            icon={<Play className="w-5 h-5" />}
            title="التشغيل التلقائي"
            desc="بدء تشغيل الفيديو تلقائياً عند فتح صفحة المشاهدة"
            control={<Toggle on={autoplay} onChange={handleAutoplay} />}
          />
          <Row
            icon={<Bell className="w-5 h-5" />}
            title="إشعارات المتصفح"
            desc="السماح للتطبيق بإظهار إشعارات عند اكتمال التنزيلات"
            control={<Toggle on={notif} onChange={handleNotif} />}
          />
        </div>
      </motion.section>

      {/* Storage */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-8"
      >
        <h2 className="text-base font-medium text-[var(--yt-text)] mb-2">التخزين والبيانات</h2>
        <div className="bg-[var(--yt-bg-elev)] rounded-2xl px-5 border border-[var(--yt-border)]">
          <Row
            icon={<HardDriveDownload className="w-5 h-5" />}
            title="الفيديوهات المحملة"
            desc={`${dlCount} فيديو محفوظ على جهازك للمشاهدة بلا إنترنت`}
            control={
              <button
                onClick={clearDownloads}
                disabled={busy || dlCount === 0}
                className="yt-btn-pill px-4 py-2 rounded-full text-sm font-medium disabled:opacity-40 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                حذف الكل
              </button>
            }
          />
          <Row
            icon={<History className="w-5 h-5" />}
            title="سجل المشاهدة"
            desc={`${histCount} عنصر في السجل المحلي`}
            control={
              <button
                onClick={clearHist}
                disabled={busy || histCount === 0}
                className="yt-btn-pill px-4 py-2 rounded-full text-sm font-medium disabled:opacity-40 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                مسح السجل
              </button>
            }
          />
        </div>
      </motion.section>

      {/* Account */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <h2 className="text-base font-medium text-[var(--yt-text)] mb-2">الحساب</h2>
        <div className="bg-[var(--yt-bg-elev)] rounded-2xl px-5 border border-[var(--yt-border)]">
          <Row
            icon={<User className="w-5 h-5" />}
            title="حسابي وقناتي"
            desc="إدارة القناة، الفيديوهات المرفوعة، وتخصيص الملف الشخصي"
            control={
              <button
                onClick={onGoToAccount}
                className="flex items-center gap-1 text-sm font-medium text-[var(--yt-blue)] hover:underline"
              >
                فتح
                <ChevronLeft className="w-4 h-4" />
              </button>
            }
          />
        </div>
      </motion.section>

      {/* About */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <h2 className="text-base font-medium text-[var(--yt-text)] mb-2">حول</h2>
        <div className="bg-[var(--yt-bg-elev)] rounded-2xl px-5 border border-[var(--yt-border)]">
          <Row
            icon={<Info className="w-5 h-5" />}
            title="YouTLibre"
            desc="منصة فيديو بأسلوب يوتيوب — الإصدار 2.0. يعمل أوفلاين عبر التنزيلات المحلية."
            control={<span className="text-xs text-[var(--yt-text-2)] font-mono">v2.0</span>}
          />
        </div>
        <div className="flex items-center gap-2 mt-4 text-xs text-[var(--yt-text-2)]">
          <Database className="w-4 h-4" />
          <span>ملاحظة: بيانات الحساب والفيديوهات تحتاج خادماً خلفياً يعمل — الوضع الحالي يعرض المحتوى المحلي فقط.</span>
        </div>
      </motion.section>
    </motion.div>
  );
}
