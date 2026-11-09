import { memo, useState } from '../../lib/teact/teact';

import useGlassLang from '../../util/glass/glassLang';
import { saveGlassApiCredentials } from '../../util/glass/glassSettings';

import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import InputText from '../ui/InputText';

import styles from './GlassApiSetup.module.scss';

const API_HASH_REGEX = /^[0-9a-f]{32}$/i;
const API_ID_REGEX = /^\d{3,12}$/;

const GlassApiSetup = () => {
  const t = useGlassLang();
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [hasError, setHasError] = useState(false);

  const handleSubmit = useLastCallback((e: React.FormEvent) => {
    e.preventDefault();
    const id = apiId.trim();
    const hash = apiHash.trim();
    if (!API_ID_REGEX.test(id) || !API_HASH_REGEX.test(hash)) {
      setHasError(true);
      return;
    }

    saveGlassApiCredentials({ apiId: Number(id), apiHash: hash.toLowerCase() });
    window.location.reload();
  });

  return (
    <div className={styles.root}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>{t('ApiTitle')}</h1>
        <p className={styles.description}>{t('ApiDesc')}</p>
        <InputText
          id="glass-api-id"
          label={t('ApiId')}
          value={apiId}
          inputMode="numeric"
          autoComplete="off"
          error={hasError ? t('ApiError') : undefined}
          onChange={(e) => {
            setApiId(e.currentTarget.value);
            setHasError(false);
          }}
        />
        <InputText
          id="glass-api-hash"
          label={t('ApiHash')}
          value={apiHash}
          autoComplete="off"
          onChange={(e) => {
            setApiHash(e.currentTarget.value);
            setHasError(false);
          }}
        />
        <Button type="submit">{t('ApiSave')}</Button>
      </form>
    </div>
  );
};

export default memo(GlassApiSetup);
