import BN from "bn.js"; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types/index.js"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { HexString } from "aptos"; // eslint-disable-line @typescript-eslint/no-unused-vars

export interface IAggregator {
  signerCap: types.SignerCapability;
  authority: HexString;
  name: Uint8Array;
  metadata: Uint8Array;
  createdAt: BN;
  isLocked: boolean;
  _ebuf: Uint8Array;
  features: Array<boolean>;
}

export interface AggregatorJSON {
  signerCap: types.SignerCapabilityJSON;
  authority: string;
  name: Array<number>;
  metadata: Array<number>;
  createdAt: string;
  isLocked: boolean;
  _ebuf: Array<number>;
  features: Array<boolean>;
}

export interface AggregatorMoveStruct {
  signer_cap: types.SignerCapabilityMoveStruct;
  authority: string;
  name: string;
  metadata: string;
  created_at: string;
  is_locked: boolean;
  _ebuf: string;
  features: Array<boolean>;
}

export class Aggregator implements IAggregator {
  readonly signerCap: types.SignerCapability;
  readonly authority: HexString;
  readonly name: Uint8Array;
  readonly metadata: Uint8Array;
  readonly createdAt: BN;
  readonly isLocked: boolean;
  readonly _ebuf: Uint8Array;
  readonly features: Array<boolean>;

  constructor(fields: IAggregator) {
    this.signerCap = fields.signerCap;
    this.authority = fields.authority;
    this.name = fields.name;
    this.metadata = fields.metadata;
    this.createdAt = fields.createdAt;
    this.isLocked = fields.isLocked;
    this._ebuf = fields._ebuf;
    this.features = fields.features;
  }

  toJSON(): AggregatorJSON {
    return {
      signerCap: this.signerCap.toJSON(),
      authority: this.authority.toString(),
      name: [...this.name],
      metadata: [...this.metadata],
      createdAt: this.createdAt.toString(),
      isLocked: this.isLocked,
      _ebuf: [...this._ebuf],
      features: this.features.map((item) => item),
    };
  }

  static fromJSON(obj: AggregatorJSON) {
    return new Aggregator({
      signerCap: types.SignerCapability.fromJSON(obj.signerCap),
      authority: HexString.ensure(obj.authority),
      name: new Uint8Array(obj.name),
      metadata: new Uint8Array(obj.metadata),
      createdAt: new BN(obj.createdAt),
      isLocked: obj.isLocked,
      _ebuf: new Uint8Array(obj._ebuf),
      features: obj.features.map((item) => item),
    });
  }

  toMoveStruct(): AggregatorMoveStruct {
    return {
      signer_cap: this.signerCap.toMoveStruct(),
      authority: this.authority.toString(),
      name: Buffer.from(this.name).toString("hex"),
      metadata: Buffer.from(this.metadata).toString("hex"),
      created_at: this.createdAt.toString(),
      is_locked: this.isLocked,
      _ebuf: Buffer.from(this._ebuf).toString("hex"),
      features: this.features.map((item) => item),
    };
  }

  static fromMoveStruct(obj: AggregatorMoveStruct) {
    return new Aggregator({
      signerCap: types.SignerCapability.fromMoveStruct(obj.signer_cap),
      authority: HexString.ensure(obj.authority),
      name:
        typeof obj.name === "string"
          ? new Uint8Array(Buffer.from(obj.name.slice(2), "hex"))
          : new Uint8Array(obj.name),
      metadata:
        typeof obj.metadata === "string"
          ? new Uint8Array(Buffer.from(obj.metadata.slice(2), "hex"))
          : new Uint8Array(obj.metadata),
      createdAt: new BN(obj.created_at),
      isLocked: obj.is_locked,
      _ebuf:
        typeof obj._ebuf === "string"
          ? new Uint8Array(Buffer.from(obj._ebuf.slice(2), "hex"))
          : new Uint8Array(obj._ebuf),
      features: obj.features.map((item) => item),
    });
  }
}
