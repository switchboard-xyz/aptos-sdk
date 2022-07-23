import {
  AptosClient,
  AptosAccount,
  Types,
  HexString,
  MaybeHexString,
} from "aptos";
import Big from "big.js";

// Address that deployed the module
const SWITCHBOARD_DEVNET_ADDRESS =
  "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";

// Address of the account that owns the Switchboard resource
const SWITCHBOARD_STATE_ADDRESS =
  "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";

export class AptosDecimal {
  constructor(
    readonly mantissa: string,
    readonly scale: number,
    readonly neg: boolean
  ) {}

  toBig(): Big {
    let result = new Big(this.mantissa);
    if (this.neg === true) {
      result = result.mul(-1);
    }
    const TEN = new Big(10);
    return result.div(TEN.pow(this.scale));
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
  address: MaybeHexString;
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
  curatorRewardCutValue: number;
  curatorRewardCutScale: number;
  lockLeaseFunding: boolean;

  // this needs to be swapped with Coin or something later
  mint: MaybeHexString;
  enableBufferRelayers: boolean;
  maxSize: number;
}

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

const JobTable: TableType = {
  stateKey: `jobs`,
  keyType: `address`,
  valueType: `${SWITCHBOARD_DEVNET_ADDRESS}::Job::Job`,
};

const CrankTable: TableType = {
  stateKey: `cranks`,
  keyType: `address`,
  valueType: `${SWITCHBOARD_DEVNET_ADDRESS}::Crank::Crank`,
};

const OracleTable: TableType = {
  stateKey: `oracles`,
  keyType: `address`,
  valueType: `${SWITCHBOARD_DEVNET_ADDRESS}::Oracle::Oracle`,
};

const OracleQueueTable: TableType = {
  stateKey: `oracle_queues`,
  keyType: `address`,
  valueType: `${SWITCHBOARD_DEVNET_ADDRESS}::OracleQueue::OracleQueue`,
};

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
export class EventPoller {
  client: AptosClient;
  cb: (event: Types.Event) => void; // some effect will happen on event
  address: MaybeHexString;
  eventHandleStruct: Types.MoveStructTagId;
  fieldName: string;
  pollingIntervalMs: number;
  lastSequenceNumber: string = "";
  intervalId?: ReturnType<typeof setInterval>;

  constructor(
    client: AptosClient,
    address: MaybeHexString,
    eventHandleStruct: Types.MoveStructTagId,
    fieldName: string,
    pollingIntervalMs: number = 5000,
    cb: (event: Types.Event) => void | (() => void) // sometimes you don't want args
  ) {
    this.client = client;
    this.cb = cb;
    this.address = address;
    this.eventHandleStruct = eventHandleStruct;
    this.fieldName = fieldName;
    this.pollingIntervalMs = pollingIntervalMs;
  }

  async start() {
    try {
      // Get the start sequence number in the EVENT STREAM, defaulting to the latest event.
      const [{ sequence_number }] = await this.client.getEventsByEventHandle(
        this.address,
        this.eventHandleStruct,
        this.fieldName,
        { limit: 1 }
      );
      this.lastSequenceNumber = sequence_number;
    } catch (e) {
      // type for this is string for some reason
      this.lastSequenceNumber = "0";
    }

    this.intervalId = setInterval(async () => {
      const events = await this.client.getEventsByEventHandle(
        this.address,
        this.eventHandleStruct,
        this.fieldName,
        {
          start: Number(this.lastSequenceNumber) + 1,
        }
      );
      for (let e of events) {
        // fire off cb if new sequence number
        if (Number(this.lastSequenceNumber) + 1 === Number(e.sequence_number)) {
          // increment sequence number
          this.lastSequenceNumber = e.sequence_number;

          // fire off the callback for all new events
          await this.cb(e);
        }
      }
    }, this.pollingIntervalMs);
  }

