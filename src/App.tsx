import { useEffect } from 'react';
import { AppRoutes } from './routes';
import { attachBleBridge } from './store/bleBridge';
import { usePotStore } from './store/potStore';
import { useCharacterStore } from './store/characterStore';
import { DevPanel, useDevMode } from './features/dev/DevPanel';

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
    </>
  );
}
