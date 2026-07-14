# Release Friday

Mobile-first web app for upcoming German and US hip-hop/rap releases.

## Product goal

Every Thursday, the app presents the hip-hop and rap releases expected for the coming Friday, separated into Germany and USA.

## Planned core features

- Upcoming Friday release overview
- Germany / USA filters
- Albums, EPs and singles
- Artist, title, artwork, release type and source links
- Mobile-first interface optimized for iPhone
- Installable Progressive Web App (PWA)
- Automated weekly data refresh
- Password-protected mobile editor for manual releases and cover uploads

## Technology

- Next.js
- TypeScript
- React
- CSS Modules
- GitHub Actions for scheduled data refreshes
- Supabase Auth, Postgres and Storage for the private release editor

## Admin editor

The protected editor is available at `/admin/`. It supports draft and published releases, cover uploads and streaming links. Setup instructions are in [`docs/admin-setup.md`](docs/admin-setup.md).

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
