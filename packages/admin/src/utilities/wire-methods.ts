import { DefaultNetworkRequestService } from '@venizia/ardor-kernel';
import { ConstClass, HTTP, type THttpMethod } from '@venizia/ignis-helpers/common';

const toWire = (method: THttpMethod) => DefaultNetworkRequestService.toWireMethod({ method });

/** The methods the providers send, in the uppercase an override is handed. */
export class WireMethods extends ConstClass {
  static readonly GET = toWire(HTTP.Methods.GET);
  static readonly POST = toWire(HTTP.Methods.POST);
  static readonly PATCH = toWire(HTTP.Methods.PATCH);
  static readonly DELETE = toWire(HTTP.Methods.DELETE);
}
