import { useEffect } from 'react';
import { AppRoutes } from './routes';
import { attachBleBridge } from './store/bleBridge';
import { usePotStore } from './store/potStore';
import { useCharacterStore } from './store/characterStore';
import { DevPanel, useDevMode } from './features/dev/DevPanel';
import { RoomEditorGate } from './features/room/RoomEditorGate';

export default function App() {
  const devMode = useDevMode();
  const selectedPotId = usePotStore((s) => s.selectedPotId);
  const loadCharacter = useCharacterStore((s) => s.load);

  useEffect(() => attachBleBridge(), []);

  useEffect(() => {
    if (selectedPotId) void loadCharacter(selectedPotId);
  }, [selectedPotId, loadCharacter]);

  return (
    <>
      <AppRoutes />
      {devMode ? <DevPanel /> : null}
      {/* 개발 서버 + ?roomEditor=true 일 때만 — 프로덕션 번들에는 포함되지 않는다 */}
      <RoomEditorGate />
    </>
  );
}
