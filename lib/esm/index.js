import { AptosClient, AptosAccount, HexString, FaucetClient, BCS, TxnBuilderTypes, } from "aptos";
import Big from "big.js";
import { OracleJob } from "@switchboard-xyz/common";
import BN from "bn.js";
import * as SHA3 from "js-sha3";
export { OracleJob } from "@switchboard-xyz/common";
// Address that deployed the module
export const SWITCHBOARD_DEVNET_ADDRESS = ``;
// Address of the account that owns the Switchboard resource
export const SWITCHBOARD_STATE_ADDRESS = ``;
export class AptosDecimal {
    constructor(mantissa, scale, neg) {
        this.mantissa = mantissa;
        this.scale = scale;
        this.neg = neg;
    }
    toBig() {
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
    static fromBig(val) {
        const value = val.c.slice();
        let e = val.e + 1;
        while (value.length - e > 9) {
            value.pop();
        }
        return new AptosDecimal(value.join(""), value.length - e, val.s === -1);
    }
    static fromObj(obj) {
        const properties = ["mantissa", "scale", "neg"];
        properties.forEach((p) => {
            if (!(p in obj)) {
                throw new Error(`Object is missing property ${p}`);
            }
        });
        return new AptosDecimal(obj["mantissa"], obj["scale"], obj["neg"]);
    }
}
export var SwitchboardPermission;
(function (SwitchboardPermission) {
    SwitchboardPermission[SwitchboardPermission["PERMIT_ORACLE_HEARTBEAT"] = 0] = "PERMIT_ORACLE_HEARTBEAT";
    SwitchboardPermission[SwitchboardPermission["PERMIT_ORACLE_QUEUE_USAGE"] = 1] = "PERMIT_ORACLE_QUEUE_USAGE";
    SwitchboardPermission[SwitchboardPermission["PERMIT_VRF_REQUESTS"] = 2] = "PERMIT_VRF_REQUESTS";
})(SwitchboardPermission || (SwitchboardPermission = {}));
/**
 * Sends and waits for an aptos tx to be confirmed
 * @param client
 * @param signer
 * @param method Aptos module method (ex: 0xSwitchboard::aggregator_add_job_action)
 * @param args Arguments for method (converts numbers to strings)
 * @returns
 */
export async function sendAptosTx(client, signer, method, args, type_args = [], retryCount = 2) {
    const payload = {
        type: "entry_function_payload",
        function: method,
        type_arguments: type_args,
        arguments: args,
    };
    const txnRequest = await client.generateTransaction(signer.address(), payload, { max_gas_amount: "5000" });
    const simulation = (await client.simulateTransaction(signer, txnRequest))[0];
    if (simulation.vm_status === "Out of gas") {
        if (retryCount > 0) {
            const faucetClient = new FaucetClient("https://fullnode.devnet.aptoslabs.com/v1", "https://faucet.devnet.aptoslabs.com");
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
export async function sendRawAptosTx(client, signer, method, raw_args, raw_type_args = [], retryCount = 2) {
    // We need to pass a token type to the `transfer` function.
    const methodInfo = method.split("::");
    const entryFunctionPayload = new TxnBuilderTypes.TransactionPayloadEntryFunction(TxnBuilderTypes.EntryFunction.natural(
    // Fully qualified module name, `AccountAddress::ModuleName`
    `${methodInfo[0]}::${methodInfo[1]}`, 
    // Module function
    methodInfo[2], 
    // The coin type to transfer
    raw_type_args, 
    // Arguments for function `transfer`: receiver account address and amount to transfer
    raw_args));
    const rawTxn = await client.generateRawTransaction(signer.address(), entryFunctionPayload, { maxGasAmount: BigInt(5000) });
    const bcsTxn = AptosClient.generateBCSTransaction(signer, rawTxn);
    const simulation = (await client.simulateTransaction(signer, rawTxn))[0];
    if (simulation.vm_status === "Out of gas") {
        if (retryCount > 0) {
            const faucetClient = new FaucetClient("https://fullnode.devnet.aptoslabs.com/v1", "https://faucet.devnet.aptoslabs.com");
            await faucetClient.fundAccount(signer.address(), 5000);
            return sendRawAptosTx(client, signer, method, raw_args, raw_type_args, --retryCount);
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
    constructor(client, eventHandlerOwner, eventOwnerStruct, eventHandlerName, pollIntervalMs = 1000) {
        this.client = client;
        this.eventHandlerOwner = eventHandlerOwner;
        this.eventOwnerStruct = eventOwnerStruct;
        this.eventHandlerName = eventHandlerName;
        this.pollIntervalMs = pollIntervalMs;
    }
    async onTrigger(callback, errorHandler) {
        let lastSequenceNumber = "0";
        const ownerData = await this.client.getAccountResource(this.eventHandlerOwner.hex(), this.eventOwnerStruct);
        try {
            lastSequenceNumber = (Number(ownerData.data[this.eventHandlerName].counter) - 1).toString();
        }
        catch (error) {
            console.error(JSON.stringify(ownerData, undefined, 2), error);
        }
        if (Number(ownerData.data[this.eventHandlerName].counter) === -1) {
            lastSequenceNumber = "0";
        }
        this.intervalId = setInterval(async () => {
            try {
                const events = await this.client.getEventsByEventHandle(this.eventHandlerOwner, this.eventOwnerStruct, this.eventHandlerName, {
                    start: BigInt(Number(lastSequenceNumber) + 1),
                    limit: 500,
                });
                if (events.length !== 0) {
                    // increment sequence number
                    lastSequenceNumber = events.at(-1).sequence_number;
                }
                for (let event of events) {
                    callback(event).catch((error) => {
                        if (errorHandler) {
                            errorHandler(error);
                        }
                        else {
                            throw error;
                        }
                    });
                }
            }
            catch (error) {
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
    constructor(client, address, payer, devnetAddress) {
        this.client = client;
        this.address = address;
        this.payer = payer;
        this.devnetAddress = devnetAddress;
    }
    static async init(client, account, devnetAddress) {
        const tx = await sendAptosTx(client, account, `${devnetAddress}::switchboard_init_action::run`, []);
        return [
            new StateAccount(client, account.address(), account, devnetAddress),
            tx,
        ];
    }
    async loadData() {
        return (await this.client.getAccountResource(this.address, `${this.devnetAddress}::switchboard::State`)).data;
    }
}
export class AggregatorAccount {
    constructor(client, address, devnetAddress, coinType = "0x1::aptos_coin::AptosCoin") {
        this.client = client;
        this.address = address;
        this.devnetAddress = devnetAddress;
        this.coinType = coinType;
    }
    async loadData() {
        return (await this.client.getAccountResource(HexString.ensure(this.address).hex(), `${this.devnetAddress}::aggregator::Aggregator`)).data;
    }
    async loadJobs() {
        const data = await this.loadData();
        const jobs = data.job_keys.map((key) => new JobAccount(this.client, HexString.ensure(key).hex(), HexString.ensure(this.devnetAddress).hex()));
        const promises = [];
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
    static async init(client, account, params, devnetAddress) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const tx = await sendAptosTx(client, account, `${devnetAddress}::aggregator_init_action::run`, [
            Buffer.from((_a = params.name) !== null && _a !== void 0 ? _a : "").toString("hex"),
            Buffer.from((_b = params.metadata) !== null && _b !== void 0 ? _b : "").toString("hex"),
            HexString.ensure(params.queueAddress).hex(),
            params.batchSize,
            params.minOracleResults,
            params.minJobResults,
            params.minUpdateDelaySeconds,
            (_c = params.startAfter) !== null && _c !== void 0 ? _c : 0,
            (_d = params.varianceThreshold) !== null && _d !== void 0 ? _d : 0,
            (_e = params.varianceThresholdScale) !== null && _e !== void 0 ? _e : 0,
            (_f = params.forceReportPeriod) !== null && _f !== void 0 ? _f : 0,
            (_g = params.expiration) !== null && _g !== void 0 ? _g : 0,
            HexString.ensure(params.authority).hex(),
        ], [(_h = params.coinType) !== null && _h !== void 0 ? _h : "0x1::aptos_coin::AptosCoin"]);
        return [
            new AggregatorAccount(client, account.address(), devnetAddress, (_j = params.coinType) !== null && _j !== void 0 ? _j : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    async addJob(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::aggregator_add_job_action::run`, [
            HexString.ensure(this.address).hex(),
            HexString.ensure(params.job).hex(),
            params.weight || 1,
        ]);
    }
    async saveResult(account, params) {
        var _a;
        return sendRawAptosTx(this.client, account, `${this.devnetAddress}::aggregator_save_result_action::run`, [
            BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(params.oracleAddress)),
            BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(this.address)),
            BCS.bcsSerializeUint64(params.oracleIdx),
            BCS.bcsSerializeBool(params.error),
            BCS.bcsSerializeU128(params.valueNum),
            BCS.bcsSerializeU8(params.valueScaleFactor),
            BCS.bcsSerializeBool(params.valueNeg),
            BCS.bcsSerializeBytes(HexString.ensure(params.jobsChecksum).toUint8Array()),
            BCS.bcsSerializeU128(params.minResponseNum),
            BCS.bcsSerializeU8(params.minResponseScaleFactor),
            BCS.bcsSerializeBool(params.minResponseNeg),
            BCS.bcsSerializeU128(params.maxResponseNum),
            BCS.bcsSerializeU8(params.maxResponseScaleFactor),
            BCS.bcsSerializeBool(params.maxResponseNeg),
        ], [
            new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString((_a = this.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin")),
        ]);
    }
    async openRound(account) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::aggregator_open_round_action::run`, [HexString.ensure(this.address).hex()], [this.coinType]);
    }
    async watch(callback) {
        const event = new AptosEvent(this.client, HexString.ensure(this.devnetAddress), `${this.devnetAddress}::switchboard::State`, "aggregator_update_events", 1000);
        await event.onTrigger(callback);
        return event;
    }
    static async shouldReportValue(value, aggregator) {
        var _a, _b;
        if (((_b = (_a = aggregator.latestConfirmedRound) === null || _a === void 0 ? void 0 : _a.numSuccess) !== null && _b !== void 0 ? _b : 0) === 0) {
            return true;
        }
        const timestamp = new BN(Math.round(Date.now() / 1000), 10);
        const startAfter = new BN(aggregator.startAfter, 10);
        if (startAfter.gt(timestamp)) {
            return false;
        }
        const varianceThreshold = new AptosDecimal(aggregator.varianceThreshold.mantissa, aggregator.varianceThreshold.dec, aggregator.varianceThreshold.neg).toBig();
        const latestResult = new AptosDecimal(aggregator.latestConfirmedRound.result.mantissa, aggregator.latestConfirmedRound.result.dec, aggregator.latestConfirmedRound.result.neg).toBig();
        const forceReportPeriod = new BN(aggregator.forceReportPeriod, 10);
        const lastTimestamp = new BN(aggregator.latestConfirmedRound.roundOpenTimestamp, 10);
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
    constructor(client, address, devnetAddress) {
        this.client = client;
        this.address = address;
        this.devnetAddress = devnetAddress;
    }
    async loadData() {
        return (await this.client.getAccountResource(this.address, `${HexString.ensure(this.devnetAddress).hex()}::job::Job`)).data;
    }
    async loadJob() {
        const data = await this.loadData();
        const job = OracleJob.decodeDelimited(Buffer.from(data.data.slice(2), "hex"));
        return job;
    }
    /**
     * Initialize a JobAccount
     * @param client
     * @param account
     * @param params JobInitParams initialization params
     */
    static async init(client, account, params, devnetAddress) {
        const tx = await sendAptosTx(client, account, `${devnetAddress}::job_init_action::run`, [
            params.name,
            params.metadata,
            HexString.ensure(params.authority).hex(),
            params.data,
        ]);
        return [new JobAccount(client, account.address(), devnetAddress), tx];
    }
}
export class CrankAccount {
    constructor(client, address, devnetAddress, coinType = "0x1::aptos_coin::AptosCoin") {
        this.client = client;
        this.address = address;
        this.devnetAddress = devnetAddress;
        this.coinType = coinType;
    }
    /**
     * Initialize a Crank
     * @param client
     * @param account account that will be the authority of the Crank
     * @param params CrankInitParams initialization params
     */
    static async init(client, account, params, devnetAddress) {
        var _a, _b;
        const tx = await sendAptosTx(client, account, `${devnetAddress}::crank_init_action::run`, [HexString.ensure(params.queueAddress).hex()], [(_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
        return [
            new CrankAccount(client, account.address(), devnetAddress, (_b = params.coinType) !== null && _b !== void 0 ? _b : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    /**
     * Push an aggregator to a Crank
     * @param params CrankPushParams
     */
    async push(account, params) {
        var _a;
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::crank_push_action::run`, [
            HexString.ensure(this.address).hex(),
            HexString.ensure(params.aggregatorAddress).hex(),
        ], [(_a = this.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
    }
    /**
     * Pop an aggregator off the Crank
     */
    async pop(account) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::crank_pop_action::run`, [HexString.ensure(this.address).hex()], [this.coinType]);
    }
    async loadData() {
        return (await this.client.getAccountResource(HexString.ensure(this.address).hex(), `${this.devnetAddress}::crank::Crank`)).data;
    }
}
export class OracleAccount {
    constructor(client, address, devnetAddress, coinType = "0x1::aptos_coin::AptosCoin") {
        this.client = client;
        this.address = address;
        this.devnetAddress = devnetAddress;
        this.coinType = coinType;
    }
    /**
     * Initialize a Oracle
     * @param client
     * @param account
     * @param params Oracle initialization params
     */
    static async init(client, account, params, devnetAddress) {
        var _a, _b;
        const tx = await sendAptosTx(client, account, `${devnetAddress}::oracle_init_action::run`, [
            params.name,
            params.metadata,
            HexString.ensure(params.authority).hex(),
            HexString.ensure(params.queue).hex(),
        ], [(_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
        return [
            new OracleAccount(client, account.address(), devnetAddress, (_b = params.coinType) !== null && _b !== void 0 ? _b : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    async loadData() {
        return (await this.client.getAccountResource(HexString.ensure(this.address).hex(), `${this.devnetAddress}::oracle::Oracle`)).data;
    }
    /**
     * Oracle Heartbeat Action
     */
    async heartbeat(account) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::oracle_heartbeat_action::run`, [HexString.ensure(this.address).hex()], [this.coinType]);
    }
}
export class OracleQueueAccount {
    constructor(client, address, devnetAddress, coinType = "0x1::aptos_coin::AptosCoin") {
        this.client = client;
        this.address = address;
        this.devnetAddress = devnetAddress;
        this.coinType = coinType;
    }
    /**
     * Initialize an OracleQueueAccount
     * @param client
     * @param account
     * @param params OracleQueueAccount initialization params
     */
    static async init(client, account, params, devnetAddress) {
        var _a, _b;
        const tx = await sendAptosTx(client, account, `${devnetAddress}::oracle_queue_init_action::run`, [
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
            HexString.ensure(params.mint).hex(),
            params.enableBufferRelayers,
            params.maxSize,
        ], [(_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
        return [
            new OracleQueueAccount(client, account.address(), devnetAddress, (_b = params.coinType) !== null && _b !== void 0 ? _b : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    async loadData() {
        return (await this.client.getAccountResource(HexString.ensure(this.address).hex(), `${this.devnetAddress}::oracle_queue::OracleQueueAccount<${this.coinType}>`)).data;
    }
}
export class LeaseAccount {
    constructor(client, address, devnetAddress, coinType = "0x1::aptos_coin::AptosCoin") {
        this.client = client;
        this.address = address;
        this.devnetAddress = devnetAddress;
        this.coinType = coinType;
    }
    /**
     * Initialize a LeaseAccount
     * @param client
     * @param account account that will be the authority of the LeaseAccount
     * @param params LeaseInitParams initialization params
     */
    static async init(client, account, params, devnetAddress) {
        var _a, _b;
        const tx = await sendAptosTx(client, account, `${devnetAddress}::lease_init_action::run`, [
            HexString.ensure(params.queueAddress).hex(),
            HexString.ensure(params.withdrawAuthority).hex(),
            params.initialAmount,
        ], [(_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
        return [
            new LeaseAccount(client, account.address(), devnetAddress, (_b = params.coinType) !== null && _b !== void 0 ? _b : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    /**
     * Extend a lease
     * @param params CrankPushParams
     */
    async extend(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::lease_extend_action::run`, [HexString.ensure(this.address).hex(), params.loadAmount], [this.coinType]);
    }
    /**
     * Pop an aggregator off the Crank
     */
    async withdraw(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::lease_withdraw_action::run`, [[HexString.ensure(this.address).hex(), params.amount]], [this.coinType]);
    }
    async loadData() {
        return (await this.client.getAccountResource(HexString.ensure(this.address).hex(), `${this.devnetAddress}::lease::Lease<${this.coinType}>`)).data;
    }
}
export class OracleWallet {
    constructor(client, address, devnetAddress, coinType = "0x1::aptos_coin::AptosCoin") {
        this.client = client;
        this.address = address;
        this.devnetAddress = devnetAddress;
        this.coinType = coinType;
    }
    /**
     * Initialize an OracleWallet
     * @param client
     * @param account account that will be the authority of the OracleWallet
     * @param params OracleWalletInitParams initialization params
     */
    static async init(client, account, params, devnetAddress) {
        var _a, _b;
        const tx = await sendAptosTx(client, account, `${devnetAddress}::oracle_wallet_init_action::run`, [HexString.ensure(params.oracleAddress).hex()], [(_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
        return [
            new OracleWallet(client, account.address(), devnetAddress, (_b = params.coinType) !== null && _b !== void 0 ? _b : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    /**
     * Contributes to an oracle wallet
     * @param params OracleWalletContributeParams
     */
    async contribute(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::oracle_wallet_contribute_action::run`, [HexString.ensure(this.address).hex(), params.loadAmount], [this.coinType]);
    }
    /**
     * Withdraw from an OracleWallet
     */
    async withdraw(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::oracle_wallet_withdraw_action::run`, [[HexString.ensure(this.address).hex(), params.amount]], [this.coinType]);
    }
    async loadData() {
        return (await this.client.getAccountResource(HexString.ensure(this.address).hex(), `${this.devnetAddress}::oracle_wallet::OracleWallet<${this.coinType}>`)).data;
    }
}
export class Permission {
    constructor(client, devnetAddress) {
        this.client = client;
        this.devnetAddress = devnetAddress;
    }
    /**
     * Initialize a Permission
     * @param client
     * @param account
     * @param params PermissionInitParams initialization params
     */
    static async init(client, account, params, devnetAddress) {
        const tx = await sendRawAptosTx(client, account, `${devnetAddress}::permission_init_action::run`, [
            BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(params.authority)),
            BCS.bcsSerializeBytes(HexString.ensure(params.granter).toUint8Array()),
            BCS.bcsSerializeBytes(HexString.ensure(params.granter).toUint8Array()),
        ]);
        return [new Permission(client, devnetAddress), tx];
    }
    /**
     * Set a Permission
     */
    async set(account, params) {
        const tx = await sendRawAptosTx(this.client, account, `${this.devnetAddress}::permission_set_action::run`, [
            BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(params.authority)),
            BCS.bcsSerializeBytes(HexString.ensure(params.granter).toUint8Array()),
            BCS.bcsSerializeBytes(HexString.ensure(params.granter).toUint8Array()),
            BCS.bcsSerializeUint64(params.permission),
            BCS.bcsSerializeBool(params.enable),
        ]);
        return tx;
    }
}
function safeDiv(number_, denominator, decimals = 20) {
    const oldDp = Big.DP;
    Big.DP = decimals;
    const result = number_.div(denominator);
    Big.DP = oldDp;
    return result;
}
export async function createFeed(client, account, params, devnetAddress) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const seed = new AptosAccount().address();
    const resource_address = generateResourceAccountAddress(account, bcsAddressToBytes(seed));
    if (params.jobs.length > 8) {
        throw new Error("Max Job limit exceeded. The create_feed_action can only create up to 8 jobs at a time.");
    }
    // enforce size 8 jobs array
    let jobs = params.jobs.length < 8
        ? [
            ...params.jobs,
            ...new Array(8 - params.jobs.length).fill({
                name: "",
                metadata: "",
                authority: "",
                data: "",
                weight: 1,
            }),
        ]
        : params.jobs;
    const tx = await sendAptosTx(client, account, `${devnetAddress}::create_new_feed_action::run`, [
        // authority will own everything
        HexString.ensure(params.authority).hex(),
        // aggregator
        (_a = params.name) !== null && _a !== void 0 ? _a : "",
        (_b = params.metadata) !== null && _b !== void 0 ? _b : "",
        HexString.ensure(params.queueAddress).hex(),
        params.batchSize,
        params.minOracleResults,
        params.minJobResults,
        params.minUpdateDelaySeconds,
        (_c = params.startAfter) !== null && _c !== void 0 ? _c : 0,
        (_d = params.varianceThreshold) !== null && _d !== void 0 ? _d : 0,
        (_e = params.varianceThresholdScale) !== null && _e !== void 0 ? _e : 0,
        (_f = params.forceReportPeriod) !== null && _f !== void 0 ? _f : 0,
        (_g = params.expiration) !== null && _g !== void 0 ? _g : 0,
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
    ], [(_h = params.coinType) !== null && _h !== void 0 ? _h : "0x1::aptos_coin::AptosCoin"]);
    return [
        new AggregatorAccount(client, resource_address, devnetAddress, (_j = params.coinType) !== null && _j !== void 0 ? _j : "0x1::aptos_coin::AptosCoin"),
        tx,
    ];
}
export function bcsAddressToBytes(hexStr) {
    return BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(hexStr));
}
export function generateResourceAccountAddress(origin, seed) {
    const hash = SHA3.sha3_256.create();
    const userAddressBCS = bcsAddressToBytes(origin.address());
    hash.update(userAddressBCS);
    hash.update(seed);
    return `0x${hash.hex()}`;
}
//# sourceMappingURL=index.js.map