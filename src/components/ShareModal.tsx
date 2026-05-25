import React from 'react';
import { X, Copy, Facebook, Twitter, Send, MessageCircle, Link } from 'lucide-react';

interface ShareModalProps {
  videoUrl: string;
  onClose: () => void;
}

export default function ShareModal({ videoUrl, onClose }: ShareModalProps) {
  const shareLinks = [
    { name: 'واتساب', icon: <MessageCircle className="w-5 h-5" />, color: 'bg-green-600', url: `https://wa.me/?text=${encodeURIComponent(videoUrl)}` },
    { name: 'تيليجرام', icon: <Send className="w-5 h-5 text-white" />, color: 'bg-blue-500', url: `https://t.me/share/url?url=${encodeURIComponent(videoUrl)}` },
    { name: 'فيسبوك', icon: <Facebook className="w-5 h-5" />, color: 'bg-blue-700', url: `https://www.facebook.com/api/sharer.php?u=${encodeURIComponent(videoUrl)}` },
    { name: 'تويتر (X)', icon: <Twitter className="w-5 h-5" />, color: 'bg-black', url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(videoUrl)}` },
  ];

  const copyToClipboard = () => {
    navigator.clipboard.writeText(videoUrl);
    alert('✅ تم نسخ الرابط بنجاح!');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in text-right" dir="rtl">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative bg-[#1a1a1a] border border-neutral-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-white">مشاركة الفيديو</h3>
          <button onClick={onClose} className="p-1 hover:bg-neutral-800 rounded-full text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {shareLinks.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 group"
            >
              <div className={`${link.color} p-3 rounded-full shadow-lg group-hover:scale-110 transition-transform`}>
                {link.icon}
              </div>
              <span className="text-[10px] text-gray-400 font-bold">{link.name}</span>
            </a>
          ))}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 block">رابط الفيديو المباشر:</label>
          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 p-2 rounded-xl">
            <input
              type="text"
              readOnly
              value={videoUrl}
              className="flex-1 bg-transparent border-none text-[10px] text-gray-300 focus:outline-none font-mono"
            />
            <button
              onClick={copyToClipboard}
              className="bg-red-600 hover:bg-red-700 p-2 rounded-lg transition-colors"
              title="نسخ الرابط"
            >
              <Copy className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 py-2.5 bg-neutral-800 hover:bg-neutral-750 text-white rounded-xl text-xs font-bold transition-colors"
        >
          إغلاق
        </button>
      </div>
    </div>
  );
}
