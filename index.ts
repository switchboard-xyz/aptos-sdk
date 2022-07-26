import {
  AptosClient,
  AptosAccount,
  Types,
  HexString,
  MaybeHexString,
} from "aptos";
import Big from "big.js";
import * as sbv2 from "@switchboard-xyz/switchboard-v2";

// Address that deployed the module
export const SWITCHBOARD_DEVNET_ADDRESS =
  "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";

// Address of the account that owns the Switchboard resource
export const SWITCHBOARD_STATE_ADDRESS =
  "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";

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
    result = result.div(TEN.pow(this.scale));
    Big.DP = oldDp;
    return result;
  }

  static fromBig(val: Big): AptosDecimal {
    const value = val.c.slice();
    let e = val.e;
    while (e > 18) {
      value.pop();
      e -= 1;
    }
    return new AptosDecimal(value.join(""), e, val.s === -1);
  }
}

export interface AggregatorAddJobParams {
  job: MaybeHexString;
  weight?: number;
}

export interface AggregatorInitParams {
  address: MaybeHexString; // arbitrary key associated with aggregator @NOTE: Cannot be altered
  authority: MaybeHexString; // owner of aggregator
  name?: string;
  metadata?: string;
  queueAddress?: MaybeHexString;
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
  //state_address: address,
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
  queueAddress: string;
}

export interface CrankPopParams {
  crankAddress: string;
}

export interface CrankPushParams {
  crankAddress: string;
  aggregatorAddress: string;
}

export interface OracleInitParams {
  address: MaybeHexString;
  name: string;
  metadata: string;
  authority: MaybeHexString;
  queue: MaybeHexString;
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
}

export type EventCallback = (
  e: Types.Event
) => Promise<void> | (() => Promise<void>);

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
  method: string,
  args: Array<any>
): Promise<string> {
  const payload: Types.TransactionPayload = {
    type: "script_function_payload",
    function: method,
    type_arguments: [],
    arguments: args,
  };
  const txnRequest = await client.generateTransaction(
    signer.address(),
    payload
  );

  const simulation = await client.simulateTransaction(signer, txnRequest);
  if (simulation.success === false) {
    console.log(`TxGas: ${simulation.gas_used}`);
    console.log(`TxGas: ${simulation.hash}`);
    throw new Error(`TxFailure: ${simulation.vm_status}`);
  } else {
    console.log(`TxGas: ${simulation.gas_used}`);
  }

  const signedTxn = await client.signTransaction(signer, txnRequest);
  const transactionRes = await client.submitTransaction(signedTxn);
  await client.waitForTransaction(transactionRes.hash);
  return transactionRes.hash;
}

interface TableType {
  stateKey: string;
  keyType: string;
  valueType: string;
}

const LeaseTable: TableType = {
  stateKey: `leases`,
  keyType: `vector<u8>`,
  valueType: `${SWITCHBOARD_DEVNET_ADDRESS}::Lease::Lease`,
};

const PermissionTable: TableType = {
  stateKey: `permissions`,
  keyType: `vector<u8>`,
  valueType: `${SWITCHBOARD_DEVNET_ADDRESS}::Permission::Permission`,
};

/**
 * Retrieve Table Item
 * @param client
 * @param tableType
 * @param key string to fetch table item by
 */
