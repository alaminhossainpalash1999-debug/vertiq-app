import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Upload, Film, Loader2 } from 'lucide-react';

export function UploadPage() {
  const { user } = useAuth();
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.type.startsWith('video/')) {
        setError('Please select a video file.');
        return;
      }
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setError(null);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !file) return;

    setUploading(true);
    setError(null);

    const ext = file.name.split('.').pop() ?? 'mp4';
    const filePath = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(filePath, file, { contentType: file.type });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('videos').getPublicUrl(filePath);
    const videoUrl = urlData.publicUrl;

    const { error: insertError } = await supabase
      .from('videos')
      .insert({ user_id: user.id, video_url: videoUrl, caption: caption.trim() });

    if (insertError) {
      setError(insertError.message);
      setUploading(false);
      return;
    }

    setUploading(false);
    setSuccess(true);
    setTimeout(() => {
      window.location.hash = '#/';
    }, 1500);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00FF88] to-[#0088FF] flex items-center justify-center mb-4">
          <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="black" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 4l9 16 9-16" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Video uploaded!</h2>
        <p className="text-gray-500 text-sm mt-1">Taking you to the feed…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-4">
        <a href="#/" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </a>
        <h1 className="text-lg font-bold">Upload Video</h1>
      </div>

      <form onSubmit={handleUpload} className="px-6 space-y-6 max-w-md mx-auto">
        {/* File picker / preview */}
        <div
          onClick={() => inputRef.current?.click()}
          className="relative aspect-[9/16] max-w-[260px] mx-auto rounded-2xl border-2 border-dashed border-white/15 flex items-center justify-center cursor-pointer hover:border-[#00FF88] transition-colors overflow-hidden bg-white/5"
        >
          {previewUrl ? (
            <video src={previewUrl} className="h-full w-full object-cover" muted loop autoPlay playsInline />
          ) : (
            <div className="flex flex-col items-center gap-3 text-gray-500">
              <Film className="w-10 h-10" />
              <p className="text-sm">Tap to select a video</p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Caption */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Caption</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption…"
            rows={3}
            maxLength={300}
            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00FF88] transition-colors resize-none"
          />
          <p className="text-right text-xs text-gray-600 mt-1">{caption.length}/300</p>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!file || uploading}
          className="w-full bg-gradient-to-r from-[#00FF88] to-[#0088FF] text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Post Video
            </>
          )}
        </button>
      </form>
    </div>
  );
}
