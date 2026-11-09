import { memo } from '../../../lib/teact/teact';

import type { GlassBackdrop, GlassMessageStyle } from '../../../util/glass/glassSettings';

import buildClassName from '../../../util/buildClassName';
import useGlassLang from '../../../util/glass/glassLang';
import {
  GLASS_ACCENTS, GLASS_BACKDROP_PALETTES, resetGlassAppearance, updateGlassAppearance,
} from '../../../util/glass/glassSettings';
import { useGlassAppearance } from '../../../util/glass/useGlassSettings';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLastCallback from '../../../hooks/useLastCallback';

import Island, { IslandTitle } from '../../gili/layout/Island';
import Checkbox from '../../ui/Checkbox';
import ListItem from '../../ui/ListItem';
import RadioGroup from '../../ui/RadioGroup';
import RangeSlider from '../../ui/RangeSlider';

import styles from './SettingsGlass.module.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

const BACKDROPS: { key: GlassBackdrop; titleKey: Parameters<ReturnType<typeof useGlassLang>>[0] }[] = [
  { key: 'aurora', titleKey: 'GlassBackdropAurora' },
  { key: 'sunset', titleKey: 'GlassBackdropSunset' },
  { key: 'ocean', titleKey: 'GlassBackdropOcean' },
  { key: 'forest', titleKey: 'GlassBackdropForest' },
  { key: 'graphite', titleKey: 'GlassBackdropGraphite' },
  { key: 'wallpaper', titleKey: 'GlassBackdropWallpaper' },
  { key: 'image', titleKey: 'GlassBackdropImage' },
];
const MAX_IMAGE_SIDE = 2560;
const IMAGE_QUALITY = 0.86;

