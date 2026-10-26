# 5-minute quickstart

The smallest ARDOR application that does something real: one application class, one repository
declared with `@repository`, one resource page, sign-in through the auth provider, and a stub API to run it
against.

```bash
bun install                # from the repository root
cd examples/5-mins-qs
bun run server:dev          # the stub API on :3100 (sign in with admin / admin) and Vite on :5173, proxying /api
```

Open <http://localhost:5173>, sign in, and the product list loads through `DefaultRestDataProvider`
with the total read from `content-range`; the "expensive products" count comes from `ProductRepository`,
resolved with `useRepository`.

| File | What it shows |
| --- | --- |
| `src/application.ts` | The application alone: `artifacts()` returns `AutoArtifacts`, the list of decorated classes the build made |
| `src/datasources/api.datasource.ts`, `src/repositories/product.repository.ts` | An `HttpDataSource` and an `HttpRepository`, one decorated class per file, found by the build and bound at start |
| `src/configurations/admin.configuration.ts` | The three default providers and their options, as `@provide` methods |
| `src/pages/product-list.tsx` | `useListContext` + `useRepository` + `useTranslate` in one component |
| `src/main.tsx` | `ArdorApplication` receiving the container |
| `.configs/builders/vite.config.ts` | `IgnisArtifactsVitePlugin`, the `@` alias, the `/api` proxy and the vendor chunks that keep each chunk under Vite's 500 KB warning |
| `api/server.ts` | The list contract the data provider expects |

---

<p align="center">
  <a href="https://venizia.ai">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://venizia.ai/assets/logo-white.svg">
      <img src="https://venizia.ai/assets/logo.svg" alt="VENIZIA" height="28">
    </picture>
  </a>
  <br>
  <sub>ARDOR is built and maintained by <a href="https://venizia.ai">VENIZIA</a>.</sub>
</p>
