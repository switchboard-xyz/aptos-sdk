import { AptosClient, AptosAccount, Types, FaucetClient } from "aptos";

const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";

// aggregator address registered with state address
const AGGREGATOR_ADDRESS =
  "0xcb5de0e03c5c7da8b91cbec9f30992d811271d906b6eb629fe7a71703660d28f";

// @TODO: change the following after
const DEMO_ADDRESS =
  "0x5032bdd3e9f7ec0c3bb771319b7a882821bf41004cae6ecea16e2605e33e2563";

/**
 * Sends and waits for an aptos tx to be confirmed
 * @param client
 * @param signer
 * @param method Aptos module method (ex: 0xSwitchboard::AggregatorAddJobAction)
 * @param args Arguments for method (converts numbers to strings)
 * @param retryCount
 * @returns
 */
export async function sendAptosTx(
  client: AptosClient,
  signer: AptosAccount,
  method: string,
  args: Array<any>,
  retryCount = 2
): Promise<string> {
  const payload: Types.TransactionPayload = {
    type: "script_function_payload",
    function: method,
    type_arguments: [],
    arguments: args,
  };
  const txnRequest = await client.generateTransaction(
    signer.address(),
    payload
  );

  const simulation = await client.simulateTransaction(signer, txnRequest);
  if (simulation.vm_status === "Out of gas") {
    if (retryCount > 0) {
      const faucetClient = new FaucetClient(
        client.nodeUrl,
        "https://faucet.devnet.aptoslabs.com"
      );
      await faucetClient.fundAccount(signer.address(), 5000);
      return sendAptosTx(client, signer, method, args, --retryCount);
    }
  }
  if (simulation.success === false) {
    console.log(`TxGas: ${simulation.gas_used}`);
    console.log(`TxGas: ${simulation.hash}`);

    throw new Error(`TxFailure: ${simulation.vm_status}`);
  } else {
    console.log(`TxGas: ${simulation.gas_used}`);
  }

  const signedTxn = await client.signTransaction(signer, txnRequest);
  const transactionRes = await client.submitTransaction(signedTxn);
  await client.waitForTransaction(transactionRes.hash);
  return transactionRes.hash;
}

const client = new AptosClient(NODE_URL);
const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL);
const acct = new AptosAccount();
await faucetClient.fundAccount(acct.address(), 5000);

const agg_add = await sendAptosTx(
  client,
  acct,
  `${DEMO_ADDRESS}::demo_app::log_aggregator_info`,
  [AGGREGATOR_ADDRESS]
);

console.log(`tx hash: ${agg_add}`);

console.log(
  `check out the resource with the aggregator value at: https://explorer.devnet.aptos.dev/account/${acct
    .address()
    .hex()}`
);

async function loadData(): Promise<any> {
  return (
    await client.getAccountResource(
      acct.address().hex(),
      `${DEMO_ADDRESS}::demo_app::AggregatorInfo`
    )
  ).data;
}

console.log("Aggregator Info: ", await loadData());
