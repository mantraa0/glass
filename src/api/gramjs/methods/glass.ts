import type { WsRouteConfig } from '../../../lib/gramjs/extensions/wsRoutes';
import {
  getWsRouteStatuses as getStatuses,
  setWsRouteConfig as setConfig,
} from '../../../lib/gramjs/extensions/wsRoutes';

export function setWsRouteConfig({ config }: { config: Partial<WsRouteConfig> }) {
  setConfig(config);
}

export function fetchWsRouteStatuses() {
  return getStatuses();
}
