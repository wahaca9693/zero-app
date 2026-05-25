export interface Comment {
  id: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  timestamp: string;
  likes: number;
  replies?: Comment[];
}

export interface Video {
  id: string;
  title: string;
  description: string;
  src: string; // The streaming url
  thumbnail: string;
  category: string;
  channelName: string;
  channelAvatar: string;
  views: string;
  uploadDate: string;
  duration: string;
  likes: number;
  subscribers: string;
  isShort?: boolean;
  liked?: boolean;
  subscribed?: boolean;
}

export interface DownloadedItem {
  id: string;
  video: Video;
  downloadedAt: Date;
  blob?: Blob; // The actual downloaded video file
  blobUrl?: string; // Created blob URL when running the app
  fileSize: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;
}

export type ActiveTab = 'home' | 'shorts' | 'subscriptions' | 'library' | 'liked' | 'downloads' | 'history' | 'account';