async function getTableItem(
  client: AptosClient,
  tableType: TableType,
  key: string
): Promise<unknown | undefined> {
  // get table resource
  const switchboardTableResource = await client.getAccountResource(
    SWITCHBOARD_STATE_ADDRESS,
    `${SWITCHBOARD_DEVNET_ADDRESS}::Switchboard::State`
  );

  const handle = (switchboardTableResource.data as any)[tableType.stateKey]
    ?.handle;

  const getTokenTableItemRequest: Types.TableItemRequest = {
    key_type: tableType.keyType,
    value_type: tableType.valueType,
    key: key,
  };

  try {
    // fetch table item (it's an object with the schema structure)
    const tableItem = await client.getTableItem(
      handle,
      getTokenTableItemRequest
    );
    return tableItem?.data;
  } catch (e) {
    console.log(e);
    return;
  }
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
    readonly eventOwnerStruct: string,
    readonly eventHandlerName: string,
    readonly pollIntervalMs: number = 1000
  ) {}

  async onTrigger(callback: EventCallback) {
    // Get the start sequence number in the EVENT STREAM, defaulting to the latest event.
    const [{ sequence_number }] = await this.client.getEventsByEventHandle(
      this.eventHandlerOwner,
      this.eventOwnerStruct,
      this.eventHandlerName,
      { limit: 1 }
    );

    // type for this is string for some reason
    let lastSequenceNumber = sequence_number;

    this.intervalId = setInterval(async () => {
      const events = await this.client.getEventsByEventHandle(
        this.eventHandlerOwner,
        this.eventOwnerStruct,
        this.eventHandlerName,
        {
          start: Number(lastSequenceNumber) + 1,
          limit: 500,
        }
      );
      if (events.length !== 0) {
        // increment sequence number
        lastSequenceNumber = events.at(-1)!.sequence_number;
      }
      for (let e of events) {
        // fire off the callback for all new events
        await callback(e);
      }
    }, this.pollIntervalMs);
  }

  stop() {
    clearInterval(this.intervalId);
  }
}

/**
 * Common Constructor
 */
class SwitchboardResource {
  client: AptosClient;
  address: MaybeHexString;
  tableType: TableType;
  account?: AptosAccount;

  constructor(
    tableType: TableType,
    client: AptosClient,
    address: MaybeHexString,
    account?: AptosAccount
  ) {
    this.tableType = tableType;
    this.client = client;
    this.account = account;
    this.address = address;
  }

  // try to load data from on-chain
  async loadData(): Promise<unknown | undefined> {
    return await getTableItem(
      this.client,
      this.tableType,
      HexString.ensure(this.address).hex()
    );
  }
}

