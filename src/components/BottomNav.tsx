import { Home, Users, Inbox, User, Plus } from 'lucide-react';

interface Props {
  current: string;
}

export function BottomNav({ current }: Props) {
  const items = [
    { key: 'feed', href: '#/', icon: Home, label: 'Home' },
    { key: 'friends', href: '#/search', icon: Users, label: 'Friends' },
    { key: 'inbox', href: '#/notifications', icon: Inbox, label: 'Inbox' },
    { key: 'me', href: '#/me', icon: User, label: 'Me' },
  ];

  return (
    <nav className="absolute bottom-0 left-0 right-0 z-40 bg-black border-t border-white/10">
      <div className="flex items-center justify-around h-16 px-2">
        {/* Left two items */}
        {items.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const active = current === item.key;
          return (
            <a
              key={item.key}
              href={item.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 w-14 h-14 transition-colors ${
                active ? 'text-white' : 'text-gray-500'
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </a>
          );
        })}

        {/* Center + button */}
        <a
          href="#/upload"
          className="relative flex items-center justify-center w-12 h-8 active:scale-90 transition-transform"
        >
          <div className="absolute left-0 w-7 h-8 rounded-l-lg bg-[#00FF88]" />
          <div className="absolute right-0 w-7 h-8 rounded-r-lg bg-[#0088FF]" />
          <div className="relative w-9 h-7 rounded-lg bg-black flex items-center justify-center">
            <Plus className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
        </a>

        {/* Right two items */}
        {items.slice(2).map((item) => {
          const Icon = item.icon;
          const active = current === item.key;
          return (
            <a
              key={item.key}
              href={item.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 w-14 h-14 transition-colors ${
                active ? 'text-white' : 'text-gray-500'
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
