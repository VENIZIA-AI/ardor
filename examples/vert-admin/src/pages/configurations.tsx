import { useInjectable, useNotifyError, useTranslate } from '@venizia/ardor';
import { type ApplicationError } from '@venizia/ignis-inversion';
import { useEffect, useState } from 'react';
import { useListContext, useLogout } from 'ra-core';

import { IdentityApi, type IWhoAmI } from '@/application';

interface IConfiguration {
  id: number;
  code: string;
  value: unknown;
}

export const ConfigurationList = () => {
  const { data, total, isPending } = useListContext<IConfiguration>();
  const translate = useTranslate();
  const notifyError = useNotifyError();
  const logout = useLogout();
  const identityApi = useInjectable<IdentityApi>({ key: 'services.IdentityApi' });
  const [identity, setIdentity] = useState<IWhoAmI | null>(null);

  useEffect(() => {
    identityApi
      .whoAmI()
      .then(setIdentity)
      .catch((error: unknown) => notifyError(error as ApplicationError));
  }, [identityApi, notifyError]);

  if (isPending) {
    return <p>Loading</p>;
  }

  return (
    <main>
      <h1>
        {translate('vert.configurations')} ({total})
      </h1>
      {identity ? <p>{translate('vert.signedInAs', { userId: identity.userId })}</p> : null}
      <button type="button" onClick={() => logout()}>
        Log out
      </button>
      <table>
        <tbody>
          {(data ?? []).map((row) => (
            <tr key={row.id}>
              <td>{row.code}</td>
              <td>{JSON.stringify(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
};
