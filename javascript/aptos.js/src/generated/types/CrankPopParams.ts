import BN from "bn.js"; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types/index.js"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { HexString } from "aptos"; // eslint-disable-line @typescript-eslint/no-unused-vars

export interface ICrankPopParams {
  crankAddr: HexString;
}

export interface CrankPopParamsJSON {
  crankAddr: string;
}

export interface CrankPopParamsMoveStruct {
  crank_addr: string;
}

export class CrankPopParams implements ICrankPopParams {
  readonly crankAddr: HexString;

  constructor(fields: ICrankPopParams) {
    this.crankAddr = fields.crankAddr;
  }

  toJSON(): CrankPopParamsJSON {
    return {
      crankAddr: this.crankAddr.toString(),
    };
  }

  static fromJSON(obj: CrankPopParamsJSON) {
    return new CrankPopParams({
      crankAddr: HexString.ensure(obj.crankAddr),
    });
  }

  toMoveStruct(): CrankPopParamsMoveStruct {
    return {
      crank_addr: this.crankAddr.toString(),
    };
  }

  static fromMoveStruct(obj: CrankPopParamsMoveStruct) {
    return new CrankPopParams({
      crankAddr: HexString.ensure(obj.crank_addr),
    });
  }
}
