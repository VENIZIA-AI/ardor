import { getError } from '@venizia/ignis-inversion';
import { io, type Socket, type SocketOptions } from 'socket.io-client';

import type { AnyType } from '@/common/types';
import { BaseHelper } from './base-helper';

export type TSocketIOEventHandler = (client: Socket, ...props: AnyType[]) => void;

interface ISocketIOConnectionOptions extends SocketOptions {
  path: string;
  extraHeaders: Record<string | symbol | number, AnyType>;
}

export interface ISocketIOClientOptions {
  identifier: string;
  host: string;
  options: ISocketIOConnectionOptions;
}

export class SocketIOClientHelper extends BaseHelper {
  private identifier: string;
  private host: string;
  private options: ISocketIOConnectionOptions;
  private client: Socket;

  // subscribe() registers a wrapper that passes `this.client`, never the caller handler directly:
  // without this map, unsubscribe() cannot unbind one handler or deduplicate repeat subscriptions.
  private wrappedHandlers = new Map<
    string,
    Map<TSocketIOEventHandler, (...props: AnyType[]) => void>
  >();
  constructor(opts: ISocketIOClientOptions) {
    super({ scope: SocketIOClientHelper.name });

    this.identifier = opts.identifier;
    this.host = opts.host;
    this.options = opts.options;

    this.configure();
  }

  configure() {
    if (this.client) {
      this.logger.info(
        '[configure][%s] SocketIO Client already established! Client: %j',
        this.identifier,
        this.client,
      );
      return;
    }

    this.client = io(this.host, this.options);
  }

  getSocketClient(): Socket {
    return this.client;
  }

  subscribe(opts: { events: Record<string, TSocketIOEventHandler>; ignoreDuplicate?: boolean }) {
    const { events: eventHandlers, ignoreDuplicate = false } = opts;

    const eventNames = Object.keys(eventHandlers);
    this.logger.info('[subscribe][%s] Handling events: %j', this.identifier, eventNames);

    for (const eventName of eventNames) {
      const handler = eventHandlers[eventName];
      if (!handler) {
        this.logger.info(
          '[subscribe][%s] Ignore handling event %s because of no handler!',
          this.identifier,
          eventName,
        );
        continue;
      }

      if (ignoreDuplicate && this.client.hasListeners(eventName)) {
        this.logger.info(
          '[subscribe][%s] Ignore handling event %s because of duplicate handler!',
          this.identifier,
          eventName,
        );
        continue;
      }

      let handlersForEvent = this.wrappedHandlers.get(eventName);
      if (!handlersForEvent) {
        handlersForEvent = new Map();
        this.wrappedHandlers.set(eventName, handlersForEvent);
      }

      if (handlersForEvent.has(handler)) {
        continue;
      }

      const wrappedHandler = (...props: AnyType[]) => {
        handler(this.client, ...props);
      };
      handlersForEvent.set(handler, wrappedHandler);
      this.client.on(eventName, wrappedHandler);
    }
  }

  unsubscribe(opts: { events: Array<string>; handler?: TSocketIOEventHandler }) {
    const { events: eventNames, handler } = opts;
    this.logger.info('[unsubscribe][%s] Handling events: %j', this.identifier, eventNames);
    for (const eventName of eventNames) {
      if (!this.client?.hasListeners(eventName)) {
        continue;
      }

      const handlersForEvent = this.wrappedHandlers.get(eventName);
      if (handler) {
        const wrappedHandler = handlersForEvent?.get(handler);
        if (!wrappedHandler) {
          continue;
        }

        this.client.off(eventName, wrappedHandler);
        handlersForEvent?.delete(handler);
        if (handlersForEvent?.size === 0) {
          this.wrappedHandlers.delete(eventName);
        }
        continue;
      }

      this.client.off(eventName);
      this.wrappedHandlers.delete(eventName);
    }
  }

  connect() {
    if (!this.client) {
      this.logger.info('[connect][%s] Invalid client to connect!', this.identifier);
      return;
    }

    this.client.connect();
  }

  disconnect() {
    if (!this.client) {
      this.logger.info('[disconnect][%s] Invalid client to disconnect!', this.identifier);
      return;
    }

    this.client.disconnect();
  }

  emit(opts: { topic: string; message: string; doLog?: boolean }) {
    if (!this.client?.connected) {
      throw getError({
        statusCode: 400,
        message: `[emit] Invalid socket client state to emit!`,
      });
    }

    const { topic, message, doLog = false } = opts;
    this.client.emit(topic, message);

    if (!doLog) {
      return;
    }

    this.logger.info('[emit][%s] Topic: %s | Message: %j', this.identifier, topic, message);
  }
}
