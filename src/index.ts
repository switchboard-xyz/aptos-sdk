import {
  AptosClient,
  AptosAccount,
  HexString,
  MaybeHexString,
  FaucetClient,
} from "aptos";
import { MoveStructTag, EntryFunctionId } from "aptos/src/generated";
import Big from "big.js";
import * as sbv2 from "@switchboard-xyz/switchboard-v2";
import * as anchor from "@project-serum/anchor";

// Address that deployed the module
export const SWITCHBOARD_DEVNET_ADDRESS = ``;

// Address of the account that owns the Switchboard resource
export const SWITCHBOARD_STATE_ADDRESS = ``;

export class AptosDecimal {
  constructor(
    readonly mantissa: string,
    readonly scale: number,
    readonly neg: boolean
  ) {}

  toBig(): Big {
    const oldDp = Big.DP;
    Big.DP = 18;
    let result = new Big(this.mantissa);
    if (this.neg === true) {
      result = result.mul(-1);
    }
    const TEN = new Big(10);
    result = safeDiv(result, TEN.pow(this.scale));
    Big.DP = oldDp;
    return result;
  }

  static fromBig(val: Big): AptosDecimal {
    const value = val.c.slice();
    let e = val.e + 1;
    while (value.length - e > 9) {
      value.pop();
    }
    return new AptosDecimal(value.join(""), value.length - e, val.s === -1);
  }

  static fromObj(obj: Object): AptosDecimal {
    const properties = ["mantissa", "scale", "neg"];
    properties.forEach((p) => {
      if (!(p in obj)) {
        throw new Error(`Object is missing property ${p}`);
      }
    });

    return new AptosDecimal(obj["mantissa"], obj["scale"], obj["neg"]);
  }
}

export enum SwitchboardPermission {
  PERMIT_ORACLE_HEARTBEAT,
  PERMIT_ORACLE_QUEUE_USAGE,
  PERMIT_VRF_REQUESTS,
}

export interface AggregatorAddJobParams {
  job: MaybeHexString;
  weight?: number;
}

export interface AggregatorInitParams {
  authority: MaybeHexString; // owner of aggregator
  name?: string;
  metadata?: string;
  queueAddress: MaybeHexString;
  coinType: MoveStructTag;
  batchSize: number;
  minOracleResults: number;
  minJobResults: number;
  minUpdateDelaySeconds: number;
  startAfter?: number;
  varianceThreshold?: number;
  varianceThresholdScale?: number;
  forceReportPeriod?: number;
  expiration?: number;
}

export interface AggregatorSaveResultParams {
  oracle_address: MaybeHexString;
  oracle_idx: number;
  error: boolean;
  // this should probably be automatically generated
  value_num: number;
  value_scale_factor: number; // scale factor
  value_neg: boolean;
  jobs_checksum: string;
}

export interface JobInitParams {
  name: string;
  metadata: string;
  authority: MaybeHexString;
  data: string;
}

export interface AggregatorRemoveJobParams {
  aggregatorAddress: string;
  job: string;
}

export interface AggregatorSetConfigParams {
  address: string;
  authority: string;
  name?: string;
  metadata?: string;
  queueAddress?: string;
  batchSize: number;
  minOracleResults: number;
  minJobResults: number;
  minUpdateDelaySeconds: number;
  startAfter?: number;
  varianceThreshold?: number;
  forceReportPeriod?: number;
  expiration?: number;
}

export interface CrankInitParams {
  address: string;
  queueAddress: MaybeHexString;
  coinType: MoveStructTag;
}

export interface CrankPopParams {
  crankAddress: string;
}

export interface CrankPushParams {
  aggregatorAddress: string;
}

export interface OracleInitParams {
  address: MaybeHexString;
  name: string;
  metadata: string;
  authority: MaybeHexString;
  queue: MaybeHexString;
  coinType: MoveStructTag;
}

