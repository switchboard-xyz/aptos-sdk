import {
  AptosClient,
  AptosAccount,
  HexString,
  MaybeHexString,
  FaucetClient,
  BCS,
  TxnBuilderTypes,
  Types,
} from "aptos";
import { MoveStructTag, EntryFunctionId } from "aptos/src/generated";
import Big from "big.js";
import { OracleJob } from "@switchboard-xyz/common";
import BN from "bn.js";
import * as SHA3 from "js-sha3";

export { OracleJob, IOracleJob } from "@switchboard-xyz/common";

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
  varianceThreshold?: Big;
  forceReportPeriod?: number;
  expiration?: number;
  disableCrank?: boolean;
  historySize?: number;
  readCharge?: number;
  rewardEscrow?: string;
  gasPrice?: number;
  gasPriceFeed?: string;
}

export interface AggregatorSaveResultParams {
  oracleAddress: MaybeHexString;
  oracleIdx: number;
  error: boolean;
  // this should probably be automatically generated
  value: Big;
  jobsChecksum: string;
  minResponse: Big;
  maxResponse: Big;
}

export interface JobInitParams {
  name: string;
  metadata: string;
  authority: MaybeHexString;
  data: string;
  weight?: number;
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
  varianceThreshold?: Big;
  forceReportPeriod?: number;
  expiration?: number;
  disableCrank: boolean;
  historySize: number;
  readCharge: number;
  rewardEscrow: string;
  gasPrice?: number;
  gasPriceFeed?: string;
  coinType?: string;
}

export interface CrankInitParams {
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
  gasPrice?: number;

  // this needs to be swapped with Coin or something later
  enableBufferRelayers: boolean;
  maxSize: number;
  coinType: MoveStructTag;
}

export interface OracleQueueSetConfigsParams {
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
  gasPrice?: number;

  // this needs to be swapped with Coin or something later
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
  granter: MaybeHexString;
  grantee: MaybeHexString;
  permission: SwitchboardPermission;
  enable: boolean;
}

export type EventCallback = (
  e: any
) => Promise<void> /** | (() => Promise<void>) */;

/**
 * Sends and waits for an aptos tx to be confirmed
 * @param client
 * @param signer
 * @param method Aptos module method (ex: 0xSwitchboard::aggregator_add_job_action)
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
    throw new Error(`TxFailure: ${simulation.vm_status}`);
  }

  const signedTxn = await client.signTransaction(signer, txnRequest);
  const transactionRes = await client.submitTransaction(signedTxn);
  await client.waitForTransaction(transactionRes.hash);
  return transactionRes.hash;
}

/**
 * Generates an aptos tx for client
 * @param method Aptos module method (ex: 0xSwitchboard::aggregator_add_job_action)
 * @param args Arguments for method (converts numbers to strings)
 * @param type_args Arguments for type_args
 * @returns
 */
export function getAptosTx(
  method: EntryFunctionId,
  args: Array<any>,
  type_args: Array<string> = []
): Types.TransactionPayload {
  const payload: Types.TransactionPayload = {
    type: "entry_function_payload",
    function: method,
    type_arguments: type_args,
    arguments: args,
  };
  return payload;
}

export async function simulateAndRun(
  client: AptosClient,
  user: AptosAccount,
  txn: Types.TransactionPayload
) {
  const txnRequest = await client.generateTransaction(
    user.address(),
    txn as Types.EntryFunctionPayload,
    { max_gas_amount: "5000" }
  );

  const simulation = (await client.simulateTransaction(user, txnRequest))[0];
  if (simulation.success === false) {
    console.log(simulation);
    throw new Error(`TxFailure: ${simulation.vm_status}`);
  }

  const signedTxn = await client.signTransaction(user, txnRequest);
  const transactionRes = await client.submitTransaction(signedTxn);
  await client.waitForTransaction(transactionRes.hash);
  return transactionRes.hash;
}

