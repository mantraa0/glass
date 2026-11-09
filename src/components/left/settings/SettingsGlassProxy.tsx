import type { WsRouteStatus } from '../../../lib/gramjs/extensions/wsRoutes';
import { memo, useState } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';
import useGlassLang from '../../../util/glass/glassLang';
import { buildWsRouteConfig, updateGlassProxySettings } from '../../../util/glass/glassSettings';
import { useGlassProxySettings } from '../../../util/glass/useGlassSettings';
import { callApi } from '../../../api/gramjs';

import useInterval from '../../../hooks/schedulers/useInterval';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLastCallback from '../../../hooks/useLastCallback';

import Island, { IslandDescription, IslandTitle } from '../../gili/layout/Island';
import Button from '../../ui/Button';
import Checkbox from '../../ui/Checkbox';
import RangeSlider from '../../ui/RangeSlider';

import styles from './SettingsGlass.module.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

const STATUS_POLL_INTERVAL = 3000;
const MS_IN_SECOND = 1000;
const ROUTE_LABELS = {
  zws: 'zws',
  kws: 'kws',
  cf: 'CF',
  worker: 'Worker',
} as const;

const SettingsGlassProxy = ({ isActive, onReset }: OwnProps) => {
  const t = useGlassLang();
  const settings = useGlassProxySettings();
  const [cfText, setCfText] = useState(settings.cfUserDomains.join('\n'));
  const [workerText, setWorkerText] = useState(settings.workerDomains.join('\n'));
  const [statuses, setStatuses] = useState<WsRouteStatus[]>([]);
  const [isApplied, setIsApplied] = useState(false);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const refreshStatuses = useLastCallback(async () => {
    const result = await callApi('fetchWsRouteStatuses');
    if (result) setStatuses([...result].sort((a, b) => a.dcId - b.dcId || Number(a.isMedia) - Number(b.isMedia)));
  });

  useInterval(refreshStatuses, isActive ? STATUS_POLL_INTERVAL : undefined);

  const applySettings = useLastCallback((patch: Parameters<typeof updateGlassProxySettings>[0]) => {
    updateGlassProxySettings(patch);
    void callApi('setWsRouteConfig', { config: buildWsRouteConfig() });
    setIsApplied(true);
  });

  const handleSaveDomains = useLastCallback(() => {
    applySettings({
      cfUserDomains: parseDomains(cfText),
      workerDomains: parseDomains(workerText),
    });
  });

  const { isEnabled, shouldTryKws, shouldUseCfProxy, shouldUseDefaultCfDomains, attemptTimeout } = settings;

  return (
    <div className="settings-content custom-scroll">
      <Island>
        <Checkbox
          label={t('ProxyEnabled')}
          subLabel={isEnabled ? t('ProxyEnabledOn') : t('ProxyEnabledOff')}
          checked={isEnabled}
          onCheck={(isChecked) => applySettings({ isEnabled: isChecked })}
        />
      </Island>

      <IslandTitle>{t('ProxyStatus')}</IslandTitle>
      <Island>
        {statuses.length ? (
          <div className={styles.dcs}>
            {statuses.map((status) => (
              <div key={`${status.dcId}-${status.isMedia}`} className={styles.dc}>
                <span className={styles.dcTitle}>
                  <span>
                    DC
                    {status.dcId}
                    {status.isMedia ? ` · ${t('ProxyStatusMedia')}` : ''}
                  </span>
                  <span className={styles.dcRoute}>{ROUTE_LABELS[status.kind]}</span>
                </span>
                <span className={styles.dcMeta}>{`${status.latency} ${t('Ms')}`}</span>
                <span className={styles.dcMeta} title={status.host}>{status.host}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.note}>{t('ProxyStatusEmpty')}</div>
        )}
      </Island>

      <IslandTitle>{t('ProxyRoutes')}</IslandTitle>
      <Island className={buildClassName(!isEnabled && styles.disabled)}>
        <Checkbox label={t('ProxyRouteZws')} subLabel={t('ProxyRouteZwsDesc')} checked disabled />
        <Checkbox
          label={t('ProxyRouteKws')}
          subLabel={t('ProxyRouteKwsDesc')}
          checked={shouldTryKws}
          onCheck={(isChecked) => applySettings({ shouldTryKws: isChecked })}
        />
        <Checkbox
          label={t('ProxyRouteCf')}
          subLabel={t('ProxyRouteCfDesc')}
          checked={shouldUseCfProxy}
          onCheck={(isChecked) => applySettings({ shouldUseCfProxy: isChecked })}
        />
        <Checkbox
          label={t('ProxyRouteCfDefault')}
          subLabel={t('ProxyRouteCfDefaultDesc')}
          checked={shouldUseDefaultCfDomains}
          disabled={!shouldUseCfProxy}
          onCheck={(isChecked) => applySettings({ shouldUseDefaultCfDomains: isChecked })}
        />
        <div className={styles.slider}>
          <RangeSlider
            label={t('ProxyTimeout')}
            min={2}
            max={15}
            value={Math.round(attemptTimeout / MS_IN_SECOND)}
            renderValue={(value) => `${value} ${t('Seconds')}`}
            onChange={(value) => applySettings({ attemptTimeout: value * MS_IN_SECOND })}
          />
        </div>
      </Island>
      <IslandDescription>{t('ProxyRoutesDesc')}</IslandDescription>

      <Island className={buildClassName(!isEnabled && styles.disabled)}>
        <label className={styles.fieldLabel} htmlFor="glass-cf-domains">{t('ProxyCfDomains')}</label>
        <span className={styles.fieldHint}>{t('ProxyCfDomainsHint')}</span>
        <textarea
          id="glass-cf-domains"
          className={styles.textarea}
          value={cfText}
          placeholder="proxy.example.com"
          spellCheck={false}
          onInput={(e) => setCfText(e.currentTarget.value)}
        />
        <label className={styles.fieldLabel} htmlFor="glass-worker-domains">{t('ProxyWorkerDomains')}</label>
        <span className={styles.fieldHint}>{t('ProxyWorkerDomainsHint')}</span>
        <textarea
          id="glass-worker-domains"
          className={styles.textarea}
          value={workerText}
          placeholder="name.account.workers.dev"
          spellCheck={false}
          onInput={(e) => setWorkerText(e.currentTarget.value)}
        />
        <div className={styles.actions}>
          <Button size="smaller" fluid={false} onClick={handleSaveDomains}>{t('ProxyApply')}</Button>
        </div>
      </Island>
      {isApplied && <IslandDescription>{t('ProxyApplied')}</IslandDescription>}
      <IslandDescription>{t('ProxyCredits')}</IslandDescription>
    </div>
  );
};

function parseDomains(text: string) {
  return text.split(/[\s,]+/)
    .map((line) => line.trim().toLowerCase().replace(/^(wss?|https?):\/\//, '').replace(/\/.*$/, ''))
    .filter(Boolean);
}

export default memo(SettingsGlassProxy);
