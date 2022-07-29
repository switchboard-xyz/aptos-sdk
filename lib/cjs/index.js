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
exports.OracleQueue = exports.Oracle = exports.Crank = exports.Job = exports.Aggregator = exports.State = exports.AptosEvent = exports.sendAptosTx = exports.AptosDecimal = exports.SWITCHBOARD_STATE_ADDRESS = exports.SWITCHBOARD_DEVNET_ADDRESS = void 0;
const aptos_1 = require("aptos");
const big_js_1 = __importDefault(require("big.js"));
const sbv2 = __importStar(require("@switchboard-xyz/switchboard-v2"));
// Address that deployed the module
exports.SWITCHBOARD_DEVNET_ADDRESS = "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";
// Address of the account that owns the Switchboard resource
exports.SWITCHBOARD_STATE_ADDRESS = "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";
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
async function sendAptosTx(client, signer, method, args) {
    const payload = {
        type: "script_function_payload",
        function: method,
        type_arguments: [],
        arguments: args,
    };
    const txnRequest = await client.generateTransaction(signer.address(), payload);
    const simulation = await client.simulateTransaction(signer, txnRequest);
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
const LeaseTable = {
    stateKey: `leases`,
    keyType: `vector<u8>`,
    valueType: `${exports.SWITCHBOARD_DEVNET_ADDRESS}::Lease::Lease`,
};
const PermissionTable = {
    stateKey: `permissions`,
    keyType: `vector<u8>`,
    valueType: `${exports.SWITCHBOARD_DEVNET_ADDRESS}::Permission::Permission`,
};
/**
 * Retrieve Table Item
 * @param client
 * @param tableType
 * @param key string to fetch table item by
 */
async function getTableItem(client, tableType, key) {
    var _a;
    // get table resource
    const switchboardTableResource = await client.getAccountResource(exports.SWITCHBOARD_STATE_ADDRESS, `${exports.SWITCHBOARD_DEVNET_ADDRESS}::Switchboard::State`);
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
        // Get the start sequence number in the EVENT STREAM, defaulting to the latest event.
        const [{ sequence_number }] = await this.client.getEventsByEventHandle(this.eventHandlerOwner, this.eventOwnerStruct, this.eventHandlerName, { limit: 1 });
        // type for this is string for some reason
        let lastSequenceNumber = sequence_number;
        this.intervalId = setInterval(async () => {
            const events = await this.client.getEventsByEventHandle(this.eventHandlerOwner, this.eventOwnerStruct, this.eventHandlerName, {
                start: Number(lastSequenceNumber) + 1,
                limit: 500,
            });
            if (events.length !== 0) {
                // increment sequence number
                lastSequenceNumber = events.at(-1).sequence_number;
            }
            for (let e of events) {
                try {
                    // fire off the callback for all new events
                    await callback(e);
                }
                catch (error) { }
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
    // try to load data from on-chain
    async loadData() {
        return await getTableItem(this.client, this.tableType, aptos_1.HexString.ensure(this.address).hex());
    }
}
class State {
    constructor(client, address, account) {
        this.client = client;
        this.address = address;
        this.account = account;
    }
    static async init(client, account) {
        const tx = await sendAptosTx(client, account, `${exports.SWITCHBOARD_DEVNET_ADDRESS}::SwitchboardInitAction::run`, []);
        return [new State(client, account.address(), account), tx];
    }
    async loadData() {
        return (await this.client.getAccountResource(this.address, `${exports.SWITCHBOARD_STATE_ADDRESS}::Switchboard::State`)).data;
    }
}
exports.State = State;
class Aggregator {
    constructor(client, address, account) {
        this.client = client;
        this.address = address;
        this.account = account;
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${aptos_1.HexString.ensure(exports.SWITCHBOARD_DEVNET_ADDRESS).hex()}::Aggregator::Aggregator`)).data;
    }
    async loadJobs() {
        const data = await this.loadData();
        const jobs = data.job_keys.map((key) => new Job(this.client, key));
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
    static async init(client, account, params) {
        var _a, _b, _c, _d, _e, _f, _g;
        const tx = await sendAptosTx(client, account, `${exports.SWITCHBOARD_DEVNET_ADDRESS}::AggregatorInitAction::run`, [
            aptos_1.HexString.ensure(exports.SWITCHBOARD_STATE_ADDRESS).hex(),
            Buffer.from((_a = params.name) !== null && _a !== void 0 ? _a : "").toString("hex"),
            Buffer.from((_b = params.metadata) !== null && _b !== void 0 ? _b : "").toString("hex"),
            params.queueAddress
                ? aptos_1.HexString.ensure(params.queueAddress).hex()
                : aptos_1.HexString.ensure("0x0").hex(),
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
        return [new Aggregator(client, params.address, account), tx];
    }
    async addJob(account, params) {
        return await sendAptosTx(this.client, account, `${exports.SWITCHBOARD_DEVNET_ADDRESS}::AggregatorAddJobAction::run`, [
            aptos_1.HexString.ensure(exports.SWITCHBOARD_STATE_ADDRESS).hex(),
            aptos_1.HexString.ensure(this.address).hex(),
            aptos_1.HexString.ensure(params.job).hex(),
            params.weight || 1,
        ]);
    }
    async saveResult(account, params) {
        return await sendAptosTx(this.client, account, `${exports.SWITCHBOARD_DEVNET_ADDRESS}::AggregatorSaveResultAction::run`, [
            aptos_1.HexString.ensure(exports.SWITCHBOARD_STATE_ADDRESS).hex(),
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
        return await sendAptosTx(this.client, this.account, `${exports.SWITCHBOARD_DEVNET_ADDRESS}::AggregatorOpenRoundAction::run`, [
            aptos_1.HexString.ensure(exports.SWITCHBOARD_STATE_ADDRESS).hex(),
            aptos_1.HexString.ensure(this.address).hex(),
        ]);
    }
}
exports.Aggregator = Aggregator;
class Job {
    constructor(client, address) {
        this.client = client;
        this.address = address;
    }
    async loadData() {
        return (await this.client.getAccountResource(this.address, `0x${exports.SWITCHBOARD_DEVNET_ADDRESS}::Job::Job`)).data;
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
    static async init(client, account, params) {
        const tx = await sendAptosTx(client, account, `${exports.SWITCHBOARD_DEVNET_ADDRESS}::JobInitAction::run`, [
            aptos_1.HexString.ensure(exports.SWITCHBOARD_STATE_ADDRESS).hex(),
            stringToHex(params.name),
            stringToHex(params.metadata),
            aptos_1.HexString.ensure(params.authority).hex(),
            params.data,
        ]);
        return [new Job(client, account.address()), tx];
    }
}
exports.Job = Job;
class Crank {
    constructor(client, address) {
        this.client = client;
        this.address = address;
    }
    /**
     * Initialize a Crank stored in the switchboard resource account
     * @param client
     * @param account account that will be the authority of the Crank
     * @param params CrankInitParams initialization params
     */
    static async init(client, account, params) {
        const tx = await sendAptosTx(client, account, `${exports.SWITCHBOARD_DEVNET_ADDRESS}::CrankInitAction::run`, [
            aptos_1.HexString.ensure(exports.SWITCHBOARD_STATE_ADDRESS).hex(),
            aptos_1.HexString.ensure(params.address).hex(),
            aptos_1.HexString.ensure(params.queueAddress).hex(),
        ]);
        return [new Crank(client, params.address), tx];
    }
    /**
     * Push an aggregator to a Crank
     * @param params CrankPushParams
     */
    async push(account, params) {
        return await sendAptosTx(this.client, account, `${exports.SWITCHBOARD_DEVNET_ADDRESS}::CrankPushAction::run`, [
            aptos_1.HexString.ensure(exports.SWITCHBOARD_STATE_ADDRESS).hex(),
            aptos_1.HexString.ensure(params.crankAddress).hex(),
            aptos_1.HexString.ensure(params.aggregatorAddress).hex(),
        ]);
    }
    /**
     * Pop an aggregator off the Crank
     * @param params CrankPopParams
     */
    async pop(account, params) {
        return await sendAptosTx(this.client, account, `${exports.SWITCHBOARD_DEVNET_ADDRESS}::CrankPopAction::run`, [
            aptos_1.HexString.ensure(exports.SWITCHBOARD_STATE_ADDRESS).hex(),
            aptos_1.HexString.ensure(params.crankAddress).hex(),
        ]);
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${aptos_1.HexString.ensure(exports.SWITCHBOARD_DEVNET_ADDRESS).hex()}::Crank::Crank`)).data;
    }
}
exports.Crank = Crank;
class Oracle {
    constructor(client, address) {
        this.client = client;
        this.address = address;
    }
    /**
     * Initialize a Oracle stored in the switchboard resource account
     * @param client
     * @param account
     * @param params Oracle initialization params
     */
    static async init(client, account, params) {
        const tx = await sendAptosTx(client, account, `${exports.SWITCHBOARD_DEVNET_ADDRESS}::OracleInitAction::run`, [
            aptos_1.HexString.ensure(exports.SWITCHBOARD_STATE_ADDRESS).hex(),
            stringToHex(params.name),
            stringToHex(params.metadata),
            aptos_1.HexString.ensure(params.authority).hex(),
            aptos_1.HexString.ensure(params.queue).hex(),
        ]);
        return [new Oracle(client, params.address), tx];
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${aptos_1.HexString.ensure(exports.SWITCHBOARD_DEVNET_ADDRESS).hex()}::Oracle::Oracle`)).data;
    }
    /**
     * Oracle Heartbeat Action
     */
    async heartbeat(account) {
        return await sendAptosTx(this.client, account, `${exports.SWITCHBOARD_DEVNET_ADDRESS}::OracleHeartbeatAction::run`, [
            aptos_1.HexString.ensure(exports.SWITCHBOARD_STATE_ADDRESS).hex(),
            aptos_1.HexString.ensure(this.address).hex(),
        ]);
    }
}
exports.Oracle = Oracle;
class OracleQueue {
    constructor(client, address) {
        this.client = client;
        this.address = address;
    }
    /**
     * Initialize a OracleQueue stored in the switchboard resource account
     * @param client
     * @param account
     * @param params OracleQueue initialization params
     */
    static async init(client, account, params) {
        const tx = await sendAptosTx(client, account, `${exports.SWITCHBOARD_DEVNET_ADDRESS}::OracleQueueInitAction::run`, [
            aptos_1.HexString.ensure(exports.SWITCHBOARD_STATE_ADDRESS).hex(),
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
        return [new OracleQueue(client, account.address()), tx];
    }
    async loadData() {
        return (await this.client.getAccountResource(aptos_1.HexString.ensure(this.address).hex(), `${aptos_1.HexString.ensure(exports.SWITCHBOARD_DEVNET_ADDRESS).hex()}::OracleQueue::OracleQueue`)).data;
    }
}
exports.OracleQueue = OracleQueue;
//# sourceMappingURL=index.js.map