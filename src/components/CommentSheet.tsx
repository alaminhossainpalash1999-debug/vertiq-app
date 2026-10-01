import { useEffect, useState, useRef } from 'react';
import { supabase, type Comment, type Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { X, Send } from 'lucide-react';

interface CommentWithProfile extends Comment {
  profiles: Pick<Profile, 'username' | 'avatar_url'> | null;
}

interface Props {
  videoId: string;
  onClose: () => void;
}

export function CommentSheet({ videoId, onClose }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id, user_id, video_id, text, created_at,
          profiles:profiles!comments_user_id_fkey (username, avatar_url)
        `)
        .eq('video_id', videoId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setComments(data as unknown as CommentWithProfile[]);
      }
      setLoading(false);
    }
    load();
  }, [videoId]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !text.trim()) return;
    setSubmitting(true);
    const trimmed = text.trim();
    setText('');

    const { data, error } = await supabase
      .from('comments')
      .insert({ user_id: user.id, video_id: videoId, text: trimmed })
      .select(`
        id, user_id, video_id, text, created_at,
        profiles:profiles!comments_user_id_fkey (username, avatar_url)
      `)
      .maybeSingle();

    if (!error && data) {
      setComments((prev) => [...prev, data as unknown as CommentWithProfile]);
    }
    setSubmitting(false);
  }

  return (
    <div className="absolute inset-0 z-40 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full bg-[#111] rounded-t-3xl max-h-[70%] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
          <h3 className="text-white font-semibold">
            {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {loading && <p className="text-gray-500 text-sm text-center">Loading…</p>}
          {!loading && comments.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8">No comments yet. Be the first!</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00FF88] to-[#0088FF] flex items-center justify-center shrink-0">
                <span className="text-black font-bold text-xs">
                  {(c.profiles?.username ?? '?')[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-gray-400 text-xs font-medium">@{c.profiles?.username ?? 'unknown'}</p>
                <p className="text-white text-sm leading-snug break-words">{c.text}</p>
              </div>
            </div>
          ))}
          <div ref={listEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={submitComment} className="flex items-center gap-2 px-4 py-3 border-t border-white/10">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 bg-white/10 border border-white/10 rounded-full px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00FF88] transition-colors"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className="w-10 h-10 rounded-full bg-[#00FF88] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed active:scale-90 transition-transform"
          >
            <Send className="w-5 h-5 text-black" strokeWidth={2} />
          </button>
        </form>
      </div>
    </div>
  );
}