export class State {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly account: AptosAccount
  ) {}

  static async init(
    client: AptosClient,
    account: AptosAccount
  ): Promise<[State, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${SWITCHBOARD_DEVNET_ADDRESS}::SwitchboardInitAction::run`,
      []
    );

    return [new State(client, account.address(), account), tx];
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        this.address,
        `${SWITCHBOARD_STATE_ADDRESS}::Switchboard::State`
      )
    ).data;
  }
}

export class Aggregator {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly account?: AptosAccount
  ) {}

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${HexString.ensure(
          SWITCHBOARD_DEVNET_ADDRESS
        ).hex()}::Aggregator::Aggregator`
      )
    ).data;
  }

  async loadJobs(): Promise<Array<sbv2.OracleJob>> {
    const data = await this.loadData();
    const jobs = data.job_keys.map((key: string) => new Job(this.client, key));
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
    params: AggregatorInitParams
  ): Promise<[Aggregator, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${SWITCHBOARD_DEVNET_ADDRESS}::AggregatorInitAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        Buffer.from(params.name ?? "").toString("hex"),
        Buffer.from(params.metadata ?? "").toString("hex"),
        params.queueAddress
          ? HexString.ensure(params.queueAddress).hex()
          : HexString.ensure("0x0").hex(),
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
      ]
    );

    return [new Aggregator(client, params.address, account), tx];
  }

  async addJob(
    account: AptosAccount,
    params: AggregatorAddJobParams
  ): Promise<string> {
    return await sendAptosTx(
      this.client,
      account,
      `${SWITCHBOARD_DEVNET_ADDRESS}::AggregatorAddJobAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
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
      `${SWITCHBOARD_DEVNET_ADDRESS}::AggregatorSaveResultAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        HexString.ensure(params.oracle_address).hex(),
        HexString.ensure(this.address).hex(),
        params.oracle_idx.toString(),
        params.error,
        params.value_num.toString(),
        params.value_scale_factor,
        params.value_neg,
        stringToHex(params.jobs_checksum),
      ]
    );
  }

  async openRound(): Promise<string> {
    if (!this.account) {
      throw "Save Result Error: No Payer Found";
    }

    return await sendAptosTx(
      this.client,
      this.account,
      `${SWITCHBOARD_DEVNET_ADDRESS}::AggregatorOpenRoundAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        HexString.ensure(this.address).hex(),
      ]
    );
  }
}

export class Job {
  constructor(readonly client: AptosClient, readonly address: MaybeHexString) {}

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        this.address,
        `0x${SWITCHBOARD_DEVNET_ADDRESS}::Job::Job`
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
   * Initialize a Job stored in the switchboard resource account
   * @param client
   * @param account
   * @param params JobInitParams initialization params
   */
  static async init(
    client: AptosClient,
    account: AptosAccount,
    params: JobInitParams
  ): Promise<[Job, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${SWITCHBOARD_DEVNET_ADDRESS}::JobInitAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        stringToHex(params.name),
        stringToHex(params.metadata),
        HexString.ensure(params.authority).hex(),
        params.data,
      ]
    );

    return [new Job(client, account.address()), tx];
  }
}

export class Crank {
  constructor(readonly client: AptosClient, readonly address: MaybeHexString) {}

  /**
   * Initialize a Crank stored in the switchboard resource account
   * @param client
   * @param account account that will be the authority of the Crank
   * @param params CrankInitParams initialization params
   */
  static async init(
    client: AptosClient,
    account: AptosAccount,
    params: CrankInitParams
  ): Promise<[Crank, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${SWITCHBOARD_DEVNET_ADDRESS}::CrankInitAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        HexString.ensure(params.address).hex(),
        HexString.ensure(params.queueAddress).hex(),
      ]
    );

    return [new Crank(client, params.address), tx];
  }

  /**
   * Push an aggregator to a Crank
   * @param params CrankPushParams
   */
  async push(account: AptosAccount, params: CrankPushParams): Promise<string> {
    return await sendAptosTx(
      this.client,
      account,
      `${SWITCHBOARD_DEVNET_ADDRESS}::CrankPushAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        HexString.ensure(params.crankAddress).hex(),
        HexString.ensure(params.aggregatorAddress).hex(),
      ]
    );
  }

  /**
   * Pop an aggregator off the Crank
   * @param params CrankPopParams
   */
  async pop(account: AptosAccount, params: CrankPopParams): Promise<string> {
    return await sendAptosTx(
      this.client,
      account,
      `${SWITCHBOARD_DEVNET_ADDRESS}::CrankPopAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        HexString.ensure(params.crankAddress).hex(),
      ]
    );
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${HexString.ensure(SWITCHBOARD_DEVNET_ADDRESS).hex()}::Crank::Crank`
      )
    ).data;
  }
}

export class Oracle {
  constructor(readonly client: AptosClient, readonly address: MaybeHexString) {}

  /**
   * Initialize a Oracle stored in the switchboard resource account
   * @param client
   * @param account
   * @param params Oracle initialization params
   */
  static async init(
    client: AptosClient,
    account: AptosAccount,
    params: OracleInitParams
  ): Promise<[Oracle, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${SWITCHBOARD_DEVNET_ADDRESS}::OracleInitAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        stringToHex(params.name),
        stringToHex(params.metadata),
        HexString.ensure(params.authority).hex(),
        HexString.ensure(params.queue).hex(),
      ]
    );

    return [new Oracle(client, params.address), tx];
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${HexString.ensure(SWITCHBOARD_DEVNET_ADDRESS).hex()}::Oracle::Oracle`
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
      `${SWITCHBOARD_DEVNET_ADDRESS}::OracleHeartbeatAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        HexString.ensure(this.address).hex(),
      ]
    );
  }
}

export class OracleQueue {
  constructor(readonly client: AptosClient, readonly address: MaybeHexString) {}

  /**
   * Initialize a OracleQueue stored in the switchboard resource account
   * @param client
   * @param account
   * @param params OracleQueue initialization params
   */
  static async init(
    client: AptosClient,
    account: AptosAccount,
    params: OracleQueueInitParams
  ): Promise<[OracleQueue, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${SWITCHBOARD_DEVNET_ADDRESS}::OracleQueueInitAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
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
      ]
    );

    return [new OracleQueue(client, account.address()), tx];
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${HexString.ensure(
          SWITCHBOARD_DEVNET_ADDRESS
        ).hex()}::OracleQueue::OracleQueue`
      )
    ).data;
  }
}
