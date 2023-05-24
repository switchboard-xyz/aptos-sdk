import * as types from "./"; // eslint-disable-line @typescript-eslint/no-unused-vars

import { HexString } from "aptos"; // eslint-disable-line @typescript-eslint/no-unused-vars
import BN from "bn.js"; // eslint-disable-line @typescript-eslint/no-unused-vars

export interface IOracleMetrics {
  consecutiveSuccess: BN;
  consecutiveError: BN;
  consecutiveDisagreement: BN;
  consecutiveLateResponse: BN;
  consecutiveFailure: BN;
  totalSuccess: BN;
  totalError: BN;
  totalDisagreement: BN;
  totalLateResponse: BN;
}

export interface OracleMetricsJSON {
  consecutiveSuccess: string;
  consecutiveError: string;
  consecutiveDisagreement: string;
  consecutiveLateResponse: string;
  consecutiveFailure: string;
  totalSuccess: string;
  totalError: string;
  totalDisagreement: string;
  totalLateResponse: string;
}

export interface OracleMetricsMoveStruct {
  consecutive_success: string;
  consecutive_error: string;
  consecutive_disagreement: string;
  consecutive_late_response: string;
  consecutive_failure: string;
  total_success: string;
  total_error: string;
  total_disagreement: string;
  total_late_response: string;
}

export class OracleMetrics implements IOracleMetrics {
  readonly consecutiveSuccess: BN;
  readonly consecutiveError: BN;
  readonly consecutiveDisagreement: BN;
  readonly consecutiveLateResponse: BN;
  readonly consecutiveFailure: BN;
  readonly totalSuccess: BN;
  readonly totalError: BN;
  readonly totalDisagreement: BN;
  readonly totalLateResponse: BN;

  constructor(fields: IOracleMetrics) {
    this.consecutiveSuccess = fields.consecutiveSuccess;
    this.consecutiveError = fields.consecutiveError;
    this.consecutiveDisagreement = fields.consecutiveDisagreement;
    this.consecutiveLateResponse = fields.consecutiveLateResponse;
    this.consecutiveFailure = fields.consecutiveFailure;
    this.totalSuccess = fields.totalSuccess;
    this.totalError = fields.totalError;
    this.totalDisagreement = fields.totalDisagreement;
    this.totalLateResponse = fields.totalLateResponse;
  }

  toJSON(): OracleMetricsJSON {
    return {
      consecutiveSuccess: this.consecutiveSuccess.toString(),
      consecutiveError: this.consecutiveError.toString(),
      consecutiveDisagreement: this.consecutiveDisagreement.toString(),
      consecutiveLateResponse: this.consecutiveLateResponse.toString(),
      consecutiveFailure: this.consecutiveFailure.toString(),
      totalSuccess: this.totalSuccess.toString(),
      totalError: this.totalError.toString(),
      totalDisagreement: this.totalDisagreement.toString(),
      totalLateResponse: this.totalLateResponse.toString(),
    };
  }

  static fromJSON(obj: OracleMetricsJSON) {
    return new OracleMetrics({
      consecutiveSuccess: new BN(obj.consecutiveSuccess),
      consecutiveError: new BN(obj.consecutiveError),
      consecutiveDisagreement: new BN(obj.consecutiveDisagreement),
      consecutiveLateResponse: new BN(obj.consecutiveLateResponse),
      consecutiveFailure: new BN(obj.consecutiveFailure),
      totalSuccess: new BN(obj.totalSuccess),
      totalError: new BN(obj.totalError),
      totalDisagreement: new BN(obj.totalDisagreement),
      totalLateResponse: new BN(obj.totalLateResponse),
    });
  }

  toMoveStruct(): OracleMetricsMoveStruct {
    return {
      consecutive_success: this.consecutiveSuccess.toString(),
      consecutive_error: this.consecutiveError.toString(),
      consecutive_disagreement: this.consecutiveDisagreement.toString(),
      consecutive_late_response: this.consecutiveLateResponse.toString(),
      consecutive_failure: this.consecutiveFailure.toString(),
      total_success: this.totalSuccess.toString(),
      total_error: this.totalError.toString(),
      total_disagreement: this.totalDisagreement.toString(),
      total_late_response: this.totalLateResponse.toString(),
    };
  }

  static fromMoveStruct(obj: OracleMetricsMoveStruct) {
    return new OracleMetrics({
      consecutiveSuccess: new BN(obj.consecutive_success),
      consecutiveError: new BN(obj.consecutive_error),
      consecutiveDisagreement: new BN(obj.consecutive_disagreement),
      consecutiveLateResponse: new BN(obj.consecutive_late_response),
      consecutiveFailure: new BN(obj.consecutive_failure),
      totalSuccess: new BN(obj.total_success),
      totalError: new BN(obj.total_error),
      totalDisagreement: new BN(obj.total_disagreement),
      totalLateResponse: new BN(obj.total_late_response),
    });
  }
}
