import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { X, Flag, Loader2 } from 'lucide-react';

interface Props {
  videoId: string;
  onClose: () => void;
}

const REPORT_REASONS = [
  'Spam or misleading',
  'Harassment or bullying',
  'Hate speech',
  'Violence or dangerous content',
  'Nudity or sexual content',
  'Other',
];

export function ReportSheet({ videoId, onClose }: Props) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!user || !reason) return;
    setSubmitting(true);
    const { error } = await supabase
      .from('reports')
      .insert({ reporter_id: user.id, video_id: videoId, reason });
    if (!error) {
      setDone(true);
      setTimeout(onClose, 1500);
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
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-red-400" />
            <h3 className="text-white font-semibold">Report Video</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#00FF88]/15 flex items-center justify-center mb-3">
              <Flag className="w-6 h-6 text-[#00FF88]" />
            </div>
            <p className="text-white font-semibold">Report submitted</p>
            <p className="text-gray-500 text-sm mt-1">Thank you. Our team will review it.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            <p className="text-gray-500 text-sm mb-3">Why are you reporting this video?</p>
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors ${
                  reason === r
                    ? 'bg-[#00FF88]/15 text-[#00FF88] border border-[#00FF88]/30'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-transparent'
                }`}
              >
                {r}
              </button>
            ))}

            <button
              onClick={submit}
              disabled={!reason || submitting}
              className="w-full mt-4 bg-red-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                'Submit Report'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
