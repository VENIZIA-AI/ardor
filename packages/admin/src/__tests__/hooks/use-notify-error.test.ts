import React from 'react';
import { describe, test, expect } from 'bun:test';
import { act, renderHook } from '@testing-library/react';
import { getError } from '@venizia/ignis-inversion';
import { NotificationContextProvider, useNotificationContext } from 'ra-core';
import { useNotifyError } from '@/hooks/use-notify-error';

type TNotifyError = Parameters<ReturnType<typeof useNotifyError>>[0];

interface IWrapperProps {
  readonly children?: React.ReactNode;
}

const Wrapper = ({ children }: IWrapperProps) => {
  return React.createElement(NotificationContextProvider, null, children);
};

const buildError = () => {
  return getError({
    message: { code: 'auth.invalid', text: 'Invalid authentication', args: { name: 'x' } },
  });
};

const buildStatusError = (opts: { statusCode: number }) => {
  return getError({
    statusCode: opts.statusCode,
    message: { code: 'auth.invalid', text: 'Invalid authentication', args: { name: 'x' } },
  });
};

const setupTest = () => {
  return renderHook(
    () => {
      return {
        notifyError: useNotifyError(),
        notificationContext: useNotificationContext(),
      };
    },
    { wrapper: Wrapper },
  );
};

describe('useNotifyError', () => {
  test('calls notify with normalized code, error type, and message arguments', () => {
    const { result } = setupTest();
    const error: TNotifyError = buildError();

    act(() => {
      result.current.notifyError(error);
    });

    expect(result.current.notificationContext.notifications).toHaveLength(1);
    const [notification] = result.current.notificationContext.notifications;
    expect(notification?.message).toBe('auth.invalid');
    expect(notification?.type).toBe('error');
    expect(notification?.notificationOptions).toEqual({
      messageArgs: { name: 'x' },
    });
  });

  test('allows extra options to override notification type', () => {
    const { result } = setupTest();
    const error: TNotifyError = buildError();

    act(() => {
      result.current.notifyError(error, { type: 'warning' });
    });

    expect(result.current.notificationContext.notifications).toHaveLength(1);
    const [notification] = result.current.notificationContext.notifications;
    expect(notification?.message).toBe('auth.invalid');
    expect(notification?.type).toBe('warning');
    expect(notification?.notificationOptions).toEqual({
      messageArgs: { name: 'x' },
    });
  });

  test('allows extra options to override message arguments and add custom notification options', () => {
    const { result } = setupTest();
    const error: TNotifyError = buildError();

    act(() => {
      result.current.notifyError(error, {
        messageArgs: { name: 'override' },
        autoHideDuration: 5000,
      });
    });

    expect(result.current.notificationContext.notifications).toHaveLength(1);
    const [notification] = result.current.notificationContext.notifications;
    expect(notification?.message).toBe('auth.invalid');
    expect(notification?.type).toBe('error');
    expect(notification?.notificationOptions).toEqual({
      messageArgs: { name: 'override' },
      autoHideDuration: 5000,
    });
  });

  test.each([500, 503, 504, 599])(
    'a %i shows the generic server message, without arguments',
    (statusCode) => {
      const { result } = setupTest();

      act(() => {
        result.current.notifyError(buildStatusError({ statusCode }));
      });

      const [notification] = result.current.notificationContext.notifications;
      expect(notification?.message).toBe('ra.notification.http_error');
      expect(notification?.type).toBe('error');
      expect(notification?.notificationOptions).toEqual({});
    },
  );

  test.each([400, 422, 499])('a %i keeps its code and arguments', (statusCode) => {
    const { result } = setupTest();

    act(() => {
      result.current.notifyError(buildStatusError({ statusCode }));
    });

    const [notification] = result.current.notificationContext.notifications;
    expect(notification?.message).toBe('auth.invalid');
    expect(notification?.notificationOptions).toEqual({ messageArgs: { name: 'x' } });
  });

  test('a response schema mismatch keeps its code', () => {
    const { result } = setupTest();
    const code = 'core.fetch.schema_mismatch';

    act(() => {
      result.current.notifyError(getError({ statusCode: 502, message: { code, text: 'failed' } }));
    });

    const [notification] = result.current.notificationContext.notifications;
    expect(notification?.message).toBe(code);
  });

  test('options override the generic message arguments of a 5xx', () => {
    const { result } = setupTest();

    act(() => {
      result.current.notifyError(buildStatusError({ statusCode: 500 }), {
        messageArgs: { name: 'override' },
      });
    });

    const [notification] = result.current.notificationContext.notifications;
    expect(notification?.notificationOptions).toEqual({ messageArgs: { name: 'override' } });
  });
});
