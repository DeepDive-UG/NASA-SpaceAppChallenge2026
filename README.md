# CropTips

#ROBOCZE README!!!!

## Wymagania

Python 3.10+ i Node.js 20.9+ z npm.

## Backend — terminal 1

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

API: http://127.0.0.1:8000/api/health/

## Frontend — terminal 2

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Otwórz http://localhost:3000.

## Sprawdzenie

```bash
cd backend
.venv/bin/python manage.py check
```

```bash
cd frontend
npm run build
npm run typecheck
```

## Aplikacja Android/iOS — Expo (terminal 3)

Osobny frontend React Native znajduje się w `mobile/`.

```bash
cd mobile
npm ci
cp .env.example .env
npm start
```

W `mobile/.env` ustaw `EXPO_PUBLIC_API_URL` na adres komputera w sieci lokalnej. Telefon i komputer powinny być w tej samej sieci. Uruchom Django z adresem komputera w dozwolonych hostach, np.:

```bash
cd backend
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.100 .venv/bin/python manage.py runserver 0.0.0.0:8000
```

Podmień `192.168.1.100` na swój adres. W Expo Go zeskanuj kod QR; użyj wersji Expo Go zgodnej z SDK projektu. Emulator Androida korzysta zwykle z adresu hosta `10.0.2.2`. Symulator iOS wymaga macOS. Helper `mobile/api.ts` obsługuje kontrolne żądanie do Django. Zmienne `EXPO_PUBLIC_*` są publiczne — nie wpisuj do nich sekretów. HTTP służy tutaj tylko do lokalnego developmentu.

### Stan weryfikacji szkieletu

Sprawdzono konfigurację i migracje Django, endpoint zdrowia przez proxy Next.js, build Next.js oraz eksport bundli Expo dla Androida/iOS. Nie wykonano uruchomienia na fizycznym urządzeniu ani natywnego buildu sklepowego. Audyt zależności Expo SDK 54 nadal zgłasza podatności (w tym wysokie); przed wdrożeniem potrzebna jest aktualizacja SDK i ponowna kontrola. Override `expo` utrzymuje jedną zgodną wersję SDK w zależnościach.

## Moduł analityczny

Kod predykcji i modele znajdują się w `backend/analytics/`, a trening, opis danych i raporty w `ml/`. Moduł wymaga instalacji `backend/requirements-analytics.txt`. Instrukcje odtwarzania treningu i wczytywania modeli: [ml/README.md](ml/README.md). Surowe dane NASA i LANDFIRE pozostają poza repozytorium.
