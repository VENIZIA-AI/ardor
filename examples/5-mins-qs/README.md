# 5-minute quickstart

The smallest ARDOR application that does something real: one application class, one service
bound by class, one resource page, sign-in through the auth provider, and a stub API to run it
against.

```bash
bun install                # from the repository root
cd examples/5-mins-qs
bun run api                # the stub API on :3100 - sign in with admin / admin
bun run dev                # Vite on :5173, proxying /api
```

Open <http://localhost:5173>, sign in, and the product list loads through `DefaultRestDataProvider`
with the total read from `content-range`; the "expensive products" count comes from `ProductApi`,
resolved with `useInjectable`.

| File | What it shows |
| --- | --- |
| `src/application.ts` | The application, the three default providers, a `BaseApiService` subclass, the key augmentations |
| `src/pages/product-list.tsx` | `useListContext` + `useInjectable` + `useTranslate` in one component |
| `src/main.tsx` | `ArdorApplication` receiving the container |
| `api/server.ts` | The list contract the data provider expects |
