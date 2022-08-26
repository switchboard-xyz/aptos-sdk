"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Permission = exports.OracleWallet = exports.Lease = exports.OracleQueue = exports.Oracle = exports.Crank = exports.Job = exports.Aggregator = exports.State = exports.AptosEvent = exports.sendAptosTx = exports.SwitchboardPermission = exports.AptosDecimal = exports.SWITCHBOARD_STATE_ADDRESS = exports.SWITCHBOARD_DEVNET_ADDRESS = exports.OracleJob = void 0;
const aptos_1 = require("aptos");
const big_js_1 = __importDefault(require("big.js"));
const common_1 = require("@switchboard-xyz/common");
const bn_js_1 = __importDefault(require("bn.js"));
var common_2 = require("@switchboard-xyz/common");
Object.defineProperty(exports, "OracleJob", { enumerable: true, get: function () { return common_2.OracleJob; } });
// Address that deployed the module
exports.SWITCHBOARD_DEVNET_ADDRESS = ``;
// Address of the account that owns the Switchboard resource
exports.SWITCHBOARD_STATE_ADDRESS = ``;
class AptosDecimal {
    constructor(mantissa, scale, neg) {
        this.mantissa = mantissa;
        this.scale = scale;
        this.neg = neg;
    }
    toBig() {
        const oldDp = big_js_1.default.DP;
        big_js_1.default.DP = 18;
        let result = new big_js_1.default(this.mantissa);
        if (this.neg === true) {
            result = result.mul(-1);
        }
        const TEN = new big_js_1.default(10);
        result = safeDiv(result, TEN.pow(this.scale));
        big_js_1.default.DP = oldDp;
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
exports.AptosDecimal = AptosDecimal;
var SwitchboardPermission;
(function (SwitchboardPermission) {
    SwitchboardPermission[SwitchboardPermission["PERMIT_ORACLE_HEARTBEAT"] = 0] = "PERMIT_ORACLE_HEARTBEAT";
    SwitchboardPermission[SwitchboardPermission["PERMIT_ORACLE_QUEUE_USAGE"] = 1] = "PERMIT_ORACLE_QUEUE_USAGE";
    SwitchboardPermission[SwitchboardPermission["PERMIT_VRF_REQUESTS"] = 2] = "PERMIT_VRF_REQUESTS";
})(SwitchboardPermission = exports.SwitchboardPermission || (exports.SwitchboardPermission = {}));
/** Convert string to hex-encoded utf-8 bytes. */
function stringToHex(text) {
    return Buffer.from(text, "utf-8").toString("hex");
}
/**
 * Sends and waits for an aptos tx to be confirmed
 * @param client
 * @param signer
 * @param method Aptos module method (ex: 0xSwitchboard::aggregator_add_job_action)
 * @param args Arguments for method (converts numbers to strings)
 * @returns
 */
async function sendAptosTx(client, signer, method, args, type_args = [], retryCount = 2) {
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
            const faucetClient = new aptos_1.FaucetClient("https://fullnode.devnet.aptoslabs.com/v1", "https://faucet.devnet.aptoslabs.com");
            await faucetClient.fundAccount(signer.address(), 5000);
            return sendAptosTx(client, signer, method, args, type_args, --retryCount);
        }
    }
    if (simulation.success === false) {
        console.log(simulation);
        // console.log(`TxGas: ${simulation.gas_used}`);
        // console.log(`TxGas: ${simulation.hash}`);
        throw new Error(`TxFailure: ${simulation.vm_status}`);
    }
    else {
        // console.log(`TxGas: ${simulation.gas_used}`);
    }
    const signedTxn = await client.signTransaction(signer, txnRequest);
    const transactionRes = await client.submitTransaction(signedTxn);
    await client.waitForTransaction(transactionRes.hash);
    return transactionRes.hash;
}
exports.sendAptosTx = sendAptosTx;
/**
 * Poll Events on Aptos
 * @Note uncleared setTimeout calls will keep processes from ending organically (SIGTERM is needed)
 */
