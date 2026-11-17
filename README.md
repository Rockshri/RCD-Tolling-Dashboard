# RCD Toll Plaza Monitor

Monitoring and data-entry dashboard for the Road Construction Department (RCD), Bihar. Tracks 92 toll plazas (including bridge toll plazas), lets authorised users enter and edit plaza details, attach PDFs / geolocation images, and download a plaza's full details.

**Stack:** React + TypeScript + Tailwind (client), Node.js + Express + TypeScript (server), PostgreSQL + Drizzle ORM.

## Repository layout

| Path | Contents |
|---|---|
| [`Toll_Dashboard/`](Toll_Dashboard/) | **The application.** Client + server + DB migrations + docs + tests. Start here. |
| [`Toll_Dashboard/README.md`](Toll_Dashboard/README.md) | Setup / run / test instructions |
| [`Toll_Dashboard/docs/`](Toll_Dashboard/docs/) | Threat model, architecture, ADRs, runbook |
| [`Setup.md`](Setup.md) | Original build specification |
| [`Security_UX_Testing.md`](Security_UX_Testing.md) | Security, UX and testing brief |
| [`Request_UI_Changes.md`](Request_UI_Changes.md) | Change Request 01 — dashboard UI updates |
| [`Enhancements.md`](Enhancements.md) | Enhancement brief — Location Finalized, BSRDC/BRPNNL, filter persistence, etc. |
| [`Zone-Division-mapping.md`](Zone-Division-mapping.md) | Zone → Division mapping used to seed the Zone filter |
| `One Toll Plaza Details Dashboard dt 31.10.2026.xlsx` | Source workbook (master data) |
| `toll_plazas_seed_raw.csv` | Raw 92-row export of the workbook used by the importer |

## Quick start

```bash
# 1. Database (PostgreSQL 14+)
createdb toll
cp Toll_Dashboard/server/.env.example Toll_Dashboard/server/.env
# edit DATABASE_URL in .env

# 2. Server
cd Toll_Dashboard/server
npm install
npm run db:migrate
npm run db:seed
npm run db:import
npm run db:create-admin -- admin "ChangeMe!2026" admin
npm run dev            # API on :4000

# 3. Client (separate terminal)
cd Toll_Dashboard/client
npm install
npm run dev            # UI on :5173
```

Then sign in at http://localhost:5173 with the admin credentials (you'll be forced to change the password on first login).

Full setup, test, and deployment instructions are in [`Toll_Dashboard/README.md`](Toll_Dashboard/README.md).
