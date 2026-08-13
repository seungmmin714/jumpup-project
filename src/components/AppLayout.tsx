import { NavLink, Outlet, useLocation } from 'react-router-dom';

// §9.1 하단 탭 — 홈 · 일지 · 도감 · 상점
const TABS = [
  { to: '/', label: '홈', icon: '🏡' },
  { to: '/journal', label: '일지', icon: '📖' },
  { to: '/catalog', label: '도감', icon: '🌱' },
  { to: '/shop', label: '상점', icon: '🧺' },
] as const;

export function AppLayout() {
  const { pathname } = useLocation();
  // 급수 가이드는 몰입 화면 — 탭을 숨긴다
  const hideTabs = pathname.startsWith('/water');

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <main
        className="flex-1 px-4 pt-4"
        style={{
          paddingBottom: hideTabs
            ? '1.5rem'
            : 'calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 1rem)',
        }}
      >
        <Outlet />
      </main>
      {hideTabs ? null : <BottomTabs />}
    </div>
  );
}

function BottomTabs() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-line bg-bg/95 px-2 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="주요 메뉴"
    >
      <ul className="grid h-tabbar grid-cols-4 items-center gap-1 py-1.5">
        {TABS.map((t) => (
          <li key={t.to} className="h-full">
            <NavLink
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex h-full flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-bold transition ${
                  isActive ? 'bg-primary-soft text-primary' : 'text-ink-sub'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`text-lg leading-none ${isActive ? '' : 'opacity-50 grayscale'}`}
                    aria-hidden
                  >
                    {t.icon}
                  </span>
                  {t.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** 화면 제목 — 시안 공통 헤더 */
export function PageHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {sub ? <p className="page-sub mt-0.5">{sub}</p> : null}
      </div>
      {right}
    </header>
  );
}
