import {
  AptosClient,
  AptosAccount,
  FaucetClient,
  BCS,
  TxnBuilderTypes,
  Types,
  HexString,
} from "aptos";
import assert from "assert";

const NODE_URL =
  process.env.APTOS_NODE_URL || "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL =
  process.env.APTOS_FAUCET_URL || "https://faucet.devnet.aptoslabs.com";

// Address that deployed the module
const SWITCHBOARD_DEVNET_ADDRESS = "BLAHBLAHBLAH";

// Address of the account that owns the Switchboard resource
const SWITCHBOARD_STATE_ADDRESS = "Probable the above";

const {
  AccountAddress,
  TypeTagStruct,
  ScriptFunction,
  StructTag,
  TransactionPayloadScriptFunction,
  RawTransaction,
  ChainId,
} = TxnBuilderTypes;

/**
 * Aggregator
 * init
 * addJob
 * openRound
 *
 * Job
 * init
 *
 * Oracle
 * saveResult
 *
 * Crank
 *
 *
 */

interface AggregatorAddJobParams {
  aggregatorAddress: string;
  job: string;
  weight?: number;
}

interface AggregatorInitParams {
  address: string; // arbitrary key associated with aggregator @NOTE: Cannot be altered
  authority: string; // owner of aggregator
  name?: string;
  metadata?: string;
  queueAddress?: string;
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

interface AggregatorOpenRoundParams {
  aggregator_address: string;
}

interface AggregatorRemoveJobParams {
  aggregatorAddress: string;
  job: string;
}

interface AggregatorSetConfigParams {
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

interface CrankInitParams {
  addr: string;
  queue_address: string;
}

interface CrankPopParams {
  crank_address: string;
}

interface CrankPushParams {
  crank_address: string;
  aggregator_address: string;
}

/** Convert string to hex-encoded utf-8 bytes. */
function stringToHex(text: string) {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(text);
  return Array.from(encoded, (i) => i.toString(16).padStart(2, "0")).join("");
}

export class AggregatorAccount {
  static async init(
    client: AptosClient,
    payer: AptosAccount,
    params: AggregatorInitParams
  ) {
    const payload: Types.TransactionPayload = {
      type: "script_function_payload",
      function: `${SWITCHBOARD_DEVNET_ADDRESS}::Switchboard::AggregatorInitAction::run`,
      type_arguments: [],
      arguments: [
        HexString.ensure(SWITCHBOARD_STATE_ADDRESS).hex(),
        HexString.ensure(params.address).hex(),
        stringToHex(params.name ?? ""),
        stringToHex(params.metadata ?? ""),
        params.queueAddress
          ? HexString.ensure(params.queueAddress).hex()
          : HexString.ensure("0x0").hex(),
        params.batchSize,
        params.minOracleResults,
        params.minUpdateDelaySeconds,
        params.startAfter ?? 0,
        params.varianceThreshold ?? 0,
        params.varianceThresholdScale ?? 0,
        params.forceReportPeriod ?? 0,
        params.expiration ?? 0,
        payer.address().hex(),

        // values must be strings
      ].map((value) => (typeof value === "string" ? value : value.toString())),
    };

    const txnRequest = await client.generateTransaction(
      payer.address(),
      payload
    );
    const signedTxn = await client.signTransaction(payer, txnRequest);
    const transactionRes = await client.submitTransaction(signedTxn);
    await client.waitForTransaction(transactionRes.hash);
  }
}

export class JobAccount {
  static async init(client: AptosClient, payer: AptosAccount) {
    const account1 = new AptosAccount();
    // TS SDK support 3 types of transaction payloads: `ScriptFunction`, `Script` and `Module`.
    // See https://aptos-labs.github.io/ts-sdk-doc/ for the details.
    const scriptFunctionPayload = new TransactionPayloadScriptFunction(
      ScriptFunction.natural(
        // Fully qualified module name, `AccountAddress::ModuleName`
        `${SWITCHBOARD_DEVNET_ADDRESS}::Switchboard::AggregatorInitAction`,
        // Module function
        "run",
        [],
        // Arguments for function `transfer`: receiver account address and amount to transfer
        [BCS.b, BCS.bcsSerializeUint64(717)]
      )
    );

    const [{ sequence_number: sequnceNumber }, chainId] = await Promise.all([
      client.getAccount(account1.address()),
      client.getChainId(),
    ]);

    // See class definiton here
    // https://aptos-labs.github.io/ts-sdk-doc/classes/TxnBuilderTypes.RawTransaction.html#constructor.
    const rawTxn = new RawTransaction(
      // Transaction sender account address
      AccountAddress.fromHex(account1.address()),
      BigInt(sequnceNumber),
      scriptFunctionPayload,
      // Max gas unit to spend
      1000n,
      // Gas price per unit
      1n,
      // Expiration timestamp. Transaction is discarded if it is not executed within 10 seconds from now.
      BigInt(Math.floor(Date.now() / 1000) + 10),
      new ChainId(chainId)
    );

    // Sign the raw transaction with account1's private key
    const bcsTxn = AptosClient.generateBCSTransaction(account1, rawTxn);

    const transactionRes = await client.submitSignedBCSTransaction(bcsTxn);

    await client.waitForTransaction(transactionRes.hash);

    const signedTxn = await client.signTransaction(payer, txnRequest);
    const res = await client.submitTransaction(signedTxn);
  }
}
