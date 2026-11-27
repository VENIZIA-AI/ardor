import { OrdersPaths } from '@shell-example/orders';
import {
  configuration,
  CoreBindings,
  englishMessages,
  type II18nProviderOptions,
  type IRestDataProviderOptions,
  provide,
  type TAuthProviderOptions,
  vietnameseMessages,
} from '@venizia/ardor';

import { ApiPaths, Locales } from '@/constants/shell';

declare module '@venizia/ardor' {
  interface IUseTranslateKeysOverrides {
    'shell.home': unknown;
    'shell.roles': unknown;
    'shell.language': unknown;
    'shell.signIn': unknown;
    'shell.signOut': unknown;
  }
}

@configuration()
export class ShellConfiguration {
  @provide({ key: CoreBindings.REST_DATA_PROVIDER_OPTIONS })
  restDataProviderOptions(): IRestDataProviderOptions {
    return { url: ApiPaths.BASE, noAuth: { paths: [ApiPaths.SIGN_IN] } };
  }

  @provide({ key: CoreBindings.AUTH_PROVIDER_OPTIONS })
  authProviderOptions(): TAuthProviderOptions {
    return { use: true, paths: { signIn: ApiPaths.SIGN_IN, afterLogin: OrdersPaths.LIST } };
  }

  @provide({ key: CoreBindings.I18N_PROVIDER_OPTIONS })
  i18nProviderOptions(): II18nProviderOptions {
    return {
      i18nSources: {
        [Locales.ENGLISH]: {
          ...englishMessages,
          shell: {
            home: 'Pick a page in the menu.',
            roles: 'Roles',
            language: 'Tiếng Việt',
            signIn: 'Sign in',
            signOut: 'Sign out',
          },
        },
        [Locales.VIETNAMESE]: {
          ...vietnameseMessages,
          shell: {
            home: 'Chọn một trang trong menu.',
            roles: 'Vai trò',
            language: 'English',
            signIn: 'Đăng nhập',
            signOut: 'Đăng xuất',
          },
        },
      },
      languages: [
        { locale: Locales.ENGLISH, name: 'English' },
        { locale: Locales.VIETNAMESE, name: 'Tiếng Việt' },
      ],
    };
  }
}
