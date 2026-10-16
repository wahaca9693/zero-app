import { motion } from 'motion/react';
import { Download, Check, Trash2, Loader2, MoreVertical } from 'lucide-react';
import { Video, DownloadedItem } from '../types';

interface VideoCardProps {
  key?: any;
  video: Video;
  onSelect: () => void;
  downloadStatus: DownloadedItem | undefined;
  onDownload: (e: any) => void;
  onDeleteDownload: (e: any) => void;
  isOffline: boolean;
  onChannelClick?: (channelName: string) => void;
}

const FALLBACK_THUMB = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&auto=format&fit=crop&q=60';
const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60';

export default function VideoCard({
  video,
  onSelect,
  downloadStatus,
  onDownload,
  onDeleteDownload,
  isOffline,
  onChannelClick
}: VideoCardProps) {
  const isDownloaded = downloadStatus?.status === 'completed';
  const isDownloading = downloadStatus?.status === 'downloading';
  const downloadProgress = downloadStatus?.progress || 0;

  const renderBadge = () => {
    if (isDownloaded) {
      return (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onDeleteDownload}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--yt-chip)] text-[var(--yt-text)] hover:bg-[var(--yt-chip-hover)] transition-colors"
          title="محمّل — اضغط للحذف"
        >
          <Check className="w-3 h-3" />
          <span>تم التنزيل</span>
        </motion.button>
      );
    }
    if (isDownloading) {
      return (
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--yt-blue)] font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="font-mono">{downloadProgress}%</span>
        </span>
      );
    }
    if (!isOffline) {
      return (
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onDownload}
          className="yt-icon-btn p-1.5 text-[var(--yt-text-2)] hover:text-[var(--yt-text)]"
          title="تنزيل للمشاهدة بلا إنترنت"
        >
          <Download className="w-4 h-4" />
        </motion.button>
      );
    }
    return null;
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
      className="group flex flex-col cursor-pointer"
      onClick={onSelect}
      id={`video-card-${video.id}`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[var(--yt-skeleton)]">
        <img
          src={video.thumbnail || undefined}
          alt={video.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_THUMB; }}
          className="yt-card-thumb w-full h-full object-cover"
        />
        {video.duration && video.duration !== '00:00' && (
          <span className="absolute bottom-1.5 left-1.5 bg-black/80 text-white text-xs font-medium px-1.5 py-0.5 rounded">
            {video.duration}
          </span>
        )}
        {isDownloaded && (
          <span className="absolute top-1.5 right-1.5 bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1">
            <Check className="w-3 h-3" />
            بلا إنترنت
          </span>
        )}
        {isDownloading && (
          <div className="absolute bottom-0 right-0 left-0 h-1 bg-black/40">
            <motion.div
              className="h-full bg-[var(--yt-red)]"
              animate={{ width: `${downloadProgress}%` }}
              transition={{ ease: 'linear', duration: 0.3 }}
            />
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="flex gap-3 pt-3">
        <div
          className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-[var(--yt-chip)] cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onChannelClick?.(video.channelName);
          }}
          title={video.channelName}
        >
          <img
            src={video.channelAvatar || undefined}
            alt={video.channelName}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_AVATAR; }}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium leading-[1.4] text-[var(--yt-text)] line-clamp-2">
            {video.title}
          </h3>
          <div className="mt-1 text-xs text-[var(--yt-text-2)] leading-relaxed">
            <span
              className="hover:text-[var(--yt-text)] transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onChannelClick?.(video.channelName);
              }}
            >
              {video.channelName}
            </span>
            <div className="flex items-center gap-1">
              <span>{video.views || '0'} مشاهدة</span>
              <span>•</span>
              <span>{video.uploadDate}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            className="yt-icon-btn p-1.5 text-[var(--yt-text)] opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="خيارات"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {renderBadge()}
        </div>
      </div>
      {isDownloaded && (
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteDownload(e); }}
          className="mt-1 self-start flex items-center gap-1 text-[11px] text-[var(--yt-text-2)] hover:text-[var(--yt-red)] transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          حذف التنزيل
        </button>
      )}
    </motion.article>
  );
}