export interface OracleQueueInitParams {
  name: string;
  metadata: string;
  authority: MaybeHexString;
  oracleTimeout: number;
  reward: number;
  minStake: number;
  slashingEnabled: boolean;
  varianceToleranceMultiplierValue: number;
  varianceToleranceMultiplierScale: number;
  feedProbationPeriod: number;
  consecutiveFeedFailureLimit: number;
  consecutiveOracleFailureLimit: number;
  unpermissionedFeedsEnabled: boolean;
  unpermissionedVrfEnabled: boolean;
  lockLeaseFunding: boolean;

  // this needs to be swapped with Coin or something later
  mint: MaybeHexString;
  enableBufferRelayers: boolean;
  maxSize: number;
  coinType: MoveStructTag;
}

export interface LeaseInitParams {
  queueAddress: MaybeHexString;
  withdrawAuthority: MaybeHexString;
  initialAmount: number;
  coinType: MoveStructTag;
}

export interface LeaseExtendParams {
  loadAmount: number;
}

export interface LeaseWithdrawParams {
  amount: number;
}

export interface OracleWalletInitParams {
  oracleAddress: MaybeHexString;
  coinType: string;
}

export interface OracleWalletContributeParams {
  oracleWalletAddr: MaybeHexString;
  loadAmount: number;
}

export interface OracleWalletWithdrawParams {
  oracleWalletAddr: MaybeHexString;
  amount: number;
}

export interface PermissionInitParams {
  authority: MaybeHexString;
  granter: MaybeHexString;
  grantee: MaybeHexString;
}

export interface PermissionSetParams {
  authority: MaybeHexString;
  granter: string;
  grantee: string;
  permission: SwitchboardPermission;
  enable: boolean;
}

export type EventCallback = (
  e: any
) => Promise<void> /** | (() => Promise<void>) */;

/** Convert string to hex-encoded utf-8 bytes. */
function stringToHex(text: string) {
  return Buffer.from(text, "utf-8").toString("hex");
}

/**
 * Sends and waits for an aptos tx to be confirmed
 * @param client
 * @param signer
 * @param method Aptos module method (ex: 0xSwitchboard::AggregatorAddJobAction)
 * @param args Arguments for method (converts numbers to strings)
 * @returns
 */
export async function sendAptosTx(
  client: AptosClient,
  signer: AptosAccount,
  method: EntryFunctionId,
  args: Array<any>,
  type_args: Array<string> = [],
  retryCount = 2
): Promise<string> {
  const payload = {
    type: "entry_function_payload",
    function: method,
    type_arguments: type_args,
    arguments: args,
  };
  const txnRequest = await client.generateTransaction(
    signer.address(),
    payload,
    { max_gas_amount: "5000" }
  );

  const simulation = (await client.simulateTransaction(signer, txnRequest))[0];
  if (simulation.vm_status === "Out of gas") {
    if (retryCount > 0) {
      const faucetClient = new FaucetClient(
        "https://fullnode.devnet.aptoslabs.com/v1",
        "https://faucet.devnet.aptoslabs.com"
      );
      await faucetClient.fundAccount(signer.address(), 5000);
      return sendAptosTx(client, signer, method, args, type_args, --retryCount);
    }
  }
  if (simulation.success === false) {
    console.log(simulation);
    // console.log(`TxGas: ${simulation.gas_used}`);
    // console.log(`TxGas: ${simulation.hash}`);
    throw new Error(`TxFailure: ${simulation.vm_status}`);
  } else {
    // console.log(`TxGas: ${simulation.gas_used}`);
  }

  const signedTxn = await client.signTransaction(signer, txnRequest);
  const transactionRes = await client.submitTransaction(signedTxn);
  await client.waitForTransaction(transactionRes.hash);
  return transactionRes.hash;
}

/**
 * Poll Events on Aptos
 * @Note uncleared setTimeout calls will keep processes from ending organically (SIGTERM is needed)
 */
export class AptosEvent {
  intervalId?: ReturnType<typeof setInterval>;
  constructor(
    readonly client: AptosClient,
    readonly eventHandlerOwner: HexString,
    readonly eventOwnerStruct: MoveStructTag,
    readonly eventHandlerName: string,
    readonly pollIntervalMs: number = 1000
  ) {}

