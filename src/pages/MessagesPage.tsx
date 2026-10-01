import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase, type Message, type Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BottomNav } from '@/components/BottomNav';
import { LoadingState, EmptyState, ErrorState } from '@/components/States';
import { timeAgo } from '@/lib/format';
import { ArrowLeft, Send, MessageCircle, Search } from 'lucide-react';

interface Conversation {
  otherUser: Profile;
  lastMessage: Message;
  unreadCount: number;
}

export function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    // Get all messages involving the user
    const { data: msgData, error: err } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const allMsgs = (msgData ?? []) as Message[];

    // Group by conversation partner
    const convMap = new Map<string, { lastMessage: Message; unreadCount: number }>();
    for (const msg of allMsgs) {
      const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      const existing = convMap.get(partnerId);
      if (!existing) {
        convMap.set(partnerId, {
          lastMessage: msg,
          unreadCount: msg.receiver_id === user.id && !msg.read ? 1 : 0,
        });
      } else {
        if (msg.receiver_id === user.id && !msg.read) {
          existing.unreadCount++;
        }
      }
    }

    // Fetch profiles for conversation partners
    const partnerIds = Array.from(convMap.keys());
    if (partnerIds.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, created_at, is_private, role, is_blocked')
      .in('id', partnerIds);

    const profileMap = new Map<string, Profile>();
    for (const p of (profileData ?? []) as Profile[]) {
      profileMap.set(p.id, p);
    }

    const convs: Conversation[] = partnerIds
      .map((pid) => {
        const info = convMap.get(pid)!;
        const otherUser = profileMap.get(pid);
        if (!otherUser) return null;
        return { otherUser, lastMessage: info.lastMessage, unreadCount: info.unreadCount };
      })
      .filter((c): c is Conversation => c !== null)
      .sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime());

    setConversations(convs);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Realtime for conversation list
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('messages-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, loadConversations)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadConversations]);

  // Load messages for active conversation
  const loadMessages = useCallback(async (partnerId: string) => {
    if (!user) return;
    setMsgLoading(true);
    setMsgError(null);

    const { data, error: err } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(100);

    if (err) {
      setMsgError(err.message);
      setMsgLoading(false);
      return;
    }

    setMessages((data ?? []) as Message[]);
    setMsgLoading(false);

    // Mark received messages as read
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('sender_id', partnerId)
      .eq('receiver_id', user.id)
      .eq('read', false);
  }, [user]);

  // Realtime for active conversation messages
  useEffect(() => {
    if (!user || !activeConversation) return;

    loadMessages(activeConversation.id);

    const channel = supabase
      .channel(`messages-${activeConversation.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          if (
            (newMsg.sender_id === user.id && newMsg.receiver_id === activeConversation.id) ||
            (newMsg.sender_id === activeConversation.id && newMsg.receiver_id === user.id)
          ) {
            setMessages((prev) => [...prev, newMsg]);
            // Mark as read if we received it
            if (newMsg.receiver_id === user.id && !newMsg.read) {
              supabase
                .from('messages')
                .update({ read: true })
                .eq('id', newMsg.id);
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeConversation, loadMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Search for users to start a new conversation
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, created_at, is_private, role, is_blocked')
        .ilike('username', `%${searchQuery.trim()}%`)
        .neq('id', user?.id ?? '')
        .limit(10);
      setSearchResults((data ?? []) as Profile[]);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, user]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !activeConversation || !draft.trim()) return;
    setSending(true);
    const text = draft.trim();
    setDraft('');

    const { data, error: err } = await supabase
      .from('messages')
      .insert({ sender_id: user.id, receiver_id: activeConversation.id, text })
      .select('*')
      .maybeSingle();

    if (err) {
      setDraft(text);
    } else if (data) {
      setMessages((prev) => [...prev, data as Message]);
    }
    setSending(false);
  }

  // ── Conversation view ──────────────────────────────────
  if (activeConversation) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-6 pb-3 border-b border-white/10 shrink-0">
          <button
            onClick={() => setActiveConversation(null)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00FF88] to-[#0088FF] flex items-center justify-center">
            <span className="text-black font-bold text-sm">
              {activeConversation.username[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <a href={`#/profile/${activeConversation.id}`} className="text-white font-semibold text-sm hover:text-[#00FF88] transition-colors">
              @{activeConversation.username}
            </a>
          </div>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-4">
          {msgLoading && <LoadingState label="Loading messages…" />}
          {msgError && <ErrorState message={msgError} onRetry={() => loadMessages(activeConversation.id)} />}
          {!msgLoading && !msgError && messages.length === 0 && (
            <EmptyState icon={MessageCircle} title="No messages yet" description="Send a message to start the conversation." />
          )}
          {messages.map((m) => {
            const isMine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-snug ${
                    isMine
                      ? 'bg-gradient-to-r from-[#00FF88] to-[#0088FF] text-black rounded-br-sm'
                      : 'bg-white/10 text-white rounded-bl-sm'
                  }`}
                >
                  <p className="break-words">{m.text}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-black/50' : 'text-gray-500'}`}>
                    {timeAgo(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="flex items-center gap-2 px-4 py-3 border-t border-white/10 shrink-0">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Send a message…"
            className="flex-1 bg-white/10 border border-white/10 rounded-full px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00FF88] transition-colors"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="w-10 h-10 rounded-full bg-[#00FF88] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed active:scale-90 transition-transform shrink-0"
          >
            <Send className="w-5 h-5 text-black" strokeWidth={2} />
          </button>
        </form>
      </div>
    );
  }

  // ── Conversation list view ─────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-sm px-4 pt-6 pb-3 border-b border-white/10">
        <h1 className="text-lg font-bold mb-3">Messages</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users to start a chat…"
            className="w-full bg-white/10 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00FF88] transition-colors"
          />
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Search results */}
        {searchQuery.trim() && (
          <div className="mb-4 space-y-1">
            <p className="text-gray-600 text-xs font-medium uppercase tracking-wide mb-2">Search results</p>
            {searching && <LoadingState label="Searching…" />}
            {!searching && searchResults.length === 0 && (
              <p className="text-gray-600 text-sm text-center py-4">No users found.</p>
            )}
            {searchResults.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setActiveConversation(p);
                  setSearchQuery('');
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left"
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#00FF88] to-[#0088FF] flex items-center justify-center shrink-0">
                  <span className="text-black font-bold text-base">{p.username[0]?.toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">@{p.username}</p>
                  <p className="text-gray-500 text-xs">Tap to start chatting</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Conversation list */}
        {!searchQuery.trim() && (
          <>
            {loading && <LoadingState label="Loading conversations…" />}
            {!loading && error && <ErrorState message={error} onRetry={loadConversations} />}
            {!loading && !error && conversations.length === 0 && (
              <EmptyState icon={MessageCircle} title="No messages yet" description="Search for a user above to start a direct conversation." />
            )}
            {!loading && !error && conversations.length > 0 && (
              <div className="space-y-1">
                {conversations.map((c) => (
                  <button
                    key={c.otherUser.id}
                    onClick={() => setActiveConversation(c.otherUser)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#00FF88] to-[#0088FF] flex items-center justify-center shrink-0">
                      <span className="text-black font-bold text-base">{c.otherUser.username[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">@{c.otherUser.username}</p>
                      <p className="text-gray-500 text-xs truncate">{c.lastMessage.text}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-gray-600 text-[10px]">{timeAgo(c.lastMessage.created_at)}</span>
                      {c.unreadCount > 0 && (
                        <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#00FF88] text-black text-[10px] font-bold flex items-center justify-center">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav current="messages" />
    </div>
  );
}
