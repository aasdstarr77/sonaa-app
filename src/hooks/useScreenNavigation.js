import { useEffect, useRef, useState } from 'react';

export function useScreenNavigation(onScreenChange) {
  const [screen, setScreenState] = useState('home');
  useEffect(() => { onScreenChange?.(screen); }, [screen, onScreenChange]);
  const screenHistoryRef = useRef([]);
  const screenRef = useRef('home');
  const setScreen = next => {
    const target = typeof next === 'function' ? next(screenRef.current) : next;
    if (target === screenRef.current) return;
    screenHistoryRef.current.push(screenRef.current);
    if (screenHistoryRef.current.length > 40) screenHistoryRef.current.shift();
    screenRef.current = target;
    setScreenState(target);
  };
  return { screen, setScreenState, screenHistoryRef, screenRef, setScreen };
}
