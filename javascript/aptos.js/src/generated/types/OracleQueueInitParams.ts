import BN from "bn.js"; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as types from "../types/index.js"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { HexString } from "aptos"; // eslint-disable-line @typescript-eslint/no-unused-vars

export interface IOracleQueueInitParams {
  name: Uint8Array;
  metadata: Uint8Array;
  authority: HexString;
  oracleTimeout: BN;
  reward: BN;
  minStake: BN;
  slashingEnabled: boolean;
  varianceToleranceMultiplier: types.SwitchboardDecimal;
  feedProbationPeriod: BN;
  consecutiveFeedFailureLimit: BN;
  consecutiveOracleFailureLimit: BN;
  unpermissionedFeedsEnabled: boolean;
  unpermissionedVrfEnabled: boolean;
  lockLeaseFunding: boolean;
  enableBufferRelayers: boolean;
  maxSize: BN;
  data: Array<HexString>;
}

export interface OracleQueueInitParamsJSON {
  name: Array<number>;
  metadata: Array<number>;
  authority: string;
  oracleTimeout: string;
  reward: string;
  minStake: string;
  slashingEnabled: boolean;
  varianceToleranceMultiplier: types.SwitchboardDecimalJSON;
  feedProbationPeriod: string;
  consecutiveFeedFailureLimit: string;
  consecutiveOracleFailureLimit: string;
  unpermissionedFeedsEnabled: boolean;
  unpermissionedVrfEnabled: boolean;
  lockLeaseFunding: boolean;
  enableBufferRelayers: boolean;
  maxSize: string;
  data: Array<string>;
}

export interface OracleQueueInitParamsMoveStruct {
  name: string;
  metadata: string;
  authority: string;
  oracle_timeout: string;
  reward: string;
  min_stake: string;
  slashing_enabled: boolean;
  variance_tolerance_multiplier: types.SwitchboardDecimalMoveStruct;
  feed_probation_period: string;
  consecutive_feed_failure_limit: string;
  consecutive_oracle_failure_limit: string;
  unpermissioned_feeds_enabled: boolean;
  unpermissioned_vrf_enabled: boolean;
  lock_lease_funding: boolean;
  enable_buffer_relayers: boolean;
  max_size: string;
  data: Array<string>;
}

export class OracleQueueInitParams implements IOracleQueueInitParams {
  readonly name: Uint8Array;
  readonly metadata: Uint8Array;
  readonly authority: HexString;
  readonly oracleTimeout: BN;
  readonly reward: BN;
  readonly minStake: BN;
  readonly slashingEnabled: boolean;
  readonly varianceToleranceMultiplier: types.SwitchboardDecimal;
  readonly feedProbationPeriod: BN;
  readonly consecutiveFeedFailureLimit: BN;
  readonly consecutiveOracleFailureLimit: BN;
  readonly unpermissionedFeedsEnabled: boolean;
  readonly unpermissionedVrfEnabled: boolean;
  readonly lockLeaseFunding: boolean;
  readonly enableBufferRelayers: boolean;
  readonly maxSize: BN;
  readonly data: Array<HexString>;

  constructor(fields: IOracleQueueInitParams) {
    this.name = fields.name;
    this.metadata = fields.metadata;
    this.authority = fields.authority;
    this.oracleTimeout = fields.oracleTimeout;
    this.reward = fields.reward;
    this.minStake = fields.minStake;
    this.slashingEnabled = fields.slashingEnabled;
    this.varianceToleranceMultiplier = fields.varianceToleranceMultiplier;
    this.feedProbationPeriod = fields.feedProbationPeriod;
    this.consecutiveFeedFailureLimit = fields.consecutiveFeedFailureLimit;
    this.consecutiveOracleFailureLimit = fields.consecutiveOracleFailureLimit;
    this.unpermissionedFeedsEnabled = fields.unpermissionedFeedsEnabled;
    this.unpermissionedVrfEnabled = fields.unpermissionedVrfEnabled;
    this.lockLeaseFunding = fields.lockLeaseFunding;
    this.enableBufferRelayers = fields.enableBufferRelayers;
    this.maxSize = fields.maxSize;
    this.data = fields.data;
  }

