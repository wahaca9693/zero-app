import React, { useState } from 'react';
import { Menu, Search, Video, Bell, Upload, ArrowLeft, User } from 'lucide-react';

interface NavbarProps {
  onSearch: (query: string) => void;
  onToggleSidebar: () => void;
  onOpenUpload: () => void;
  onGoHome: () => void;
  currentUser: { user_id: number; username: string; email: string } | null;
  onGoToAccount: () => void;
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchVal);
  };

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between h-14 px-4 bg-[#0F0F0F] text-white border-b border-[#272727]" id="app-navbar">
      {/* Right side: Logo & Toggle Sidebar (for RTL, logo is on the right) */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onToggleSidebar}
          className="p-2 hover:bg-[#272727] rounded-full transition-colors active:scale-95"
          id="btn-sidebar-toggle"
        >
          <Menu className="w-5 h-5 text-gray-200" />
        </button>
        
        <div 
          onClick={onGoHome}
          className="flex items-center gap-1.5 cursor-pointer select-none active:scale-95 transition-transform"
          id="logo-brand"
        >
          {/* YouTube official red play button logo */}
          <svg viewBox="0 0 24 24" className="w-[28px] h-[20px] fill-[#FF0000]" aria-hidden="true" style={{ display: 'inline-block' }}>
            <path d="M23.498 6.163c-.272-1.022-1.078-1.826-2.1-2.1C19.516 3.5 12 3.5 12 3.5s-7.516 0-9.398.563c-1.022.274-1.828 1.078-2.1 2.1C0 8.047 0 12 0 12s0 3.953.502 5.837c.272 1.023 1.078 1.827 2.1 2.1C4.484 20.5 12 20.5 12 20.5s7.516 0 9.398-.563c1.022-.273 1.828-1.077 2.1-2.1C24 15.953 24 12 24 12s0-3.953-.502-5.837z" />
            <path d="M9.5 15.5l6.5-3.5-6.5-3.5v7z" className="fill-white" />
          </svg>
          <span className="text-lg font-bold tracking-tighter text-white font-sans flex items-center">
            YouTube
          </span>
        </div>
      </div>

      {/* Middle: Rich Search bar */}
      <form 
        onSubmit={handleSearchSubmit}
        className="flex-1 max-w-[600px] mx-4 hidden md:flex items-center"
        id="search-form"
      >
        <div className="flex w-full h-10 items-center bg-[#121212] border border-[#272727] rounded-r-full px-4 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all duration-200">
          <input
            type="text"
            placeholder="ابحث عن فيديوهات..."
            value={searchVal || ''}
            onChange={(e) => setSearchVal(e.target.value)}
            className="w-full bg-transparent focus:outline-none text-sm placeholder-gray-500 text-white"
            id="search-input"
          />
          {searchVal && (
            <button 
              type="button" 
              onClick={() => { setSearchVal(''); onSearch(''); }} 
              className="text-gray-400 hover:text-white mr-2 text-xs shrink-0"
            >
              مسح
            </button>
          )}
        </div>
        <button 
          type="submit"
          className="bg-[#222222] border border-r-0 border-[#272727] rounded-l-full px-5 h-10 flex items-center justify-center hover:bg-[#272727] transition-colors active:bg-[#323232] shrink-0"
          id="btn-search-submit"
        >
          <Search className="w-5 h-5 text-gray-300" />
        </button>
      </form>

      {/* Left side: Custom Upload and Avatar */}
      <div className="flex items-center gap-2">
        {/* Mobile Search button */}
        <button 
          onClick={() => {
            const query = prompt('ابحث عن فيديوهات:');
            if (query !== null) onSearch(query);
          }}
          className="p-2 md:hidden hover:bg-[#272727] rounded-full text-gray-200"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Upload Video Trigger */}
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 p-2 md:px-3 md:py-1.5 hover:bg-[#272727] active:bg-[#373737] rounded-full border border-gray-800 text-sm font-medium transition-all text-gray-200 active:scale-95"
          title="رفع فيديو خاص بك"
          id="btn-upload-trigger"
        >
          <Upload className="w-4 h-4 text-red-500" />
          <span className="hidden md:inline">رفع فيديو</span>
        </button>

        {/* User profile avatar or Sign In button */}
        {currentUser ? (
          <div 
            onClick={onGoToAccount}
            className="w-8 h-8 rounded-full overflow-hidden border-2 border-red-500 bg-[#cc1111] flex items-center justify-center font-black text-xs text-white cursor-pointer hover:scale-105 active:scale-95 transition-all select-none"
            title={`قناتي: ${currentUser.username}`}
            id="navbar-profile-avatar"
          >
            {(currentUser as any).avatar ? (
              <img src={`${(currentUser as any).avatar}?t=${Date.now()}`} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
            ) : (
              currentUser.username ? currentUser.username.substring(0, 2).toUpperCase() : '??'
            )}
          </div>
        ) : (
          <button
            onClick={onGoToAccount}
            className="px-3.5 py-1.5 bg-[#181818] border border-neutral-800 hover:bg-neutral-800 text-red-500 hover:text-red-400 text-xs font-bold rounded-full select-none transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            id="navbar-signin-btn"
          >
            <User className="w-3.5 h-3.5" />
            <span>دخول</span>
          </button>
        )}
      </div>
    </nav>
  );
}
