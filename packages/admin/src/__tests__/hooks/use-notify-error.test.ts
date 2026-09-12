import React from 'react';
import { describe, test, expect } from 'bun:test';
import { act, renderHook } from '@testing-library/react';
import { NotificationContextProvider, useNotificationContext } from 'ra-core';
import { useNotifyError } from '@/hooks/use-notify-error';

type TNotifyError = Parameters<ReturnType<typeof useNotifyError>>[0];

interface IWrapperProps {
  readonly children?: React.ReactNode;
}

const Wrapper = ({ children }: IWrapperProps) => {
  return React.createElement(NotificationContextProvider, null, children);
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
    const error: TNotifyError = {
      name: 'ApplicationError',
      message: 'Invalid authentication',
      statusCode: 400,
      normalized: {
        code: 'auth.invalid',
        text: 'Invalid authentication',
        args: { name: 'x' },
      },
    };

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
    const error: TNotifyError = {
      name: 'ApplicationError',
      message: 'Invalid authentication',
      statusCode: 400,
      normalized: {
        code: 'auth.invalid',
        text: 'Invalid authentication',
        args: { name: 'x' },
      },
    };

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
    const error: TNotifyError = {
      name: 'ApplicationError',
      message: 'Invalid authentication',
      statusCode: 400,
      normalized: {
        code: 'auth.invalid',
        text: 'Invalid authentication',
        args: { name: 'x' },
      },
    };

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
});
