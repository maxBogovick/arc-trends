# DesignLab — System Design Lab Frontend

A Figma-like collaborative design editor built as a **frontend-first** teaching project. Students implement the backend to match the existing API contract.

---

## Quick Start

```bash
cd DesignLab
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
- All data is served from in-memory fixtures (`src/api/mock/fixtures.ts`).
- WebSocket events are simulated (cursor movement, node updates, presence).
- Perfect for UI development and demos without a running backend.

### Real backend mode
```
VITE_API_MODE=real
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws
```
Switch at runtime with the **Mock / Real** toggle in the top bar (persisted in `localStorage`).

When Real is selected and the backend is unreachable, a banner appears and the app stays functional by surfacing the error clearly.

---

## Architecture

```
src/
├── api/
│   ├── client.ts          ← unified Proxy-based switcher
│   ├── contracts.ts       ← TypeScript interfaces for all API calls
│   ├── mock/              ← in-memory mock implementation
│   │   ├── fixtures.ts    ← 5 files, 30+ nodes, comments, collaborators
│   │   └── index.ts       ← mockApiClient
│   └── real/
│       └── index.ts       ← realApiClient (plain fetch)
├── realtime/
│   ├── types.ts           ← event type definitions
│   ├── mockAdapter.ts     ← simulates cursor/presence/node events
│   ├── realAdapter.ts     ← real WebSocket client
│   └── index.ts           ← factory: returns mock or real adapter
├── store/
│   ├── apiModeStore.ts    ← mock/real toggle, connection status
│   └── editorStore.ts     ← tool, selection, nodes, pan/zoom, drag
├── features/
│   ├── files/             ← Dashboard, FileCard, NewFileModal, useFiles
│   ├── editor/            ← Editor, Canvas, Toolbar, sidebars, useNodes
│   ├── comments/          ← CommentsPanel, CommentBubble, useComments
│   └── collaboration/     ← RemoteCursors, useCollaboration
└── shared/
    ├── types/index.ts     ← all domain types
    └── ui/                ← Button, Modal, Input
```

---

## API Contract

### HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/files` | List all design files |
| `POST` | `/api/files` | Create a new file, optionally from a starter template |
| `GET` | `/api/files/:fileId` | Get file metadata |
| `PATCH` | `/api/files/:fileId` | Update file title |
| `GET` | `/api/files/:fileId/nodes` | Get all nodes in a file |
| `POST` | `/api/files/:fileId/nodes` | Create a node, including visual style fields |
| `PATCH` | `/api/files/:fileId/nodes/:nodeId` | Update node layout, content, and visual style |
| `DELETE` | `/api/files/:fileId/nodes/:nodeId` | Delete a node |
| `GET` | `/api/files/:fileId/comments` | Get all comments |
| `POST` | `/api/files/:fileId/comments` | Create a comment |
| `POST` | `/api/files/:fileId/comments/:commentId/replies` | Add a reply |
| `PATCH` | `/api/files/:fileId/comments/:commentId` | Update (resolve) a comment |

### WebSocket

Connect to: `ws://localhost:8080/ws/files/:fileId`

#### Events frontend → backend
```jsonc
{ "type": "cursor.update",  "data": { "x": 340, "y": 220 } }
{ "type": "node.update",    "data": { "nodeId": "n-1", "changes": { "x": 100 } } }
{ "type": "node.create",    "data": { /* DesignNode fields */ } }
{ "type": "node.delete",    "data": { "nodeId": "n-1" } }
{ "type": "comment.create", "data": { "x": 200, "y": 300, "body": "…" } }
{ "type": "presence.join",  "data": { "name": "Alice", "avatarColor": "#22d3ee" } }
{ "type": "presence.leave", "data": {} }
```

#### Events backend → frontend
```jsonc
{ "type": "presence.updated", "data": { "collaborators": [ /* Collaborator[] */ ] } }
{ "type": "cursor.updated",   "data": { "userId": "u-2", "x": 340, "y": 220 } }
{ "type": "node.created",     "data": { /* DesignNode */ } }
{ "type": "node.updated",     "data": { "nodeId": "n-1", "changes": { "x": 100 } } }
{ "type": "node.deleted",     "data": { "nodeId": "n-1" } }
{ "type": "comment.created",  "data": { /* Comment */ } }
{ "type": "comment.updated",  "data": { "commentId": "c-1", "changes": { "resolved": true } } }
```

