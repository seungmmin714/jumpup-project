import { NavLink, Outlet, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/', label: '홈', icon: '🏡' },
  { to: '/journal', label: '일지', icon: '📔' },
  { to: '/catalog', label: '도감', icon: '🌱' },
  { to: '/shop', label: '상점', icon: '🛍️' },
] as const;

export function AppLayout() {
  const { pathname } = useLocation();
  // 급수 가이드는 몰입 화면 — 탭을 숨긴다
  const hideTabs = pathname.startsWith('/water');

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <main className={`flex-1 px-4 pt-3 ${hideTabs ? 'pb-6' : 'pb-24'}`}>
        <Outlet />
      </main>
      {hideTabs ? null : <BottomTabs />}
    </div>
  );
}

function BottomTabs() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-olive-100 bg-cream-50/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="주요 메뉴"
    >
      <ul className="grid grid-cols-4">
        {TABS.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `tap flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition ${
                  isActive ? 'text-olive-700' : 'text-olive-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`text-xl ${isActive ? '' : 'opacity-60 grayscale'}`} aria-hidden>
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