  async onTrigger(
    callback: EventCallback,
    errorHandler?: (error: unknown) => void
  ) {
    let lastSequenceNumber = "0";
    const ownerData = await this.client.getAccountResource(
      this.eventHandlerOwner.hex().toString(),
      this.eventOwnerStruct
    );
    try {
      lastSequenceNumber = (
        Number(ownerData.data[this.eventHandlerName].counter) - 1
      ).toString();
    } catch (error) {
      console.error(JSON.stringify(ownerData, undefined, 2), error);
    }
    if (Number(ownerData.data[this.eventHandlerName].counter) === -1) {
      lastSequenceNumber = "0";
    }

    this.intervalId = setInterval(async () => {
      try {
        const events = await this.client.getEventsByEventHandle(
          this.eventHandlerOwner,
          this.eventOwnerStruct,
          this.eventHandlerName,
          {
            start: BigInt(Number(lastSequenceNumber) + 1),
            limit: 500,
          }
        );
        if (events.length !== 0) {
          // increment sequence number
          lastSequenceNumber = events.at(-1)!.sequence_number;
        }
        for (let event of events) {
          callback(event).catch((error) => {
            if (errorHandler) {
              errorHandler(error);
            } else {
              throw error;
            }
          });
        }
      } catch (error) {
        if (errorHandler) {
          errorHandler(error);
        }
      }
    }, this.pollIntervalMs);
    return this.intervalId;
  }

  stop() {
    clearInterval(this.intervalId);
  }
}

