import { useState, type FormEvent } from 'react';
import { useLogin, useNotify } from 'ra-core';

export const LoginPage = () => {
  const login = useLogin();
  const notify = useNotify();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login({ username, password }).catch(() => notify('ra.auth.sign_in_error', { type: 'error' }));
  };

  return (
    <form onSubmit={submit}>
      <h1>Sign in</h1>
      <label>
        Username{' '}
        <input
          name="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      <label>
        Password{' '}
        <input
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button type="submit">Sign in</button>
    </form>
  );
};
