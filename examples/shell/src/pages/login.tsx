import { useTranslate } from '@venizia/ardor';
import { useLogin, useNotify } from 'ra-core';
import { type FormEvent, useState } from 'react';

export const LoginPage = () => {
  const login = useLogin();
  const notify = useNotify();
  const translate = useTranslate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login({ username, password }).catch(() => notify('ra.auth.sign_in_error', { type: 'error' }));
  };

  return (
    <form onSubmit={submit}>
      <h1>{translate('shell.signIn')}</h1>
      <label>
        {translate('ra.auth.username')}{' '}
        <input
          name="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      <label>
        {translate('ra.auth.password')}{' '}
        <input
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button type="submit">{translate('shell.signIn')}</button>
    </form>
  );
};
