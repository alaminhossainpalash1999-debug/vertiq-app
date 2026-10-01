import { AlertCircle, Loader2, Inbox } from 'lucide-react';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="w-8 h-8 border-2 border-[#00FF88] border-t-transparent rounded-full animate-spin text-[#00FF88]" />
      <p className="text-gray-500 text-sm mt-3">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
}: {
  icon?: typeof Inbox;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-600" strokeWidth={1.5} />
      </div>
      <h3 className="text-white font-semibold text-base mb-1">{title}</h3>
      {description && <p className="text-gray-500 text-sm">{description}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-400" strokeWidth={1.5} />
      </div>
      <h3 className="text-white font-semibold text-base mb-1">Something went wrong</h3>
      <p className="text-gray-500 text-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="bg-white/10 hover:bg-white/15 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
}
