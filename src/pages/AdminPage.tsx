import { useEffect, useState, useCallback } from 'react';
import { supabase, type Report, type Video, type Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BottomNav } from '@/components/BottomNav';
import { LoadingState, EmptyState, ErrorState } from '@/components/States';
import { timeAgo } from '@/lib/format';
import { Shield, Trash2, CheckCircle, Clock, Flag, ArrowLeft, VideoOff } from 'lucide-react';

interface ReportWithDetails extends Report {
  videos: Pick<Video, 'video_url' | 'caption' | 'user_id'> | null;
  reporter: Pick<Profile, 'username'> | null;
  video_owner: Pick<Profile, 'username'> | null;
}

type AdminTab = 'pending' | 'resolved' | 'videos';

export function AdminPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<AdminTab>('pending');
  const [reports, setReports] = useState<ReportWithDetails[]>([]);
  const [allVideos, setAllVideos] = useState<(Video & { profiles: Pick<Profile, 'username'> | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);

    const statusFilter = tab === 'pending' ? 'pending' : 'resolved';
    const { data, error: err } = await supabase
      .from('reports')
      .select(`
        id, reporter_id, video_id, reason, status, created_at,
        videos:videos!reports_video_id_fkey (video_url, caption, user_id),
        reporter:profiles!reports_reporter_id_fkey (username),
        video_owner:profiles!videos_user_id_fkey (username)
      `)
      .eq('status', statusFilter)
      .order('created_at', { ascending: false })
      .limit(50);

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setReports((data ?? []) as unknown as ReportWithDetails[]);
    setLoading(false);
  }, [tab]);

  const loadAllVideos = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from('videos')
      .select(`
        id, user_id, video_url, caption, created_at,
        profiles:profiles!videos_user_id_fkey (username)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setAllVideos((data ?? []) as unknown as (Video & { profiles: Pick<Profile, 'username'> | null })[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'videos') {
      loadAllVideos();
    } else {
      loadReports();
    }
  }, [tab, loadReports, loadAllVideos]);

  // Realtime for reports
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel('admin-reports')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, () => {
        if (tab !== 'videos') loadReports();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, tab, loadReports]);

  async function resolveReport(reportId: string) {
    setActionLoading(reportId);
    await supabase.from('reports').update({ status: 'resolved' }).eq('id', reportId);
    setActionLoading(null);
    loadReports();
  }

  async function deleteVideo(videoId: string) {
    setActionLoading(videoId);
    const { error: delError } = await supabase.from('videos').delete().eq('id', videoId);
    if (delError) {
      setError(delError.message);
    } else {
      // Also try to remove from storage
      // The video_url contains the path; extract and delete
      if (tab === 'videos') {
        setAllVideos((prev) => prev.filter((v) => v.id !== videoId));
      } else {
        loadReports();
      }
    }
    setActionLoading(null);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#00FF88] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-red-400" strokeWidth={1.5} />
        </div>
        <h2 className="text-white font-bold text-lg mb-1">Admin Access Required</h2>
        <p className="text-gray-500 text-sm">You don't have permission to view this page.</p>
        <a href="#/" className="mt-4 text-[#00FF88] text-sm font-medium">Back to feed</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-sm px-4 pt-6 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5 text-[#00FF88]" />
          <h1 className="text-lg font-bold">Admin Dashboard</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-4">
          <button
            onClick={() => setTab('pending')}
            className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition-colors ${
              tab === 'pending' ? 'text-white border-[#00FF88]' : 'text-gray-500 border-transparent'
            }`}
          >
            <Clock className="w-4 h-4" />
            Pending
          </button>
          <button
            onClick={() => setTab('resolved')}
            className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition-colors ${
              tab === 'resolved' ? 'text-white border-[#00FF88]' : 'text-gray-500 border-transparent'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            Resolved
          </button>
          <button
            onClick={() => setTab('videos')}
            className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition-colors ${
              tab === 'videos' ? 'text-white border-[#00FF88]' : 'text-gray-500 border-transparent'
            }`}
          >
            <VideoOff className="w-4 h-4" />
            All Videos
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        {loading && <LoadingState label="Loading…" />}

        {!loading && error && <ErrorState message={error} onRetry={() => (tab === 'videos' ? loadAllVideos() : loadReports())} />}

        {/* Reports */}
        {!loading && !error && tab !== 'videos' && (
          <>
            {reports.length === 0 ? (
              <EmptyState icon={Flag} title={tab === 'pending' ? 'No pending reports' : 'No resolved reports'} description={tab === 'pending' ? 'All clear — no reports need attention.' : 'Resolved reports will appear here.'} />
            ) : (
              <div className="space-y-3">
                {reports.map((r) => (
                  <div key={r.id} className="bg-white/5 rounded-xl overflow-hidden border border-white/10">
                    {/* Video thumbnail */}
                    {r.videos && (
                      <div className="relative aspect-video bg-black">
                        <video src={r.videos.video_url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <p className="absolute bottom-2 left-3 text-white text-xs line-clamp-1">{r.videos.caption || 'No caption'}</p>
                      </div>
                    )}
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium">
                            Reported by @{r.reporter?.username ?? 'unknown'}
                          </p>
                          <p className="text-gray-500 text-xs mt-0.5">
                            Owner: @{r.video_owner?.username ?? 'unknown'} · {timeAgo(r.created_at)}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          r.status === 'pending' ? 'bg-yellow-500/15 text-yellow-400' : 'bg-[#00FF88]/15 text-[#00FF88]'
                        }`}>
                          {r.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm bg-white/5 rounded-lg px-3 py-2 mb-3">{r.reason}</p>
                      <div className="flex gap-2">
                        {tab === 'pending' && (
                          <>
                            <button
                              onClick={() => resolveReport(r.id)}
                              disabled={actionLoading === r.id}
                              className="flex-1 bg-white/10 hover:bg-white/15 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Resolve
                            </button>
                            {r.videos && (
                              <button
                                onClick={() => deleteVideo(r.video_id)}
                                disabled={actionLoading === r.video_id}
                                className="flex-1 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete Video
                              </button>
                            )}
                          </>
                        )}
                        {tab === 'resolved' && r.videos && (
                          <button
                            onClick={() => deleteVideo(r.video_id)}
                            disabled={actionLoading === r.video_id}
                            className="flex-1 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete Video
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* All Videos */}
        {!loading && !error && tab === 'videos' && (
          <>
            {allVideos.length === 0 ? (
              <EmptyState icon={VideoOff} title="No videos" description="There are no videos in the database." />
            ) : (
              <div className="space-y-2">
                {allVideos.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/10">
                    <video src={v.video_url} className="w-16 h-28 rounded-lg object-cover shrink-0" muted playsInline preload="metadata" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">@{v.profiles?.username ?? 'unknown'}</p>
                      <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{v.caption || 'No caption'}</p>
                      <p className="text-gray-600 text-[10px] mt-1">{timeAgo(v.created_at)}</p>
                    </div>
                    <button
                      onClick={() => deleteVideo(v.id)}
                      disabled={actionLoading === v.id}
                      className="w-9 h-9 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 flex items-center justify-center transition-colors disabled:opacity-50 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav current="settings" />
    </div>
  );
}
