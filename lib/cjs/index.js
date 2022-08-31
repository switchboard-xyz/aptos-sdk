"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAggregators = exports.generateResourceAccountAddress = exports.bcsAddressToBytes = exports.createFeed = exports.createFeedTx = exports.Permission = exports.OracleWallet = exports.LeaseAccount = exports.OracleQueueAccount = exports.OracleAccount = exports.CrankAccount = exports.JobAccount = exports.AggregatorAccount = exports.StateAccount = exports.AptosEvent = exports.sendRawAptosTx = exports.simulateAndRun = exports.getAptosTx = exports.sendAptosTx = exports.SwitchboardPermission = exports.AptosDecimal = exports.SWITCHBOARD_STATE_ADDRESS = exports.SWITCHBOARD_DEVNET_ADDRESS = exports.OracleJob = void 0;
const aptos_1 = require("aptos");
const big_js_1 = __importDefault(require("big.js"));
const common_1 = require("@switchboard-xyz/common");
const bn_js_1 = __importDefault(require("bn.js"));
const SHA3 = __importStar(require("js-sha3"));
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
        throw new Error(`TxFailure: ${simulation.vm_status}`);
    }
    const signedTxn = await client.signTransaction(signer, txnRequest);
    const transactionRes = await client.submitTransaction(signedTxn);
    await client.waitForTransaction(transactionRes.hash);
    return transactionRes.hash;
}
exports.sendAptosTx = sendAptosTx;
/**
 * Generates an aptos tx for client
 * @param client
 * @param method Aptos module method (ex: 0xSwitchboard::aggregator_add_job_action)
 * @param args Arguments for method (converts numbers to strings)
 * @param type_args Arguments for type_args
 * @returns
 */