class AptosEvent {
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
exports.AptosEvent = AptosEvent;
class State {
    constructor(client, address, payer, devnetAddress) {
        this.client = client;
        this.address = address;
        this.payer = payer;
        this.devnetAddress = devnetAddress;
    }
    static async init(client, account, devnetAddress) {
        const tx = await sendAptosTx(client, account, `${devnetAddress}::switchboard_init_action::run`, []);
        return [new State(client, account.address(), account, devnetAddress), tx];
    }
    async loadData() {
        return (await this.client.getAccountResource(this.address, `${this.devnetAddress}::switchboard::State`)).data;
    }
}
exports.State = State;
class Aggregator {
    constructor(client, address, devnetAddress, coinType = "0x1::aptos_coin::AptosCoin") {
        this.client = client;
        this.address = address;
        this.devnetAddress = devnetAddress;
        this.coinType = coinType;
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${this.devnetAddress}::aggregator::Aggregator`)).data;
    }
    async loadJobs() {
        const data = await this.loadData();
        const jobs = data.job_keys.map((key) => new Job(this.client, key, this.devnetAddress));
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
            aptos_1.HexString.ensure(params.queueAddress).hex(),
            params.batchSize,
            params.minOracleResults,
            params.minJobResults,
            params.minUpdateDelaySeconds,
            (_c = params.startAfter) !== null && _c !== void 0 ? _c : 0,
            (_d = params.varianceThreshold) !== null && _d !== void 0 ? _d : 0,
            (_e = params.varianceThresholdScale) !== null && _e !== void 0 ? _e : 0,
            (_f = params.forceReportPeriod) !== null && _f !== void 0 ? _f : 0,
            (_g = params.expiration) !== null && _g !== void 0 ? _g : 0,
            aptos_1.HexString.ensure(params.authority).hex(),
        ], [(_h = params.coinType) !== null && _h !== void 0 ? _h : "0x1::aptos_coin::AptosCoin"]);
        return [
            new Aggregator(client, account.address(), devnetAddress, (_j = params.coinType) !== null && _j !== void 0 ? _j : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    async addJob(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::AggregatorAddJobAction::run`, [
            aptos_1.HexString.ensure(this.address).hex(),
            aptos_1.HexString.ensure(params.job).hex(),
            params.weight || 1,
        ]);
    }
    async saveResult(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::aggregator_save_result_action::run`, [
            aptos_1.HexString.ensure(params.oracleAddress).hex(),
            aptos_1.HexString.ensure(this.address).hex(),
            params.oracleIdx,
            params.error,
            params.valueNum,
            params.valueScaleFactor,
            params.valueNeg,
            stringToHex(params.jobsChecksum),
            params.minResponseNum,
            params.minResponseScaleFactor,
            params.minResponseNeg,
            params.maxResponseNum,
            params.maxResponseScaleFactor,
            params.maxResponseNeg,
        ], [this.coinType]);
    }
    async openRound(account) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::aggregator_open_round_action::run`, [aptos_1.HexString.ensure(this.address).hex()], [this.coinType]);
    }
    async watch(callback) {
        const event = new AptosEvent(this.client, aptos_1.HexString.ensure(this.devnetAddress), `${this.devnetAddress}::switchboard::State`, "aggregator_update_events", 1000);
        await event.onTrigger(callback);
        return event;
    }
    static async shouldReportValue(value, aggregator) {
        var _a, _b;
        if (((_b = (_a = aggregator.latestConfirmedRound) === null || _a === void 0 ? void 0 : _a.numSuccess) !== null && _b !== void 0 ? _b : 0) === 0) {
            return true;
        }
        const timestamp = new bn_js_1.default(Math.round(Date.now() / 1000), 10);
        const startAfter = new bn_js_1.default(aggregator.startAfter, 10);
        if (startAfter.gt(timestamp)) {
            return false;
        }
        const varianceThreshold = new AptosDecimal(aggregator.varianceThreshold.mantissa, aggregator.varianceThreshold.dec, aggregator.varianceThreshold.neg).toBig();
        const latestResult = new AptosDecimal(aggregator.latestConfirmedRound.result.mantissa, aggregator.latestConfirmedRound.result.dec, aggregator.latestConfirmedRound.result.neg).toBig();
        const forceReportPeriod = new bn_js_1.default(aggregator.forceReportPeriod, 10);
        const lastTimestamp = new bn_js_1.default(aggregator.latestConfirmedRound.roundOpenTimestamp, 10);
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
        const changePercent = new big_js_1.default(1).minus(diff).mul(100);
        return changePercent.gt(varianceThreshold);
    }
}
exports.Aggregator = Aggregator;
class Job {
    constructor(client, address, devnetAddress) {
        this.client = client;
        this.address = address;
        this.devnetAddress = devnetAddress;
    }
    async loadData() {
        return (await this.client.getAccountResource(this.address, `${this.devnetAddress}::job::Job`)).data;
    }
    async loadJob() {
        const data = await this.loadData();
        return common_1.OracleJob.decodeDelimited(Buffer.from(data.data.slice(2), "hex"));
    }
    /**
     * Initialize a Job
     * @param client
     * @param account
     * @param params JobInitParams initialization params
     */
    static async init(client, account, params, devnetAddress) {
        const tx = await sendAptosTx(client, account, `${devnetAddress}::job_init_action::run`, [
            stringToHex(params.name),
            stringToHex(params.metadata),
            aptos_1.HexString.ensure(params.authority).hex(),
            params.data,
        ]);
        return [new Job(client, account.address(), devnetAddress), tx];
    }
}
exports.Job = Job;
class Crank {
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
        const tx = await sendAptosTx(client, account, `${devnetAddress}::crank_init_action::run`, [aptos_1.HexString.ensure(params.queueAddress).hex()], [(_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
        return [
            new Crank(client, account.address(), devnetAddress, (_b = params.coinType) !== null && _b !== void 0 ? _b : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    /**
     * Push an aggregator to a Crank
     * @param params CrankPushParams
     */
    async push(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::crank_push_action::run`, [
            aptos_1.HexString.ensure(this.address).hex(),
            aptos_1.HexString.ensure(params.aggregatorAddress).hex(),
        ], [this.coinType]);
    }
    /**
     * Pop an aggregator off the Crank
     */
    async pop(account) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::crank_pop_action::run`, [aptos_1.HexString.ensure(this.address).hex()], [this.coinType]);
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${this.devnetAddress}::crank::Crank`)).data;
    }
}
exports.Crank = Crank;
class Oracle {
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
            stringToHex(params.name),
            stringToHex(params.metadata),
            aptos_1.HexString.ensure(params.authority).hex(),
            aptos_1.HexString.ensure(params.queue).hex(),
        ], [(_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
        return [
            new Oracle(client, account.address(), devnetAddress, (_b = params.coinType) !== null && _b !== void 0 ? _b : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${this.devnetAddress}::oracle::Oracle`)).data;
    }
    /**
     * Oracle Heartbeat Action
     */
    async heartbeat(account) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::oracle_heartbeat_action::run`, [aptos_1.HexString.ensure(this.address).hex()], [this.coinType]);
    }
}
exports.Oracle = Oracle;
class OracleQueue {
    constructor(client, address, devnetAddress, coinType = "0x1::aptos_coin::AptosCoin") {
        this.client = client;
        this.address = address;
        this.devnetAddress = devnetAddress;
        this.coinType = coinType;
    }
    /**
     * Initialize an OracleQueue
     * @param client
     * @param account
     * @param params OracleQueue initialization params
     */
    static async init(client, account, params, devnetAddress) {
        var _a, _b;
        const tx = await sendAptosTx(client, account, `${devnetAddress}::oracle_queue_init_action::run`, [
            stringToHex(params.name),
            stringToHex(params.metadata),
            aptos_1.HexString.ensure(params.authority).hex(),
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
            aptos_1.HexString.ensure(params.mint).hex(),
            params.enableBufferRelayers,
            params.maxSize,
        ], [(_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
        return [
            new OracleQueue(client, account.address(), devnetAddress, (_b = params.coinType) !== null && _b !== void 0 ? _b : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${this.devnetAddress}::oracle_queue::OracleQueue<${this.coinType}>`)).data;
    }
}
exports.OracleQueue = OracleQueue;
class Lease {
    constructor(client, address, devnetAddress, coinType = "0x1::aptos_coin::AptosCoin") {
        this.client = client;
        this.address = address;
        this.devnetAddress = devnetAddress;
        this.coinType = coinType;
    }
    /**
     * Initialize a Lease
     * @param client
     * @param account account that will be the authority of the Lease
     * @param params LeaseInitParams initialization params
     */
    static async init(client, account, params, devnetAddress) {
        var _a, _b;
        const tx = await sendAptosTx(client, account, `${devnetAddress}::lease_init_action::run`, [
            aptos_1.HexString.ensure(params.queueAddress).hex(),
            aptos_1.HexString.ensure(params.withdrawAuthority).hex(),
            params.initialAmount,
        ], [(_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
        return [
            new Lease(client, account.address(), devnetAddress, (_b = params.coinType) !== null && _b !== void 0 ? _b : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    /**
     * Extend a lease
     * @param params CrankPushParams
     */
    async extend(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::lease_extend_action::run`, [aptos_1.HexString.ensure(this.address).hex(), params.loadAmount], [this.coinType]);
    }
    /**
     * Pop an aggregator off the Crank
     */
    async withdraw(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::lease_withdraw_action::run`, [[aptos_1.HexString.ensure(this.address).hex(), params.amount]], [this.coinType]);
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${this.devnetAddress}::lease::Lease<${this.coinType}>`)).data;
    }
}
exports.Lease = Lease;
class OracleWallet {
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
        const tx = await sendAptosTx(client, account, `${devnetAddress}::oracle_wallet_init_action::run`, [aptos_1.HexString.ensure(params.oracleAddress).hex()], [(_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
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
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::oracle_wallet_contribute_action::run`, [aptos_1.HexString.ensure(this.address).hex(), params.loadAmount], [this.coinType]);
    }
    /**
     * Withdraw from an OracleWallet
     */
    async withdraw(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::oracle_wallet_withdraw_action::run`, [[aptos_1.HexString.ensure(this.address).hex(), params.amount]], [this.coinType]);
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${this.devnetAddress}::oracle_wallet::OracleWallet<${this.coinType}>`)).data;
    }
}
exports.OracleWallet = OracleWallet;
class Permission {
    constructor(client, address, devnetAddress) {
        this.client = client;
        this.address = address;
        this.devnetAddress = devnetAddress;
    }
    /**
     * Initialize a Permission
     * @param client
     * @param account
     * @param params PermissionInitParams initialization params
     */
    static async init(client, account, params, devnetAddress) {
        const tx = await sendAptosTx(client, account, `${devnetAddress}::permission_init_action::run`, [
            aptos_1.HexString.ensure(params.authority).hex(),
            aptos_1.HexString.ensure(params.granter).hex(),
            aptos_1.HexString.ensure(params.grantee).hex(),
        ]);
        return [new Permission(client, account.address(), devnetAddress), tx];
    }
    /**
     * Set a Permission
     */
    async set(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::permission_set_action::run`, [
            aptos_1.HexString.ensure(params.authority).hex(),
            aptos_1.HexString.ensure(params.granter).hex(),
            aptos_1.HexString.ensure(params.grantee).hex(),
            params.permission,
            params.enable,
        ]);
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${this.devnetAddress}::permission::Permission`)).data;
    }
}
exports.Permission = Permission;
function safeDiv(number_, denominator, decimals = 20) {
    const oldDp = big_js_1.default.DP;
    big_js_1.default.DP = decimals;
    const result = number_.div(denominator);
    big_js_1.default.DP = oldDp;
    return result;
}
async function createFeed(client, account, devnetAddress, aggregatorParams, jobInitParams, initialLoadAmount, crank) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (jobInitParams.length > 8) {
        throw new Error("Max Job limit exceeded. The create_feed_action can only create up to 8 jobs at a time.");
    }
    // enforce size 8 jobs array
    let jobs = jobInitParams.length < 8
        ? [
            ...jobInitParams,
            ...new Array(8 - jobInitParams.length).fill({
                name: "",
                metadata: "",
                authority: "",
                data: "",
            }),
        ]
        : jobInitParams;
    const tx = await sendAptosTx(client, account, `${devnetAddress}::aggregator_init_action::run`, [
        // authority will own everything
        aptos_1.HexString.ensure(aggregatorParams.authority).hex(),
        // aggregator
        Buffer.from((_a = aggregatorParams.name) !== null && _a !== void 0 ? _a : "").toString("hex"),
        Buffer.from((_b = aggregatorParams.metadata) !== null && _b !== void 0 ? _b : "").toString("hex"),
        aptos_1.HexString.ensure(aggregatorParams.queueAddress).hex(),
        aggregatorParams.batchSize,
        aggregatorParams.minOracleResults,
        aggregatorParams.minJobResults,
        aggregatorParams.minUpdateDelaySeconds,
        (_c = aggregatorParams.startAfter) !== null && _c !== void 0 ? _c : 0,
        (_d = aggregatorParams.varianceThreshold) !== null && _d !== void 0 ? _d : 0,
        (_e = aggregatorParams.varianceThresholdScale) !== null && _e !== void 0 ? _e : 0,
        (_f = aggregatorParams.forceReportPeriod) !== null && _f !== void 0 ? _f : 0,
        (_g = aggregatorParams.expiration) !== null && _g !== void 0 ? _g : 0,
        // lease
        initialLoadAmount,
        // jobs
        ...jobs.flatMap((jip) => {
            return [
                stringToHex(jip.name),
                stringToHex(jip.metadata),
                aptos_1.HexString.ensure(jip.authority).hex(),
                jip.data,
            ];
        }),
        // crank
        aptos_1.HexString.ensure(crank).hex(),
    ], [(_h = aggregatorParams.coinType) !== null && _h !== void 0 ? _h : "0x1::aptos_coin::AptosCoin"]);
}
//# sourceMappingURL=index.js.map