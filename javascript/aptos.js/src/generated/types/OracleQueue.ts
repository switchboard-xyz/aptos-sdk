import BN from "bn.js"; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types/index.js"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { HexString } from "aptos"; // eslint-disable-line @typescript-eslint/no-unused-vars

export interface IOracleQueue {
  name: Uint8Array;
  metadata: Uint8Array;
  feedProbationPeriod: BN;
  consecutiveFeedFailureLimit: BN;
  consecutiveOracleFailureLimit: BN;
  unpermissionedVrfEnabled: boolean;
  lockLeaseFunding: boolean;
  enableBufferRelayers: boolean;
  minStake: BN;
  maxSize: BN;
  createdAt: BN;
  features: Array<boolean>;
  _ebuf: Uint8Array;
}

export interface OracleQueueJSON {
  name: Array<number>;
  metadata: Array<number>;
  feedProbationPeriod: string;
  consecutiveFeedFailureLimit: string;
  consecutiveOracleFailureLimit: string;
  unpermissionedVrfEnabled: boolean;
  lockLeaseFunding: boolean;
  enableBufferRelayers: boolean;
  minStake: string;
  maxSize: string;
  createdAt: string;
  features: Array<boolean>;
  _ebuf: Array<number>;
}

export interface OracleQueueMoveStruct {
  name: string;
  metadata: string;
  feed_probation_period: string;
  consecutive_feed_failure_limit: string;
  consecutive_oracle_failure_limit: string;
  unpermissioned_vrf_enabled: boolean;
  lock_lease_funding: boolean;
  enable_buffer_relayers: boolean;
  min_stake: string;
  max_size: string;
  created_at: string;
  features: Array<boolean>;
  _ebuf: string;
}

export class OracleQueue implements IOracleQueue {
  readonly name: Uint8Array;
  readonly metadata: Uint8Array;
  readonly feedProbationPeriod: BN;
  readonly consecutiveFeedFailureLimit: BN;
  readonly consecutiveOracleFailureLimit: BN;
  readonly unpermissionedVrfEnabled: boolean;
  readonly lockLeaseFunding: boolean;
  readonly enableBufferRelayers: boolean;
  readonly minStake: BN;
  readonly maxSize: BN;
  readonly createdAt: BN;
  readonly features: Array<boolean>;
  readonly _ebuf: Uint8Array;

  constructor(fields: IOracleQueue) {
    this.name = fields.name;
    this.metadata = fields.metadata;
    this.feedProbationPeriod = fields.feedProbationPeriod;
    this.consecutiveFeedFailureLimit = fields.consecutiveFeedFailureLimit;
    this.consecutiveOracleFailureLimit = fields.consecutiveOracleFailureLimit;
    this.unpermissionedVrfEnabled = fields.unpermissionedVrfEnabled;
    this.lockLeaseFunding = fields.lockLeaseFunding;
    this.enableBufferRelayers = fields.enableBufferRelayers;
    this.minStake = fields.minStake;
    this.maxSize = fields.maxSize;
    this.createdAt = fields.createdAt;
    this.features = fields.features;
    this._ebuf = fields._ebuf;
  }

  toJSON(): OracleQueueJSON {
    return {
      name: [...this.name],
      metadata: [...this.metadata],
      feedProbationPeriod: this.feedProbationPeriod.toString(),
      consecutiveFeedFailureLimit: this.consecutiveFeedFailureLimit.toString(),
      consecutiveOracleFailureLimit:
        this.consecutiveOracleFailureLimit.toString(),
      unpermissionedVrfEnabled: this.unpermissionedVrfEnabled,
      lockLeaseFunding: this.lockLeaseFunding,
      enableBufferRelayers: this.enableBufferRelayers,
      minStake: this.minStake.toString(),
      maxSize: this.maxSize.toString(),
      createdAt: this.createdAt.toString(),
      features: this.features.map((item) => item),
      _ebuf: [...this._ebuf],
    };
  }

  static fromJSON(obj: OracleQueueJSON) {
    return new OracleQueue({
      name: new Uint8Array(obj.name),
      metadata: new Uint8Array(obj.metadata),
      feedProbationPeriod: new BN(obj.feedProbationPeriod),
      consecutiveFeedFailureLimit: new BN(obj.consecutiveFeedFailureLimit),
      consecutiveOracleFailureLimit: new BN(obj.consecutiveOracleFailureLimit),
      unpermissionedVrfEnabled: obj.unpermissionedVrfEnabled,
      lockLeaseFunding: obj.lockLeaseFunding,
      enableBufferRelayers: obj.enableBufferRelayers,
      minStake: new BN(obj.minStake),
      maxSize: new BN(obj.maxSize),
      createdAt: new BN(obj.createdAt),
      features: obj.features.map((item) => item),
      _ebuf: new Uint8Array(obj._ebuf),
    });
  }

  toMoveStruct(): OracleQueueMoveStruct {
    return {
      name: Buffer.from(this.name).toString("hex"),
      metadata: Buffer.from(this.metadata).toString("hex"),
      feed_probation_period: this.feedProbationPeriod.toString(),
      consecutive_feed_failure_limit:
        this.consecutiveFeedFailureLimit.toString(),
      consecutive_oracle_failure_limit:
        this.consecutiveOracleFailureLimit.toString(),
      unpermissioned_vrf_enabled: this.unpermissionedVrfEnabled,
      lock_lease_funding: this.lockLeaseFunding,
      enable_buffer_relayers: this.enableBufferRelayers,
      min_stake: this.minStake.toString(),
      max_size: this.maxSize.toString(),
      created_at: this.createdAt.toString(),
      features: this.features.map((item) => item),
      _ebuf: Buffer.from(this._ebuf).toString("hex"),
    };
  }

  static fromMoveStruct(obj: OracleQueueMoveStruct) {
    return new OracleQueue({
      name:
        typeof obj.name === "string"
          ? new Uint8Array(Buffer.from(obj.name.slice(2), "hex"))
          : new Uint8Array(obj.name),
      metadata:
        typeof obj.metadata === "string"
          ? new Uint8Array(Buffer.from(obj.metadata.slice(2), "hex"))
          : new Uint8Array(obj.metadata),
      feedProbationPeriod: new BN(obj.feed_probation_period),
      consecutiveFeedFailureLimit: new BN(obj.consecutive_feed_failure_limit),
      consecutiveOracleFailureLimit: new BN(
        obj.consecutive_oracle_failure_limit
      ),
      unpermissionedVrfEnabled: obj.unpermissioned_vrf_enabled,
      lockLeaseFunding: obj.lock_lease_funding,
      enableBufferRelayers: obj.enable_buffer_relayers,
      minStake: new BN(obj.min_stake),
      maxSize: new BN(obj.max_size),
      createdAt: new BN(obj.created_at),
      features: obj.features.map((item) => item),
      _ebuf:
        typeof obj._ebuf === "string"
          ? new Uint8Array(Buffer.from(obj._ebuf.slice(2), "hex"))
          : new Uint8Array(obj._ebuf),
    });
  }
}