async function getAptosTx(client, user, method, args, type_args = []) {
    const payload = {
        type: "entry_function_payload",
        function: method,
        type_arguments: type_args,
        arguments: args,
    };
    return await client.generateTransaction(user, payload, {
        max_gas_amount: "5000",
    });
}
exports.getAptosTx = getAptosTx;
async function simulateAndRun(client, user, txn) {
    const simulation = (await client.simulateTransaction(user, txn))[0];
    if (simulation.success === false) {
        console.log(simulation);
        throw new Error(`TxFailure: ${simulation.vm_status}`);
    }
    const signedTxn = await client.signTransaction(user, txn);
    const transactionRes = await client.submitTransaction(signedTxn);
    await client.waitForTransaction(transactionRes.hash);
    return transactionRes.hash;
}
exports.simulateAndRun = simulateAndRun;
async function sendRawAptosTx(client, signer, method, raw_args, raw_type_args = [], retryCount = 2) {
    // We need to pass a token type to the `transfer` function.
    const methodInfo = method.split("::");
    const entryFunctionPayload = new aptos_1.TxnBuilderTypes.TransactionPayloadEntryFunction(aptos_1.TxnBuilderTypes.EntryFunction.natural(
    // Fully qualified module name, `AccountAddress::ModuleName`
    `${methodInfo[0]}::${methodInfo[1]}`, 
    // Module function
    methodInfo[2], 
    // The coin type to transfer
    raw_type_args, 
    // Arguments for function `transfer`: receiver account address and amount to transfer
    raw_args));
    const rawTxn = await client.generateRawTransaction(signer.address(), entryFunctionPayload, { maxGasAmount: BigInt(5000) });
    const bcsTxn = aptos_1.AptosClient.generateBCSTransaction(signer, rawTxn);
    const simulation = (await client.simulateTransaction(signer, rawTxn))[0];
    if (simulation.vm_status === "Out of gas") {
        if (retryCount > 0) {
            const faucetClient = new aptos_1.FaucetClient("https://fullnode.devnet.aptoslabs.com/v1", "https://faucet.devnet.aptoslabs.com");
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
exports.sendRawAptosTx = sendRawAptosTx;
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
class StateAccount {
    constructor(client, address, payer, switchboardAddress) {
        this.client = client;
        this.address = address;
        this.payer = payer;
        this.switchboardAddress = switchboardAddress;
    }
    static async init(client, account, switchboardAddress) {
        const tx = await sendAptosTx(client, account, `${switchboardAddress}::switchboard_init_action::run`, []);
        return [
            new StateAccount(client, account.address(), account, switchboardAddress),
            tx,
        ];
    }
    async loadData() {
        return (await this.client.getAccountResource(this.address, `${this.switchboardAddress}::switchboard::State`)).data;
    }
}
exports.StateAccount = StateAccount;
class AggregatorAccount {
    constructor(client, address, switchboardAddress, coinType = "0x1::aptos_coin::AptosCoin") {
        this.client = client;
        this.address = address;
        this.switchboardAddress = switchboardAddress;
        this.coinType = coinType;
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${this.switchboardAddress}::aggregator::Aggregator`)).data;
    }
    async loadJobs() {
        const data = await this.loadData();
        const jobs = data.job_keys.map((key) => new JobAccount(this.client, aptos_1.HexString.ensure(key).hex(), aptos_1.HexString.ensure(this.switchboardAddress).hex()));
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
    static async init(client, account, params, switchboardAddress) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const { mantissa: vtMantissa, scale: vtScale } = AptosDecimal.fromBig(params.varianceThreshold);
        const tx = await sendAptosTx(client, account, `${switchboardAddress}::aggregator_init_action::run`, [
            (_a = params.name) !== null && _a !== void 0 ? _a : "",
            (_b = params.metadata) !== null && _b !== void 0 ? _b : "",
            aptos_1.HexString.ensure(params.queueAddress).hex(),
            params.batchSize,
            params.minOracleResults,
            params.minJobResults,
            params.minUpdateDelaySeconds,
            (_c = params.startAfter) !== null && _c !== void 0 ? _c : 0,
            Number(vtMantissa),
            Number(vtScale),
            (_d = params.forceReportPeriod) !== null && _d !== void 0 ? _d : 0,
            (_e = params.expiration) !== null && _e !== void 0 ? _e : 0,
            (_f = params.disableCrank) !== null && _f !== void 0 ? _f : false,
            (_g = params.historySize) !== null && _g !== void 0 ? _g : 0,
            (_h = params.readCharge) !== null && _h !== void 0 ? _h : 0,
            params.rewardEscrow
                ? aptos_1.HexString.ensure(params.rewardEscrow).hex()
                : account.address().hex(),
            aptos_1.HexString.ensure(params.authority).hex(),
        ], [(_j = params.coinType) !== null && _j !== void 0 ? _j : "0x1::aptos_coin::AptosCoin"]);
        return [
            new AggregatorAccount(client, account.address(), switchboardAddress, (_k = params.coinType) !== null && _k !== void 0 ? _k : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    async addJob(account, params) {
        return await sendAptosTx(this.client, account, `${this.switchboardAddress}::aggregator_add_job_action::run`, [
            aptos_1.HexString.ensure(this.address).hex(),
            aptos_1.HexString.ensure(params.job).hex(),
            params.weight || 1,
        ]);
    }
    async addJobTx(authority, params) {
        return await getAptosTx(this.client, authority, `${this.switchboardAddress}::aggregator_add_job_action::run`, [
            aptos_1.HexString.ensure(this.address).hex(),
            aptos_1.HexString.ensure(params.job).hex(),
            params.weight || 1,
        ]);
    }
    async saveResult(account, params) {
        var _a;
        const { mantissa: valueMantissa, scale: valueScale, neg: valueNeg, } = AptosDecimal.fromBig(params.value);
        const { mantissa: minResponseMantissa, scale: minResponseScale, neg: minResponseNeg, } = AptosDecimal.fromBig(params.minResponse);
        const { mantissa: maxResponseMantissa, scale: maxResponseScale, neg: maxResponseNeg, } = AptosDecimal.fromBig(params.maxResponse);
        return sendRawAptosTx(this.client, account, `${this.switchboardAddress}::aggregator_save_result_action::run`, [
            aptos_1.BCS.bcsToBytes(aptos_1.TxnBuilderTypes.AccountAddress.fromHex(params.oracleAddress)),
            aptos_1.BCS.bcsToBytes(aptos_1.TxnBuilderTypes.AccountAddress.fromHex(this.address)),
            aptos_1.BCS.bcsSerializeUint64(params.oracleIdx),
            aptos_1.BCS.bcsSerializeBool(params.error),
            aptos_1.BCS.bcsSerializeU128(Number(valueMantissa)),
            aptos_1.BCS.bcsSerializeU8(valueScale),
            aptos_1.BCS.bcsSerializeBool(valueNeg),
            aptos_1.BCS.bcsSerializeBytes(aptos_1.HexString.ensure(params.jobsChecksum).toUint8Array()),
            aptos_1.BCS.bcsSerializeU128(Number(minResponseMantissa)),
            aptos_1.BCS.bcsSerializeU8(minResponseScale),
            aptos_1.BCS.bcsSerializeBool(minResponseNeg),
            aptos_1.BCS.bcsSerializeU128(Number(maxResponseMantissa)),
            aptos_1.BCS.bcsSerializeU8(maxResponseScale),
            aptos_1.BCS.bcsSerializeBool(maxResponseNeg),
        ], [
            new aptos_1.TxnBuilderTypes.TypeTagStruct(aptos_1.TxnBuilderTypes.StructTag.fromString((_a = this.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin")),
        ]);
    }
    async openRound(account) {
        return await sendAptosTx(this.client, account, `${this.switchboardAddress}::aggregator_open_round_action::run`, [aptos_1.HexString.ensure(this.address).hex()], [this.coinType]);
    }
    async openRoundTx(accountAddress) {
        var _a;
        return await getAptosTx(this.client, accountAddress, `${this.switchboardAddress}::aggregator_open_round_action::run`, [aptos_1.HexString.ensure(this.address).hex()], [(_a = this.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
    }
    async setConfigTx(accountAddress, params) {
        var _a, _b, _c, _d, _e, _f;
        const { mantissa: vtMantissa, scale: vtScale } = AptosDecimal.fromBig(params.varianceThreshold);
        const tx = await getAptosTx(this.client, accountAddress, `${this.switchboardAddress}::aggregator_init_action::run`, [
            aptos_1.HexString.ensure(this.address).hex(),
            (_a = params.name) !== null && _a !== void 0 ? _a : "",
            (_b = params.metadata) !== null && _b !== void 0 ? _b : "",
            aptos_1.HexString.ensure(params.queueAddress).hex(),
            params.batchSize,
            params.minOracleResults,
            params.minJobResults,
            params.minUpdateDelaySeconds,
            (_c = params.startAfter) !== null && _c !== void 0 ? _c : 0,
            Number(vtMantissa),
            vtScale,
            (_d = params.forceReportPeriod) !== null && _d !== void 0 ? _d : 0,
            (_e = params.expiration) !== null && _e !== void 0 ? _e : 0,
            aptos_1.HexString.ensure(params.authority).hex(),
        ], [(_f = params.coinType) !== null && _f !== void 0 ? _f : "0x1::aptos_coin::AptosCoin"]);
    }
    async watch(callback) {
        const event = new AptosEvent(this.client, aptos_1.HexString.ensure(this.switchboardAddress), `${this.switchboardAddress}::switchboard::State`, "aggregator_update_events", 1000);
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
exports.AggregatorAccount = AggregatorAccount;
class JobAccount {
    constructor(client, address, switchboardAddress) {
        this.client = client;
        this.address = address;
        this.switchboardAddress = switchboardAddress;
    }
    async loadData() {
        return (await this.client.getAccountResource(this.address, `${aptos_1.HexString.ensure(this.switchboardAddress).hex()}::job::Job`)).data;
    }
    async loadJob() {
        const data = await this.loadData();
        const job = common_1.OracleJob.decodeDelimited(Buffer.from(data.data.slice(2), "hex"));
        return job;
    }
    /**
     * Initialize a JobAccount
     * @param client
     * @param account
     * @param params JobInitParams initialization params
     */
    static async init(client, account, params, switchboardAddress) {
        const tx = await sendAptosTx(client, account, `${switchboardAddress}::job_init_action::run`, [
            params.name,
            params.metadata,
            aptos_1.HexString.ensure(params.authority).hex(),
            params.data,
        ]);
        return [new JobAccount(client, account.address(), switchboardAddress), tx];
    }
    /**
     * Initialize a JobAccount
     * @param client
     * @param account
     * @param params JobInitParams initialization params
     */
    static async initTx(client, account, params, switchboardAddress) {
        const tx = await getAptosTx(client, account, `${switchboardAddress}::job_init_action::run`, [
            params.name,
            params.metadata,
            aptos_1.HexString.ensure(params.authority).hex(),
            params.data,
        ]);
        return [new JobAccount(client, account, switchboardAddress), tx];
    }
}
exports.JobAccount = JobAccount;
class CrankAccount {
    constructor(client, address, switchboardAddress, coinType = "0x1::aptos_coin::AptosCoin") {
        this.client = client;
        this.address = address;
        this.switchboardAddress = switchboardAddress;
        this.coinType = coinType;
    }
    /**
     * Initialize a Crank
     * @param client
     * @param account account that will be the authority of the Crank
     * @param params CrankInitParams initialization params
     */
    static async init(client, account, params, switchboardAddress) {
        var _a, _b;
        const tx = await sendAptosTx(client, account, `${switchboardAddress}::crank_init_action::run`, [aptos_1.HexString.ensure(params.queueAddress).hex()], [(_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
        return [
            new CrankAccount(client, account.address(), switchboardAddress, (_b = params.coinType) !== null && _b !== void 0 ? _b : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    /**
     * Push an aggregator to a Crank
     * @param params CrankPushParams
     */
    async push(account, params) {
        var _a;
        return await sendAptosTx(this.client, account, `${this.switchboardAddress}::crank_push_action::run`, [
            aptos_1.HexString.ensure(this.address).hex(),
            aptos_1.HexString.ensure(params.aggregatorAddress).hex(),
        ], [(_a = this.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
    }
    async pushTx(account, params) {
        var _a;
        return await getAptosTx(this.client, account, `${this.switchboardAddress}::crank_push_action::run`, [
            aptos_1.HexString.ensure(this.address).hex(),
            aptos_1.HexString.ensure(params.aggregatorAddress).hex(),
        ], [(_a = this.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
    }
    /**
     * Pop an aggregator off the Crank
     */
    async pop(account) {
        return await sendAptosTx(this.client, account, `${this.switchboardAddress}::crank_pop_action::run`, [aptos_1.HexString.ensure(this.address).hex()], [this.coinType]);
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${this.switchboardAddress}::crank::Crank`)).data;
    }
}
exports.CrankAccount = CrankAccount;
class OracleAccount {
    constructor(client, address, switchboardAddress, coinType = "0x1::aptos_coin::AptosCoin") {
        this.client = client;
        this.address = address;
        this.switchboardAddress = switchboardAddress;
        this.coinType = coinType;
    }
    /**
     * Initialize a Oracle
     * @param client
     * @param account
     * @param params Oracle initialization params
     */
    static async init(client, account, params, switchboardAddress) {
        var _a, _b;
        const tx = await sendAptosTx(client, account, `${switchboardAddress}::oracle_init_action::run`, [
            params.name,
            params.metadata,
            aptos_1.HexString.ensure(params.authority).hex(),
            aptos_1.HexString.ensure(params.queue).hex(),
        ], [(_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
        return [
            new OracleAccount(client, account.address(), switchboardAddress, (_b = params.coinType) !== null && _b !== void 0 ? _b : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${this.switchboardAddress}::oracle::Oracle`)).data;
    }
    /**
     * Oracle Heartbeat Action
     */
    async heartbeat(account) {
        return await sendAptosTx(this.client, account, `${this.switchboardAddress}::oracle_heartbeat_action::run`, [aptos_1.HexString.ensure(this.address).hex()], [this.coinType]);
    }
}
exports.OracleAccount = OracleAccount;
class OracleQueueAccount {
    constructor(client, address, switchboardAddress, coinType = "0x1::aptos_coin::AptosCoin") {
        this.client = client;
        this.address = address;
        this.switchboardAddress = switchboardAddress;
        this.coinType = coinType;
    }
    /**
     * Initialize an OracleQueueAccount
     * @param client
     * @param account
     * @param params OracleQueueAccount initialization params
     */
    static async init(client, account, params, switchboardAddress) {
        var _a, _b;
        const tx = await sendAptosTx(client, account, `${switchboardAddress}::oracle_queue_init_action::run`, [
            params.name,
            params.metadata,
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
            new OracleQueueAccount(client, account.address(), switchboardAddress, (_b = params.coinType) !== null && _b !== void 0 ? _b : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${this.switchboardAddress}::oracle_queue::OracleQueue<${this.coinType}>`)).data;
    }
}
exports.OracleQueueAccount = OracleQueueAccount;
class LeaseAccount {
    constructor(client, address, switchboardAddress, coinType = "0x1::aptos_coin::AptosCoin") {
        this.client = client;
        this.address = address;
        this.switchboardAddress = switchboardAddress;
        this.coinType = coinType;
    }
    /**
     * Initialize a LeaseAccount
     * @param client
     * @param account account that will be the authority of the LeaseAccount
     * @param params LeaseInitParams initialization params
     */
    static async init(client, account, params, switchboardAddress) {
        var _a, _b;
        const tx = await sendAptosTx(client, account, `${switchboardAddress}::lease_init_action::run`, [
            aptos_1.HexString.ensure(params.queueAddress).hex(),
            aptos_1.HexString.ensure(params.withdrawAuthority).hex(),
            params.initialAmount,
        ], [(_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
        return [
            new LeaseAccount(client, account.address(), switchboardAddress, (_b = params.coinType) !== null && _b !== void 0 ? _b : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    /**
     * Extend a lease
     * @param params CrankPushParams
     */
    async extend(account, params) {
        return await sendAptosTx(this.client, account, `${this.switchboardAddress}::lease_extend_action::run`, [aptos_1.HexString.ensure(this.address).hex(), params.loadAmount], [this.coinType]);
    }
    /**
     * Extend a lease
     * @param params CrankPushParams
     */
    async extendTx(account, params) {
        return await getAptosTx(this.client, account, `${this.switchboardAddress}::lease_extend_action::run`, [aptos_1.HexString.ensure(this.address).hex(), params.loadAmount], [this.coinType]);
    }
    /**
     * Pop an aggregator off the Crank
     */
    async withdraw(account, params) {
        return await sendAptosTx(this.client, account, `${this.switchboardAddress}::lease_withdraw_action::run`, [[aptos_1.HexString.ensure(this.address).hex(), params.amount]], [this.coinType]);
    }
    /**
     * Pop an aggregator off the Crank
     */
    async withdrawTx(account, params) {
        return await getAptosTx(this.client, account, `${this.switchboardAddress}::lease_withdraw_action::run`, [[aptos_1.HexString.ensure(this.address).hex(), params.amount]], [this.coinType]);
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${this.switchboardAddress}::lease::Lease<${this.coinType}>`)).data;
    }
}
exports.LeaseAccount = LeaseAccount;
class OracleWallet {
    constructor(client, address, switchboardAddress, coinType = "0x1::aptos_coin::AptosCoin") {
        this.client = client;
        this.address = address;
        this.switchboardAddress = switchboardAddress;
        this.coinType = coinType;
    }
    /**
     * Initialize an OracleWallet
     * @param client
     * @param account account that will be the authority of the OracleWallet
     * @param params OracleWalletInitParams initialization params
     */
    static async init(client, account, params, switchboardAddress) {
        var _a, _b;
        const tx = await sendAptosTx(client, account, `${switchboardAddress}::oracle_wallet_init_action::run`, [aptos_1.HexString.ensure(params.oracleAddress).hex()], [(_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
        return [
            new OracleWallet(client, account.address(), switchboardAddress, (_b = params.coinType) !== null && _b !== void 0 ? _b : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    /**
     * Contributes to an oracle wallet
     * @param params OracleWalletContributeParams
     */
    async contribute(account, params) {
        return await sendAptosTx(this.client, account, `${this.switchboardAddress}::oracle_wallet_contribute_action::run`, [aptos_1.HexString.ensure(this.address).hex(), params.loadAmount], [this.coinType]);
    }
    /**
     * Withdraw from an OracleWallet
     */
    async withdraw(account, params) {
        return await sendAptosTx(this.client, account, `${this.switchboardAddress}::oracle_wallet_withdraw_action::run`, [[aptos_1.HexString.ensure(this.address).hex(), params.amount]], [this.coinType]);
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${this.switchboardAddress}::oracle_wallet::OracleWallet<${this.coinType}>`)).data;
    }
}
exports.OracleWallet = OracleWallet;
class Permission {
    constructor(client, switchboardAddress) {
        this.client = client;
        this.switchboardAddress = switchboardAddress;
    }
    /**
     * Initialize a Permission
     * @param client
     * @param account
     * @param params PermissionInitParams initialization params
     */
    static async init(client, account, params, switchboardAddress) {
        const tx = await sendRawAptosTx(client, account, `${switchboardAddress}::permission_init_action::run`, [
            aptos_1.BCS.bcsToBytes(aptos_1.TxnBuilderTypes.AccountAddress.fromHex(params.authority)),
            aptos_1.BCS.bcsSerializeBytes(aptos_1.HexString.ensure(params.granter).toUint8Array()),
            aptos_1.BCS.bcsSerializeBytes(aptos_1.HexString.ensure(params.granter).toUint8Array()),
        ]);
        return [new Permission(client, switchboardAddress), tx];
    }
    /**
     * Set a Permission
     */
    async set(account, params) {
        const tx = await sendRawAptosTx(this.client, account, `${this.switchboardAddress}::permission_set_action::run`, [
            aptos_1.BCS.bcsToBytes(aptos_1.TxnBuilderTypes.AccountAddress.fromHex(params.authority)),
            aptos_1.BCS.bcsSerializeBytes(aptos_1.HexString.ensure(params.granter).toUint8Array()),
            aptos_1.BCS.bcsSerializeBytes(aptos_1.HexString.ensure(params.granter).toUint8Array()),
            aptos_1.BCS.bcsSerializeUint64(params.permission),
            aptos_1.BCS.bcsSerializeBool(params.enable),
        ]);
        return tx;
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
async function createFeedTx(client, authority, params, switchboardAddress) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const seed = new aptos_1.AptosAccount().address();
    const resource_address = generateResourceAccountAddress(aptos_1.HexString.ensure(authority), bcsAddressToBytes(aptos_1.HexString.ensure(seed)));
    if (params.jobs.length > 8) {
        throw new Error("Max Job limit exceeded. The create_feed_action can only create up to 8 jobs at a time.");
    }
    const { mantissa: vtMantissa, scale: vtScale } = AptosDecimal.fromBig(params.varianceThreshold);
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
    return [
        new AggregatorAccount(client, resource_address, switchboardAddress, (_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"),
        await getAptosTx(client, authority, `${switchboardAddress}::create_feed_action::run`, [
            // authority will own everything
            aptos_1.HexString.ensure(params.authority).hex(),
            // aggregator
            (_b = params.name) !== null && _b !== void 0 ? _b : "",
            (_c = params.metadata) !== null && _c !== void 0 ? _c : "",
            aptos_1.HexString.ensure(params.queueAddress).hex(),
            params.batchSize,
            params.minOracleResults,
            params.minJobResults,
            params.minUpdateDelaySeconds,
            (_d = params.startAfter) !== null && _d !== void 0 ? _d : 0,
            Number(vtMantissa),
            vtScale,
            (_e = params.forceReportPeriod) !== null && _e !== void 0 ? _e : 0,
            (_f = params.expiration) !== null && _f !== void 0 ? _f : 0,
            (_g = params.disableCrank) !== null && _g !== void 0 ? _g : false,
            (_h = params.historySize) !== null && _h !== void 0 ? _h : 0,
            (_j = params.readCharge) !== null && _j !== void 0 ? _j : 0,
            params.rewardEscrow
                ? aptos_1.HexString.ensure(params.rewardEscrow).hex()
                : aptos_1.HexString.ensure(params.authority).hex(),
            // lease
            params.initialLoadAmount,
            // jobs
            ...jobs.flatMap((jip) => {
                return [jip.name, jip.metadata, jip.data, jip.weight || 1];
            }),
            // crank
            aptos_1.HexString.ensure(params.crank).hex(),
            // seed
            seed.hex(),
        ], [(_k = params.coinType) !== null && _k !== void 0 ? _k : "0x1::aptos_coin::AptosCoin"]),
    ];
}
exports.createFeedTx = createFeedTx;
async function createFeed(client, account, params, switchboardAddress) {
    const [aggregator, txn] = await createFeedTx(client, account.address(), params, switchboardAddress);
    const tx = await simulateAndRun(client, account, txn);
    return [aggregator, tx];
}
exports.createFeed = createFeed;
function bcsAddressToBytes(hexStr) {
    return aptos_1.BCS.bcsToBytes(aptos_1.TxnBuilderTypes.AccountAddress.fromHex(hexStr));
}
exports.bcsAddressToBytes = bcsAddressToBytes;
function generateResourceAccountAddress(origin, seed) {
    const hash = SHA3.sha3_256.create();
    const userAddressBCS = bcsAddressToBytes(origin);
    hash.update(userAddressBCS);
    hash.update(seed);
    return `0x${hash.hex()}`;
}
exports.generateResourceAccountAddress = generateResourceAccountAddress;
async function fetchAggregators(client, authority, switchboardAddress) {
    const handle = (await client.getAccountResource(switchboardAddress, `${switchboardAddress}::switchboard::State`)).data.aggregator_authorities.handle;
    const tableItems = await client.getTableItem(handle, {
        key_type: `address`,
        value_type: `vector<address>`,
        key: authority,
    });
    return await Promise.all(tableItems.map((aggregatorAddress) => new AggregatorAccount(client, aggregatorAddress, switchboardAddress).loadData()));
}
exports.fetchAggregators = fetchAggregators;
//# sourceMappingURL=index.js.map