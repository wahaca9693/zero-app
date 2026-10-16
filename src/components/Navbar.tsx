import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Menu, Search, Bell, Plus, User, Mic } from 'lucide-react';

interface NavbarProps {
  onSearch: (query: string) => void;
  onToggleSidebar: () => void;
  onOpenUpload: () => void;
  onGoHome: () => void;
  currentUser: { user_id: string; username: string; email: string } | null;
  onGoToAccount: () => void;
}

export function YouTubeLogo({ onClick }: { onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-1 cursor-pointer select-none active:scale-95 transition-transform px-2 py-1 rounded-lg"
      id="logo-brand"
    >
      <svg viewBox="0 0 28 20" className="w-[30px] h-[21px]" aria-hidden="true">
        <path
          fill="#FF0000"
          d="M27.429 3.125c-.35-1.31-1.382-2.342-2.692-2.692C22.365 0 14 0 14 0S5.635 0 3.263.433C1.953.743.921 1.775.571 3.085 0 5.457 0 10 0 10s0 4.543.571 6.915c.35 1.31 1.382 2.342 2.692 2.692C5.635 20 14 20 14 20s8.365 0 10.737-.433c1.31-.35 2.342-1.382 2.692-2.692C28 14.543 28 10 28 10s0-4.543-.571-6.875z"
        />
        <path fill="#fff" d="M11.2 14.285V5.715L18.286 10l-7.086 4.285z" />
      </svg>
      <span className="text-[17px] font-bold tracking-tighter text-[var(--yt-text)] font-sans flex items-center leading-none">
        YouTube
      </span>
    </div>
  );
}

export default function Navbar({
  onSearch,
  onToggleSidebar,
  onOpenUpload,
  onGoHome,
  currentUser,
  onGoToAccount
}: NavbarProps) {
  const [searchVal, setSearchVal] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchVal);
  };

  return (
    <motion.nav
      initial={{ y: -56, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="sticky top-0 z-50 flex items-center justify-between h-14 px-4 bg-[var(--yt-bg)] text-[var(--yt-text)]"
      id="app-navbar"
    >
      {/* Right side (RTL start): menu + logo */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="yt-icon-btn p-2 text-[var(--yt-text)]"
          id="btn-sidebar-toggle"
          aria-label="القائمة"
        >
          <Menu className="w-5 h-5" />
        </button>
        <YouTubeLogo onClick={onGoHome} />
      </div>

      {/* Center: search */}
      <div className="flex-1 hidden md:flex items-center justify-center px-4">
        <form
          onSubmit={handleSearchSubmit}
          className="flex items-center w-full max-w-[640px]"
          id="search-form"
        >
          <div
            className={`flex flex-1 h-10 items-center bg-[var(--yt-search-bg)] border rounded-r-full px-4 transition-all duration-200 ${
              focused ? 'border-[var(--yt-blue)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]' : 'border-[var(--yt-border)]'
            }`}
          >
            {focused && <Search className="w-4 h-4 text-[var(--yt-text-2)] ml-3 shrink-0" />}
            <input
              type="text"
              placeholder="بحث"
              value={searchVal || ''}
              onChange={(e) => setSearchVal(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="w-full bg-transparent focus:outline-none text-[16px] text-[var(--yt-text)]"
              id="search-input"
            />
            {searchVal && (
              <button
                type="button"
                onClick={() => { setSearchVal(''); onSearch(''); }}
                className="yt-icon-btn p-1 text-[var(--yt-text-2)] shrink-0"
                aria-label="مسح"
              >
                <span className="text-lg leading-none px-1">×</span>
              </button>
            )}
          </div>
          <button
            type="submit"
            className="h-10 w-16 flex items-center justify-center bg-[var(--yt-search-btn)] border border-r-0 border-[var(--yt-border)] rounded-l-full text-[var(--yt-text)] hover:bg-[var(--yt-chip-hover)] transition-colors shrink-0"
            id="btn-search-submit"
            aria-label="بحث"
          >
            <Search className="w-5 h-5" />
          </button>
        </form>
        <button
          className="yt-icon-btn p-2.5 mr-3 bg-[var(--yt-chip)] text-[var(--yt-text)] shrink-0"
          aria-label="البحث الصوتي"
          title="البحث الصوتي"
        >
          <Mic className="w-5 h-5" />
        </button>
      </div>

      {/* Left side (RTL end): create, notifications, avatar */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => {
            const query = prompt('ابحث عن فيديوهات:');
            if (query !== null) onSearch(query);
          }}
          className="yt-icon-btn p-2 md:hidden text-[var(--yt-text)]"
          aria-label="بحث"
        >
          <Search className="w-5 h-5" />
        </button>

        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={onOpenUpload}
          className="hidden sm:flex items-center gap-1.5 h-9 pl-4 pr-3 yt-btn-pill rounded-full text-sm font-medium"
          id="btn-upload-trigger"
        >
          <Plus className="w-5 h-5" />
          <span>إنشاء</span>
        </motion.button>
        <button
          onClick={onOpenUpload}
          className="yt-icon-btn p-2 sm:hidden text-[var(--yt-text)]"
          aria-label="إنشاء"
        >
          <Plus className="w-6 h-6" />
        </button>

        {currentUser ? (
          <>
            <button className="yt-icon-btn p-2 text-[var(--yt-text)] relative" aria-label="الإشعارات">
              <Bell className="w-5 h-5" />
            </button>
            <motion.div
              whileTap={{ scale: 0.9 }}
              onClick={onGoToAccount}
              className="w-8 h-8 rounded-full overflow-hidden bg-[var(--yt-chip)] flex items-center justify-center font-medium text-sm text-[var(--yt-text)] cursor-pointer select-none mx-1"
              title={`قناتي: ${currentUser.username}`}
              id="navbar-profile-avatar"
            >
              {(currentUser as any).avatar ? (
                <img src={`${(currentUser as any).avatar}`} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
              ) : (
                currentUser.username ? currentUser.username.substring(0, 1).toUpperCase() : '?'
              )}
            </motion.div>
          </>
        ) : (
          <button
            onClick={onGoToAccount}
            className="flex items-center gap-1.5 h-9 px-3 rounded-full border border-[var(--yt-border)] text-[var(--yt-blue)] text-sm font-medium hover:bg-[var(--yt-chip)] transition-colors"
            id="navbar-signin-btn"
          >
            <User className="w-5 h-5" />
            <span className="hidden sm:inline">تسجيل الدخول</span>
          </button>
        )}
      </div>
    </motion.nav>
  );
}
