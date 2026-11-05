# My Training — prima versione

Frontend React + Vite per il registro personale degli allenamenti.

## Avvio locale

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Pubblicazione GitHub Pages

1. Crea un repository GitHub e carica questi file.
2. In `vite.config.js` imposta `base` al nome del repository (es. `/my-training/`) se pubblichi su `username.github.io/my-training/`.
3. Aggiungi una GitHub Action per installare dipendenze, eseguire `npm run build` e pubblicare `dist/` su Pages.

## Stato

Questa è una demo frontend: i dati di esempio e le nuove registrazioni vivono solo nello stato React e non sono ancora salvati nel cloud. Il file `supabase-schema.sql` descrive la prima struttura dati privata. Prima di usare dati reali vanno configurati Supabase Auth, le policy RLS, il client Supabase e le funzioni server-side per OAuth/import.

## Sicurezza

Non inserire mai chiavi `service_role`, client secret Strava o segreti Garmin nel frontend o nel repository. Le integrazioni OAuth devono passare da funzioni server-side sicure.