const SettingsGlass = ({ isActive, onReset }: OwnProps) => {
  const t = useGlassLang();
  const appearance = useGlassAppearance();
  const {
    isEnabled, blur, opacity, saturation, radius, gap, accent, backdrop, backdropImage, backdropDim,
    hasEdgeHighlight, shouldRefract, messageStyle,
  } = appearance;

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const handlePickImage = useLastCallback(() => {
    openSystemFilesDialog('image/png,image/jpeg,image/webp', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const dataUrl = await downscaleImage(file);
      updateGlassAppearance({ backdrop: 'image', backdropImage: dataUrl });
    }, true);
  });

  const handleSelectBackdrop = useLastCallback((key: GlassBackdrop) => {
    if (key === 'image' && !backdropImage) {
      handlePickImage();
      return;
    }
    updateGlassAppearance({ backdrop: key });
  });

  const handleCustomAccent = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateGlassAppearance({ accent: e.currentTarget.value.toUpperCase() });
  });

  const messageOptions = [
    { label: t('GlassMessagesGlass'), value: 'glass' },
    { label: t('GlassMessagesTinted'), value: 'tinted' },
    { label: t('GlassMessagesSolid'), value: 'solid' },
  ];

  return (
    <div className="settings-content custom-scroll">
      <Island>
        <Checkbox
          label={t('GlassEnabled')}
          subLabel={t('GlassEnabledDesc')}
          checked={isEnabled}
          onCheck={(isChecked) => updateGlassAppearance({ isEnabled: isChecked })}
        />
      </Island>

      <IslandTitle>{t('GlassBackdrop')}</IslandTitle>
      <Island className={buildClassName(!isEnabled && styles.disabled)}>
        <div className={styles.backdrops}>
          {BACKDROPS.map(({ key, titleKey }) => (
            <button
              key={key}
              type="button"
              className={buildClassName(styles.backdrop, backdrop === key && styles.selected)}
              aria-pressed={backdrop === key}
              onClick={() => handleSelectBackdrop(key)}
            >
              <span
                className={styles.preview}
                style={renderPreviewStyle(key, backdropImage)}
              />
              <span className={styles.backdropTitle}>{t(titleKey)}</span>
            </button>
          ))}
        </div>
        {backdrop === 'image' && (
          <ListItem icon="colorize" narrow onClick={handlePickImage}>
            {t('GlassBackdropPick')}
          </ListItem>
        )}
        {backdrop !== 'wallpaper' && (
          <div className={styles.slider}>
            <RangeSlider
              label={t('GlassBackdropDim')}
              min={0}
              max={80}
              value={backdropDim}
              renderValue={formatPercent}
              onChange={(value) => updateGlassAppearance({ backdropDim: value })}
            />
          </div>
        )}
      </Island>

      <IslandTitle>{t('GlassMaterial')}</IslandTitle>
      <Island className={buildClassName(!isEnabled && styles.disabled)}>
        <div className={styles.slider}>
          <RangeSlider
            label={t('GlassBlur')}
            min={0}
            max={60}
            value={blur}
            renderValue={(value) => `${value} px`}
            onChange={(value) => updateGlassAppearance({ blur: value })}
          />
        </div>
        <div className={styles.slider}>
          <RangeSlider
            label={t('GlassOpacity')}
            min={5}
            max={95}
            value={opacity}
            renderValue={formatPercent}
            onChange={(value) => updateGlassAppearance({ opacity: value })}
          />
        </div>
        <div className={styles.slider}>
          <RangeSlider
            label={t('GlassSaturation')}
            min={100}
            max={250}
            value={saturation}
            renderValue={formatPercent}
            onChange={(value) => updateGlassAppearance({ saturation: value })}
          />
        </div>
        <Checkbox
          label={t('GlassEdges')}
          subLabel={t('GlassEdgesDesc')}
          checked={hasEdgeHighlight}
          onCheck={(isChecked) => updateGlassAppearance({ hasEdgeHighlight: isChecked })}
        />
        <Checkbox
          label={t('GlassRefract')}
          subLabel={t('GlassRefractDesc')}
          checked={shouldRefract}
          onCheck={(isChecked) => updateGlassAppearance({ shouldRefract: isChecked })}
        />
      </Island>

      <IslandTitle>{t('GlassShape')}</IslandTitle>
      <Island className={buildClassName(!isEnabled && styles.disabled)}>
        <div className={styles.slider}>
          <RangeSlider
            label={t('GlassRadius')}
            min={0}
            max={40}
            value={radius}
            renderValue={(value) => `${value} px`}
            onChange={(value) => updateGlassAppearance({ radius: value })}
          />
        </div>
        <div className={styles.slider}>
          <RangeSlider
            label={t('GlassGap')}
            min={0}
            max={28}
            value={gap}
            renderValue={(value) => `${value} px`}
            onChange={(value) => updateGlassAppearance({ gap: value })}
          />
        </div>
      </Island>

      <IslandTitle>{t('GlassAccent')}</IslandTitle>
      <Island className={buildClassName(!isEnabled && styles.disabled)}>
        <div className={styles.accents}>
          <button
            type="button"
            className={buildClassName(styles.accent, styles.accentTheme, !accent && styles.selected)}
            aria-label={t('GlassAccentTheme')}
            title={t('GlassAccentTheme')}
            aria-pressed={!accent}
            onClick={() => updateGlassAppearance({ accent: undefined })}
          />
          {GLASS_ACCENTS.map((color) => (
            <button
              key={color}
              type="button"
              className={buildClassName(styles.accent, accent === color && styles.selected)}
              style={`--swatch: ${color}`}
              aria-label={color}
              title={color}
              aria-pressed={accent === color}
              onClick={() => updateGlassAppearance({ accent: color })}
            />
          ))}
          <label
            className={buildClassName(
              styles.accent,
              styles.accentCustom,
              accent && !GLASS_ACCENTS.includes(accent) && styles.selected,
            )}
            title={t('GlassAccentCustom')}
          >
            <input
              type="color"
              className={styles.colorInput}
              value={accent || '#3390EC'}
              aria-label={t('GlassAccentCustom')}
              onChange={handleCustomAccent}
            />
          </label>
        </div>
      </Island>

      <IslandTitle>{t('GlassMessages')}</IslandTitle>
      <Island className={buildClassName(!isEnabled && styles.disabled)}>
        <RadioGroup
          name="glass-messages"
          options={messageOptions}
          selected={messageStyle}
          onChange={(value) => updateGlassAppearance({ messageStyle: value as GlassMessageStyle })}
        />
      </Island>

      <Island>
        <ListItem icon="reload" narrow destructive onClick={resetGlassAppearance}>
          {t('GlassReset')}
        </ListItem>
      </Island>
    </div>
  );
};

function renderPreviewStyle(key: GlassBackdrop, image?: string) {
  if (key === 'image') {
    return image ? `background-image: url("${image}")` : undefined;
  }
  if (key === 'wallpaper') return undefined;

  const [first, second, third] = GLASS_BACKDROP_PALETTES[key];
  return `background: radial-gradient(circle at 20% 25%, ${first} 0, transparent 60%), `
    + `radial-gradient(circle at 85% 40%, ${second} 0, transparent 55%), `
    + `radial-gradient(circle at 50% 100%, ${third} 0, transparent 60%), #10131c`;
}

function formatPercent(value: number) {
  return `${value}%`;
}

async function downscaleImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return canvas.toDataURL('image/jpeg', IMAGE_QUALITY);
}

export default memo(SettingsGlass);