export class State {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly payer: AptosAccount,
    readonly devnetAddress: MaybeHexString
  ) {}

  static async init(
    client: AptosClient,
    account: AptosAccount,
    devnetAddress: MaybeHexString
  ): Promise<[State, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${devnetAddress}::SwitchboardInitAction::run`,
      []
    );

    return [new State(client, account.address(), account, devnetAddress), tx];
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        this.address,
        `${this.devnetAddress}::Switchboard::State`
      )
    ).data;
  }
}

export class Aggregator {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly devnetAddress: MaybeHexString,
    readonly stateAddress: MaybeHexString,
    readonly coinType: MoveStructTag = "0x1::aptos_coin::AptosCoin"
  ) {}

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${this.devnetAddress}::Aggregator::Aggregator`
      )
    ).data;
  }

  async loadJobs(): Promise<Array<sbv2.OracleJob>> {
    const data = await this.loadData();
    const jobs = data.job_keys.map(
      (key: string) =>
        new Job(this.client, key, this.devnetAddress, this.stateAddress)
    );
    const promises: Array<Promise<sbv2.OracleJob>> = [];
    for (let job of jobs) {
      promises.push(job.loadJob());
    }
    return await Promise.all(promises);
  }

  /**
   * Initialize an Aggregator
   * @param client
   * @param account
   * @param params AggregatorInitParams initialization params
   */
  static async init(
    client: AptosClient,
    account: AptosAccount,
    params: AggregatorInitParams,
    devnetAddress: MaybeHexString,
    stateAddress: MaybeHexString
  ): Promise<[Aggregator, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${devnetAddress}::AggregatorInitAction::run`,
      [
        HexString.ensure(stateAddress).hex(),
        Buffer.from(params.name ?? "").toString("hex"),
        Buffer.from(params.metadata ?? "").toString("hex"),
        HexString.ensure(params.queueAddress).hex(),
        params.batchSize.toString(),
        params.minOracleResults.toString(),
        params.minJobResults.toString(),
        params.minUpdateDelaySeconds.toString(),
        (params.startAfter ?? 0).toString(),
        (params.varianceThreshold ?? 0).toString(),
        params.varianceThresholdScale ?? 0,
        (params.forceReportPeriod ?? 0).toString(),
        (params.expiration ?? 0).toString(),
        HexString.ensure(params.authority).hex(),
      ],
      [params.coinType ?? "0x1::aptos_coin::AptosCoin"]
    );

    return [
      new Aggregator(
        client,
        account.address(),
        devnetAddress,
        stateAddress,
        params.coinType ?? "0x1::aptos_coin::AptosCoin"
      ),
      tx,
    ];
  }

  async addJob(
    account: AptosAccount,
    params: AggregatorAddJobParams
  ): Promise<string> {
    return await sendAptosTx(
      this.client,
      account,
      `${this.devnetAddress}::AggregatorAddJobAction::run`,
      [
        HexString.ensure(this.stateAddress).hex(),
        HexString.ensure(this.address).hex(),
        HexString.ensure(params.job).hex(),
        params.weight || 1,
      ]
    );
  }

  async saveResult(
    account: AptosAccount,
    params: AggregatorSaveResultParams
  ): Promise<string> {
    return await sendAptosTx(
      this.client,
      account,
      `${this.devnetAddress}::AggregatorSaveResultAction::run`,
      [
        HexString.ensure(this.stateAddress).hex(),
        HexString.ensure(params.oracle_address).hex(),
        HexString.ensure(this.address).hex(),
        params.oracle_idx.toString(),
        params.error,
        params.value_num.toString(),
        params.value_scale_factor,
        params.value_neg,
        stringToHex(params.jobs_checksum),
      ],
      [this.coinType]
    );
  }

  async openRound(account: AptosAccount): Promise<string> {
    return await sendAptosTx(
      this.client,
      account,
      `${this.devnetAddress}::AggregatorOpenRoundAction::run`,
      [
        HexString.ensure(this.stateAddress).hex(),
        HexString.ensure(this.address).hex(),
      ],
      [this.coinType]
    );
  }

  async watch(callback: EventCallback): Promise<AptosEvent> {
    const event = new AptosEvent(
      this.client,
      HexString.ensure(`${this.devnetAddress}::Switchboard::State`),
      `${this.devnetAddress}::Switchboard::State`,
      "aggregator_update_events",
      1000
    );
    await event.onTrigger(callback);
    return event;
  }

  static async shouldReportValue(
    value: Big,
    aggregator: any
  ): Promise<boolean> {
    if ((aggregator.latestConfirmedRound?.numSuccess ?? 0) === 0) {
      return true;
    }
    const timestamp = new anchor.BN(Math.round(Date.now() / 1000), 10);
    const startAfter = new anchor.BN(aggregator.startAfter, 10);
    if (startAfter.gt(timestamp)) {
      return false;
    }
    const varianceThreshold: Big = new AptosDecimal(
      aggregator.varianceThreshold.mantissa,
      aggregator.varianceThreshold.dec,
      aggregator.varianceThreshold.neg
    ).toBig();
    const latestResult: Big = new AptosDecimal(
      aggregator.latestConfirmedRound.result.mantissa,
      aggregator.latestConfirmedRound.result.dec,
      aggregator.latestConfirmedRound.result.neg
    ).toBig();
    const forceReportPeriod = new anchor.BN(aggregator.forceReportPeriod, 10);
    const lastTimestamp = new anchor.BN(
      aggregator.latestConfirmedRound.roundOpenTimestamp,
      10
    );
    if (lastTimestamp.add(forceReportPeriod).lt(timestamp)) {
      return true;
    }
    let diff = safeDiv(latestResult, value);
    if (diff.abs().gt(1)) {
      diff = safeDiv(value, latestResult);
    }
    // I dont want to think about variance percentage when values cross 0.
    // Changes the scale of what we consider a "percentage".
    if (diff.lt(0)) {
      return true;
    }
    const changePercent = new Big(1).minus(diff).mul(100);
    return changePercent.gt(varianceThreshold);
  }
}

export class Job {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly devnetAddress: MaybeHexString,
    readonly stateAddress: MaybeHexString
  ) {}

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        this.address,
        `${this.devnetAddress}::Job::Job`
      )
    ).data;
  }

  async loadJob(): Promise<sbv2.OracleJob> {
    const data = await this.loadData();
    return sbv2.OracleJob.decodeDelimited(
      Buffer.from(data.data.slice(2), "hex")
    );
  }

  /**
   * Initialize a Job
   * @param client
   * @param account
   * @param params JobInitParams initialization params
   */
  static async init(
    client: AptosClient,
    account: AptosAccount,
    params: JobInitParams,
    devnetAddress: MaybeHexString,
    stateAddress: MaybeHexString
  ): Promise<[Job, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${devnetAddress}::JobInitAction::run`,
      [
        HexString.ensure(stateAddress).hex(),
        stringToHex(params.name),
        stringToHex(params.metadata),
        HexString.ensure(params.authority).hex(),
        params.data,
      ]
    );

    return [
      new Job(client, account.address(), devnetAddress, stateAddress),
      tx,
    ];
  }
}

