import {
  AptosClient,
  AptosAccount,
  HexString,
  MaybeHexString,
  FaucetClient,
} from "aptos";
import { MoveStructTag, ScriptFunctionId } from "aptos/src/generated";
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

export interface AggregatorAddJobParams {
  job: MaybeHexString;
  weight?: number;
}

export interface AggregatorInitParams {
  authority: MaybeHexString; // owner of aggregator
  name?: string;
  metadata?: string;
  queueAddress: MaybeHexString;
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
  method: ScriptFunctionId,
  args: Array<any>,
  retryCount = 2
): Promise<string> {
  const full_method = `${method.module.address}::${method.module.name}::${method.name}`;
  const payload = {
    type: "script_function_payload",
    function: method,
    type_arguments: [],
    arguments: args,
  };
  const txnRequest = await client.generateTransaction(
    signer.address(),
    payload
  );

  const simulation = (await client.simulateTransaction(signer, txnRequest))[0];
  if (simulation.vm_status === "Out of gas") {
    if (retryCount > 0) {
      const faucetClient = new FaucetClient(
        "https://fullnode.devnet.aptoslabs.com/v1",
        "https://faucet.devnet.aptoslabs.com"
      );
      await faucetClient.fundAccount(signer.address(), 5000);
      return sendAptosTx(client, signer, method, args, --retryCount);
    }
  }
  if (simulation.success === false) {
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
// async function getTableItem(
// client: AptosClient,
// tableType: TableType,
// key: string
// ): Promise<unknown | undefined> {
// // get table resource
// const switchboardTableResource = await client.getAccountResource(
// SWITCHBOARD_STATE_ADDRESS,
// `${SWITCHBOARD_DEVNET_ADDRESS}::Switchboard::State`
// );
//
// const handle = (switchboardTableResource.data as any)[tableType.stateKey]
// ?.handle;
//
// const getTokenTableItemRequest = {
// key_type: tableType.keyType,
// value_type: tableType.valueType,
// key: key,
// };
//
// try {
// // fetch table item (it's an object with the schema structure)
// const tableItem = await client.getTableItem(
// handle,
// getTokenTableItemRequest
// );
// return tableItem?.data;
// } catch (e) {
// console.log(e);
// return;
// }
// }

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
  // async loadData(): Promise<unknown | undefined> {
  // return await getTableItem(
  // this.client,
  // this.tableType,
  // HexString.ensure(this.address).hex()
  // );
  // }
}

export class State {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly account: AptosAccount,
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
      {
        module: {
          address: HexString.ensure(devnetAddress).hex(),
          name: "SwitchboardInitAction",
        },
        name: "run",
      },
      []
    );

    return [new State(client, account.address(), account, devnetAddress), tx];
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(this.address, {
        address: HexString.ensure(this.devnetAddress).hex(),
        module: "Switchboard",
        name: "State",
        generic_type_params: [],
      })
    ).data;
  }
}

