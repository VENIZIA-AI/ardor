import { describe, expect, test } from 'bun:test';
import { type Socket } from 'socket.io-client';
import { type AnyType } from '@/common';
import { SocketIOClientHelper } from '@/helpers/socket-io-client';

class FakeSocket {
  connected = true;
  private listeners = new Map<string, Set<(...args: AnyType[]) => void>>();

  on(event: string, listener: (...args: AnyType[]) => void) {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return this;
  }

  off(event: string, listener?: (...args: AnyType[]) => void) {
    if (!listener) {
      this.listeners.delete(event);
      return this;
    }
    const set = this.listeners.get(event);
    set?.delete(listener);
    if (set && set.size === 0) {
      this.listeners.delete(event);
    }
    return this;
  }

  hasListeners(event: string): boolean {
    return (this.listeners.get(event)?.size ?? 0) > 0;
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  trigger(event: string, ...args: AnyType[]) {
    for (const fn of this.listeners.get(event) ?? []) {
      fn(...args);
    }
  }
}

class TestSocketIOClientHelper extends SocketIOClientHelper {
  override configure() {}
}

const createHelperWithFakeSocket = () => {
  const fakeSocket = new FakeSocket();
  const helper = new TestSocketIOClientHelper({
    identifier: 'test-socket',
    host: 'http://localhost:3000',
    options: { path: '/ws', extraHeaders: {} },
  });
  helper['client'] = fakeSocket as unknown as Socket;
  return { helper, fakeSocket };
};

describe('SocketIOClientHelper listener wrapper tracking', () => {
  test('unsubscribing one handler removes its wrapper from the socket without dropping sibling handlers', () => {
    const { helper, fakeSocket } = createHelperWithFakeSocket();
    const receivedA: string[] = [];
    const receivedB: string[] = [];

    const handlerA = (_socket: Socket, payload: string) => {
      receivedA.push(payload);
    };
    const handlerB = (_socket: Socket, payload: string) => {
      receivedB.push(payload);
    };

    helper.subscribe({ events: { 'order:updated': handlerA } });
    helper.subscribe({ events: { 'order:updated': handlerB } });

    expect(fakeSocket.listenerCount('order:updated')).toBe(2);

    helper.unsubscribe({ events: ['order:updated'], handler: handlerA });

    expect(fakeSocket.listenerCount('order:updated')).toBe(1);
    fakeSocket.trigger('order:updated', 'ord-1');

    expect(receivedA).toEqual([]);
    expect(receivedB).toEqual(['ord-1']);
  });

  test('subscribing the same handler reference twice does not leak a duplicate wrapper', () => {
    const { helper, fakeSocket } = createHelperWithFakeSocket();
    const received: string[] = [];
    const handler = (_socket: Socket, payload: string) => {
      received.push(payload);
    };

    helper.subscribe({ events: { 'stock:changed': handler } });
    helper.subscribe({ events: { 'stock:changed': handler } });

    expect(fakeSocket.listenerCount('stock:changed')).toBe(1);
    fakeSocket.trigger('stock:changed', 'sku-1');
    expect(received).toEqual(['sku-1']);

    helper.unsubscribe({ events: ['stock:changed'] });
    expect(fakeSocket.listenerCount('stock:changed')).toBe(0);
  });
});