export class Crank {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly devnetAddress: MaybeHexString,
    readonly stateAddress: MaybeHexString,
    readonly coinType: MoveStructTag = "0x1::aptos_coin::AptosCoin"
  ) {}

  /**
   * Initialize a Crank
   * @param client
   * @param account account that will be the authority of the Crank
   * @param params CrankInitParams initialization params
   */
  static async init(
    client: AptosClient,
    account: AptosAccount,
    params: CrankInitParams,
    devnetAddress: MaybeHexString,
    stateAddress: MaybeHexString
  ): Promise<[Crank, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${devnetAddress}::CrankInitAction::run`,
      [
        HexString.ensure(stateAddress).hex(),
        HexString.ensure(params.queueAddress).hex(),
      ],
      [params.coinType ?? "0x1::aptos_coin::AptosCoin"]
    );

    return [
      new Crank(
        client,
        account.address(),
        devnetAddress,
        stateAddress,
        params.coinType ?? "0x1::aptos_coin::AptosCoin"
      ),
      tx,
    ];
  }

  /**
   * Push an aggregator to a Crank
   * @param params CrankPushParams
   */
  async push(account: AptosAccount, params: CrankPushParams): Promise<string> {
    return await sendAptosTx(
      this.client,
      account,
      `${this.devnetAddress}::CrankPushAction::run`,
      [
        HexString.ensure(this.stateAddress).hex(),
        HexString.ensure(this.address).hex(),
        HexString.ensure(params.aggregatorAddress).hex(),
      ],
      [this.coinType]
    );
  }

  /**
   * Pop an aggregator off the Crank
   */
  async pop(account: AptosAccount): Promise<string> {
    return await sendAptosTx(
      this.client,
      account,
      `${this.devnetAddress}::CrankPopAction::run`,
      [
        HexString.ensure(this.stateAddress).hex(),
        HexString.ensure(this.address).hex(),
      ],
      [this.coinType]
    );
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${this.devnetAddress}::Crank::Crank`
      )
    ).data;
  }
}

export class Oracle {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly devnetAddress: MaybeHexString,
    readonly stateAddress: MaybeHexString,
    readonly coinType: MoveStructTag = "0x1::aptos_coin::AptosCoin"
  ) {}

  /**
   * Initialize a Oracle
   * @param client
   * @param account
   * @param params Oracle initialization params
   */
  static async init(
    client: AptosClient,
    account: AptosAccount,
    params: OracleInitParams,
    devnetAddress: MaybeHexString,
    stateAddress: MaybeHexString
  ): Promise<[Oracle, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${devnetAddress}::OracleInitAction::run`,
      [
        HexString.ensure(stateAddress).hex(),
        stringToHex(params.name),
        stringToHex(params.metadata),
        HexString.ensure(params.authority).hex(),
        HexString.ensure(params.queue).hex(),
      ],
      [params.coinType ?? "0x1::aptos_coin::AptosCoin"]
    );

    return [
      new Oracle(
        client,
        account.address(),
        devnetAddress,
        stateAddress,
        params.coinType ?? "0x1::aptos_coin::AptosCoin"
      ),
      tx,
    ];
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${this.devnetAddress}::Oracle::Oracle`
      )
    ).data;
  }

  /**
   * Oracle Heartbeat Action
   */
  async heartbeat(account: AptosAccount): Promise<string> {
    return await sendAptosTx(
      this.client,
      account,
      `${this.devnetAddress}::OracleHeartbeatAction::run`,
      [
        HexString.ensure(this.stateAddress).hex(),
        HexString.ensure(this.address).hex(),
      ],
      [this.coinType]
    );
  }
}

