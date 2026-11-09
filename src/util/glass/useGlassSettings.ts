import { useEffect, useState } from '../../lib/teact/teact';

import { getGlassAppearance, getGlassProxySettings, subscribeGlass } from './glassSettings';

export function useGlassAppearance() {
  const [appearance, setAppearance] = useState(getGlassAppearance);

  useEffect(() => subscribeGlass(() => setAppearance(getGlassAppearance())), []);

  return appearance;
}

export function useGlassProxySettings() {
  const [settings, setSettings] = useState(getGlassProxySettings);

  useEffect(() => subscribeGlass(() => setSettings(getGlassProxySettings())), []);

  return settings;
}
