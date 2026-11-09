# Glass

Клиент Telegram для Windows с интерфейсом liquid glass и встроенным обходом блокировок.

Основа — [Telegram Web A](https://github.com/Ajaxy/telegram-tt) (GPL-3.0) в оболочке Tauri.
Запасные маршруты подключения перенесены из [tg-ws-proxy](https://github.com/Flowseal/tg-ws-proxy) от Flowseal (MIT).

## Установка

Установщик собирается автоматически: вкладка **Actions** → последний успешный запуск «Build Windows installer» → артефакт `Glass-windows-x64`. Для версий с тегом `v*` он также появляется в **Releases**.

Установщик не подписан, поэтому при первом запуске Windows SmartScreen предупредит: «Подробнее» → «Выполнить в любом случае».

## api_id и api_hash

Нужны любому клиенту Telegram, бесплатно выдаются на https://my.telegram.org → API development tools.

- Не вшивать: приложение спросит их при первом запуске и сохранит на компьютере.
- Вшить в сборку: добавьте секреты репозитория `TELEGRAM_API_ID` и `TELEGRAM_API_HASH` (Settings → Secrets and variables → Actions). Значения попадут в код приложения, поэтому так стоит делать только для личных сборок.

## Что добавлено к Web A

- `src/styles/glass.scss`, `src/util/glass/` — стекло, фоны, акцент, настройки оформления.
- `src/components/left/settings/SettingsGlass*.tsx` — экраны «Оформление Glass» и «Подключение».
- `src/lib/gramjs/extensions/wsRoutes.ts` — цепочка маршрутов: `zws{N}.web.telegram.org` → `kws{N}.web.telegram.org` → Cloudflare-прокси → Cloudflare Worker.
- `src/components/auth/GlassApiSetup.tsx` — ввод api_id/api_hash при первом запуске.
- `tauri/` — название, иконки, раздача приложения с `http://localhost:47613`, установщик NSIS.

## Сборка локально на Windows

```
npm ci
copy .env.example .env   # BASE_URL=http://localhost:47613/, APP_TITLE=Glass
npm run build:production
npx tauri build --bundles nsis
```