export class OracleQueue {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly devnetAddress: MaybeHexString,
    readonly stateAddress: MaybeHexString,
    readonly coinType: MoveStructTag = "0x1::aptos_coin::AptosCoin"
  ) {}

  /**
   * Initialize an OracleQueue
   * @param client
   * @param account
   * @param params OracleQueue initialization params
   */
  static async init(
    client: AptosClient,
    account: AptosAccount,
    params: OracleQueueInitParams,
    devnetAddress,
    stateAddress
  ): Promise<[OracleQueue, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${devnetAddress}::OracleQueueInitAction::run`,
      [
        HexString.ensure(stateAddress).hex(),
        stringToHex(params.name),
        stringToHex(params.metadata),
        HexString.ensure(params.authority).hex(),
        params.oracleTimeout.toString(),
        params.reward.toString(),
        params.minStake.toString(),
        params.slashingEnabled,
        params.varianceToleranceMultiplierValue.toString(),
        params.varianceToleranceMultiplierScale,
        params.feedProbationPeriod.toString(),
        params.consecutiveFeedFailureLimit.toString(),
        params.consecutiveOracleFailureLimit.toString(),
        params.unpermissionedFeedsEnabled,
        params.unpermissionedVrfEnabled,
        params.lockLeaseFunding,
        HexString.ensure(params.mint).hex(),
        params.enableBufferRelayers,
        params.maxSize.toString(),
      ],
      [params.coinType ?? "0x1::aptos_coin::AptosCoin"]
    );

    return [
      new OracleQueue(
        client,
        account.address(),
        devnetAddress,
        stateAddress,
        params.coinType ?? "0x1::aptos_coin::AptosCoin"
      ),
      tx,
    ];
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${this.devnetAddress}::OracleQueue::OracleQueue<${this.coinType}>`
      )
    ).data;
  }
}

export class Lease {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly devnetAddress: MaybeHexString,
    readonly stateAddress: MaybeHexString,
    readonly coinType: MoveStructTag = "0x1::aptos_coin::AptosCoin"
  ) {}

  /**
   * Initialize a Lease
   * @param client
   * @param account account that will be the authority of the Lease
   * @param params LeaseInitParams initialization params
   */
  static async init(
    client: AptosClient,
    account: AptosAccount,
    params: LeaseInitParams,
    devnetAddress: MaybeHexString,
    stateAddress: MaybeHexString
  ): Promise<[Lease, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${devnetAddress}::LeaseInitAction::run`,
      [
        HexString.ensure(stateAddress).hex(),
        HexString.ensure(params.queueAddress).hex(),
        HexString.ensure(params.withdrawAuthority).hex(),
        params.initialAmount.toString(),
      ],
      [params.coinType ?? "0x1::aptos_coin::AptosCoin"]
    );

    return [
      new Lease(
        client,
        account.address(),
        devnetAddress,
        stateAddress,
        params.coinType ?? "0x1::aptos_coin::AptosCoin"
      ),
      tx,
    ];
  }

  /**
   * Extend a lease
   * @param params CrankPushParams
   */
  async extend(
    account: AptosAccount,
    params: LeaseExtendParams
  ): Promise<string> {
    return await sendAptosTx(
      this.client,
      account,
      `${this.devnetAddress}::LeaseExtendAction::run`,
      [HexString.ensure(this.address).hex(), params.loadAmount.toString()],
      [this.coinType]
    );
  }

  /**
   * Pop an aggregator off the Crank
   */
  async withdraw(
    account: AptosAccount,
    params: LeaseWithdrawParams
  ): Promise<string> {
    return await sendAptosTx(
      this.client,
      account,
      `${this.devnetAddress}::LeaseWithdrawAction::run`,
      [[HexString.ensure(this.address).hex(), params.amount.toString()]],
      [this.coinType]
    );
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${this.devnetAddress}::Lease::Lease<${this.coinType}>`
      )
    ).data;
  }
}

