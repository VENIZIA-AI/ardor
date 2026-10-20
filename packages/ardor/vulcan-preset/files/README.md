# {{app}}

The {{app}} admin of {{project}}, built on ARDOR: Vite, React and react-admin.

`bun run dev` serves `http://localhost:{{devPort}}`. `/api` is proxied to the backend app chosen when this app was added (`apiUrl` in `vite.config.mts`).

The `products` resource reads `GET /api/products` (a JSON array and a `Content-Range` header) and writes `POST /api/products` and `PATCH /api/products/:id`. Point it at your own resource by renaming `products` in `src/main.tsx`.
