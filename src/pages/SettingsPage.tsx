import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { BottomNav } from '@/components/BottomNav';
import { ArrowLeft, Lock, Unlock, LogOut, Shield, ChevronRight } from 'lucide-react';

export function SettingsPage() {
  const { user, profile, signOut, refreshProfile, isAdmin } = useAuth();
  const [isPrivate, setIsPrivate] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  useEffect(() => {
    setIsPrivate(profile?.is_private ?? false);
  }, [profile]);

  async function togglePrivacy() {
    if (!user) return;
    setSavingPrivacy(true);
    const newValue = !isPrivate;
    setIsPrivate(newValue);
    await supabase.from('profiles').update({ is_private: newValue }).eq('id', user.id);
    await refreshProfile();
    setSavingPrivacy(false);
  }

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-sm px-4 pt-6 pb-3 border-b border-white/10 flex items-center gap-3">
        <a href="#/me" className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </a>
        <h1 className="text-lg font-bold">Settings</h1>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* Privacy section */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2 px-1">Privacy</h2>
          <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            <button
              onClick={togglePrivacy}
              disabled={savingPrivacy}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isPrivate ? 'bg-[#0088FF]/15' : 'bg-white/5'}`}>
                {isPrivate ? <Lock className="w-4 h-4 text-[#0088FF]" /> : <Unlock className="w-4 h-4 text-gray-400" />}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">Private Account</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isPrivate ? 'Only followers can see your videos' : 'Anyone can see your videos'}
                </p>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${isPrivate ? 'bg-[#00FF88]' : 'bg-white/15'}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Admin section */}
        {isAdmin && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2 px-1">Admin</h2>
            <a
              href="#/admin"
              className="flex items-center gap-3 px-4 py-3.5 bg-white/5 rounded-xl border border-white/10 hover:bg-white/5 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-[#00FF88]/15 flex items-center justify-center">
                <Shield className="w-4 h-4 text-[#00FF88]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Admin Dashboard</p>
                <p className="text-xs text-gray-500 mt-0.5">Review reports and manage videos</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </a>
          </div>
        )}

        {/* Account section */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2 px-1">Account</h2>
          <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                <span className="text-gray-400 text-xs font-medium">@</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{profile?.username}</p>
                <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
              </div>
            </div>
            <div className="border-t border-white/5">
              <button
                onClick={() => signOut()}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors text-red-400"
              >
                <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <LogOut className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">Log Out</span>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-700 pt-4">VERTIQ v1.0</p>
      </div>

      <BottomNav current="me" />
    </div>
  );
}
