import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// ── Types ──────────────────────────────────────────────────

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  is_private: boolean;
  role: 'user' | 'admin';
  is_blocked: boolean;
}

export interface Video {
  id: string;
  user_id: string;
  video_url: string;
  caption: string;
  created_at: string;
}

export interface Like {
  user_id: string;
  video_id: string;
}

export interface Comment {
  id: string;
  user_id: string;
  video_id: string;
  text: string;
  created_at: string;
}

export interface Follow {
  follower_id: string;
  following_id: string;
}

export interface Bookmark {
  user_id: string;
  video_id: string;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: 'like' | 'follow' | 'comment' | 'bookmark';
  video_id: string | null;
  text: string | null;
  read: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  read: boolean;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  video_id: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved';
  created_at: string;
}

export interface Block {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface VideoWithProfile extends Video {
  profiles: Pick<Profile, 'username' | 'avatar_url'> | null;
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
  saved_by_me?: boolean;
}

export interface NotificationWithActor extends Notification {
  actor: Pick<Profile, 'username' | 'avatar_url'> | null;
}

export interface LiveStream {
  id: string;
  host_id: string;
  title: string;
  status: 'live' | 'ended';
  viewer_count: number;
  created_at: string;
  ended_at: string | null;
}

export interface AudioRoom {
  id: string;
  host_id: string;
  name: string;
  status: 'live' | 'ended';
  speaker_count: number;
  listener_count: number;
  created_at: string;
  ended_at: string | null;
}

export interface StreamSignal {
  id: string;
  stream_id: string;
  sender_id: string;
  receiver_id: string;
  type: 'offer' | 'answer' | 'ice';
  payload: string;
  created_at: string;
}

export interface RoomSignal {
  id: string;
  room_id: string;
  sender_id: string;
  receiver_id: string;
  type: 'offer' | 'answer' | 'ice';
  payload: string;
  created_at: string;
}

export interface LiveStreamWithHost extends LiveStream {
  host: Pick<Profile, 'username' | 'avatar_url'> | null;
}

export interface AudioRoomWithHost extends AudioRoom {
  host: Pick<Profile, 'username' | 'avatar_url'> | null;
}
