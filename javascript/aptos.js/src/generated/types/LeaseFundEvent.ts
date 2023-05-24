import * as types from "./"; // eslint-disable-line @typescript-eslint/no-unused-vars

import { HexString } from "aptos"; // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js"; // eslint-disable-line @typescript-eslint/no-unused-vars

export interface ILeaseFundEvent {
  leaseAddress: HexString;
  funder: HexString;
  amount: BN;
  timestamp: BN;
}

export interface LeaseFundEventJSON {
  leaseAddress: string;
  funder: string;
  amount: string;
  timestamp: string;
}

export interface LeaseFundEventMoveStruct {
  lease_address: string;
  funder: string;
  amount: string;
  timestamp: string;
}

export class LeaseFundEvent implements ILeaseFundEvent {
  readonly leaseAddress: HexString;
  readonly funder: HexString;
  readonly amount: BN;
  readonly timestamp: BN;

  constructor(fields: ILeaseFundEvent) {
    this.leaseAddress = fields.leaseAddress;
    this.funder = fields.funder;
    this.amount = fields.amount;
    this.timestamp = fields.timestamp;
  }

  toJSON(): LeaseFundEventJSON {
    return {
      leaseAddress: this.leaseAddress.toString(),
      funder: this.funder.toString(),
      amount: this.amount.toString(),
      timestamp: this.timestamp.toString(),
    };
  }

  static fromJSON(obj: LeaseFundEventJSON) {
    return new LeaseFundEvent({
      leaseAddress: HexString.ensure(obj.leaseAddress),
      funder: HexString.ensure(obj.funder),
      amount: new BN(obj.amount),
      timestamp: new BN(obj.timestamp),
    });
  }

  toMoveStruct(): LeaseFundEventMoveStruct {
    return {
      lease_address: this.leaseAddress.toString(),
      funder: this.funder.toString(),
      amount: this.amount.toString(),
      timestamp: this.timestamp.toString(),
    };
  }

  static fromMoveStruct(obj: LeaseFundEventMoveStruct) {
    return new LeaseFundEvent({
      leaseAddress: HexString.ensure(obj.lease_address),
      funder: HexString.ensure(obj.funder),
      amount: new BN(obj.amount),
      timestamp: new BN(obj.timestamp),
    });
  }
}
