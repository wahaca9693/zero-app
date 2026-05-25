import React from 'react';
import { Download, Check, Trash2, Loader2, Play } from 'lucide-react';
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

  // Render correct badge for downloading
  const renderDownloadButton = () => {
    if (isDownloaded) {
      return (
        <button
          onClick={onDeleteDownload}
          className="p-1 px-2.5 rounded-full text-xs font-semibold bg-green-500/15 border border-green-500/30 text-green-400 flex items-center gap-1 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all duration-200"
          title="محمل بالفعل. انقر للحذف."
        >
          <Check className="w-3.5 h-3.5 text-green-400" />
          <span>محمل</span>
          <Trash2 className="w-3 h-3 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      );
    }

    if (isDownloading) {
      return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#272727] text-xs font-semibold text-blue-400 border border-blue-500/20">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{downloadProgress}%</span>
        </div>
      );
    }

    // Standard download button if we're online and not downloaded yet
    if (!isOffline) {
      return (
        <button
          onClick={onDownload}
          className="p-1.5 rounded-full bg-[#1b1b1b] border border-[#2d2d2d] hover:bg-[#2e2e2e] hover:border-red-500 text-gray-300 hover:text-red-500 active:scale-90 transition-all duration-200"
          title="تحميل لمشاهدته بلا إنترنت"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      );
    }

    return null;
  };

  return (
    <div 
      className="group flex flex-col bg-transparent overflow-hidden transition-all duration-200 cursor-pointer text-right"
      onClick={onSelect}
      id={`video-card-${video.id}`}
    >
      {/* 1. Thumbnail Container */}
      <div className="relative aspect-video w-full overflow-hidden bg-neutral-900 rounded-xl">
        <img
          src={video.thumbnail || undefined}
          alt={video.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&auto=format&fit=crop&q=60'; }}
        />
        
        {/* Play Icon Hover Overlay */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200">
          <div className="p-3 rounded-full bg-black/60 text-white">
            <Play className="w-5 h-5 fill-white text-white" />
          </div>
        </div>
        
        {/* Video Duration */}
        <span className="absolute bottom-2 left-2 bg-black/80 text-[11px] font-bold tracking-tight px-1.5 py-0.5 rounded text-white font-mono">
          {video.duration}
        </span>
        
        {/* Category Badge on top right */}
        <span className="absolute top-2 right-2 bg-black/60 text-[10px] font-bold px-2 py-0.5 rounded text-gray-300">
          {video.category}
        </span>
        
        {/* Offline indicator on top left if already downloaded */}
        {isDownloaded && (
          <span className="absolute top-2 left-2 bg-green-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
            <Check className="w-3 h-3" />
            <span>محمل</span>
          </span>
        )}
      </div>

      {/* 2. Details Section */}
      <div className="mt-3 flex gap-3">
        {/* Channel Avatar */}
        <div 
          className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-neutral-800 cursor-pointer hover:ring-2 hover:ring-red-500/50 transition-all active:scale-95 duration-150"
          onClick={(e) => {
            if (onChannelClick) {
              e.stopPropagation();
              onChannelClick(video.channelName);
            }
          }}
          title={`عرض قناة ${video.channelName}`}
        >
          <img 
            src={video.channelAvatar || undefined} 
            alt={video.channelName} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60'; }}
          />
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          {/* Title */}
          <h3 className="text-sm font-bold leading-snug text-white line-clamp-2 pr-0.5 group-hover:text-gray-300 transition-colors">
            {video.title}
          </h3>

          {/* Channel Name */}
          <div className="text-xs text-gray-400 font-medium hover:text-white transition-colors flex items-center justify-between">
            <span 
              onClick={(e) => {
                if (onChannelClick) {
                  e.stopPropagation();
                  onChannelClick(video.channelName);
                }
              }}
              className="cursor-pointer hover:underline hover:text-white transition-colors"
              title={`عرض قناة ${video.channelName}`}
            >
              {video.channelName}
            </span>
            
            {/* Download/Delete trigger button directly inside the meta row */}
            <div onClick={e => e.stopPropagation()} className="ml-1 z-10 shrink-0">
              {renderDownloadButton()}
            </div>
          </div>

          {/* View Count & Upload Date */}
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <span>{video.views}</span>
            <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
            <span>{video.uploadDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
