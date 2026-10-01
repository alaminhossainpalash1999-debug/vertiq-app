import { useState } from 'react';
import { Heart, MessageCircle, Share2, Music2, Bookmark, Flag, MoreHorizontal, Plus } from 'lucide-react';
import type { VideoWithProfile } from '@/lib/supabase';
import { renderCaptionWithHashtags, formatCount } from '@/lib/format';

interface Props {
  video: VideoWithProfile;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onOpenComments: () => void;
  onToggleLike: () => void;
  onToggleBookmark: () => void;
  onOpenProfile: () => void;
  onReport: () => void;
}

export function VideoCard({
  video,
  active,
  muted,
  onToggleMute,
  onOpenComments,
  onToggleLike,
  onToggleBookmark,
  onOpenProfile,
  onReport,
}: Props) {
  const [shareFlash, setShareFlash] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}${window.location.pathname}#/v/${video.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setShareFlash(true);
    setTimeout(() => setShareFlash(false), 1500);
  }

  return (
    <div className="relative h-full w-full flex items-center justify-center bg-black">
      <video
        src={video.video_url}
        className="h-full w-full object-cover"
        loop
        playsInline
        autoPlay={active}
        muted={muted}
        onClick={onToggleMute}
      />

      {muted && active && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70 pointer-events-none" />

      {menuOpen && (
        <>
          <div className="absolute inset-0 z-20" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-3 bottom-56 z-30 bg-[#1a1a1a] rounded-xl border border-white/10 overflow-hidden shadow-xl">
            <button
              onClick={() => {
                setMenuOpen(false);
                onReport();
              }}
              className="flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-white/5 transition-colors w-full whitespace-nowrap"
            >
              <Flag className="w-4 h-4" />
              Report Video
            </button>
          </div>
        </>
      )}

      {/* Right action rail — TikTok style */}
      <div className="absolute right-2 bottom-24 flex flex-col items-center gap-4 z-20">
        {/* Profile avatar with + follow button */}
        <button
          onClick={onOpenProfile}
          className="relative flex flex-col items-center active:scale-90 transition-transform"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00FF88] to-[#0088FF] flex items-center justify-center border-2 border-white">
            <span className="text-black font-bold text-lg">
              {(video.profiles?.username ?? '?')[0]?.toUpperCase()}
            </span>
          </div>
          <div className="absolute -bottom-2 w-5 h-5 rounded-full bg-[#FF2D55] flex items-center justify-center border-2 border-black">
            <Plus className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        </button>

        {/* Like */}
        <button
          onClick={onToggleLike}
          className="flex flex-col items-center gap-0.5 active:scale-90 transition-transform"
        >
          <Heart
            className={`w-9 h-9 transition-all drop-shadow-lg ${video.liked_by_me ? 'fill-[#FF2D55] text-[#FF2D55]' : 'text-white'}`}
            strokeWidth={2}
          />
          <span className="text-xs font-semibold text-white drop-shadow-lg">
            {formatCount(video.like_count ?? 0)}
          </span>
        </button>

        {/* Comments */}
        <button
          onClick={onOpenComments}
          className="flex flex-col items-center gap-0.5 active:scale-90 transition-transform"
        >
          <MessageCircle className="w-9 h-9 text-white drop-shadow-lg" strokeWidth={2} />
          <span className="text-xs font-semibold text-white drop-shadow-lg">
            {formatCount(video.comment_count ?? 0)}
          </span>
        </button>

        {/* Bookmark/Save */}
        <button
          onClick={onToggleBookmark}
          className="flex flex-col items-center gap-0.5 active:scale-90 transition-transform"
        >
          <Bookmark
            className={`w-9 h-9 transition-all drop-shadow-lg ${video.saved_by_me ? 'fill-[#0088FF] text-[#0088FF]' : 'text-white'}`}
            strokeWidth={2}
          />
          <span className="text-xs font-semibold text-white drop-shadow-lg">Save</span>
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          className="flex flex-col items-center gap-0.5 active:scale-90 transition-transform"
        >
          <Share2 className="w-9 h-9 text-white drop-shadow-lg" strokeWidth={2} />
          <span className="text-xs font-semibold text-white drop-shadow-lg">Share</span>
        </button>

        {/* More */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex flex-col items-center gap-0.5 active:scale-90 transition-transform"
        >
          <MoreHorizontal className="w-9 h-9 text-white drop-shadow-lg" strokeWidth={2} />
        </button>
      </div>

      {shareFlash && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
          <div className="bg-black/80 text-white px-5 py-2.5 rounded-xl text-sm font-medium">Link copied to clipboard</div>
        </div>
      )}

      {/* Bottom-left info — username, caption, Vertiq logo */}
      <div className="absolute left-0 right-16 bottom-24 px-4 z-20">
        {/* Vertiq logo */}
        <div className="flex items-center gap-1.5 mb-2">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="url(#vertiqGradient)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <linearGradient id="vertiqGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00FF88" />
                <stop offset="100%" stopColor="#0088FF" />
              </linearGradient>
            </defs>
            <path d="M3 4l9 16 9-16" />
          </svg>
          <span className="text-white font-bold text-sm tracking-tight">Vertiq</span>
        </div>

        <button onClick={onOpenProfile} className="block mb-1 active:scale-95 transition-transform">
          <span className="text-white font-bold text-base drop-shadow-lg">
            @{video.profiles?.username ?? 'unknown'}
          </span>
        </button>
        {video.caption && (
          <p className="text-white text-sm leading-snug mb-2 line-clamp-3 drop-shadow-lg">
            {renderCaptionWithHashtags(video.caption)}
          </p>
        )}
        <div className="flex items-center gap-1.5 text-white/80 text-xs">
          <Music2 className="w-3 h-3" />
          <span>Original audio - Vertiq</span>
        </div>
      </div>
    </div>
  );
}
