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
/**
 * Generates an aptos tx for client
 * @param method Aptos module method (ex: 0xSwitchboard::aggregator_add_job_action)
 * @param args Arguments for method (converts numbers to strings)
 * @param type_args Arguments for type_args
 * @returns
 */
export function getAptosTx(method, args, type_args = []) {
    const payload = {
        type: "entry_function_payload",
        function: method,
        type_arguments: type_args,
        arguments: args,
    };
    return payload;
}
export async function simulateAndRun(client, user, txn) {
    const txnRequest = await client.generateTransaction(user.address(), txn, { max_gas_amount: "5000" });
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
export class AggregatorAccount {
    constructor(client, address, switchboardAddress, coinType = "0x1::aptos_coin::AptosCoin") {
        this.client = client;
        this.address = address;
        this.switchboardAddress = switchboardAddress;
        this.coinType = coinType;
    }
    async loadData() {
        return (await this.client.getAccountResource(HexString.ensure(this.address).hex(), `${this.switchboardAddress}::aggregator::Aggregator`)).data;
    }
    async loadJobs() {
        const data = await this.loadData();
        const jobs = data.job_keys.map((key) => new JobAccount(this.client, HexString.ensure(key).hex(), HexString.ensure(this.switchboardAddress).hex()));
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const { mantissa: vtMantissa, scale: vtScale } = AptosDecimal.fromBig((_a = params.varianceThreshold) !== null && _a !== void 0 ? _a : new Big(0));
        const tx = await sendAptosTx(client, account, `${switchboardAddress}::aggregator_init_action::run`, [
            (_b = params.name) !== null && _b !== void 0 ? _b : "",
            (_c = params.metadata) !== null && _c !== void 0 ? _c : "",
            HexString.ensure(params.queueAddress).hex(),
            params.batchSize,
            params.minOracleResults,
            params.minJobResults,
            params.minUpdateDelaySeconds,
            (_d = params.startAfter) !== null && _d !== void 0 ? _d : 0,
            Number(vtMantissa),
            Number(vtScale),
            (_e = params.forceReportPeriod) !== null && _e !== void 0 ? _e : 0,
            (_f = params.expiration) !== null && _f !== void 0 ? _f : 0,
            (_g = params.disableCrank) !== null && _g !== void 0 ? _g : false,
            (_h = params.historySize) !== null && _h !== void 0 ? _h : 0,
            (_j = params.readCharge) !== null && _j !== void 0 ? _j : 0,
            params.rewardEscrow
                ? HexString.ensure(params.rewardEscrow).hex()
                : account.address().hex(),
            (_k = params.gasPrice) !== null && _k !== void 0 ? _k : 0,
            params.gasPriceFeed
                ? HexString.ensure(params.gasPriceFeed).hex()
                : "0x0",
            HexString.ensure(params.authority).hex(),
        ], [(_l = params.coinType) !== null && _l !== void 0 ? _l : "0x1::aptos_coin::AptosCoin"]);
        return [
            new AggregatorAccount(client, account.address(), switchboardAddress, (_m = params.coinType) !== null && _m !== void 0 ? _m : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    async addJob(account, params) {
        return await sendAptosTx(this.client, account, `${this.switchboardAddress}::aggregator_add_job_action::run`, [
            HexString.ensure(this.address).hex(),
            HexString.ensure(params.job).hex(),
            params.weight || 1,
        ]);
    }
    addJobTx(params) {
        return getAptosTx(`${this.switchboardAddress}::aggregator_add_job_action::run`, [
            HexString.ensure(this.address).hex(),
            HexString.ensure(params.job).hex(),
            params.weight || 1,
        ]);
    }
    async saveResult(account, params) {
        var _a;
        const { mantissa: valueMantissa, scale: valueScale, neg: valueNeg, } = AptosDecimal.fromBig(params.value);
        const { mantissa: minResponseMantissa, scale: minResponseScale, neg: minResponseNeg, } = AptosDecimal.fromBig(params.minResponse);
        const { mantissa: maxResponseMantissa, scale: maxResponseScale, neg: maxResponseNeg, } = AptosDecimal.fromBig(params.maxResponse);
        return sendRawAptosTx(this.client, account, `${this.switchboardAddress}::aggregator_save_result_action::run`, [
            BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(params.oracleAddress)),
            BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(this.address)),
            BCS.bcsSerializeUint64(params.oracleIdx),
            BCS.bcsSerializeBool(params.error),
            BCS.bcsSerializeU128(Number(valueMantissa)),
            BCS.bcsSerializeU8(valueScale),
            BCS.bcsSerializeBool(valueNeg),
            BCS.bcsSerializeBytes(HexString.ensure(params.jobsChecksum).toUint8Array()),
            BCS.bcsSerializeU128(Number(minResponseMantissa)),
            BCS.bcsSerializeU8(minResponseScale),
            BCS.bcsSerializeBool(minResponseNeg),
            BCS.bcsSerializeU128(Number(maxResponseMantissa)),
            BCS.bcsSerializeU8(maxResponseScale),
            BCS.bcsSerializeBool(maxResponseNeg),
        ], [
            new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString((_a = this.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin")),
        ]);
    }
    async openRound(account, jitter) {
        return await sendAptosTx(this.client, account, `${this.switchboardAddress}::aggregator_open_round_action::run`, [HexString.ensure(this.address).hex(), jitter !== null && jitter !== void 0 ? jitter : 1], [this.coinType]);
    }
    openRoundTx() {
        var _a;
        return getAptosTx(`${this.switchboardAddress}::aggregator_open_round_action::run`, [HexString.ensure(this.address).hex()], [(_a = this.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
    }
    setConfigTx(params) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const { mantissa: vtMantissa, scale: vtScale } = AptosDecimal.fromBig((_a = params.varianceThreshold) !== null && _a !== void 0 ? _a : new Big(0));
        const tx = getAptosTx(`${this.switchboardAddress}::aggregator_init_action::run`, [
            HexString.ensure(this.address).hex(),
            (_b = params.name) !== null && _b !== void 0 ? _b : "",
            (_c = params.metadata) !== null && _c !== void 0 ? _c : "",
            HexString.ensure(params.queueAddress).hex(),
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
                ? HexString.ensure(params.rewardEscrow).hex()
                : HexString.ensure(params.authority).hex(),
            (_k = params.gasPrice) !== null && _k !== void 0 ? _k : 0,
            params.gasPriceFeed
                ? HexString.ensure(params.gasPriceFeed).hex()
                : "0x0",
            params.authority,
        ], [(_l = params.coinType) !== null && _l !== void 0 ? _l : "0x1::aptos_coin::AptosCoin"]);
        return tx;
    }
    async watch(callback) {
        const event = new AptosEvent(this.client, HexString.ensure(this.switchboardAddress), `${this.switchboardAddress}::switchboard::State`, "aggregator_update_events", 1000);
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
    constructor(client, address, switchboardAddress) {
        this.client = client;
        this.address = address;
        this.switchboardAddress = switchboardAddress;
    }
    async loadData() {
        return (await this.client.getAccountResource(this.address, `${HexString.ensure(this.switchboardAddress).hex()}::job::Job`)).data;
    }
    async loadJob() {
        const data = await this.loadData();
        // on-chain hex encoded base64 -> base64 -> Uint8Array -> OracleJob
        const job = OracleJob.decodeDelimited(Buffer.from(Buffer.from(data.data.slice(2), "hex").toString(), "base64"));
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
            HexString.ensure(params.authority).hex(),
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
    static initTx(client, account, params, switchboardAddress) {
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
        const tx = await sendAptosTx(client, account, `${switchboardAddress}::crank_init_action::run`, [HexString.ensure(params.queueAddress).hex()], [(_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
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
            HexString.ensure(this.address).hex(),
            HexString.ensure(params.aggregatorAddress).hex(),
        ], [(_a = this.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
    }
    pushTx(account, params) {
        var _a;
        return getAptosTx(`${this.switchboardAddress}::crank_push_action::run`, [
            HexString.ensure(this.address).hex(),
            HexString.ensure(params.aggregatorAddress).hex(),
        ], [(_a = this.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
    }
    /**
     * Pop an aggregator off the Crank
     */
    async pop(account) {
        return await sendAptosTx(this.client, account, `${this.switchboardAddress}::crank_pop_action::run`, [HexString.ensure(this.address).hex()], [this.coinType]);
    }
    async loadData() {
        return (await this.client.getAccountResource(HexString.ensure(this.address).hex(), `${this.switchboardAddress}::crank::Crank`)).data;
    }
}
export class OracleAccount {
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
            HexString.ensure(params.authority).hex(),
            HexString.ensure(params.queue).hex(),
        ], [(_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
        return [
            new OracleAccount(client, account.address(), switchboardAddress, (_b = params.coinType) !== null && _b !== void 0 ? _b : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    async loadData() {
        return (await this.client.getAccountResource(HexString.ensure(this.address).hex(), `${this.switchboardAddress}::oracle::Oracle`)).data;
    }
    /**
     * Oracle Heartbeat Action
     */
    async heartbeat(account) {
        return await sendAptosTx(this.client, account, `${this.switchboardAddress}::oracle_heartbeat_action::run`, [HexString.ensure(this.address).hex()], [this.coinType]);
    }
}
export class OracleQueueAccount {
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
        var _a, _b, _c;
        const tx = await sendAptosTx(client, account, `${switchboardAddress}::oracle_queue_init_action::run`, [
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
            (_a = params.gasPrice) !== null && _a !== void 0 ? _a : 0,
        ], [(_b = params.coinType) !== null && _b !== void 0 ? _b : "0x1::aptos_coin::AptosCoin"]);
        let address = generateResourceAccountAddress(account.address(), Buffer.from("OracleQueue"));
        return [
            new OracleQueueAccount(client, address, switchboardAddress, (_c = params.coinType) !== null && _c !== void 0 ? _c : "0x1::aptos_coin::AptosCoin"),
            tx,
        ];
    }
    async loadData() {
        return (await this.client.getAccountResource(HexString.ensure(this.address).hex(), `${this.switchboardAddress}::oracle_queue::OracleQueue<${this.coinType}>`)).data;
    }
}
export class LeaseAccount {
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
            HexString.ensure(params.queueAddress).hex(),
            HexString.ensure(params.withdrawAuthority).hex(),
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
        return await sendAptosTx(this.client, account, `${this.switchboardAddress}::lease_extend_action::run`, [HexString.ensure(this.address).hex(), params.loadAmount], [this.coinType]);
    }
    /**
     * Extend a lease
     * @param params CrankPushParams
     */
    extendTx(account, params) {
        return getAptosTx(`${this.switchboardAddress}::lease_extend_action::run`, [HexString.ensure(this.address).hex(), params.loadAmount], [this.coinType]);
    }
    /**
     * Pop an aggregator off the Crank
     */
    async withdraw(account, params) {
        return await sendAptosTx(this.client, account, `${this.switchboardAddress}::lease_withdraw_action::run`, [[HexString.ensure(this.address).hex(), params.amount]], [this.coinType]);
    }
    /**
     * Pop an aggregator off the Crank
     */
    withdrawTx(account, params) {
        return getAptosTx(`${this.switchboardAddress}::lease_withdraw_action::run`, [[HexString.ensure(this.address).hex(), params.amount]], [this.coinType]);
    }
    async loadData() {
        return (await this.client.getAccountResource(HexString.ensure(this.address).hex(), `${this.switchboardAddress}::lease::Lease<${this.coinType}>`)).data;
    }
}
export class OracleWallet {
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
        const tx = await sendAptosTx(client, account, `${switchboardAddress}::oracle_wallet_init_action::run`, [], [(_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
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
        return await sendAptosTx(this.client, account, `${this.switchboardAddress}::oracle_wallet_contribute_action::run`, [HexString.ensure(this.address).hex(), params.loadAmount], [this.coinType]);
    }
    /**
     * Withdraw from an OracleWallet
     */
    async withdraw(account, params) {
        return await sendAptosTx(this.client, account, `${this.switchboardAddress}::oracle_wallet_withdraw_action::run`, [[HexString.ensure(this.address).hex(), params.amount]], [this.coinType]);
    }
    async loadData() {
        return (await this.client.getAccountResource(HexString.ensure(this.address).hex(), `${this.switchboardAddress}::oracle_wallet::OracleWallet<${this.coinType}>`)).data;
    }
}
export class Permission {
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
            BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(params.authority)),
            BCS.bcsSerializeBytes(HexString.ensure(params.granter).toUint8Array()),
            BCS.bcsSerializeBytes(HexString.ensure(params.grantee).toUint8Array()),
        ]);
        return [new Permission(client, switchboardAddress), tx];
    }
    /**
     * Set a Permission
     */
    async set(account, params) {
        const tx = await sendRawAptosTx(this.client, account, `${this.switchboardAddress}::permission_set_action::run`, [
            BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(params.authority)),
            BCS.bcsSerializeBytes(HexString.ensure(params.granter).toUint8Array()),
            BCS.bcsSerializeBytes(HexString.ensure(params.grantee).toUint8Array()),
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
export async function createFeedTx(client, authority, params, switchboardAddress) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const seed = new AptosAccount().address();
    const resource_address = generateResourceAccountAddress(HexString.ensure(authority), bcsAddressToBytes(HexString.ensure(seed)));
    if (params.jobs.length > 8) {
        throw new Error("Max Job limit exceeded. The create_feed_action can only create up to 8 jobs at a time.");
    }
    const { mantissa: vtMantissa, scale: vtScale } = AptosDecimal.fromBig((_a = params.varianceThreshold) !== null && _a !== void 0 ? _a : new Big(0));
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
        new AggregatorAccount(client, resource_address, switchboardAddress, (_b = params.coinType) !== null && _b !== void 0 ? _b : "0x1::aptos_coin::AptosCoin"),
        getAptosTx(`${switchboardAddress}::create_feed_action::run`, [
            // authority will own everything
            HexString.ensure(params.authority).hex(),
            // aggregator
            (_c = params.name) !== null && _c !== void 0 ? _c : "",
            (_d = params.metadata) !== null && _d !== void 0 ? _d : "",
            HexString.ensure(params.queueAddress).hex(),
            params.batchSize,
            params.minOracleResults,
            params.minJobResults,
            params.minUpdateDelaySeconds,
            (_e = params.startAfter) !== null && _e !== void 0 ? _e : 0,
            Number(vtMantissa),
            vtScale,
            (_f = params.forceReportPeriod) !== null && _f !== void 0 ? _f : 0,
            (_g = params.expiration) !== null && _g !== void 0 ? _g : 0,
            (_h = params.disableCrank) !== null && _h !== void 0 ? _h : false,
            (_j = params.historySize) !== null && _j !== void 0 ? _j : 0,
            (_k = params.readCharge) !== null && _k !== void 0 ? _k : 0,
            params.rewardEscrow
                ? HexString.ensure(params.rewardEscrow).hex()
                : HexString.ensure(params.authority).hex(),
            (_l = params.gasPrice) !== null && _l !== void 0 ? _l : 0,
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
        ], [(_m = params.coinType) !== null && _m !== void 0 ? _m : "0x1::aptos_coin::AptosCoin"]),
    ];
}
// Create a feed with jobs, a lease, then optionally push the lease to the specified crank
export async function createFeed(client, account, params, switchboardAddress) {
    const [aggregator, txn] = await createFeedTx(client, account.address(), params, switchboardAddress);
    const tx = await simulateAndRun(client, account, txn);
    return [aggregator, tx];
}
// Create an oracle, oracle wallet, permisison, and set the heartbeat permission if user is the queue authority
export async function createOracle(client, account, params, switchboardAddress) {
    var _a, _b;
    const seed = new AptosAccount().address();
    const resource_address = generateResourceAccountAddress(HexString.ensure(account.address()), bcsAddressToBytes(HexString.ensure(seed)));
    const tx = await sendAptosTx(client, account, `${switchboardAddress}::create_oracle_action::run`, [
        HexString.ensure(params.authority).hex(),
        params.name,
        params.metadata,
        HexString.ensure(params.queue).hex(),
        seed.hex(),
    ], [(_a = params.coinType) !== null && _a !== void 0 ? _a : "0x1::aptos_coin::AptosCoin"]);
    return [
        new OracleAccount(client, resource_address, switchboardAddress, (_b = params.coinType) !== null && _b !== void 0 ? _b : "0x1::aptos_coin::AptosCoin"),
        tx,
    ];
}
export function bcsAddressToBytes(hexStr) {
    return BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(hexStr));
}
export function generateResourceAccountAddress(origin, seed) {
    const hash = SHA3.sha3_256.create();
    const userAddressBCS = bcsAddressToBytes(origin);
    hash.update(userAddressBCS);
    hash.update(seed);
    return `0x${hash.hex()}`;
}
export async function fetchAggregators(client, authority, switchboardAddress) {
    const handle = (await client.getAccountResource(switchboardAddress, `${switchboardAddress}::switchboard::State`)).data.aggregator_authorities.handle;
    const tableItems = await client.getTableItem(handle, {
        key_type: `address`,
        value_type: `vector<address>`,
        key: HexString.ensure(authority).hex(),
    });
    return (await Promise.all(tableItems.map((aggregatorAddress) => new AggregatorAccount(client, aggregatorAddress, switchboardAddress).loadData()))).map((aggregator, i) => {
        aggregator.address = tableItems[i];
        return aggregator; // map addresses back to the aggregator object
    });
}
//# sourceMappingURL=index.js.map