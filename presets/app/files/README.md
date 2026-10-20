# {{app}}

The {{app}} admin of {{project}}, built on ARDOR: Vite, React and react-admin.

`bun run server:dev` serves `http://localhost:{{devPort}}`. `/api` is proxied to the backend app chosen when this app was added (`apiUrl` in `.configs/builders/vite.config.mts`).

The one page, `src/pages/home.tsx`, shows the app name and what the backend answers to `GET /api/hello` (`{ "message": "..." }`; an IGNIS app made from its preset has that route). The call goes through the data provider's `send`, so it has the `/api` prefix and the headers of every request of the app. While it loads the card shows a placeholder; if the backend is down it says so and shows the command that starts it. Replace the page with your own.

The scripts are the same in every ARDOR and IGNIS app: `server:dev`, `compile`, `typecheck`, `lint`, `lint:fix`, `test` and `clean`. `compile` writes `dist/` and `clean` removes it.

The look is Tailwind CSS v4 with shadcn-style components you own: `src/components/shadcn/*`, the tokens in `src/themes/index.css` (ARDOR's palette, light and dark by the system preference) and `src/utilities/tw.utility.ts` (`cn`). `components.json` is the shadcn config (`bunx shadcn add <component>`).
