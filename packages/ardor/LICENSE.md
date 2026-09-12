# ARDOR Framework License

ARDOR is a TypeScript frontend application framework built on [IGNIS](https://ignis.venizia.ai) and
[React](https://react.dev/).

## MIT License

Copyright (c) 2025 VENIZIA Ltd. Co.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## Packages

This monorepo contains the following packages, all licensed under MIT:

| Package | Description |
|---------|-------------|
| `@venizia/ardor` | Umbrella entry point over the framework packages |
| `@venizia/ardor-kernel` | Isomorphic core - application base, services, network layer, utilities |
| `@venizia/ardor-react` | React bindings - application context, injectable and UI hooks |
| `@venizia/ardor-admin` | react-admin adapter - data, auth and i18n providers |
| `@venizia/ardor-ui-kit` | Design system - Tailwind and Radix components, design tokens |

---

## Third-Party Dependencies

ARDOR uses the following open-source libraries. We are grateful to the authors and contributors of
these projects.

### Core Dependencies

| Library | License | Description |
|---------|---------|-------------|
| [IGNIS](https://github.com/VENIZIA-AI/ignis) | MIT | Inversion of control container and query filter vocabulary |
| [React](https://github.com/facebook/react) | MIT | User interface library |
| [react-admin](https://github.com/marmelab/react-admin) (`ra-core`) | MIT | Admin application framework |
| [reflect-metadata](https://github.com/rbuckton/reflect-metadata) | Apache-2.0 | Metadata reflection API |

### Data and State Dependencies

| Library | License | Description |
|---------|---------|-------------|
| [Redux Toolkit](https://github.com/reduxjs/redux-toolkit) | MIT | State container |
| [React Redux](https://github.com/reduxjs/react-redux) | MIT | React bindings for Redux |
| [TanStack Query](https://github.com/TanStack/query) | MIT | Asynchronous state management |
| [React Router](https://github.com/remix-run/react-router) | MIT | Routing |
| [Axios](https://github.com/axios/axios) | MIT | HTTP client |
| [Socket.IO Client](https://github.com/socketio/socket.io) | MIT | Real-time bidirectional communication |
| [Lodash](https://github.com/lodash/lodash) | MIT | Utility library |
| [node-polyglot](https://github.com/airbnb/polyglot.js) (`ra-i18n-polyglot`) | BSD-2-Clause | Internationalisation |

### UI Kit Dependencies

| Library | License | Description |
|---------|---------|-------------|
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | MIT | Utility-first CSS framework |
| [Radix UI](https://github.com/radix-ui/primitives) | MIT | Unstyled, accessible component primitives |
| [Lucide](https://github.com/lucide-icons/lucide) | ISC | Icon set |
| [Day.js](https://github.com/iamkun/dayjs) | MIT | Date manipulation library |

---

## Acknowledgments

ARDOR is inspired by and built upon the work of many open-source projects:

- **[IGNIS](https://ignis.venizia.ai)** - The backend framework ARDOR is the frontend sibling of
- **[react-admin](https://marmelab.com/react-admin/)** by Marmelab - The admin framework ARDOR adapts
- **[LoopBack 4](https://loopback.io/)** by IBM/StrongLoop - Inspiration for the binding-key and provider patterns
- **[shadcn/ui](https://ui.shadcn.com/)** - Inspiration and source for the UI kit component layer

We thank all the maintainers and contributors of these projects for their excellent work.

---

## Contributing

By contributing to ARDOR, you agree that your contributions will be licensed under the MIT License.
