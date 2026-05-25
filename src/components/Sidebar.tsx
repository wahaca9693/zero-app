import { Home, Zap, Heart, History, Download, Library, Film, Github, User, Tv } from 'lucide-react';
import { ActiveTab } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  isOpen: boolean;
  downloadCount: number;
}

interface SidebarItem {
  id: ActiveTab;
  label: string;
  icon: any;
  badge?: number;
}

export default function Sidebar({
  activeTab,
  onChangeTab,
  isOpen,
  downloadCount
}: SidebarProps) {
  // Navigation categories
  const mainItems: SidebarItem[] = [
    { id: 'home' as ActiveTab, label: 'الرئيسية', icon: Home },
    { id: 'shorts' as ActiveTab, label: 'قصيرة (Shorts)', icon: Zap },
    { id: 'subscriptions' as ActiveTab, label: 'الاشتراكات', icon: Tv },
    { id: 'downloads' as ActiveTab, label: 'الفيديوهات المحملة', icon: Download, badge: downloadCount > 0 ? downloadCount : undefined },
  ];

  const libraryItems: SidebarItem[] = [
    { id: 'library' as ActiveTab, label: 'مكتبتك', icon: Library },
    { id: 'history' as ActiveTab, label: 'السجل', icon: History },
    { id: 'liked' as ActiveTab, label: 'أعجبني', icon: Heart },
  ];

  const personalItems: SidebarItem[] = [
    { id: 'account' as ActiveTab, label: 'حسابي وقناتي', icon: User }
  ];

  if (!isOpen) {
    // Collapsed mini sidebar view
    return (
      <aside className="hidden lg:flex flex-col w-20 bg-[#0F0F0F] border-l border-[#272727] py-2 shrink-0 select-none" id="sidebar-collapsed">
        {[...mainItems, ...libraryItems, ...personalItems].map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1.5 py-4 px-1 rounded-xl mx-1 hover:bg-[#272727] active:scale-95 transition-all text-center ${
                isActive ? 'text-white font-bold bg-[#272727]' : 'text-gray-400 font-medium'
              }`}
              id={`sidebar-collapsed-${item.id}`}
            >
              <div className="relative">
                <IconComponent className="w-5 h-5" />
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 bg-red-600 text-white text-[10px] px-1 rounded-full border border-[#0F0F0F]">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] truncate max-w-full">{item.label}</span>
            </button>
          );
        })}
      </aside>
    );
  }

  return (
    <>
      {/* Full Expanded Sidebar for Desktop & Mobile Overlay Drawer */}
      <aside 
        className="fixed inset-y-14 right-0 lg:static z-45 w-[240px] bg-[#0F0F0F] border-l border-[#272727] px-3 py-4 shrink-0 overflow-y-auto select-none"
        id="sidebar-expanded"
      >
        {/* Main Section */}
        <div className="space-y-1 mb-4">
          <span className="text-xs text-gray-500 font-bold px-3 uppercase block mb-1">تصفح</span>
          {mainItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#272727] active:scale-98 transition-all relative ${
                  isActive ? 'bg-[#272727] text-white font-bold' : 'text-gray-300 hover:text-white'
                }`}
                id={`sidebar-expanded-${item.id}`}
              >
                <div className="flex items-center gap-3">
                  <IconComponent className={`w-5 h-5 ${isActive ? 'text-red-500' : 'text-gray-400'}`} />
                  <span className="text-sm">{item.label}</span>
                </div>
                {isActive && (
                  <span className="absolute right-0 top-2 bottom-2 w-1 bg-red-600 rounded"></span>
                )}
                {item.badge !== undefined && (
                  <span className="bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="border-t border-[#272727] my-4"></div>

        {/* Library Section */}
        <div className="space-y-1 mb-4">
          <span className="text-xs text-gray-500 font-bold px-3 uppercase block mb-1">المكتبة الخاصة</span>
          {libraryItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#272727] active:scale-98 transition-all relative ${
                  isActive ? 'bg-[#272727] text-white font-bold' : 'text-gray-300 hover:text-white'
                }`}
                id={`sidebar-expanded-${item.id}`}
              >
                <IconComponent className={`w-5 h-5 ${isActive ? 'text-red-500' : 'text-gray-400'}`} />
                <span className="text-sm">{item.label}</span>
                {isActive && (
                  <span className="absolute right-0 top-1.5 bottom-1.5 w-1 bg-red-600 rounded"></span>
                )}
              </button>
            );
          })}
        </div>

        <div className="border-t border-[#272727] my-4"></div>

        {/* Account management */}
        <div className="space-y-1 mb-4">
          <span className="text-xs text-gray-500 font-bold px-3 uppercase block mb-1">بروفايل المبدع</span>
          {personalItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#272727] active:scale-98 transition-all relative ${
                  isActive ? 'bg-[#272727] text-white font-bold' : 'text-gray-300 hover:text-white'
                }`}
                id={`sidebar-expanded-${item.id}`}
              >
                <IconComponent className={`w-5 h-5 ${isActive ? 'text-red-500' : 'text-gray-400'}`} />
                <span className="text-sm">{item.label}</span>
                {isActive && (
                  <span className="absolute right-0 top-1.5 bottom-1.5 w-1 bg-red-600 rounded"></span>
                )}
              </button>
            );
          })}
        </div>

        <div className="border-t border-[#272727] my-4"></div>

        {/* Offline notice box inside Sidebar */}
        <div className="bg-[#161616] border border-[#272727] p-4 rounded-xl text-center space-y-2 relative overflow-hidden">
          <div className="absolute -top-3 -right-3 w-10 h-10 bg-red-600/10 rounded-full blur-xl"></div>
          <span className="text-xs text-red-500 font-bold tracking-tight block">🔥 ميزة غيغا-أوفلاين</span>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            يمكنك تحميل الفيديوهات لتخزينها في قاعدة بيانات جهازك مباشرة ومشاهدتها حياً حتى بدون اتصال إنترنت!
          </p>
        </div>
      </aside>
    </>
  );
}
