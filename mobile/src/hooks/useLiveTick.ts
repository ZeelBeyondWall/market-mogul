import { useIsFocused } from '@react-navigation/native';
import { useGame } from '../store/game';

// Subscribe to live data ticks ONLY while the screen is focused. When a tab is
// blurred the selector returns a constant, so zustand sees no change and the
// off-screen screen stops re-rendering — only the visible screen updates.
export function useLiveTick(): number {
  const focused = useIsFocused();
  return useGame((s) => (focused ? s.dataTick : -1));
}
