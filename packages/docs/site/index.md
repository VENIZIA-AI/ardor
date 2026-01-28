---
layout: home

hero:
  name: "ARDOR UI"
  text: "React UI Kit for Modern Apps"
  tagline: Built with Tailwind CSS v4, Radix UI, and shadcn/ui
  actions:
    - theme: brand
      text: Get Started
      link: /guide/installation
    - theme: alt
      text: View Components
      link: /components/

features:
  - icon: 🎨
    title: Tailwind CSS v4 + OKLCH
    details: Modern CSS with perceptually uniform colors and advanced theming using the latest Tailwind CSS v4.
  - icon: ♿
    title: Accessible by Default
    details: Built on Radix UI primitives with WCAG 2.1 AA compliance and full keyboard navigation support.
  - icon: 📱
    title: Adaptive Components
    details: Unique components that automatically adapt between desktop (Dialog/Popover) and mobile (Drawer) layouts.
  - icon: 🔧
    title: Fully Customizable
    details: Complete control over styling with CSS variables, CVA variants, and Tailwind utilities.
  - icon: ⚡
    title: TypeScript First
    details: Full type safety with React 19, strict TypeScript, and comprehensive type definitions.
  - icon: 🎯
    title: Developer Experience
    details: Path aliases, auto-generated exports, and patterns inspired by shadcn/ui for the best DX.
---

## Quick Example

```tsx
import { Button, Card, CardHeader, CardTitle, CardContent } from '@venizia/ardor-admin'

export default function App() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome to ARDOR</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={() => alert('Hello!')}>
          Click me
        </Button>
      </CardContent>
    </Card>
  )
}
```
