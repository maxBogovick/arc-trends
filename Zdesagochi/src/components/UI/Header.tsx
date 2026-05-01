import { ApiModeToggle } from './ApiModeToggle';

export function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-2xl flex items-center justify-center text-lg"
          style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)', boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }}
        >
          🫧
        </div>
        <div>
          <h1 className="font-display font-bold text-lumio-text text-base leading-none">Lumio</h1>
          <p className="text-xs text-lumio-muted leading-none mt-0.5">Digital Companion</p>
        </div>
      </div>

      <ApiModeToggle />
    </header>
  );
}
