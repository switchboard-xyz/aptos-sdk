/// <reference types="node" />
import { AptosClient, AptosAccount, HexString, MaybeHexString } from "aptos";
import { MoveStructTag, EntryFunctionId } from "aptos/src/generated";
import Big from "big.js";
import { OracleJob } from "@switchboard-xyz/common";
export { OracleJob, IOracleJob } from "@switchboard-xyz/common";
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
export declare enum SwitchboardPermission {
    PERMIT_ORACLE_HEARTBEAT = 0,
    PERMIT_ORACLE_QUEUE_USAGE = 1,
    PERMIT_VRF_REQUESTS = 2
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
    oracleAddress: MaybeHexString;
    oracleIdx: number;
    error: boolean;
    valueNum: number;
    valueScaleFactor: number;
    valueNeg: boolean;
    jobsChecksum: string;
    minResponseNum: number;
    minResponseScaleFactor: number;
    minResponseNeg: boolean;
    maxResponseNum: number;
    maxResponseScaleFactor: number;
    maxResponseNeg: boolean;
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
export declare type EventCallback = (e: any) => Promise<void> /** | (() => Promise<void>) */;
/**
 * Sends and waits for an aptos tx to be confirmed
 * @param client
 * @param signer
 * @param method Aptos module method (ex: 0xSwitchboard::aggregator_add_job_action)
 * @param args Arguments for method (converts numbers to strings)
 * @returns
 */
export declare function sendAptosTx(client: AptosClient, signer: AptosAccount, method: EntryFunctionId, args: Array<any>, type_args?: Array<string>, retryCount?: number): Promise<string>;
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
    static init(client: AptosClient, account: AptosAccount, devnetAddress: MaybeHexString): Promise<[State, string]>;
    loadData(): Promise<any>;
}
export declare class Aggregator {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly devnetAddress: MaybeHexString;
    readonly coinType: MoveStructTag;
    constructor(client: AptosClient, address: MaybeHexString, devnetAddress: MaybeHexString, coinType?: MoveStructTag);
    loadData(): Promise<any>;
    loadJobs(): Promise<Array<OracleJob>>;
    /**
     * Initialize an Aggregator
     * @param client
     * @param account
     * @param params AggregatorInitParams initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: AggregatorInitParams, devnetAddress: MaybeHexString): Promise<[Aggregator, string]>;
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
    constructor(client: AptosClient, address: MaybeHexString, devnetAddress: MaybeHexString);
    loadData(): Promise<any>;
    loadJob(): Promise<OracleJob>;
    /**
     * Initialize a Job
     * @param client
     * @param account
     * @param params JobInitParams initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: JobInitParams, devnetAddress: MaybeHexString): Promise<[Job, string]>;
}
export declare class Crank {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly devnetAddress: MaybeHexString;
    readonly coinType: MoveStructTag;
    constructor(client: AptosClient, address: MaybeHexString, devnetAddress: MaybeHexString, coinType?: MoveStructTag);
    /**
     * Initialize a Crank
     * @param client
     * @param account account that will be the authority of the Crank
     * @param params CrankInitParams initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: CrankInitParams, devnetAddress: MaybeHexString): Promise<[Crank, string]>;
    /**
     * Push an aggregator to a Crank
     * @param params CrankPushParams
     */
    push(account: AptosAccount, params: CrankPushParams): Promise<string>;
    /**
     * Pop an aggregator off the Crank
     */
    pop(account: AptosAccount): Promise<string>;
    loadData(): Promise<any>;
}
export declare class Oracle {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly devnetAddress: MaybeHexString;
    readonly coinType: MoveStructTag;
    constructor(client: AptosClient, address: MaybeHexString, devnetAddress: MaybeHexString, coinType?: MoveStructTag);
    /**
     * Initialize a Oracle
     * @param client
     * @param account
     * @param params Oracle initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: OracleInitParams, devnetAddress: MaybeHexString): Promise<[Oracle, string]>;
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
    readonly coinType: MoveStructTag;
    constructor(client: AptosClient, address: MaybeHexString, devnetAddress: MaybeHexString, coinType?: MoveStructTag);
    /**
     * Initialize an OracleQueue
     * @param client
     * @param account
     * @param params OracleQueue initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: OracleQueueInitParams, devnetAddress: MaybeHexString): Promise<[OracleQueue, string]>;
    loadData(): Promise<any>;
}
export declare class Lease {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly devnetAddress: MaybeHexString;
    readonly coinType: MoveStructTag;
    constructor(client: AptosClient, address: MaybeHexString, devnetAddress: MaybeHexString, coinType?: MoveStructTag);
    /**
     * Initialize a Lease
     * @param client
     * @param account account that will be the authority of the Lease
     * @param params LeaseInitParams initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: LeaseInitParams, devnetAddress: MaybeHexString): Promise<[Lease, string]>;
    /**
     * Extend a lease
     * @param params CrankPushParams
     */
    extend(account: AptosAccount, params: LeaseExtendParams): Promise<string>;
    /**
     * Pop an aggregator off the Crank
     */
    withdraw(account: AptosAccount, params: LeaseWithdrawParams): Promise<string>;
    loadData(): Promise<any>;
}
export declare class OracleWallet {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly devnetAddress: MaybeHexString;
    readonly coinType: MoveStructTag;
    constructor(client: AptosClient, address: MaybeHexString, devnetAddress: MaybeHexString, coinType?: MoveStructTag);
    /**
     * Initialize an OracleWallet
     * @param client
     * @param account account that will be the authority of the OracleWallet
     * @param params OracleWalletInitParams initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: OracleWalletInitParams, devnetAddress: MaybeHexString): Promise<[OracleWallet, string]>;
    /**
     * Contributes to an oracle wallet
     * @param params OracleWalletContributeParams
     */
    contribute(account: AptosAccount, params: OracleWalletContributeParams): Promise<string>;
    /**
     * Withdraw from an OracleWallet
     */
    withdraw(account: AptosAccount, params: OracleWalletWithdrawParams): Promise<string>;
    loadData(): Promise<any>;
}
export declare class Permission {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly devnetAddress: MaybeHexString;
    constructor(client: AptosClient, address: MaybeHexString, devnetAddress: MaybeHexString);
    /**
     * Initialize a Permission
     * @param client
     * @param account
     * @param params PermissionInitParams initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: PermissionInitParams, devnetAddress: MaybeHexString): Promise<[Permission, string]>;
    /**
     * Set a Permission
     */
    set(account: AptosAccount, params: PermissionSetParams): Promise<string>;
    loadData(): Promise<any>;
}
export declare function createFeed(client: AptosClient, account: AptosAccount, devnetAddress: MaybeHexString, aggregatorParams: AggregatorInitParams, jobInitParams: JobInitParams[], initialLoadAmount: number, crank: MaybeHexString): Promise<[Aggregator, string]>;
//# sourceMappingURL=index.d.ts.map