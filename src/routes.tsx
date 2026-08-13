import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import HomePage from './features/home/HomePage';
import WaterPage from './features/water/WaterPage';
import JournalPage from './features/journal/JournalPage';
import CatalogPage from './features/catalog/CatalogPage';
import ShopPage from './features/shop/ShopPage';
import PotEntryPage from './features/home/PotEntryPage';

export function AppRoutes() {
  return (
    <Routes>
      {/* §9.1 QR 진입점 — 탭 레이아웃 밖 (T-14) */}
      <Route path="/p/:potId" element={<PotEntryPage />} />

      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/water" element={<WaterPage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/shop" element={<ShopPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
