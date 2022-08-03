import { HexString, FaucetClient, } from "aptos";
import Big from "big.js";
import * as sbv2 from "@switchboard-xyz/switchboard-v2";
import * as anchor from "@project-serum/anchor";
// Address that deployed the module
export const SWITCHBOARD_DEVNET_ADDRESS = `0x${"2B3C332C6C95D3B717FDF3644A7633E8EFA7B1451193891A504A6A292EDC0039".toLowerCase()}`;
// Address of the account that owns the Switchboard resource
export const SWITCHBOARD_STATE_ADDRESS = `0x${"2B3C332C6C95D3B717FDF3644A7633E8EFA7B1451193891A504A6A292EDC0039".toLowerCase()}`;
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
        result = result.div(TEN.pow(this.scale));
        Big.DP = oldDp;
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
export async function sendAptosTx(client, signer, method, args, retryCount = 2) {
    const payload = {
        type: "script_function_payload",
        function: method,
        type_arguments: [],
        arguments: args,
    };
    const txnRequest = await client.generateTransaction(signer.address(), payload);
    const simulation = await client.simulateTransaction(signer, txnRequest);
    if (simulation.vm_status === "Out of gas") {
        if (retryCount > 0) {
            const faucetClient = new FaucetClient(client.nodeUrl, "https://faucet.devnet.aptoslabs.com");
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
const LeaseTable = {
    stateKey: `leases`,
    keyType: `vector<u8>`,
    valueType: `${SWITCHBOARD_DEVNET_ADDRESS}::Lease::Lease`,
};
const PermissionTable = {
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
async function getTableItem(client, tableType, key) {
    var _a;
    // get table resource
    const switchboardTableResource = await client.getAccountResource(SWITCHBOARD_STATE_ADDRESS, `${SWITCHBOARD_DEVNET_ADDRESS}::Switchboard::State`);
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
                    start: Number(lastSequenceNumber) + 1,
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
        return await getTableItem(this.client, this.tableType, HexString.ensure(this.address).hex());
    }
}
export class State {
    constructor(client, address, account, devnetAddress = SWITCHBOARD_DEVNET_ADDRESS) {
        this.client = client;
        this.address = address;
        this.account = account;
        this.devnetAddress = devnetAddress;
    }
    static async init(client, account, devnetAddress = SWITCHBOARD_DEVNET_ADDRESS) {
        const tx = await sendAptosTx(client, account, `${devnetAddress}::SwitchboardInitAction::run`, []);
        return [new State(client, account.address(), account, devnetAddress), tx];
    }
    async loadData() {
        return (await this.client.getAccountResource(this.address, `${SWITCHBOARD_STATE_ADDRESS}::Switchboard::State`)).data;
    }
}
export class Aggregator {
    constructor(client, address, account, devnetAddress = SWITCHBOARD_DEVNET_ADDRESS, stateAddress = SWITCHBOARD_STATE_ADDRESS) {
        this.client = client;
        this.address = address;
        this.account = account;
        this.devnetAddress = devnetAddress;
        this.stateAddress = stateAddress;
    }
    async loadData() {
        return (await this.client.getAccountResource(HexString.ensure(this.address).hex(), `${HexString.ensure(this.devnetAddress).hex()}::Aggregator::Aggregator`)).data;
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
    static async init(client, account, params, devnetAddress = SWITCHBOARD_DEVNET_ADDRESS, stateAddress = SWITCHBOARD_STATE_ADDRESS) {
        var _a, _b, _c, _d, _e, _f, _g;
        const tx = await sendAptosTx(client, account, `${devnetAddress}::AggregatorInitAction::run`, [
            HexString.ensure(stateAddress).hex(),
            Buffer.from((_a = params.name) !== null && _a !== void 0 ? _a : "").toString("hex"),
            Buffer.from((_b = params.metadata) !== null && _b !== void 0 ? _b : "").toString("hex"),
            HexString.ensure(params.queueAddress).hex(),
            params.batchSize.toString(),
            params.minOracleResults.toString(),
            params.minJobResults.toString(),
            params.minUpdateDelaySeconds.toString(),
            ((_c = params.startAfter) !== null && _c !== void 0 ? _c : 0).toString(),
            ((_d = params.varianceThreshold) !== null && _d !== void 0 ? _d : 0).toString(),
            (_e = params.varianceThresholdScale) !== null && _e !== void 0 ? _e : 0,
            ((_f = params.forceReportPeriod) !== null && _f !== void 0 ? _f : 0).toString(),
            ((_g = params.expiration) !== null && _g !== void 0 ? _g : 0).toString(),
            HexString.ensure(params.authority).hex(),
        ]);
        return [
            new Aggregator(client, account.address(), account, devnetAddress, stateAddress),
            tx,
        ];
    }
    async addJob(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::AggregatorAddJobAction::run`, [
            HexString.ensure(this.stateAddress).hex(),
            HexString.ensure(this.address).hex(),
            HexString.ensure(params.job).hex(),
            params.weight || 1,
        ]);
    }
    async saveResult(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::AggregatorSaveResultAction::run`, [
            HexString.ensure(this.stateAddress).hex(),
            HexString.ensure(params.oracle_address).hex(),
            HexString.ensure(this.address).hex(),
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
            HexString.ensure(this.stateAddress).hex(),
            HexString.ensure(this.address).hex(),
        ]);
    }
    async watch(callback) {
        const event = new AptosEvent(this.client, HexString.ensure(this.stateAddress), `${this.devnetAddress}::Switchboard::State`, "aggregator_update_events", 1000);
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
        const changePercent = new Big(1).minus(diff).mul(100);
        return changePercent.gt(varianceThreshold);
    }
}
export class Job {
    constructor(client, address, devnetAddress = SWITCHBOARD_DEVNET_ADDRESS, stateAddress = SWITCHBOARD_STATE_ADDRESS) {
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
    static async init(client, account, params, devnetAddress = SWITCHBOARD_DEVNET_ADDRESS, stateAddress = SWITCHBOARD_STATE_ADDRESS) {
        const tx = await sendAptosTx(client, account, `${devnetAddress}::JobInitAction::run`, [
            HexString.ensure(stateAddress).hex(),
            stringToHex(params.name),
            stringToHex(params.metadata),
            HexString.ensure(params.authority).hex(),
            params.data,
        ]);
        return [
            new Job(client, account.address(), devnetAddress, stateAddress),
            tx,
        ];
    }
}
export class Crank {
    constructor(client, address, devnetAddress = SWITCHBOARD_DEVNET_ADDRESS, stateAddress = SWITCHBOARD_STATE_ADDRESS) {
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
    static async init(client, account, params, devnetAddress = SWITCHBOARD_DEVNET_ADDRESS, stateAddress = SWITCHBOARD_STATE_ADDRESS) {
        const tx = await sendAptosTx(client, account, `${devnetAddress}::CrankInitAction::run`, [
            HexString.ensure(stateAddress).hex(),
            HexString.ensure(params.address).hex(),
            HexString.ensure(params.queueAddress).hex(),
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
            HexString.ensure(this.stateAddress).hex(),
            HexString.ensure(params.crankAddress).hex(),
            HexString.ensure(params.aggregatorAddress).hex(),
        ]);
    }
    /**
     * Pop an aggregator off the Crank
     * @param params CrankPopParams
     */
    async pop(account, params) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::CrankPopAction::run`, [
            HexString.ensure(this.stateAddress).hex(),
            HexString.ensure(params.crankAddress).hex(),
        ]);
    }
    async loadData() {
        return (await this.client.getAccountResource(HexString.ensure(this.address).hex(), `${HexString.ensure(this.devnetAddress).hex()}::Crank::Crank`)).data;
    }
}
export class Oracle {
    constructor(client, address, devnetAddress = SWITCHBOARD_DEVNET_ADDRESS, stateAddress = SWITCHBOARD_STATE_ADDRESS) {
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
    static async init(client, account, params, devnetAddress = SWITCHBOARD_DEVNET_ADDRESS, stateAddress = SWITCHBOARD_STATE_ADDRESS) {
        const tx = await sendAptosTx(client, account, `${devnetAddress}::OracleInitAction::run`, [
            HexString.ensure(stateAddress).hex(),
            stringToHex(params.name),
            stringToHex(params.metadata),
            HexString.ensure(params.authority).hex(),
            HexString.ensure(params.queue).hex(),
        ]);
        return [
            new Oracle(client, account.address(), devnetAddress, stateAddress),
            tx,
        ];
    }
    async loadData() {
        return (await this.client.getAccountResource(HexString.ensure(this.address).hex(), `${HexString.ensure(this.devnetAddress).hex()}::Oracle::Oracle`)).data;
    }
    /**
     * Oracle Heartbeat Action
     */
    async heartbeat(account) {
        return await sendAptosTx(this.client, account, `${this.devnetAddress}::OracleHeartbeatAction::run`, [
            HexString.ensure(this.stateAddress).hex(),
            HexString.ensure(this.address).hex(),
        ]);
    }
}
export class OracleQueue {
    constructor(client, address, devnetAddress = SWITCHBOARD_DEVNET_ADDRESS, stateAddress = SWITCHBOARD_STATE_ADDRESS) {
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
    static async init(client, account, params, devnetAddress = SWITCHBOARD_DEVNET_ADDRESS, stateAddress = SWITCHBOARD_STATE_ADDRESS) {
        const tx = await sendAptosTx(client, account, `${devnetAddress}::OracleQueueInitAction::run`, [
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
        ]);
        return [
            new OracleQueue(client, account.address(), devnetAddress, stateAddress),
            tx,
        ];
    }
    async loadData() {
        return (await this.client.getAccountResource(HexString.ensure(this.address).hex(), `${HexString.ensure(this.devnetAddress).hex()}::OracleQueue::OracleQueue`)).data;
    }
}
function safeDiv(number_, denominator, decimals = 20) {
    const oldDp = Big.DP;
    Big.DP = decimals;
    const result = number_.div(denominator);
    Big.DP = oldDp;
    return result;
}
//# sourceMappingURL=index.js.map