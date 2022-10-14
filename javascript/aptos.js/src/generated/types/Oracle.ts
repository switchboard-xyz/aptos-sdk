import BN from "bn.js"; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types/index.js"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { HexString } from "aptos"; // eslint-disable-line @typescript-eslint/no-unused-vars

export interface IOracle {
  name: Uint8Array;
  metadata: Uint8Array;
  signerCap: types.SignerCapability;
  features: Array<boolean>;
  createdAt: BN;
  _ebuf: Uint8Array;
}

export interface OracleJSON {
  name: Array<number>;
  metadata: Array<number>;
  signerCap: types.SignerCapabilityJSON;
  features: Array<boolean>;
  createdAt: string;
  _ebuf: Array<number>;
}

export interface OracleMoveStruct {
  name: string;
  metadata: string;
  signer_cap: types.SignerCapabilityMoveStruct;
  features: Array<boolean>;
  created_at: string;
  _ebuf: string;
}

export class Oracle implements IOracle {
  readonly name: Uint8Array;
  readonly metadata: Uint8Array;
  readonly signerCap: types.SignerCapability;
  readonly features: Array<boolean>;
  readonly createdAt: BN;
  readonly _ebuf: Uint8Array;

  constructor(fields: IOracle) {
    this.name = fields.name;
    this.metadata = fields.metadata;
    this.signerCap = fields.signerCap;
    this.features = fields.features;
    this.createdAt = fields.createdAt;
    this._ebuf = fields._ebuf;
  }

  toJSON(): OracleJSON {
    return {
      name: [...this.name],
      metadata: [...this.metadata],
      signerCap: this.signerCap.toJSON(),
      features: this.features.map((item) => item),
      createdAt: this.createdAt.toString(),
      _ebuf: [...this._ebuf],
    };
  }

  static fromJSON(obj: OracleJSON) {
    return new Oracle({
      name: new Uint8Array(obj.name),
      metadata: new Uint8Array(obj.metadata),
      signerCap: types.SignerCapability.fromJSON(obj.signerCap),
      features: obj.features.map((item) => item),
      createdAt: new BN(obj.createdAt),
      _ebuf: new Uint8Array(obj._ebuf),
    });
  }

  toMoveStruct(): OracleMoveStruct {
    return {
      name: Buffer.from(this.name).toString("hex"),
      metadata: Buffer.from(this.metadata).toString("hex"),
      signer_cap: this.signerCap.toMoveStruct(),
      features: this.features.map((item) => item),
      created_at: this.createdAt.toString(),
      _ebuf: Buffer.from(this._ebuf).toString("hex"),
    };
  }

  static fromMoveStruct(obj: OracleMoveStruct) {
    return new Oracle({
      name:
        typeof obj.name === "string"
          ? new Uint8Array(Buffer.from(obj.name.slice(2), "hex"))
          : new Uint8Array(obj.name),
      metadata:
        typeof obj.metadata === "string"
          ? new Uint8Array(Buffer.from(obj.metadata.slice(2), "hex"))
          : new Uint8Array(obj.metadata),
      signerCap: types.SignerCapability.fromMoveStruct(obj.signer_cap),
      features: obj.features.map((item) => item),
      createdAt: new BN(obj.created_at),
      _ebuf:
        typeof obj._ebuf === "string"
          ? new Uint8Array(Buffer.from(obj._ebuf.slice(2), "hex"))
          : new Uint8Array(obj._ebuf),
    });
  }
}