export class Aggregator {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly account: AptosAccount,
    readonly devnetAddress: MaybeHexString,
    readonly stateAddress: MaybeHexString
  ) {}

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        {
          address: HexString.ensure(this.devnetAddress).hex(),
          module: "Aggregator",
          name: "Aggregator",
          generic_type_params: [],
        }
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
      {
        module: {
          address: HexString.ensure(devnetAddress).hex(),
          name: "AggregatorInitAction",
        },
        name: "run",
      },
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
      ]
    );

    return [
      new Aggregator(
        client,
        account.address(),
        account,
        devnetAddress,
        stateAddress
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
      {
        module: {
          address: HexString.ensure(this.devnetAddress).hex(),
          name: "AggregatorAddJobAction",
        },
        name: "run",
      },
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
      {
        module: {
          address: HexString.ensure(this.devnetAddress).hex(),
          name: "AggregatorSaveResultAction",
        },
        name: "run",
      },
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
      {
        module: {
          address: HexString.ensure(this.devnetAddress).hex(),
          name: "AggregatorOpenRoundAction",
        },
        name: "run",
      },
      [
        HexString.ensure(this.stateAddress).hex(),
        HexString.ensure(this.address).hex(),
      ]
    );
  }

  async watch(callback: EventCallback): Promise<AptosEvent> {
    const event = new AptosEvent(
      this.client,
      HexString.ensure(`${this.devnetAddress}::Switchboard::State`),
      {
        address: HexString.ensure(this.devnetAddress).hex(),
        module: "Switchboard",
        name: "State",
        generic_type_params: [],
      },
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
      await this.client.getAccountResource(this.address, {
        address: HexString.ensure(this.devnetAddress).hex(),
        module: "Job",
        name: "Job",
        generic_type_params: [],
      })
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
    params: JobInitParams,
    devnetAddress: MaybeHexString,
    stateAddress: MaybeHexString
  ): Promise<[Job, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      {
        module: {
          address: HexString.ensure(devnetAddress).hex(),
          name: "JobInitAction",
        },
        name: "run",
      },
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
    readonly stateAddress: MaybeHexString
  ) {}

  /**
   * Initialize a Crank stored in the switchboard resource account
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
      {
        module: {
          address: HexString.ensure(devnetAddress).hex(),
          name: "CrankInitAction",
        },
        name: "run",
      },
      [
        HexString.ensure(stateAddress).hex(),
        HexString.ensure(params.address).hex(),
        HexString.ensure(params.queueAddress).hex(),
      ]
    );

    return [
      new Crank(client, account.address(), devnetAddress, stateAddress),
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
      {
        module: {
          address: HexString.ensure(this.devnetAddress).hex(),
          name: "CrankPushAction",
        },
        name: "run",
      },
      [
        HexString.ensure(this.stateAddress).hex(),
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
      {
        module: {
          address: HexString.ensure(this.devnetAddress).hex(),
          name: "CrankPopAction",
        },
        name: "run",
      },
      [
        HexString.ensure(this.stateAddress).hex(),
        HexString.ensure(params.crankAddress).hex(),
      ]
    );
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        {
          address: HexString.ensure(this.devnetAddress).hex(),
          module: "Crank",
          name: "Crank",
          generic_type_params: [],
        }
      )
    ).data;
  }
}

export class Oracle {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly devnetAddress: MaybeHexString,
    readonly stateAddress: MaybeHexString
  ) {}

  /**
   * Initialize a Oracle stored in the switchboard resource account
   * @param client
   * @param account
   * @param params Oracle initialization params
   */
  static async init(
    client: AptosClient,
    account: AptosAccount,
    params: OracleInitParams,
    devnetAddress,
    stateAddress
  ): Promise<[Oracle, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      {
        module: {
          address: HexString.ensure(devnetAddress).hex(),
          name: "OracleInitAction",
        },
        name: "run",
      },
      [
        HexString.ensure(stateAddress).hex(),
        stringToHex(params.name),
        stringToHex(params.metadata),
        HexString.ensure(params.authority).hex(),
        HexString.ensure(params.queue).hex(),
      ]
    );

    return [
      new Oracle(client, account.address(), devnetAddress, stateAddress),
      tx,
    ];
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${this.devnetAddress}::Oracle::Oracle` as any
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
      {
        module: {
          address: HexString.ensure(this.devnetAddress).hex(),
          name: "OracleHeartbeatAction",
        },
        name: "run",
      },
      [
        HexString.ensure(this.stateAddress).hex(),
        HexString.ensure(this.address).hex(),
      ]
    );
  }
}

export class OracleQueue {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly devnetAddress: MaybeHexString,
    readonly stateAddress: MaybeHexString
  ) {}

  /**
   * Initialize a OracleQueue stored in the switchboard resource account
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
      {
        module: { address: devnetAddress, name: "OracleQueueInitAction" },
        name: "run",
      },
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
      ]
    );

    return [
      new OracleQueue(client, account.address(), devnetAddress, stateAddress),
      tx,
    ];
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        {
          address: HexString.ensure(this.devnetAddress).hex(),
          module: "OracleQueue",
          name: "OracleQueue",
          generic_type_params: [],
        }
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