export async function sendRawAptosTx(
  client: AptosClient,
  signer: AptosAccount,
  method: EntryFunctionId,
  raw_args: Array<any>,
  raw_type_args: BCS.Seq<TxnBuilderTypes.TypeTag> = [],
  retryCount = 2
): Promise<string> {
  // We need to pass a token type to the `transfer` function.

  const methodInfo = method.split("::");
  const entryFunctionPayload =
    new TxnBuilderTypes.TransactionPayloadEntryFunction(
      TxnBuilderTypes.EntryFunction.natural(
        // Fully qualified module name, `AccountAddress::ModuleName`
        `${methodInfo[0]}::${methodInfo[1]}`,
        // Module function
        methodInfo[2],
        // The coin type to transfer
        raw_type_args,
        // Arguments for function `transfer`: receiver account address and amount to transfer
        raw_args
      )
    );

  const rawTxn = await client.generateRawTransaction(
    signer.address(),
    entryFunctionPayload,
    { maxGasAmount: BigInt(5000) }
  );

  const bcsTxn = AptosClient.generateBCSTransaction(signer, rawTxn);

  const simulation = (await client.simulateTransaction(signer, rawTxn))[0];
  if (simulation.vm_status === "Out of gas") {
    if (retryCount > 0) {
      const faucetClient = new FaucetClient(
        "https://fullnode.devnet.aptoslabs.com/v1",
        "https://faucet.devnet.aptoslabs.com"
      );
      await faucetClient.fundAccount(signer.address(), 5000);
      return sendRawAptosTx(
        client,
        signer,
        method,
        raw_args,
        raw_type_args,
        --retryCount
      );
    }
  }
  if (simulation.success === false) {
    console.log(simulation);
    throw new Error(`TxFailure: ${simulation.vm_status}`);
  }

  const transactionRes = await client.submitSignedBCSTransaction(bcsTxn);
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
      this.eventHandlerOwner.hex(),
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

export class StateAccount {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly payer: AptosAccount,
    readonly switchboardAddress: MaybeHexString
  ) {}

  static async init(
    client: AptosClient,
    account: AptosAccount,
    switchboardAddress: MaybeHexString
  ): Promise<[StateAccount, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${switchboardAddress}::switchboard_init_action::run`,
      []
    );

    return [
      new StateAccount(client, account.address(), account, switchboardAddress),
      tx,
    ];
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        this.address,
        `${this.switchboardAddress}::switchboard::State`
      )
    ).data;
  }
}

export class AggregatorAccount {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly switchboardAddress: MaybeHexString,
    readonly coinType: MoveStructTag = "0x1::aptos_coin::AptosCoin"
  ) {}

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${this.switchboardAddress}::aggregator::Aggregator`
      )
    ).data;
  }

  async loadJobs(): Promise<Array<OracleJob>> {
    const data = await this.loadData();
    const jobs = data.job_keys.map(
      (key: string) =>
        new JobAccount(
          this.client,
          HexString.ensure(key).hex(),
          HexString.ensure(this.switchboardAddress).hex()
        )
    );
    const promises: Array<Promise<OracleJob>> = [];
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
    switchboardAddress: MaybeHexString
  ): Promise<[AggregatorAccount, string]> {
    const { mantissa: vtMantissa, scale: vtScale } = AptosDecimal.fromBig(
      params.varianceThreshold ?? new Big(0)
    );

    const tx = await sendAptosTx(
      client,
      account,
      `${switchboardAddress}::aggregator_init_action::run`,
      [
        params.name ?? "",
        params.metadata ?? "",
        HexString.ensure(params.queueAddress).hex(),
        params.batchSize,
        params.minOracleResults,
        params.minJobResults,
        params.minUpdateDelaySeconds,
        params.startAfter ?? 0,
        Number(vtMantissa),
        Number(vtScale),
        params.forceReportPeriod ?? 0,
        params.expiration ?? 0,
        params.disableCrank ?? false,
        params.historySize ?? 0,
        params.readCharge ?? 0,
        params.rewardEscrow
          ? HexString.ensure(params.rewardEscrow).hex()
          : account.address().hex(),
        params.gasPrice ?? 0,
        params.gasPriceFeed
          ? HexString.ensure(params.gasPriceFeed).hex()
          : "0x0",
        HexString.ensure(params.authority).hex(),
      ],
      [params.coinType ?? "0x1::aptos_coin::AptosCoin"]
    );

    return [
      new AggregatorAccount(
        client,
        account.address(),
        switchboardAddress,
        params.coinType ?? "0x1::aptos_coin::AptosCoin"
      ),
      tx,
    ];
  }

  async latestValue(): Promise<number> {
    const data = await this.loadData();
    return new AptosDecimal(
      data.latest_confirmed_round.result.value,
      9,
      Boolean(data.latest_confirmed_round.result.neg)
    )
      .toBig()
      .toNumber();
  }

  async addJob(
    account: AptosAccount,
    params: AggregatorAddJobParams
  ): Promise<string> {
    return await sendAptosTx(
      this.client,
      account,
      `${this.switchboardAddress}::aggregator_add_job_action::run`,
      [
        HexString.ensure(this.address).hex(),
        HexString.ensure(params.job).hex(),
        params.weight || 1,
      ]
    );
  }

  addJobTx(params: AggregatorAddJobParams): Types.TransactionPayload {
    return getAptosTx(
      `${this.switchboardAddress}::aggregator_add_job_action::run`,
      [
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
    const {
      mantissa: valueMantissa,
      scale: valueScale,
      neg: valueNeg,
    } = AptosDecimal.fromBig(params.value);
    const {
      mantissa: minResponseMantissa,
      scale: minResponseScale,
      neg: minResponseNeg,
    } = AptosDecimal.fromBig(params.minResponse);
    const {
      mantissa: maxResponseMantissa,
      scale: maxResponseScale,
      neg: maxResponseNeg,
    } = AptosDecimal.fromBig(params.maxResponse);

    return sendRawAptosTx(
      this.client,
      account,
      `${this.switchboardAddress}::aggregator_save_result_action::run`,
      [
        BCS.bcsToBytes(
          TxnBuilderTypes.AccountAddress.fromHex(params.oracleAddress)
        ),
        BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(this.address)),
        BCS.bcsSerializeUint64(params.oracleIdx),
        BCS.bcsSerializeBool(params.error),
        BCS.bcsSerializeU128(Number(valueMantissa)),
        BCS.bcsSerializeU8(valueScale),
        BCS.bcsSerializeBool(valueNeg),
        BCS.bcsSerializeBytes(
          HexString.ensure(params.jobsChecksum).toUint8Array()
        ),
        BCS.bcsSerializeU128(Number(minResponseMantissa)),
        BCS.bcsSerializeU8(minResponseScale),
        BCS.bcsSerializeBool(minResponseNeg),
        BCS.bcsSerializeU128(Number(maxResponseMantissa)),
        BCS.bcsSerializeU8(maxResponseScale),
        BCS.bcsSerializeBool(maxResponseNeg),
      ],
      [
        new TxnBuilderTypes.TypeTagStruct(
          TxnBuilderTypes.StructTag.fromString(
            this.coinType ?? "0x1::aptos_coin::AptosCoin"
          )
        ),
      ]
    );
  }

  async openRound(account: AptosAccount, jitter?: number): Promise<string> {
    return await sendAptosTx(
      this.client,
      account,
      `${this.switchboardAddress}::aggregator_open_round_action::run`,
      [HexString.ensure(this.address).hex(), jitter ?? 1],
      [this.coinType]
    );
  }

  openRoundTx(): Types.TransactionPayload {
    return getAptosTx(
      `${this.switchboardAddress}::aggregator_open_round_action::run`,
      [HexString.ensure(this.address).hex()],
      [this.coinType ?? "0x1::aptos_coin::AptosCoin"]
    );
  }

  setConfigTx(params: AggregatorSetConfigParams): Types.TransactionPayload {
    const { mantissa: vtMantissa, scale: vtScale } = AptosDecimal.fromBig(
      params.varianceThreshold ?? new Big(0)
    );
    const tx = getAptosTx(
      `${this.switchboardAddress}::aggregator_init_action::run`,
      [
        HexString.ensure(this.address).hex(),
        params.name ?? "",
        params.metadata ?? "",
        HexString.ensure(params.queueAddress).hex(),
        params.batchSize,
        params.minOracleResults,
        params.minJobResults,
        params.minUpdateDelaySeconds,
        params.startAfter ?? 0,
        Number(vtMantissa),
        vtScale,
        params.forceReportPeriod ?? 0,
        params.expiration ?? 0,
        params.disableCrank ?? false,
        params.historySize ?? 0,
        params.readCharge ?? 0,
        params.rewardEscrow
          ? HexString.ensure(params.rewardEscrow).hex()
          : HexString.ensure(params.authority).hex(),
        params.gasPrice ?? 0,
        params.gasPriceFeed
          ? HexString.ensure(params.gasPriceFeed).hex()
          : "0x0",
        params.authority,
      ],
      [params.coinType ?? "0x1::aptos_coin::AptosCoin"]
    );
    return tx;
  }

  async watch(callback: EventCallback): Promise<AptosEvent> {
    const event = new AptosEvent(
      this.client,
      HexString.ensure(this.switchboardAddress),
      `${this.switchboardAddress}::switchboard::State`,
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
    const timestamp = new BN(Math.round(Date.now() / 1000), 10);
    const startAfter = new BN(aggregator.startAfter, 10);
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
    const forceReportPeriod = new BN(aggregator.forceReportPeriod, 10);
    const lastTimestamp = new BN(
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

export class JobAccount {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly switchboardAddress: MaybeHexString
  ) {}

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        this.address,
        `${HexString.ensure(this.switchboardAddress).hex()}::job::Job`
      )
    ).data;
  }

  async loadJob(): Promise<OracleJob> {
    const data = await this.loadData();

    // on-chain hex encoded base64 -> base64 -> Uint8Array -> OracleJob
    const job = OracleJob.decodeDelimited(
      Buffer.from(Buffer.from(data.data.slice(2), "hex").toString(), "base64")
    );
    return job;
  }

  /**
   * Initialize a JobAccount
   * @param client
   * @param account
   * @param params JobInitParams initialization params
   */
  static async init(
    client: AptosClient,
    account: AptosAccount,
    params: JobInitParams,
    switchboardAddress: MaybeHexString
  ): Promise<[JobAccount, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${switchboardAddress}::job_init_action::run`,
      [
        params.name,
        params.metadata,
        HexString.ensure(params.authority).hex(),
        params.data,
      ]
    );

    return [new JobAccount(client, account.address(), switchboardAddress), tx];
  }

  /**
   * Initialize a JobAccount
   * @param client
   * @param account
   * @param params JobInitParams initialization params
   */
  static initTx(
    client: AptosClient,
    account: MaybeHexString,
    params: JobInitParams,
    switchboardAddress: MaybeHexString
  ): [JobAccount, Types.TransactionPayload] {
    const tx = getAptosTx(`${switchboardAddress}::job_init_action::run`, [
      params.name,
      params.metadata,
      HexString.ensure(params.authority).hex(),
      params.data,
    ]);

    return [new JobAccount(client, account, switchboardAddress), tx];
  }
}

export class CrankAccount {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly switchboardAddress: MaybeHexString,
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
    switchboardAddress: MaybeHexString
  ): Promise<[CrankAccount, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${switchboardAddress}::crank_init_action::run`,
      [HexString.ensure(params.queueAddress).hex()],
      [params.coinType ?? "0x1::aptos_coin::AptosCoin"]
    );

    return [
      new CrankAccount(
        client,
        account.address(),
        switchboardAddress,
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
      `${this.switchboardAddress}::crank_push_action::run`,
      [
        HexString.ensure(this.address).hex(),
        HexString.ensure(params.aggregatorAddress).hex(),
      ],
      [this.coinType ?? "0x1::aptos_coin::AptosCoin"]
    );
  }

  pushTx(
    account: MaybeHexString,
    params: CrankPushParams
  ): Types.TransactionPayload {
    return getAptosTx(
      `${this.switchboardAddress}::crank_push_action::run`,
      [
        HexString.ensure(this.address).hex(),
        HexString.ensure(params.aggregatorAddress).hex(),
      ],
      [this.coinType ?? "0x1::aptos_coin::AptosCoin"]
    );
  }

  /**
   * Pop an aggregator off the Crank
   */
  async pop(account: AptosAccount): Promise<string> {
    return await sendAptosTx(
      this.client,
      account,
      `${this.switchboardAddress}::crank_pop_action::run`,
      [HexString.ensure(this.address).hex()],
      [this.coinType]
    );
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${this.switchboardAddress}::crank::Crank`
      )
    ).data;
  }
}

export class OracleAccount {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly switchboardAddress: MaybeHexString,
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
    switchboardAddress: MaybeHexString
  ): Promise<[OracleAccount, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${switchboardAddress}::oracle_init_action::run`,
      [
        params.name,
        params.metadata,
        HexString.ensure(params.authority).hex(),
        HexString.ensure(params.queue).hex(),
      ],
      [params.coinType ?? "0x1::aptos_coin::AptosCoin"]
    );

    return [
      new OracleAccount(
        client,
        account.address(),
        switchboardAddress,
        params.coinType ?? "0x1::aptos_coin::AptosCoin"
      ),
      tx,
    ];
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${this.switchboardAddress}::oracle::Oracle`
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
      `${this.switchboardAddress}::oracle_heartbeat_action::run`,
      [HexString.ensure(this.address).hex()],
      [this.coinType]
    );
  }
}

export class OracleQueueAccount {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly switchboardAddress: MaybeHexString,
    readonly coinType: MoveStructTag = "0x1::aptos_coin::AptosCoin"
  ) {}

  /**
   * Initialize an OracleQueueAccount
   * @param client
   * @param account
   * @param params OracleQueueAccount initialization params
   */
  static async init(
    client: AptosClient,
    account: AptosAccount,
    params: OracleQueueInitParams,
    switchboardAddress: MaybeHexString
  ): Promise<[OracleQueueAccount, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${switchboardAddress}::oracle_queue_init_action::run`,
      [
        params.name,
        params.metadata,
        HexString.ensure(params.authority).hex(),
        params.oracleTimeout,
        params.reward,
        params.minStake,
        params.slashingEnabled,
        params.varianceToleranceMultiplierValue,
        params.varianceToleranceMultiplierScale,
        params.feedProbationPeriod,
        params.consecutiveFeedFailureLimit,
        params.consecutiveOracleFailureLimit,
        params.unpermissionedFeedsEnabled,
        params.unpermissionedVrfEnabled,
        params.lockLeaseFunding,
        params.enableBufferRelayers,
        params.maxSize,
        params.gasPrice ?? 0,
      ],
      [params.coinType ?? "0x1::aptos_coin::AptosCoin"]
    );

    return [
      new OracleQueueAccount(
        client,
        account.address(),
        switchboardAddress,
        params.coinType ?? "0x1::aptos_coin::AptosCoin"
      ),
      tx,
    ];
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${this.switchboardAddress}::oracle_queue::OracleQueue<${this.coinType}>`
      )
    ).data;
  }
}

export class LeaseAccount {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly switchboardAddress: MaybeHexString,
    readonly coinType: MoveStructTag = "0x1::aptos_coin::AptosCoin"
  ) {}

  /**
   * Initialize a LeaseAccount
   * @param client
   * @param account account that will be the authority of the LeaseAccount
   * @param params LeaseInitParams initialization params
   */
  static async init(
    client: AptosClient,
    account: AptosAccount,
    params: LeaseInitParams,
    switchboardAddress: MaybeHexString
  ): Promise<[LeaseAccount, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${switchboardAddress}::lease_init_action::run`,
      [
        HexString.ensure(params.queueAddress).hex(),
        HexString.ensure(params.withdrawAuthority).hex(),
        params.initialAmount,
      ],
      [params.coinType ?? "0x1::aptos_coin::AptosCoin"]
    );

    return [
      new LeaseAccount(
        client,
        account.address(),
        switchboardAddress,
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
      `${this.switchboardAddress}::lease_extend_action::run`,
      [HexString.ensure(this.address).hex(), params.loadAmount],
      [this.coinType]
    );
  }

  /**
   * Extend a lease
   * @param params CrankPushParams
   */
  extendTx(
    account: MaybeHexString,
    params: LeaseExtendParams
  ): Types.TransactionPayload {
    return getAptosTx(
      `${this.switchboardAddress}::lease_extend_action::run`,
      [HexString.ensure(this.address).hex(), params.loadAmount],
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
      `${this.switchboardAddress}::lease_withdraw_action::run`,
      [[HexString.ensure(this.address).hex(), params.amount]],
      [this.coinType]
    );
  }

  /**
   * Pop an aggregator off the Crank
   */
  withdrawTx(
    account: MaybeHexString,
    params: LeaseWithdrawParams
  ): Types.TransactionPayload {
    return getAptosTx(
      `${this.switchboardAddress}::lease_withdraw_action::run`,
      [[HexString.ensure(this.address).hex(), params.amount]],
      [this.coinType]
    );
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${this.switchboardAddress}::lease::Lease<${this.coinType}>`
      )
    ).data;
  }
}

export class OracleWallet {
  constructor(
    readonly client: AptosClient,
    readonly address: MaybeHexString,
    readonly switchboardAddress: MaybeHexString,
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
    switchboardAddress: MaybeHexString
  ): Promise<[OracleWallet, string]> {
    const tx = await sendAptosTx(
      client,
      account,
      `${switchboardAddress}::oracle_wallet_init_action::run`,
      [],
      [params.coinType ?? "0x1::aptos_coin::AptosCoin"]
    );

    return [
      new OracleWallet(
        client,
        account.address(),
        switchboardAddress,
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
      `${this.switchboardAddress}::oracle_wallet_contribute_action::run`,
      [HexString.ensure(this.address).hex(), params.loadAmount],
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
      `${this.switchboardAddress}::oracle_wallet_withdraw_action::run`,
      [[HexString.ensure(this.address).hex(), params.amount]],
      [this.coinType]
    );
  }

  async loadData(): Promise<any> {
    return (
      await this.client.getAccountResource(
        HexString.ensure(this.address).hex(),
        `${this.switchboardAddress}::oracle_wallet::OracleWallet<${this.coinType}>`
      )
    ).data;
  }
}

export class Permission {
  constructor(
    readonly client: AptosClient,
    readonly switchboardAddress: MaybeHexString
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
    switchboardAddress: MaybeHexString
  ): Promise<[Permission, string]> {
    const tx = await sendRawAptosTx(
      client,
      account,
      `${switchboardAddress}::permission_init_action::run`,
      [
        BCS.bcsToBytes(
          TxnBuilderTypes.AccountAddress.fromHex(params.authority)
        ),
        BCS.bcsSerializeBytes(HexString.ensure(params.granter).toUint8Array()),
        BCS.bcsSerializeBytes(HexString.ensure(params.grantee).toUint8Array()),
      ]
    );

    return [new Permission(client, switchboardAddress), tx];
  }

  /**
   * Set a Permission
   */
  async set(
    account: AptosAccount,
    params: PermissionSetParams
  ): Promise<string> {
    const tx = await sendRawAptosTx(
      this.client,
      account,
      `${this.switchboardAddress}::permission_set_action::run`,
      [
        BCS.bcsToBytes(
          TxnBuilderTypes.AccountAddress.fromHex(params.authority)
        ),
        BCS.bcsSerializeBytes(HexString.ensure(params.granter).toUint8Array()),
        BCS.bcsSerializeBytes(HexString.ensure(params.grantee).toUint8Array()),
        BCS.bcsSerializeUint64(params.permission),
        BCS.bcsSerializeBool(params.enable),
      ]
    );
    return tx;
  }
}

function safeDiv(number_: Big, denominator: Big, decimals = 20): Big {
  const oldDp = Big.DP;
  Big.DP = decimals;
  const result = number_.div(denominator);
  Big.DP = oldDp;
  return result;
}

interface CreateFeedParams extends AggregatorInitParams {
  jobs: JobInitParams[];
  initialLoadAmount: number;
  crank: MaybeHexString;
}

interface CreateOracleParams extends OracleInitParams {}

export async function createFeedTx(
  client: AptosClient,
  authority: MaybeHexString,
  params: CreateFeedParams,
  switchboardAddress: MaybeHexString
): Promise<[AggregatorAccount, Types.TransactionPayload]> {
  const seed = new AptosAccount().address();
  const resource_address = generateResourceAccountAddress(
    HexString.ensure(authority),
    bcsAddressToBytes(HexString.ensure(seed))
  );

  if (params.jobs.length > 8) {
    throw new Error(
      "Max Job limit exceeded. The create_feed_action can only create up to 8 jobs at a time."
    );
  }

  const { mantissa: vtMantissa, scale: vtScale } = AptosDecimal.fromBig(
    params.varianceThreshold ?? new Big(0)
  );

  // enforce size 8 jobs array
  let jobs =
    params.jobs.length < 8
      ? [
          ...params.jobs,
          ...new Array<JobInitParams>(8 - params.jobs.length).fill({
            name: "",
            metadata: "",
            authority: "",
            data: "",
            weight: 1,
          }),
        ]
      : params.jobs;

  return [
    new AggregatorAccount(
      client,
      resource_address,
      switchboardAddress,
      params.coinType ?? "0x1::aptos_coin::AptosCoin"
    ),
    getAptosTx(
      `${switchboardAddress}::create_feed_action::run`,
      [
        // authority will own everything
        HexString.ensure(params.authority).hex(),

        // aggregator
        params.name ?? "",
        params.metadata ?? "",
        HexString.ensure(params.queueAddress).hex(),
        params.batchSize,
        params.minOracleResults,
        params.minJobResults,
        params.minUpdateDelaySeconds,
        params.startAfter ?? 0,
        Number(vtMantissa),
        vtScale,
        params.forceReportPeriod ?? 0,
        params.expiration ?? 0,
        params.disableCrank ?? false,
        params.historySize ?? 0,
        params.readCharge ?? 0,
        params.rewardEscrow
          ? HexString.ensure(params.rewardEscrow).hex()
          : HexString.ensure(params.authority).hex(),
        params.gasPrice ?? 0,
        params.gasPriceFeed
          ? HexString.ensure(params.gasPriceFeed).hex()
          : "0x0",

        // lease
        params.initialLoadAmount,

        // jobs
        ...jobs.flatMap((jip) => {
          return [jip.name, jip.metadata, jip.data, jip.weight || 1];
        }),

        // crank
        HexString.ensure(params.crank).hex(),

        // seed
        seed.hex(),
      ],
      [params.coinType ?? "0x1::aptos_coin::AptosCoin"]
    ),
  ];
}

// Create a feed with jobs, a lease, then optionally push the lease to the specified crank
export async function createFeed(
  client: AptosClient,
  account: AptosAccount,
  params: CreateFeedParams,
  switchboardAddress: MaybeHexString
): Promise<[AggregatorAccount, string]> {
  const [aggregator, txn] = await createFeedTx(
    client,
    account.address(),
    params,
    switchboardAddress
  );

  const tx = await simulateAndRun(client, account, txn);
  return [aggregator, tx];
}

// Create an oracle, oracle wallet, permisison, and set the heartbeat permission if user is the queue authority
export async function createOracle(
  client: AptosClient,
  account: AptosAccount,
  params: CreateOracleParams,
  switchboardAddress: MaybeHexString
): Promise<[OracleAccount, string]> {
  const seed = new AptosAccount().address();
  const resource_address = generateResourceAccountAddress(
    HexString.ensure(account.address()),
    bcsAddressToBytes(HexString.ensure(seed))
  );

  const tx = await sendAptosTx(
    client,
    account,
    `${switchboardAddress}::create_oracle_action::run`,
    [
      HexString.ensure(params.authority).hex(),
      params.name,
      params.metadata,
      HexString.ensure(params.queue).hex(),
      seed.hex(),
    ],
    [params.coinType ?? "0x1::aptos_coin::AptosCoin"]
  );

  return [
    new OracleAccount(
      client,
      resource_address,
      switchboardAddress,
      params.coinType ?? "0x1::aptos_coin::AptosCoin"
    ),
    tx,
  ];
}

export function bcsAddressToBytes(hexStr: HexString): Uint8Array {
  return BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(hexStr));
}

export function generateResourceAccountAddress(
  origin: HexString,
  seed: Uint8Array
): MaybeHexString {
  const hash = SHA3.sha3_256.create();
  const userAddressBCS = bcsAddressToBytes(origin);
  hash.update(userAddressBCS);
  hash.update(seed);
  return `0x${hash.hex()}`;
}

export async function fetchAggregators(
  client: AptosClient,
  authority: MaybeHexString,
  switchboardAddress: MaybeHexString
): Promise<any[]> {
  const handle = (
    (await client.getAccountResource(
      switchboardAddress,
      `${switchboardAddress}::switchboard::State`
    )) as any
  ).data.aggregator_authorities.handle;
  const tableItems = await client.getTableItem(handle, {
    key_type: `address`,
    value_type: `vector<address>`,
    key: HexString.ensure(authority).hex(),
  });
  return (
    await Promise.all(
      tableItems.map((aggregatorAddress: MaybeHexString) =>
        new AggregatorAccount(
          client,
          aggregatorAddress,
          switchboardAddress
        ).loadData()
      )
    )
  ).map((aggregator: any, i) => {
    aggregator.address = tableItems[i];
    return aggregator; // map addresses back to the aggregator object
  });
}
