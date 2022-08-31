/// <reference types="node" />
import { AptosClient, AptosAccount, HexString, MaybeHexString, BCS, TxnBuilderTypes } from "aptos";
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
    varianceThreshold: Big;
    forceReportPeriod?: number;
    expiration?: number;
    disableCrank?: boolean;
    historySize?: number;
    readCharge?: number;
    rewardEscrow?: string;
}
export interface AggregatorSaveResultParams {
    oracleAddress: MaybeHexString;
    oracleIdx: number;
    error: boolean;
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
    coinType?: string;
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
    granter: MaybeHexString;
    grantee: MaybeHexString;
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
 * Generates an aptos tx for client
 * @param client
 * @param method Aptos module method (ex: 0xSwitchboard::aggregator_add_job_action)
 * @param args Arguments for method (converts numbers to strings)
 * @param type_args Arguments for type_args
 * @returns
 */
export declare function getAptosTx(client: AptosClient, user: MaybeHexString, method: EntryFunctionId, args: Array<any>, type_args?: Array<string>): Promise<TxnBuilderTypes.RawTransaction>;
export declare function simulateAndRun(client: AptosClient, user: AptosAccount, txn: TxnBuilderTypes.RawTransaction): Promise<string>;
export declare function sendRawAptosTx(client: AptosClient, signer: AptosAccount, method: EntryFunctionId, raw_args: Array<any>, raw_type_args?: BCS.Seq<TxnBuilderTypes.TypeTag>, retryCount?: number): Promise<string>;
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
export declare class StateAccount {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly payer: AptosAccount;
    readonly switchboardAddress: MaybeHexString;
    constructor(client: AptosClient, address: MaybeHexString, payer: AptosAccount, switchboardAddress: MaybeHexString);
    static init(client: AptosClient, account: AptosAccount, switchboardAddress: MaybeHexString): Promise<[StateAccount, string]>;
    loadData(): Promise<any>;
}
export declare class AggregatorAccount {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly switchboardAddress: MaybeHexString;
    readonly coinType: MoveStructTag;
    constructor(client: AptosClient, address: MaybeHexString, switchboardAddress: MaybeHexString, coinType?: MoveStructTag);
    loadData(): Promise<any>;
    loadJobs(): Promise<Array<OracleJob>>;
    /**
     * Initialize an Aggregator
     * @param client
     * @param account
     * @param params AggregatorInitParams initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: AggregatorInitParams, switchboardAddress: MaybeHexString): Promise<[AggregatorAccount, string]>;
    addJob(account: AptosAccount, params: AggregatorAddJobParams): Promise<string>;
    addJobTx(authority: MaybeHexString, params: AggregatorAddJobParams): Promise<TxnBuilderTypes.RawTransaction>;
    saveResult(account: AptosAccount, params: AggregatorSaveResultParams): Promise<string>;
    openRound(account: AptosAccount): Promise<string>;
    openRoundTx(accountAddress: MaybeHexString): Promise<TxnBuilderTypes.RawTransaction>;
    setConfigTx(accountAddress: MaybeHexString, params: AggregatorSetConfigParams): Promise<void>;
    watch(callback: EventCallback): Promise<AptosEvent>;
    static shouldReportValue(value: Big, aggregator: any): Promise<boolean>;
}
export declare class JobAccount {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly switchboardAddress: MaybeHexString;
    constructor(client: AptosClient, address: MaybeHexString, switchboardAddress: MaybeHexString);
    loadData(): Promise<any>;
    loadJob(): Promise<OracleJob>;
    /**
     * Initialize a JobAccount
     * @param client
     * @param account
     * @param params JobInitParams initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: JobInitParams, switchboardAddress: MaybeHexString): Promise<[JobAccount, string]>;
    /**
     * Initialize a JobAccount
     * @param client
     * @param account
     * @param params JobInitParams initialization params
     */
    static initTx(client: AptosClient, account: MaybeHexString, params: JobInitParams, switchboardAddress: MaybeHexString): Promise<[JobAccount, TxnBuilderTypes.RawTransaction]>;
}
export declare class CrankAccount {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly switchboardAddress: MaybeHexString;
    readonly coinType: MoveStructTag;
    constructor(client: AptosClient, address: MaybeHexString, switchboardAddress: MaybeHexString, coinType?: MoveStructTag);
    /**
     * Initialize a Crank
     * @param client
     * @param account account that will be the authority of the Crank
     * @param params CrankInitParams initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: CrankInitParams, switchboardAddress: MaybeHexString): Promise<[CrankAccount, string]>;
    /**
     * Push an aggregator to a Crank
     * @param params CrankPushParams
     */
    push(account: AptosAccount, params: CrankPushParams): Promise<string>;
    pushTx(account: MaybeHexString, params: CrankPushParams): Promise<TxnBuilderTypes.RawTransaction>;
    /**
     * Pop an aggregator off the Crank
     */
    pop(account: AptosAccount): Promise<string>;
    loadData(): Promise<any>;
}
export declare class OracleAccount {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly switchboardAddress: MaybeHexString;
    readonly coinType: MoveStructTag;
    constructor(client: AptosClient, address: MaybeHexString, switchboardAddress: MaybeHexString, coinType?: MoveStructTag);
    /**
     * Initialize a Oracle
     * @param client
     * @param account
     * @param params Oracle initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: OracleInitParams, switchboardAddress: MaybeHexString): Promise<[OracleAccount, string]>;
    loadData(): Promise<any>;
    /**
     * Oracle Heartbeat Action
     */
    heartbeat(account: AptosAccount): Promise<string>;
}
export declare class OracleQueueAccount {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly switchboardAddress: MaybeHexString;
    readonly coinType: MoveStructTag;
    constructor(client: AptosClient, address: MaybeHexString, switchboardAddress: MaybeHexString, coinType?: MoveStructTag);
    /**
     * Initialize an OracleQueueAccount
     * @param client
     * @param account
     * @param params OracleQueueAccount initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: OracleQueueInitParams, switchboardAddress: MaybeHexString): Promise<[OracleQueueAccount, string]>;
    loadData(): Promise<any>;
}
export declare class LeaseAccount {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly switchboardAddress: MaybeHexString;
    readonly coinType: MoveStructTag;
    constructor(client: AptosClient, address: MaybeHexString, switchboardAddress: MaybeHexString, coinType?: MoveStructTag);
    /**
     * Initialize a LeaseAccount
     * @param client
     * @param account account that will be the authority of the LeaseAccount
     * @param params LeaseInitParams initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: LeaseInitParams, switchboardAddress: MaybeHexString): Promise<[LeaseAccount, string]>;
    /**
     * Extend a lease
     * @param params CrankPushParams
     */
    extend(account: AptosAccount, params: LeaseExtendParams): Promise<string>;
    /**
     * Extend a lease
     * @param params CrankPushParams
     */
    extendTx(account: MaybeHexString, params: LeaseExtendParams): Promise<TxnBuilderTypes.RawTransaction>;
    /**
     * Pop an aggregator off the Crank
     */
    withdraw(account: AptosAccount, params: LeaseWithdrawParams): Promise<string>;
    /**
     * Pop an aggregator off the Crank
     */
    withdrawTx(account: MaybeHexString, params: LeaseWithdrawParams): Promise<TxnBuilderTypes.RawTransaction>;
    loadData(): Promise<any>;
}
export declare class OracleWallet {
    readonly client: AptosClient;
    readonly address: MaybeHexString;
    readonly switchboardAddress: MaybeHexString;
    readonly coinType: MoveStructTag;
    constructor(client: AptosClient, address: MaybeHexString, switchboardAddress: MaybeHexString, coinType?: MoveStructTag);
    /**
     * Initialize an OracleWallet
     * @param client
     * @param account account that will be the authority of the OracleWallet
     * @param params OracleWalletInitParams initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: OracleWalletInitParams, switchboardAddress: MaybeHexString): Promise<[OracleWallet, string]>;
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
    readonly switchboardAddress: MaybeHexString;
    constructor(client: AptosClient, switchboardAddress: MaybeHexString);
    /**
     * Initialize a Permission
     * @param client
     * @param account
     * @param params PermissionInitParams initialization params
     */
    static init(client: AptosClient, account: AptosAccount, params: PermissionInitParams, switchboardAddress: MaybeHexString): Promise<[Permission, string]>;
    /**
     * Set a Permission
     */
    set(account: AptosAccount, params: PermissionSetParams): Promise<string>;
}
interface CreateFeedParams extends AggregatorInitParams {
    jobs: JobInitParams[];
    initialLoadAmount: number;
    crank: MaybeHexString;
}
export declare function createFeedTx(client: AptosClient, authority: MaybeHexString, params: CreateFeedParams, switchboardAddress: MaybeHexString): Promise<[AggregatorAccount, TxnBuilderTypes.RawTransaction]>;
export declare function createFeed(client: AptosClient, account: AptosAccount, params: CreateFeedParams, switchboardAddress: MaybeHexString): Promise<[AggregatorAccount, string]>;
export declare function bcsAddressToBytes(hexStr: HexString): Uint8Array;
export declare function generateResourceAccountAddress(origin: HexString, seed: Uint8Array): MaybeHexString;
export declare function fetchAggregators(client: AptosClient, authority: MaybeHexString, switchboardAddress: MaybeHexString): Promise<any[]>;
//# sourceMappingURL=index.d.ts.map