export class OracleWallet {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly devnetAddress: MaybeHexString,
    readonly stateAddress: MaybeHexString,
    readonly coinType: MoveStructTag = "0x1::aptos_coin::AptosCoin"
  ) {}

  /**
   * Initialize an OracleWallet
   * @param client
   * @param account account that will be the authority of the OracleWallet
   * @param params OracleWalletInitParams initialization params
   */
  static async init(
    client: AptosClient,
    account: AptosAccount,
    params: OracleWalletInitParams,
    devnetAddress: MaybeHexString,
    stateAddress: MaybeHexString
  ): Promise<[OracleWallet, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${devnetAddress}::OracleWalletInitAction::run`,
      [HexString.ensure(params.oracleAddress).hex()],
      [params.coinType ?? "0x1::aptos_coin::AptosCoin"]
    );

    return [
      new OracleWallet(
        client,
        account.address(),
        devnetAddress,
        stateAddress,
        params.coinType ?? "0x1::aptos_coin::AptosCoin"
      ),
      tx,
    ];
  }

  /**
   * Contributes to an oracle wallet
   * @param params OracleWalletContributeParams
   */
  async contribute(
    account: AptosAccount,
    params: OracleWalletContributeParams
  ): Promise<string> {
    return await sendAptosTx(
      this.client,
      account,
      `${this.devnetAddress}::OracleWalletContributeAction::run`,
      [HexString.ensure(this.address).hex(), params.loadAmount.toString()],
      [this.coinType]
    );
  }

  /**
   * Withdraw from an OracleWallet
   */
  async withdraw(
    account: AptosAccount,
    params: OracleWalletWithdrawParams
  ): Promise<string> {
    return await sendAptosTx(
      this.client,
      account,
      `${this.devnetAddress}::OracleWalletWithdrawAction::run`,
      [[HexString.ensure(this.address).hex(), params.amount.toString()]],
      [this.coinType]
    );
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${this.devnetAddress}::OracleWallet::OracleWallet<${this.coinType}>`
      )
    ).data;
  }
}

export class Permission {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly devnetAddress: MaybeHexString,
    readonly stateAddress: MaybeHexString
  ) {}

  /**
   * Initialize a Permission
   * @param client
   * @param account
   * @param params PermissionInitParams initialization params
   */
  static async init(
    client: AptosClient,
    account: AptosAccount,
    params: PermissionInitParams,
    devnetAddress: MaybeHexString,
    stateAddress: MaybeHexString
  ): Promise<[Permission, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${devnetAddress}::PermissionInitAction::run`,
      [
        HexString.ensure(stateAddress).hex(),
        HexString.ensure(params.authority).hex(),
        HexString.ensure(params.granter).hex(),
        HexString.ensure(params.grantee).hex(),
      ]
    );

    return [
      new Permission(client, account.address(), devnetAddress, stateAddress),
      tx,
    ];
  }

  /**
   * Set a Permission
   */
  async set(
    account: AptosAccount,
    params: PermissionSetParams,
    stateAddress: MaybeHexString
  ): Promise<string> {
    return await sendAptosTx(
      this.client,
      account,
      `${this.devnetAddress}::PermissionSetAction::run`,
      [
        HexString.ensure(stateAddress).hex(),
        HexString.ensure(params.authority).hex(),
        HexString.ensure(params.granter).hex(),
        HexString.ensure(params.grantee).hex(),
        params.permission.toString(),
        params.enable,
      ]
    );
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${this.devnetAddress}::Permission::Permission`
      )
    ).data;
  }
}

function safeDiv(number_: Big, denominator: Big, decimals = 20): Big {
  const oldDp = Big.DP;
  Big.DP = decimals;
  const result = number_.div(denominator);
  Big.DP = oldDp;
  return result;
}
