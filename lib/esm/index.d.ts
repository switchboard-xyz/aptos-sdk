/// <reference types="node" />
import { AptosClient, AptosAccount, HexString, MaybeHexString } from "aptos";
import { MoveStructTag, ScriptFunctionId } from "aptos/src/generated";
import Big from "big.js";
import * as sbv2 from "@switchboard-xyz/switchboard-v2";
export declare const SWITCHBOARD_DEVNET_ADDRESS = "";
export declare const SWITCHBOARD_STATE_ADDRESS = "";
export declare class AptosDecimal {
    readonly mantissa: string;
    readonly scale: number;
    readonly neg: boolean;
    constructor(mantissa: string, scale: number, neg: boolean);
    toBig(): Big;
    static fromBig(val: Big): AptosDecimal;
    static fromObj(obj: Object): AptosDecimal;
}
export interface AggregatorAddJobParams {
    job: MaybeHexString;
    weight?: number;
}
export interface AggregatorInitParams {
    authority: MaybeHexString;
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
    value_num: number;
    value_scale_factor: number;
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
    mint: MaybeHexString;
    enableBufferRelayers: boolean;
    maxSize: number;
}
export declare type EventCallback = (e: any) => Promise<void> /** | (() => Promise<void>) */;
/**
 * Sends and waits for an aptos tx to be confirmed
 * @param client
 * @param signer
 * @param method Aptos module method (ex: 0xSwitchboard::AggregatorAddJobAction)
 * @param args Arguments for method (converts numbers to strings)
 * @returns
 */
export declare function sendAptosTx(client: AptosClient, signer: AptosAccount, method: ScriptFunctionId, args: Array<any>, retryCount?: number): Promise<string>;
/**
 * Retrieve Table Item
 * @param client
 * @param tableType
 * @param key string to fetch table item by
 */
/**
 * Poll Events on Aptos
 * @Note uncleared setTimeout calls will keep processes from ending organically (SIGTERM is needed)
 */
export declare class AptosEvent {
    readonly client: AptosClient;
    readonly eventHandlerOwner: HexString;
    readonly eventOwnerStruct: MoveStructTag;
    readonly eventHandlerName: string;
    readonly pollIntervalMs: number;
    intervalId?: ReturnType<typeof setInterval>;
    constructor(client: AptosClient, eventHandlerOwner: HexString, eventOwnerStruct: MoveStructTag, eventHandlerName: string, pollIntervalMs?: number);
    onTrigger(callback: EventCallback, errorHandler?: (error: unknown) => void): Promise<NodeJS.Timer>;
    stop(): void;
}
export declare class State {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly payer: AptosAccount;
    readonly devnetAddress: MaybeHexString;
    constructor(client: AptosClient, address: MaybeHexString, payer: AptosAccount, devnetAddress: MaybeHexString);
    static init(client: AptosClient, account: AptosAccount, pid: MaybeHexString): Promise<[State, string]>;
    loadData(): Promise<any>;
}
export declare class Aggregator {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly devnetAddress: MaybeHexString;
    readonly stateAddress: MaybeHexString;
    constructor(client: AptosClient, address: MaybeHexString, devnetAddress: MaybeHexString, stateAddress: MaybeHexString);
    loadData(): Promise<any>;
    loadJobs(): Promise<Array<sbv2.OracleJob>>;
    /**
     * Initialize an Aggregator
     * @param client
     * @param account
     * @param params AggregatorInitParams initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: AggregatorInitParams, devnetAddress: MaybeHexString, stateAddress: MaybeHexString): Promise<[Aggregator, string]>;
    addJob(account: AptosAccount, params: AggregatorAddJobParams): Promise<string>;
    saveResult(account: AptosAccount, params: AggregatorSaveResultParams): Promise<string>;
    openRound(account: AptosAccount): Promise<string>;
    watch(callback: EventCallback): Promise<AptosEvent>;
    static shouldReportValue(value: Big, aggregator: any): Promise<boolean>;
}
export declare class Job {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly devnetAddress: MaybeHexString;
    readonly stateAddress: MaybeHexString;
    constructor(client: AptosClient, address: MaybeHexString, devnetAddress: MaybeHexString, stateAddress: MaybeHexString);
    loadData(): Promise<any>;
    loadJob(): Promise<sbv2.OracleJob>;
    /**
     * Initialize a Job stored in the switchboard resource account
     * @param client
     * @param account
     * @param params JobInitParams initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: JobInitParams, devnetAddress: MaybeHexString, stateAddress: MaybeHexString): Promise<[Job, string]>;
}
export declare class Crank {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly devnetAddress: MaybeHexString;
    readonly stateAddress: MaybeHexString;
    constructor(client: AptosClient, address: MaybeHexString, devnetAddress: MaybeHexString, stateAddress: MaybeHexString);
    /**
     * Initialize a Crank stored in the switchboard resource account
     * @param client
     * @param account account that will be the authority of the Crank
     * @param params CrankInitParams initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: CrankInitParams, devnetAddress: MaybeHexString, stateAddress: MaybeHexString): Promise<[Crank, string]>;
    /**
     * Push an aggregator to a Crank
     * @param params CrankPushParams
     */
    push(account: AptosAccount, params: CrankPushParams): Promise<string>;
    /**
     * Pop an aggregator off the Crank
     * @param params CrankPopParams
     */
    pop(account: AptosAccount, params: CrankPopParams): Promise<string>;
    loadData(): Promise<any>;
}
export declare class Oracle {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly devnetAddress: MaybeHexString;
    readonly stateAddress: MaybeHexString;
    constructor(client: AptosClient, address: MaybeHexString, devnetAddress: MaybeHexString, stateAddress: MaybeHexString);
    /**
     * Initialize a Oracle stored in the switchboard resource account
     * @param client
     * @param account
     * @param params Oracle initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: OracleInitParams, devnetAddress: any, stateAddress: any): Promise<[Oracle, string]>;
    loadData(): Promise<any>;
    /**
     * Oracle Heartbeat Action
     */
    heartbeat(account: AptosAccount): Promise<string>;
}
export declare class OracleQueue {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly devnetAddress: MaybeHexString;
    readonly stateAddress: MaybeHexString;
    constructor(client: AptosClient, address: MaybeHexString, devnetAddress: MaybeHexString, stateAddress: MaybeHexString);
    /**
     * Initialize a OracleQueue stored in the switchboard resource account
     * @param client
     * @param account
     * @param params OracleQueue initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: OracleQueueInitParams, devnetAddress: any, stateAddress: any): Promise<[OracleQueue, string]>;
    loadData(): Promise<any>;
}
//# sourceMappingURL=index.d.ts.map