---

## Data Types

```typescript
CreateFile   { title, templateId? }
DesignFile   { id, title, owner, updatedAt, thumbnailUrl, collaborators }
DesignNode   { id, fileId, type, parentId, name, x, y, width, height, rotation, opacity, fill, text, radius, stroke, strokeWidth, shadow, fontSize, fontWeight, textAlign }
Comment      { id, fileId, nodeId, x, y, author, body, createdAt, resolved, replies }
CommentReply { id, author, body, createdAt }
Collaborator { id, name, avatarColor, cursor, selectedNodeId, online }
```

Full TypeScript definitions: `src/shared/types/index.ts`  
Full API interface: `src/api/contracts.ts`

Starter templates live in `src/shared/templates.ts` and are intentionally useful for backend work:
- `mobile-onboarding` checks screen flows, comments, and text hierarchy.
- `saas-dashboard` checks dense dashboard layouts and future data binding.
- `landing-page` checks marketing structure, CTAs, and responsive hero content.
- `design-system` checks tokens, component states, and metadata needs.

---

## Student Tasks (suggested order)

### Sprint 1 — REST API
1. **GET /api/files** — return a list of design files from a database
2. **POST /api/files** — create a new file, return it with a generated ID
3. **GET /api/files/:fileId/nodes** — return all nodes for a file
4. **POST /api/files/:fileId/nodes** — create a node
5. **PATCH /api/files/:fileId/nodes/:nodeId** — update node properties
6. **DELETE /api/files/:fileId/nodes/:nodeId** — delete a node
7. **Comments endpoints** — CRUD for comments and replies

### Sprint 2 — WebSocket
8. **WebSocket upgrade** — accept WS connections at `/ws/files/:fileId`
9. **Presence broadcast** — track who is in a file, broadcast `presence.updated`
10. **Cursor broadcast** — receive `cursor.update`, broadcast `cursor.updated` to other clients
11. **Node sync** — receive `node.update`, persist and broadcast `node.updated`
12. **Comment sync** — receive `comment.create`, persist and broadcast `comment.created`

### Sprint 3 — Persistence & Auth
13. **Persistent storage** — replace in-memory storage with a real database (PostgreSQL / MongoDB)
14. **User authentication** — JWT or session-based auth; replace hardcoded `"You"` with real user
15. **Authorization** — only file owners/collaborators can edit

### Sprint 4 — Advanced
16. **Operational transforms / CRDT** — conflict-free concurrent node edits
17. **File thumbnails** — generate and store thumbnail images
18. **Search** — full-text search across file titles and node names

---

## Canvas Keyboard Shortcuts

| Key | Action |
|-----|--------|
| V | Select tool |
| F | Frame tool |
| R | Rectangle tool |
| O | Ellipse tool |
| T | Text tool |
| I | Input tool |
| B | Button tool |
| C | Comment tool |
| H | Hand (pan) tool |
| Escape | Deselect |
| Ctrl/Cmd + scroll | Zoom |
| Scroll | Pan |

Selected layers can be resized with the eight visible handles around the selection box. Creation tools work on the empty canvas and inside existing frames.

Every editor operation goes through the API contract:
- Create layer or form control: `POST /api/files/:fileId/nodes`
- Move, resize, rename, style, or edit content: `PATCH /api/files/:fileId/nodes/:nodeId`
- Delete layer or frame descendants: `DELETE /api/files/:fileId/nodes/:nodeId`
- Create comments: `POST /api/files/:fileId/comments`

When `Real API` mode is selected, the editor shows a live backend activity panel with the exact REST method, path, response code, and request duration.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_MODE` | `mock` | `mock` or `real` |
| `VITE_API_BASE_URL` | `http://localhost:8080` | Backend base URL |
| `VITE_WS_URL` | `ws://localhost:8080/ws` | WebSocket URL |
