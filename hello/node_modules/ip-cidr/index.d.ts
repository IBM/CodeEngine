import { Address4, Address6 } from "ip-address";
import { BigInteger } from "jsbn";

type Address = Address4 | Address6;

declare class IPCIDR {
  cidr: string;
  address: Address;
  addressStart: Address;
  addressEnd: Address;
  size: BigInteger;

  constructor(cidr: string);

  start<T = IPCIDR.FormatResult>(options?: IPCIDR.FormatOptions): T;

  end<T = IPCIDR.FormatResult>(options?: IPCIDR.FormatOptions): T;

  toRange<T = IPCIDR.FormatResult>(options?: IPCIDR.FormatOptions): [T, T];

  loop<T = IPCIDR.FormatResult, R = any>(fn: (ip: T) => Promise<R>, options: IPCIDR.FormatOptions, results?: IPCIDR.ChunkInfo): Promise<R>[];

  getChunkInfo(length: number, options: IPCIDR.FormatOptions): IPCIDR.ChunkInfo;

  contains(address: IPCIDR.Address | string | BigInteger): boolean;

  toString(): string;

  toArray(options?: IPCIDR.FormatOptions, results?: IPCIDR.ChunkInfo): string[];

  toObject(options?: IPCIDR.FormatOptions): { start: string, end: string };
}

declare namespace IPCIDR {
  type Address = Address4 | Address6;
  type FormatResult = BigInteger | Address | string;

  interface FormatOptions {
    type?: "bigInteger" | "addressObject",
    from?: string | number | BigInteger;
    to?: string | number | BigInteger;
    limit?: number | BigInteger;
  }

  interface ChunkInfo {
    from: BigInteger;
    to: BigInteger;
    limit: BigInteger;
    length: BigInteger;
  }
  
  export function formatIP<T = FormatResult>(address: Address, options?: any): T;
  export function isValidAddress(address: string): boolean;
  export function isValidCIDR(address: string): boolean;
  export function createAddress(address: string): Address;
}

export = IPCIDR;