  toJSON(): OracleQueueInitParamsJSON {
    return {
      name: [...this.name],
      metadata: [...this.metadata],
      authority: this.authority.toString(),
      oracleTimeout: this.oracleTimeout.toString(),
      reward: this.reward.toString(),
      minStake: this.minStake.toString(),
      slashingEnabled: this.slashingEnabled,
      varianceToleranceMultiplier: this.varianceToleranceMultiplier.toJSON(),
      feedProbationPeriod: this.feedProbationPeriod.toString(),
      consecutiveFeedFailureLimit: this.consecutiveFeedFailureLimit.toString(),
      consecutiveOracleFailureLimit:
        this.consecutiveOracleFailureLimit.toString(),
      unpermissionedFeedsEnabled: this.unpermissionedFeedsEnabled,
      unpermissionedVrfEnabled: this.unpermissionedVrfEnabled,
      lockLeaseFunding: this.lockLeaseFunding,
      enableBufferRelayers: this.enableBufferRelayers,
      maxSize: this.maxSize.toString(),
      data: this.data.map((item) => item.toString()),
    };
  }

  static fromJSON(obj: OracleQueueInitParamsJSON) {
    return new OracleQueueInitParams({
      name: new Uint8Array(obj.name),
      metadata: new Uint8Array(obj.metadata),
      authority: HexString.ensure(obj.authority),
      oracleTimeout: new BN(obj.oracleTimeout),
      reward: new BN(obj.reward),
      minStake: new BN(obj.minStake),
      slashingEnabled: obj.slashingEnabled,
      varianceToleranceMultiplier: types.SwitchboardDecimal.fromJSON(
        obj.varianceToleranceMultiplier
      ),
      feedProbationPeriod: new BN(obj.feedProbationPeriod),
      consecutiveFeedFailureLimit: new BN(obj.consecutiveFeedFailureLimit),
      consecutiveOracleFailureLimit: new BN(obj.consecutiveOracleFailureLimit),
      unpermissionedFeedsEnabled: obj.unpermissionedFeedsEnabled,
      unpermissionedVrfEnabled: obj.unpermissionedVrfEnabled,
      lockLeaseFunding: obj.lockLeaseFunding,
      enableBufferRelayers: obj.enableBufferRelayers,
      maxSize: new BN(obj.maxSize),
      data: obj.data.map((item) => HexString.ensure(item)),
    });
  }

  toMoveStruct(): OracleQueueInitParamsMoveStruct {
    return {
      name: Buffer.from(this.name).toString("hex"),
      metadata: Buffer.from(this.metadata).toString("hex"),
      authority: this.authority.toString(),
      oracle_timeout: this.oracleTimeout.toString(),
      reward: this.reward.toString(),
      min_stake: this.minStake.toString(),
      slashing_enabled: this.slashingEnabled,
      variance_tolerance_multiplier:
        this.varianceToleranceMultiplier.toMoveStruct(),
      feed_probation_period: this.feedProbationPeriod.toString(),
      consecutive_feed_failure_limit:
        this.consecutiveFeedFailureLimit.toString(),
      consecutive_oracle_failure_limit:
        this.consecutiveOracleFailureLimit.toString(),
      unpermissioned_feeds_enabled: this.unpermissionedFeedsEnabled,
      unpermissioned_vrf_enabled: this.unpermissionedVrfEnabled,
      lock_lease_funding: this.lockLeaseFunding,
      enable_buffer_relayers: this.enableBufferRelayers,
      max_size: this.maxSize.toString(),
      data: this.data.map((item) => item.toString()),
    };
  }

  static fromMoveStruct(obj: OracleQueueInitParamsMoveStruct) {
    return new OracleQueueInitParams({
      name:
        typeof obj.name === "string"
          ? new Uint8Array(Buffer.from(obj.name.slice(2), "hex"))
          : new Uint8Array(obj.name),
      metadata:
        typeof obj.metadata === "string"
          ? new Uint8Array(Buffer.from(obj.metadata.slice(2), "hex"))
          : new Uint8Array(obj.metadata),
      authority: HexString.ensure(obj.authority),
      oracleTimeout: new BN(obj.oracle_timeout),
      reward: new BN(obj.reward),
      minStake: new BN(obj.min_stake),
      slashingEnabled: obj.slashing_enabled,
      varianceToleranceMultiplier: types.SwitchboardDecimal.fromMoveStruct(
        obj.variance_tolerance_multiplier
      ),
      feedProbationPeriod: new BN(obj.feed_probation_period),
      consecutiveFeedFailureLimit: new BN(obj.consecutive_feed_failure_limit),
      consecutiveOracleFailureLimit: new BN(
        obj.consecutive_oracle_failure_limit
      ),
      unpermissionedFeedsEnabled: obj.unpermissioned_feeds_enabled,
      unpermissionedVrfEnabled: obj.unpermissioned_vrf_enabled,
      lockLeaseFunding: obj.lock_lease_funding,
      enableBufferRelayers: obj.enable_buffer_relayers,
      maxSize: new BN(obj.max_size),
      data: obj.data.map((item) => HexString.ensure(item)),
    });
  }
}