  stop() {
    clearInterval(this.intervalId);
  }
}

// Returns a started event poller for aggregator updates
export async function onAggregatorUpdate(
  client: AptosClient,
  cb: (e: Types.Event) => void
): Promise<EventPoller> {
  const poller = new EventPoller(
    client,
    SWITCHBOARD_STATE_ADDRESS,
    `${SWITCHBOARD_DEVNET_ADDRESS}::Switchboard::State`,
    "aggregator_update_events",
    1500,
    cb
  );

  await poller.start();
  return poller;
}

// Returns a started event poller for aggregator updates
export async function onAggregatorOpenRound(
  client: AptosClient,
  cb: (e: Types.Event) => void
): Promise<EventPoller> {
  const poller = new EventPoller(
    client,
    SWITCHBOARD_STATE_ADDRESS,
    `${SWITCHBOARD_DEVNET_ADDRESS}::Switchboard::State`,
    "aggregator_open_round_events",
    1500,
    cb
  );

  await poller.start();
  return poller;
}

// Returns a started event poller for aggregator updates
export async function onAggregatorSaveResult(
  client: AptosClient,
  cb: (e: Types.Event) => void
): Promise<EventPoller> {
  const poller = new EventPoller(
    client,
    SWITCHBOARD_STATE_ADDRESS,
    `${SWITCHBOARD_DEVNET_ADDRESS}::Switchboard::State`,
    "aggregator_save_result_events",
    1500,
    cb
  );

  await poller.start();
  return poller;
}

/**
 * Common Constructor
 */
class SwitchboardResource {
  client: AptosClient;
  address: MaybeHexString;
  tableType: TableType;
  payer?: AptosAccount;

  constructor(
    tableType: TableType,
    client: AptosClient,
    address: MaybeHexString,
    payer?: AptosAccount
  ) {
    this.tableType = tableType;
    this.client = client;
    this.payer = payer;
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
    readonly payer: AptosAccount
  ) {}

  static async init(
    client: AptosClient,
    payer: AptosAccount
  ): Promise<[string, State]> {
    const tx = await sendAptosTx(
      client,
      payer,
      `${SWITCHBOARD_DEVNET_ADDRESS}::SwitchboardInitAction::run`,
      []
    );

    return [tx, new State(client, payer.address(), payer)];
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
    readonly payer?: AptosAccount
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

  async loadJobs(): Promise<unknown[]> {
    const aggregatorData = await this.loadData();
    const jobs: unknown[] = [];
    for (let job of aggregatorData.job_keys) {
      jobs.push(
        (
          await this.client.getAccountResource(
            HexString.ensure(job).hex(),
            `${HexString.ensure(SWITCHBOARD_DEVNET_ADDRESS).hex()}::Job::Job`
          )
        ).data
      );
    }
    return jobs;
  }

  /**
   * Initialize an Aggregator
   * @param client
   * @param payer
   * @param params AggregatorInitParams initialization params
   */
  static async init(
    client: AptosClient,
    payer: AptosAccount,
    params: AggregatorInitParams
  ): Promise<[string, Aggregator]> {
    const tx = await sendAptosTx(
      client,
      payer,
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

    return [tx, new Aggregator(client, params.address, payer)];
  }

  async addJob(params: AggregatorAddJobParams): Promise<string> {
    if (!this.payer) {
      throw "Add Job Error: No Payer Found";
    }

    return await sendAptosTx(
      this.client,
      this.payer,
      `${SWITCHBOARD_DEVNET_ADDRESS}::AggregatorAddJobAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        HexString.ensure(this.address).hex(),
        HexString.ensure(params.job).hex(),
        params.weight || 0,
      ]
    );
  }

  async saveResult(params: AggregatorSaveResultParams): Promise<string> {
    if (!this.payer) {
      throw "Save Result Error: No Payer Found";
    }

    return await sendAptosTx(
      this.client,
      this.payer,
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
    if (!this.payer) {
      throw "Save Result Error: No Payer Found";
    }

    return await sendAptosTx(
      this.client,
      this.payer,
      `${SWITCHBOARD_DEVNET_ADDRESS}::AggregatorOpenRoundAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        HexString.ensure(this.address).hex(),
      ]
    );
  }
}

export class Job {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly payer?: AptosAccount
  ) {}

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${HexString.ensure(SWITCHBOARD_DEVNET_ADDRESS).hex()}::Job::Job`
      )
    ).data;
  }

  /**
   * Initialize a Job stored in the switchboard resource account
   * @param client
   * @param payer
   * @param params JobInitParams initialization params
   */
  static async init(
    client: AptosClient,
    payer: AptosAccount,
    params: JobInitParams
  ): Promise<[string, Job]> {
    const tx = await sendAptosTx(
      client,
      payer,
      `${SWITCHBOARD_DEVNET_ADDRESS}::JobInitAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        stringToHex(params.name),
        stringToHex(params.metadata),
        HexString.ensure(params.authority).hex(),
        params.data,
      ]
    );

    return [tx, new Job(client, payer.address(), payer)];
  }
}

