// https://vitepress.dev/guide/custom-theme
import { defineComponent, h } from 'vue';
import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';

import pkg from '../../../../../packages/ardor/package.json';
import './shared/fonts.css';
import './shared/tokens.css';
import './product.css';
import './design-tokens.css';
import './style.css';
import './shared/vp-map.css';
import './shared/doc.css';
import './shared/header.css';
import './shared/theme-switch.css';
import EcosystemSwitcher from './shared/EcosystemSwitcher.vue';
import { provideThemeSwitch } from './shared/toggle-appearance';
import HomeLanding from './HomeLanding.vue';

// The default Layout with the version chip, the ecosystem switcher and the smooth theme switch. Step 3
// replaces it with shared/SiteLayout.vue, which adds the footer and the new home page.
const Layout = defineComponent({
  setup() {
    provideThemeSwitch();

    return () =>
      h(DefaultTheme.Layout, null, {
        'nav-bar-title-after': () => h('span', { class: 'site-version' }, pkg.version),
        'nav-bar-content-after': () =>
          h(EcosystemSwitcher, { current: 'ardor', variant: 'popover' }),
        'nav-screen-content-after': () =>
          h(EcosystemSwitcher, { current: 'ardor', variant: 'sheet' }),
      });
  },
});

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('HomeLanding', HomeLanding);
  },
} satisfies Theme;
