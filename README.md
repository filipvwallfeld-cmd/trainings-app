# Mein Training

Persönliche, installierbare Trainings-App auf Basis von `Trainingsplan.pdf`.

## Lokal starten

```bash
npm install
npm run dev
```

Danach die angezeigte lokale Adresse im Browser öffnen.

## Produktions-Build

```bash
npm run build
npm run preview
```

## GitHub Pages

Die App verwendet den Basispfad `/trainings-app/` und Hash-Navigation. Der Workflow unter `.github/workflows/deploy-pages.yml` baut und veröffentlicht den Stand des `main`-Branches automatisch auf GitHub Pages.

## Daten

Alle Trainingseinträge liegen ausschließlich in IndexedDB auf dem jeweiligen Gerät. Unter „Einstellungen“ können sie als JSON-Datei exportiert und wieder importiert werden.
