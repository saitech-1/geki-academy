# GEKI Academy UI

A complete React + TypeScript + Tailwind CSS + Three.js frontend scaffold for the GEKI Academy product specification.

## Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- React Router
- Three.js via React Three Fiber + drei
- Recharts
- Lucide React

## Run

```bash
npm install
npm run dev
```

Then open the local Vite URL shown by the terminal.

## Build

```bash
npm run build
npm run preview
```

## Routes

Public: `/`, `/courses`, `/course/:id`, `/seminars`, `/login`, `/signup`, `/onboarding`

Student: `/dashboard`, `/learning`, `/app-courses`, `/app-seminars`, `/lesson/:id`, `/achievements`, `/profile`, `/library`, `/settings`

Admin: `/admin`, `/admin/users`, `/admin/courses`, `/admin/builder`, `/admin/seminars`, `/admin/achievements`, `/admin/analytics`, `/admin/settings`

## Backend integration

The UI currently uses typed mock data in `src/data/mock.ts`. Replace those imports with API services/hooks later; the route and component boundaries are intentionally kept separate so the backend contract can be introduced without rebuilding the UI.

## Design

The provided specification calls for GEKI's black/off-white/red editorial visual identity, premium martial-arts positioning, restrained motion, strong hierarchy, responsive layouts, separate student/admin shells, and a Three.js hero treatment. Those principles are implemented throughout the scaffold. fileciteturn0file0L5-L16
