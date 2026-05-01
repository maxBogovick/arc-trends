# RideLab — Ride-Hailing System Design Frontend

A full Uber-like ride-hailing frontend built as a **frontend-first** teaching project. Students implement the backend to match the existing API and WebSocket contracts.

---

## Quick Start

```bash
cd UberLike
npm install
npm run dev
# → http://localhost:5173
```

Build check:
```bash
npm run build
```

---

## Modes

### Mock mode (default — no backend needed)
```
VITE_API_MODE=mock   # .env default
```
- All data served from in-memory fixtures (`src/api/mock/fixtures.ts`).
- 20 simulated drivers moving on the map every 1.5 s.
- Full ride lifecycle simulated: matching → driver assigned → arriving → pickup → in progress → completed.
- Demand heatmap, surge pricing, and presence events all fire automatically.

### Real backend mode
```
VITE_API_MODE=real
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws
```
Switch at runtime with the **Mock / Real** toggle in the top bar (persisted in `localStorage`).

When Real is selected and the backend is unreachable, a banner appears and the app stays functional.

---

## Roles

Use the **Rider / Driver / Admin** tabs in the top bar to switch perspectives.

| Role | View |
|------|------|
| Rider | Booking → Matching → Active ride |
| Driver | Online/offline toggle, incoming request modal, status update buttons |
| Admin | Metrics, rides table, driver grid, live event stream, demand map |

---

## Architecture

```
src/
├── api/
│   ├── client.ts          ← Proxy-based mock/real switcher
│   ├── contracts.ts       ← TypeScript interfaces for all API calls
│   ├── mock/
│   │   ├── fixtures.ts    ← 20 drivers, 15 locations, 10 rides, demand cells
│   │   └── index.ts       ← mockApiClient
│   └── real/
│       └── index.ts       ← realApiClient (plain fetch + request log)
├── realtime/
│   ├── types.ts           ← event type definitions
│   ├── mockAdapter.ts     ← driver movement, ride lifecycle simulation
│   ├── realAdapter.ts     ← real WebSocket client
│   └── index.ts           ← factory: returns mock or real adapter
├── store/
│   ├── apiModeStore.ts    ← mock/real toggle, connection status, event log
│   ├── rideStore.ts       ← booking form, active ride, driver console state
│   └── sessionStore.ts    ← current user role
├── features/
│   ├── rider/             ← BookingView, MatchingView, ActiveRideView, useRide
│   ├── driver/            ← DriverConsole, useDriver
│   ├── admin/             ← AdminDashboard, useAdmin
│   └── maps/              ← CityMap (pure SVG — no external tile API)
└── shared/
    ├── types/index.ts     ← all domain types
    ├── utils/
    │   ├── geo.ts         ← MAP_BOUNDS, latlngToSvg, moveToward, generateRoute
    │   └── time.ts        ← uid, formatCurrency, formatDistanceToNow
    └── ui/                ← Button, Modal, Badge, DebugPanel
```

---

## API Contract

### HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/ride-types` | List available ride types with fares |
| `GET`  | `/api/locations/search?q=` | Search locations by name |
| `GET`  | `/api/rides/estimates` | Get fare estimates for a trip |
| `POST` | `/api/rides` | Request a ride (idempotency key required) |
| `GET`  | `/api/rides/:rideId` | Get ride details |
| `POST` | `/api/rides/:rideId/cancel` | Cancel a ride with reason |
| `GET`  | `/api/rides/:rideId/events` | Get ride event history |
| `GET`  | `/api/drivers` | List drivers with status/location |
| `GET`  | `/api/drivers/:driverId` | Get driver details |
| `PATCH`| `/api/drivers/:driverId/availability` | Update driver availability |
| `POST` | `/api/drivers/:driverId/accept` | Accept an incoming ride request |
| `POST` | `/api/drivers/:driverId/reject` | Reject an incoming ride request |
| `POST` | `/api/rides/:rideId/status` | Update ride status (driver action) |
| `GET`  | `/api/admin/metrics` | Real-time aggregated metrics |
| `GET`  | `/api/admin/rides` | Paginated ride list with filters |
| `GET`  | `/api/admin/drivers` | All drivers with live status |
| `GET`  | `/api/admin/demand` | Current demand cell data |

### Idempotency

Ride creation requires an `Idempotency-Key` header (UUID). The frontend generates a key per booking, sends it, then regenerates after a successful request. This lets students implement safe retry logic server-side.

### WebSocket

Connect to: `ws://localhost:8080/ws`

Channel subscription sent on open:
```jsonc
{ "type": "subscribe", "channel": "rider/<userId>" }
{ "type": "subscribe", "channel": "driver/<driverId>" }
{ "type": "subscribe", "channel": "admin" }
```

#### Events frontend → backend

```jsonc
{ "type": "ride.requested",       "data": { "rideId": "r-1" } }
{ "type": "ride.cancel.requested","data": { "rideId": "r-1", "reason": "changed plans" } }
{ "type": "driver.available",     "data": {} }
{ "type": "driver.offline",       "data": {} }
{ "type": "driver.accept",        "data": { "rideId": "r-1" } }
{ "type": "driver.reject",        "data": { "rideId": "r-1" } }
{ "type": "ride.status.update",   "data": { "rideId": "r-1", "status": "pickup" } }
```

