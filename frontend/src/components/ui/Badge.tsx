interface BadgeProps {
  children: string;
  color?: 'blue' | 'green' | 'gray' | 'purple';
}

const colors = {
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  gray: 'bg-slate-100 text-slate-700',
  purple: 'bg-purple-100 text-purple-800',
};

export function Badge({ children, color = 'gray' }: BadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
}
