import { motion, AnimatePresence } from 'motion/react';
import type { Key } from 'react';
import { Home, Zap, History, Download, Heart, User, Tv, Settings, Bookmark } from 'lucide-react';
import { ActiveTab } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  isOpen: boolean;
  downloadCount: number;
  onClose?: () => void;
}

interface SidebarItem {
  id: ActiveTab;
  label: string;
  icon: any;
  badge?: number;
}

function GuideButton({ item, isActive, onClick, mini }: { key?: Key; item: SidebarItem; isActive: boolean; onClick: () => void; mini?: boolean }) {
  const Icon = item.icon;
  if (mini) {
    return (
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={onClick}
        className={`flex flex-col items-center justify-center gap-1.5 py-4 px-1 rounded-xl w-full transition-colors ${
          isActive ? 'text-[var(--yt-text)]' : 'text-[var(--yt-text)] hover:bg-[var(--yt-chip)]'
        }`}
        id={`sidebar-mini-${item.id}`}
      >
        <span className="relative">
          <Icon className="w-6 h-6" strokeWidth={isActive ? 2.4 : 1.8} />
          {item.badge !== undefined && (
            <span className="absolute -top-1.5 -left-2 bg-[var(--yt-red)] text-white text-[10px] font-bold px-1 rounded-full">
              {item.badge}
            </span>
          )}
        </span>
        <span className="text-[10px] leading-none">{item.label}</span>
      </motion.button>
    );
  }
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`w-full flex items-center gap-6 px-3 h-10 rounded-lg text-sm transition-colors relative ${
        isActive
          ? 'bg-[var(--yt-chip)] text-[var(--yt-text)] font-medium'
          : 'text-[var(--yt-text)] hover:bg-[var(--yt-chip)]'
      }`}
      id={`sidebar-${item.id}`}
    >
      <span className="relative shrink-0">
        <Icon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 1.8} />
        {item.badge !== undefined && (
          <span className="absolute -top-1.5 -left-2 bg-[var(--yt-red)] text-white text-[10px] font-bold px-1 rounded-full">
            {item.badge}
          </span>
        )}
      </span>
      <span className="truncate">{item.label}</span>
    </motion.button>
  );
}

export default function Sidebar({ activeTab, onChangeTab, isOpen, downloadCount, onClose }: SidebarProps) {
  const mainItems: SidebarItem[] = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'shorts', label: 'Shorts', icon: Zap },
    { id: 'subscriptions', label: 'الاشتراكات', icon: Tv },
  ];
  const youItems: SidebarItem[] = [
    { id: 'history', label: 'السجل', icon: History },
    { id: 'liked', label: 'فيديوهات أعجبتني', icon: Heart },
    { id: 'downloads', label: 'التنزيلات', icon: Download, badge: downloadCount > 0 ? downloadCount : undefined },
    { id: 'library', label: 'المشاهدة لاحقاً', icon: Bookmark },
  ];
  const personalItems: SidebarItem[] = [
    { id: 'account', label: 'قناتك', icon: User },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
  ];

  if (!isOpen) {
    return (
      <aside className="hidden lg:flex flex-col w-[72px] py-2 px-1 shrink-0 select-none gap-1 bg-[var(--yt-bg)]" id="sidebar-mini">
        {[...mainItems, ...youItems.slice(0, 2)].map((item) => (
          <GuideButton key={item.id} item={item} isActive={activeTab === item.id} onClick={() => onChangeTab(item.id)} mini />
        ))}
      </aside>
    );
  }

  const Section = ({ title, items }: { title?: string; items: SidebarItem[] }) => (
    <div className="py-2 border-b border-[var(--yt-border)]">
      {title && <h3 className="px-3 pb-1 text-[15px] font-medium text-[var(--yt-text)]">{title}</h3>}
      <div className="space-y-0.5">
        {items.map((item) => (
          <GuideButton key={item.id} item={item} isActive={activeTab === item.id} onClick={() => onChangeTab(item.id)} />
        ))}
      </div>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            id="sidebar-backdrop"
          />
        )}
      </AnimatePresence>
      <motion.aside
        initial={false}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className="fixed lg:sticky top-14 bottom-0 right-0 z-40 lg:z-auto w-[240px] shrink-0 bg-[var(--yt-bg)] px-3 pb-6 overflow-y-auto select-none h-[calc(100vh-3.5rem)]"
        id="sidebar-guide"
      >
        <Section items={mainItems} />
        <Section title="أنت" items={youItems} />
        <Section items={personalItems} />
        <div className="px-3 py-4 text-xs text-[var(--yt-text-2)] leading-relaxed">
          <p className="font-medium text-[var(--yt-text)] mb-1">YouTLibre</p>
          <p>نسخة مطابقة لتجربة يوتيوب — سجّل الدخول للرفع والتفاعل.</p>
          <p className="mt-2">© 2026 YouTLibre</p>
        </div>
      </motion.aside>
    </>
  );
}