#### Events backend → frontend

```jsonc
{ "type": "nearby.drivers.updated", "data": { "drivers": [ /* Driver[] */ ] } }
{ "type": "demand.updated",         "data": { "cells": [ /* DemandCell[] */ ] } }
{ "type": "pricing.updated",        "data": { "rideTypeId": "economy", "surgeMultiplier": 1.4 } }
{ "type": "ride.matching.started",  "data": { "rideId": "r-1" } }
{ "type": "ride.matched",           "data": { "rideId": "r-1", "driver": { /* Driver */ } } }
{ "type": "ride.status.updated",    "data": { "rideId": "r-1", "status": "driver_arriving" } }
{ "type": "ride.completed",         "data": { "rideId": "r-1", "finalFare": 18.50 } }
{ "type": "ride.cancelled",         "data": { "rideId": "r-1", "reason": "driver cancelled" } }
{ "type": "driver.location.updated","data": { "driverId": "d-1", "location": { "lat": 40.758, "lng": -73.985 } } }
{ "type": "ride.request.incoming",  "data": { /* Ride */ } }
{ "type": "driver.earnings.updated","data": { "driverId": "d-1", "todayTotal": 134.50 } }
{ "type": "admin.metrics.updated",  "data": { /* AdminMetrics */ } }
{ "type": "admin.ride.updated",     "data": { /* Ride */ } }
{ "type": "admin.driver.updated",   "data": { /* Driver */ } }
```

---

## Ride State Machine

```
requested → matching → driver_assigned → driver_arriving → pickup → in_progress → completed
                                                                               ↘ cancelled
```

Any state except `completed` can transition to `cancelled`.

---

## Data Types

```typescript
GeoPoint     { lat, lng }
Location     { id, label, address, point }
Driver       { id, name, avatarColor, rating, vehicle, location, availability, currentRideId? }
Vehicle      { make, model, plate, color, capacity }
RideType     { id, name, description, capacity, baseFare, pricePerKm, pricePerMinute, etaMinutes, icon }
FareEstimate { rideTypeId, currency, minFare, maxFare, distanceKm, durationMinutes, surgeMultiplier, expiresAt }
Ride         { id, riderId, driverId?, status, pickup, destination, rideTypeId, estimate, finalFare?, route, createdAt, updatedAt }
RideEvent    { id, rideId, type, payload, createdAt }
DemandCell   { id, center, intensity, surgeMultiplier }
AdminMetrics { activeRides, availableDrivers, avgWaitMinutes, cancellationRate, completedToday }
```

Full TypeScript definitions: `src/shared/types/index.ts`
Full API interface: `src/api/contracts.ts`

---

## Debug Panel

Click the `⚙` button (bottom-right) to open the debug panel. Four tabs:

| Tab | Contents |
|-----|----------|
| Info | API mode, connection status, current role, active ride ID, idempotency key |
| Requests | HTTP log: method, path, status code, duration |
| Events | WebSocket event stream: direction (in/out), type, payload |
| Sim | Mock controls: latency slider (0–2000 ms), failure rate slider (0–50%) |

---

## Student Tasks (suggested order)

### Sprint 1 — REST API
1. **GET /api/ride-types** — return the list of ride options (Economy, Comfort, XL, …)
2. **GET /api/locations/search** — search locations by query string
3. **GET /api/rides/estimates** — compute fare estimate for pickup → destination pair
4. **POST /api/rides** — create a ride, validate and store the idempotency key
5. **GET /api/rides/:rideId** — return a single ride by ID
6. **POST /api/rides/:rideId/cancel** — cancel a ride and store the reason
7. **Driver availability endpoints** — PATCH availability, POST accept/reject

### Sprint 2 — WebSocket
8. **WebSocket upgrade** — accept WS connections, handle `subscribe` channel messages
9. **Nearby drivers broadcast** — push `nearby.drivers.updated` every 2 s per rider channel
10. **Ride lifecycle broadcast** — simulate matching, driver assignment, status progression
11. **Driver location broadcast** — broadcast `driver.location.updated` from driver position updates
12. **Admin live events** — broadcast `admin.metrics.updated`, `admin.ride.updated` to admin channel

### Sprint 3 — Persistence & Auth
13. **Persistent storage** — replace in-memory storage with PostgreSQL or MongoDB
14. **User authentication** — JWT or session-based auth; replace hardcoded IDs with real users
15. **Authorization** — riders see only their rides; drivers see only their assigned rides

### Sprint 4 — Advanced
16. **Surge pricing engine** — compute surge multiplier from demand/supply ratio per zone
17. **Driver matching algorithm** — assign nearest available driver; handle timeouts
18. **Geospatial queries** — use PostGIS or MongoDB $geoNear for efficient nearby-driver lookup
19. **Route calculation** — integrate a routing engine (OSRM, Valhalla) to return realistic routes
20. **Earnings & analytics** — driver earnings aggregation, admin reporting endpoints

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_MODE` | `mock` | `mock` or `real` |
| `VITE_API_BASE_URL` | `http://localhost:8080` | Backend base URL |
| `VITE_WS_URL` | `ws://localhost:8080/ws` | WebSocket URL |
