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
exports.OracleQueue = exports.Oracle = exports.Crank = exports.Job = exports.Aggregator = exports.State = exports.AptosEvent = exports.sendAptosTx = exports.AptosDecimal = void 0;
const aptos_1 = require("aptos");
const big_js_1 = __importDefault(require("big.js"));
const sbv2 = __importStar(require("@switchboard-xyz/switchboard-v2"));
const anchor = __importStar(require("@project-serum/anchor"));
// Address that deployed the module
// export const SWITCHBOARD_DEVNET_ADDRESS = `0x${"2B3C332C6C95D3B717FDF3644A7633E8EFA7B1451193891A504A6A292EDC0039".toLowerCase()}`;
//
// // Address of the account that owns the Switchboard resource
// export const SWITCHBOARD_STATE_ADDRESS = `0x${"2B3C332C6C95D3B717FDF3644A7633E8EFA7B1451193891A504A6A292EDC0039".toLowerCase()}`;
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
        result = result.div(TEN.pow(this.scale));
        big_js_1.default.DP = oldDp;
        return result;
    }
    static fromBig(val) {
        const value = val.c.slice();
        let e = val.e;
        while (e > 18) {
            value.pop();
            e -= 1;
        }
        return new AptosDecimal(value.join(""), e, val.s === -1);
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
/** Convert string to hex-encoded utf-8 bytes. */
function stringToHex(text) {
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
async function sendAptosTx(client, signer, method, args, retryCount = 2) {
    const payload = {
        type: "script_function_payload",
        function: method,
        type_arguments: [],
        arguments: args,
    };
    const txnRequest = await client.generateTransaction(signer.address(), payload);
    const simulation = (await client.simulateTransaction(signer, txnRequest))[0];
    if (simulation.vm_status === "Out of gas") {
        if (retryCount > 0) {
            const faucetClient = new aptos_1.FaucetClient("https://fullnode.devnet.aptoslabs.com/", "https://faucet.devnet.aptoslabs.com");
            await faucetClient.fundAccount(signer.address(), 5000);
            return sendAptosTx(client, signer, method, args, --retryCount);
        }
    }
    if (simulation.success === false) {
        console.log(`TxGas: ${simulation.gas_used}`);
        console.log(`TxGas: ${simulation.hash}`);
        throw new Error(`TxFailure: ${simulation.vm_status}`);
    }
    else {
        console.log(`TxGas: ${simulation.gas_used}`);
    }
    const signedTxn = await client.signTransaction(signer, txnRequest);
    const transactionRes = await client.submitTransaction(signedTxn);
    await client.waitForTransaction(transactionRes.hash);
    return transactionRes.hash;
}
exports.sendAptosTx = sendAptosTx;
// const LeaseTable: TableType = {
// stateKey: `leases`,
// keyType: `vector<u8>`,
// valueType: `${SWITCHBOARD_DEVNET_ADDRESS}::Lease::Lease`,
// };
//
// const PermissionTable: TableType = {
// stateKey: `permissions`,
// keyType: `vector<u8>`,
// valueType: `${SWITCHBOARD_DEVNET_ADDRESS}::Permission::Permission`,
// };
/**
 * Retrieve Table Item
 * @param client
 * @param tableType
 * @param key string to fetch table item by
 */
async function getTableItem(pid, client, tableType, key) {
    var _a;
    // get table resource
    const switchboardTableResource = await client.getAccountResource(pid, `${pid}::Switchboard::State`);
    const handle = (_a = switchboardTableResource.data[tableType.stateKey]) === null || _a === void 0 ? void 0 : _a.handle;
    const getTokenTableItemRequest = {
        key_type: tableType.keyType,
        value_type: tableType.valueType,
        key: key,
    };
    try {
        // fetch table item (it's an object with the schema structure)
        const tableItem = await client.getTableItem(handle, getTokenTableItemRequest);
        return tableItem === null || tableItem === void 0 ? void 0 : tableItem.data;
    }
    catch (e) {
        console.log(e);
        return;
    }
}
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
        const ownerData = await this.client.getAccountResource(this.eventHandlerOwner.hex().toString(), this.eventOwnerStruct);
        try {
            lastSequenceNumber = (Number(ownerData.data[this.eventHandlerName].counter) - 1).toString();
        }
        catch (error) {
            console.error(JSON.stringify(ownerData, undefined, 2), error);
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
/**
 * Common Constructor
 */
class SwitchboardResource {
    constructor(tableType, client, address, account) {
        this.tableType = tableType;
        this.client = client;
        this.account = account;
        this.address = address;
    }
}
class State {
    constructor(client, address, account, devnetAddress) {
        this.client = client;
        this.address = address;
        this.account = account;
        this.devnetAddress = devnetAddress;
    }
    static async init(client, account, devnetAddress) {
        const tx = await sendAptosTx(client, account, `${devnetAddress}::SwitchboardInitAction::run`, []);
        return [new State(client, account.address(), account, devnetAddress), tx];
    }
    async loadData() {
        return (await this.client.getAccountResource(this.address, `${this.devnetAddress}::Switchboard::State`)).data;
    }
}
exports.State = State;
class Aggregator {
    constructor(client, address, account, devnetAddress, stateAddress) {
        this.client = client;
        this.address = address;
        this.account = account;
        this.devnetAddress = devnetAddress;
        this.stateAddress = stateAddress;
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${aptos_1.HexString.ensure(this.devnetAddress).hex()}::Aggregator::Aggregator`)).data;
    }
    async loadJobs() {
        const data = await this.loadData();
        const jobs = data.job_keys.map((key) => new Job(this.client, key, this.devnetAddress, this.stateAddress));
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
    static async init(client, account, params, devnetAddress, stateAddress) {
        var _a, _b, _c, _d, _e, _f, _g;
        const tx = await sendAptosTx(client, account, `${devnetAddress}::AggregatorInitAction::run`, [
            aptos_1.HexString.ensure(stateAddress).hex(),
            Buffer.from((_a = params.name) !== null && _a !== void 0 ? _a : "").toString("hex"),
            Buffer.from((_b = params.metadata) !== null && _b !== void 0 ? _b : "").toString("hex"),
            aptos_1.HexString.ensure(params.queueAddress).hex(),
            params.batchSize.toString(),
            params.minOracleResults.toString(),
            params.minJobResults.toString(),
            params.minUpdateDelaySeconds.toString(),
            ((_c = params.startAfter) !== null && _c !== void 0 ? _c : 0).toString(),
            ((_d = params.varianceThreshold) !== null && _d !== void 0 ? _d : 0).toString(),
            (_e = params.varianceThresholdScale) !== null && _e !== void 0 ? _e : 0,
            ((_f = params.forceReportPeriod) !== null && _f !== void 0 ? _f : 0).toString(),
            ((_g = params.expiration) !== null && _g !== void 0 ? _g : 0).toString(),
            aptos_1.HexString.ensure(params.authority).hex(),
        ]);
        return [
            new Aggregator(client, account.address(), account, devnetAddress, stateAddress),
            tx,
        ];
    }
    async addJob(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::AggregatorAddJobAction::run`, [
            aptos_1.HexString.ensure(this.stateAddress).hex(),
            aptos_1.HexString.ensure(this.address).hex(),
            aptos_1.HexString.ensure(params.job).hex(),
            params.weight || 1,
        ]);
    }
    async saveResult(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::AggregatorSaveResultAction::run`, [
            aptos_1.HexString.ensure(this.stateAddress).hex(),
            aptos_1.HexString.ensure(params.oracle_address).hex(),
            aptos_1.HexString.ensure(this.address).hex(),
            params.oracle_idx.toString(),
            params.error,
            params.value_num.toString(),
            params.value_scale_factor,
            params.value_neg,
            stringToHex(params.jobs_checksum),
        ]);
    }
    async openRound() {
        if (!this.account) {
            throw "Save Result Error: No Payer Found";
        }
        return await sendAptosTx(this.client, this.account, `${this.devnetAddress}::AggregatorOpenRoundAction::run`, [
            aptos_1.HexString.ensure(this.stateAddress).hex(),
            aptos_1.HexString.ensure(this.address).hex(),
        ]);
    }
    async watch(callback) {
        const event = new AptosEvent(this.client, aptos_1.HexString.ensure(this.stateAddress), `${this.devnetAddress}::Switchboard::State`, "aggregator_update_events", 1000);
        await event.onTrigger(callback);
        return event;
    }
    async shouldReportValue(value, aggregator) {
        var _a, _b;
        if (((_b = (_a = aggregator.latestConfirmedRound) === null || _a === void 0 ? void 0 : _a.numSuccess) !== null && _b !== void 0 ? _b : 0) === 0) {
            return true;
        }
        const timestamp = new anchor.BN(Math.round(Date.now() / 1000), 10);
        const startAfter = new anchor.BN(aggregator.startAfter, 10);
        if (startAfter.gt(timestamp)) {
            return false;
        }
        const varianceThreshold = new AptosDecimal(aggregator.varianceThreshold.value, aggregator.varianceThreshold.dec, aggregator.varianceThreshold.neg).toBig();
        const latestResult = new AptosDecimal(aggregator.latestConfirmedRound.result.value, aggregator.latestConfirmedRound.result.dec, aggregator.latestConfirmedRound.result.neg).toBig();
        const forceReportPeriod = new anchor.BN(aggregator.forceReportPeriod, 10);
        const lastTimestamp = new anchor.BN(aggregator.latestConfirmedRound.roundOpenTimestamp, 10);
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
    constructor(client, address, devnetAddress, stateAddress) {
        this.client = client;
        this.address = address;
        this.devnetAddress = devnetAddress;
        this.stateAddress = stateAddress;
    }
    async loadData() {
        return (await this.client.getAccountResource(this.address, `${this.devnetAddress}::Job::Job`)).data;
    }
    async loadJob() {
        const data = await this.loadData();
        return sbv2.OracleJob.decodeDelimited(Buffer.from(data.data.slice(2), "hex"));
    }
    /**
     * Initialize a Job stored in the switchboard resource account
     * @param client
     * @param account
     * @param params JobInitParams initialization params
     */
    static async init(client, account, params, devnetAddress, stateAddress) {
        const tx = await sendAptosTx(client, account, `${devnetAddress}::JobInitAction::run`, [
            aptos_1.HexString.ensure(stateAddress).hex(),
            stringToHex(params.name),
            stringToHex(params.metadata),
            aptos_1.HexString.ensure(params.authority).hex(),
            params.data,
        ]);
        return [
            new Job(client, account.address(), devnetAddress, stateAddress),
            tx,
        ];
    }
}
exports.Job = Job;
class Crank {
    constructor(client, address, devnetAddress, stateAddress) {
        this.client = client;
        this.address = address;
        this.devnetAddress = devnetAddress;
        this.stateAddress = stateAddress;
    }
    /**
     * Initialize a Crank stored in the switchboard resource account
     * @param client
     * @param account account that will be the authority of the Crank
     * @param params CrankInitParams initialization params
     */
    static async init(client, account, params, devnetAddress, stateAddress) {
        const tx = await sendAptosTx(client, account, `${devnetAddress}::CrankInitAction::run`, [
            aptos_1.HexString.ensure(stateAddress).hex(),
            aptos_1.HexString.ensure(params.address).hex(),
            aptos_1.HexString.ensure(params.queueAddress).hex(),
        ]);
        return [
            new Crank(client, account.address(), devnetAddress, stateAddress),
            tx,
        ];
    }
    /**
     * Push an aggregator to a Crank
     * @param params CrankPushParams
     */
    async push(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::CrankPushAction::run`, [
            aptos_1.HexString.ensure(this.stateAddress).hex(),
            aptos_1.HexString.ensure(params.crankAddress).hex(),
            aptos_1.HexString.ensure(params.aggregatorAddress).hex(),
        ]);
    }
    /**
     * Pop an aggregator off the Crank
     * @param params CrankPopParams
     */
    async pop(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::CrankPopAction::run`, [
            aptos_1.HexString.ensure(this.stateAddress).hex(),
            aptos_1.HexString.ensure(params.crankAddress).hex(),
        ]);
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${aptos_1.HexString.ensure(this.devnetAddress).hex()}::Crank::Crank`)).data;
    }
}
exports.Crank = Crank;
class Oracle {
    constructor(client, address, devnetAddress, stateAddress) {
        this.client = client;
        this.address = address;
        this.devnetAddress = devnetAddress;
        this.stateAddress = stateAddress;
    }
    /**
     * Initialize a Oracle stored in the switchboard resource account
     * @param client
     * @param account
     * @param params Oracle initialization params
     */
    static async init(client, account, params, devnetAddress, stateAddress) {
        const tx = await sendAptosTx(client, account, `${devnetAddress}::OracleInitAction::run`, [
            aptos_1.HexString.ensure(stateAddress).hex(),
            stringToHex(params.name),
            stringToHex(params.metadata),
            aptos_1.HexString.ensure(params.authority).hex(),
            aptos_1.HexString.ensure(params.queue).hex(),
        ]);
        return [
            new Oracle(client, account.address(), devnetAddress, stateAddress),
            tx,
        ];
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${aptos_1.HexString.ensure(this.devnetAddress).hex()}::Oracle::Oracle`)).data;
    }
    /**
     * Oracle Heartbeat Action
     */
    async heartbeat(account) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::OracleHeartbeatAction::run`, [
            aptos_1.HexString.ensure(this.stateAddress).hex(),
            aptos_1.HexString.ensure(this.address).hex(),
        ]);
    }
}
exports.Oracle = Oracle;
class OracleQueue {
    constructor(client, address, devnetAddress, stateAddress) {
        this.client = client;
        this.address = address;
        this.devnetAddress = devnetAddress;
        this.stateAddress = stateAddress;
    }
    /**
     * Initialize a OracleQueue stored in the switchboard resource account
     * @param client
     * @param account
     * @param params OracleQueue initialization params
     */
    static async init(client, account, params, devnetAddress, stateAddress) {
        const tx = await sendAptosTx(client, account, `${devnetAddress}::OracleQueueInitAction::run`, [
            aptos_1.HexString.ensure(stateAddress).hex(),
            stringToHex(params.name),
            stringToHex(params.metadata),
            aptos_1.HexString.ensure(params.authority).hex(),
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
            aptos_1.HexString.ensure(params.mint).hex(),
            params.enableBufferRelayers,
            params.maxSize.toString(),
        ]);
        return [
            new OracleQueue(client, account.address(), devnetAddress, stateAddress),
            tx,
        ];
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${aptos_1.HexString.ensure(this.devnetAddress).hex()}::OracleQueue::OracleQueue`)).data;
    }
}
exports.OracleQueue = OracleQueue;
function safeDiv(number_, denominator, decimals = 20) {
    const oldDp = big_js_1.default.DP;
    big_js_1.default.DP = decimals;
    const result = number_.div(denominator);
    big_js_1.default.DP = oldDp;
    return result;
}
//# sourceMappingURL=index.js.map