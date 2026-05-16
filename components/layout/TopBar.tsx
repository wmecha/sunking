interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <div className="bg-white border-b border-[#E5E7EB] px-4 sm:px-6 py-4 flex items-center justify-between gap-3 pl-14 md:pl-6">
      <div className="min-w-0 flex-1">
        <h1 className="text-lg sm:text-xl font-bold text-[#1C2B3A] truncate">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 sm:gap-3">{actions}</div>}
    </div>
  );
}