export class Crank extends SwitchboardResource {
  constructor(
    client: AptosClient,
    address: MaybeHexString,
    payer?: AptosAccount
  ) {
    super(CrankTable, client, address, payer);
  }

  /**
   * Initialize a Crank stored in the switchboard resource account
   * @param client
   * @param payer account that will be the authority of the Crank
   * @param params CrankInitParams initialization params
   */
  static async init(
    client: AptosClient,
    payer: AptosAccount,
    params: CrankInitParams
  ): Promise<[string, Crank]> {
    const tx = await sendAptosTx(
      client,
      payer,
      `${SWITCHBOARD_DEVNET_ADDRESS}::CrankInitAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        HexString.ensure(params.address).hex(),
        HexString.ensure(params.queueAddress).hex(),
      ]
    );

    return [tx, new Crank(client, params.address, payer)];
  }

  /**
   * Push an aggregator to a Crank
   * @param params CrankPushParams
   */
  async push(params: CrankPushParams): Promise<string> {
    if (!this.payer) {
      throw "Save Result Error: No Payer Found";
    }

    return await sendAptosTx(
      this.client,
      this.payer,
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
  async pop(params: CrankPopParams): Promise<string> {
    if (!this.payer) {
      throw "Save Result Error: No Payer Found";
    }

    return await sendAptosTx(
      this.client,
      this.payer,
      `${SWITCHBOARD_DEVNET_ADDRESS}::CrankPopAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        HexString.ensure(params.crankAddress).hex(),
      ]
    );
  }
}

export class Oracle extends SwitchboardResource {
  constructor(
    client: AptosClient,
    address: MaybeHexString,
    payer?: AptosAccount
  ) {
    super(OracleTable, client, address, payer);
  }

  /**
   * Initialize a Oracle stored in the switchboard resource account
   * @param client
   * @param payer
   * @param params Oracle initialization params
   */
  static async init(
    client: AptosClient,
    payer: AptosAccount,
    params: OracleInitParams
  ): Promise<[string, Oracle]> {
    const tx = await sendAptosTx(
      client,
      payer,
      `${SWITCHBOARD_DEVNET_ADDRESS}::OracleInitAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        stringToHex(params.name),
        stringToHex(params.metadata),
        HexString.ensure(params.authority).hex(),
        HexString.ensure(params.queue).hex(),
      ]
    );

    return [tx, new Oracle(client, params.address, payer)];
  }

  /**
   * Oracle Heartbeat Action
   */
  async heartbeat(): Promise<string> {
    if (!this.payer) {
      throw "Save Result Error: No Payer Found";
    }

    return await sendAptosTx(
      this.client,
      this.payer,
      `${SWITCHBOARD_DEVNET_ADDRESS}::OracleHeartbeatAction::run`,
      [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        HexString.ensure(this.address).hex(),
      ]
    );
  }
}

export class OracleQueue extends SwitchboardResource {
  constructor(
    client: AptosClient,
    address: MaybeHexString,
    payer?: AptosAccount
  ) {
    super(OracleQueueTable, client, address, payer);
  }

  /**
   * Initialize a OracleQueue stored in the switchboard resource account
   * @param client
   * @param payer
   * @param params OracleQueue initialization params
   */
  static async init(
    client: AptosClient,
    payer: AptosAccount,
    params: OracleQueueInitParams
  ): Promise<[string, OracleQueue]> {
    const tx = await sendAptosTx(
      client,
      payer,
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
        params.curatorRewardCutValue.toString(),
        params.curatorRewardCutScale,
        params.lockLeaseFunding,
        HexString.ensure(params.mint).hex(),
        params.enableBufferRelayers,
        params.maxSize.toString(),
      ]
    );

    return [tx, new OracleQueue(client, params.address, payer)];
  }
}
