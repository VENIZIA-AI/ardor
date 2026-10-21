import { type IDataProvider } from '@venizia/ardor';
import { useQuery } from '@tanstack/react-query';
import { useDataProvider } from 'ra-core';

import { Button } from '#src/components/shadcn/button';
import { Card } from '#src/components/shadcn/card';

// The ARDOR drop. Its own colours: they read on the light and the dark surface alike.
const Logo = () => (
  <svg aria-hidden="true" viewBox="0 0 92 123" className="h-14 w-auto">
    <path d="M46 2C46 2 4 52 4 80a42 42 0 0 0 84 0C88 60 70 36 46 2Z" fill="#0091EA" />
    <path
      d="M30 92c-6-14-2-32 14-38-4 12 4 22 14 24 10 2 16-6 16-14 6 14 2 30-10 38-12 8-28 4-34-10Z"
      fill="#7DF3FF"
    />
  </svg>
);

// What the app shows: the name, and what the backend answers to `GET /api/hello`. The call goes through
// the data provider's `send`, which adds the `/api` prefix and the headers every request of the app has.
export const Home = () => {
  const dataProvider = useDataProvider<IDataProvider>();
  const hello = useQuery({
    queryKey: ['hello'],
    queryFn: () =>
      dataProvider.send<{ message: string }>({ resource: 'hello', params: { method: 'GET' } }),
    retry: false,
  });

  return (
    <div className="relative grid min-h-svh place-items-center overflow-hidden p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-(image:--brand-gradient) opacity-25 blur-3xl [mask-image:radial-gradient(60%_100%_at_50%_0%,black,transparent)] dark:opacity-20"
      />
      <Card className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl px-8 py-12 text-center shadow-[0_12px_32px_-16px_rgb(2_119_189/0.35)]">
        <Logo />
        <h1 className="text-4xl font-semibold tracking-tight">{'{{app}}'}</h1>
        {hello.isPending ? (
          <div className="h-6 w-48 animate-pulse rounded-md bg-muted" />
        ) : hello.isError ? (
          <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <p>The backend is not reachable. Start it from its folder:</p>
            <code className="rounded-md bg-muted px-3 py-1.5 font-mono text-foreground">
              bun run server:dev
            </code>
            <Button variant="outline" onClick={() => hello.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <p className="text-lg text-muted-foreground">{hello.data.data.message}</p>
        )}
      </Card>
    </div>
  );
};
