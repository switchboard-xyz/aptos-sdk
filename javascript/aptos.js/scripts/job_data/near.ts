import { OracleJob } from "../../lib/cjs";

// Make Job data for near price
export const nearBinance = Buffer.from(
  OracleJob.encodeDelimited(
    OracleJob.create({
      tasks: [
        {
          httpTask: {
            url: "https://www.binance.us/api/v3/ticker/price?symbol=NEARUSD",
          },
        },
        {
          jsonParseTask: {
            path: "$.price",
          },
        },
      ],
    })
  ).finish()
);

export const nearFtx = Buffer.from(
  OracleJob.encodeDelimited(
    OracleJob.create({
      tasks: [
        {
          websocketTask: {
            url: "wss://ftx.com/ws/",
            subscription:
              '{"op":"subscribe","channel":"ticker","market":"NEAR/USD"}',
            maxDataAgeSeconds: 15,
            filter:
              "$[?(@.type == 'update' && @.channel == 'ticker' && @.market == 'NEAR/USD')]",
          },
        },
        {
          medianTask: {
            tasks: [
              {
                jsonParseTask: {
                  path: "$.data.bid",
                },
              },
              {
                jsonParseTask: {
                  path: "$.data.ask",
                },
              },
              {
                jsonParseTask: {
                  path: "$.data.last",
                },
              },
            ],
          },
        },
      ],
    })
  ).finish()
);

export const nearCoinbase = Buffer.from(
  OracleJob.encodeDelimited(
    OracleJob.create({
      tasks: [
        {
          websocketTask: {
            url: "wss://ws-feed.pro.coinbase.com",
            subscription:
              '{"type":"subscribe","product_ids":["NEAR-USD"],"channels":["ticker",{"name":"ticker","product_ids":["NEAR-USD"]}]}',
            maxDataAgeSeconds: 15,
            filter: "$[?(@.type == 'ticker' && @.product_id == 'NEAR-USD')]",
          },
        },
        {
          jsonParseTask: {
            path: "$.price",
          },
        },
      ],
    })
  ).finish()
);

export const nearBitfinex = Buffer.from(
  OracleJob.encodeDelimited(
    OracleJob.create({
      tasks: [
        {
          httpTask: {
            url: "https://api-pub.bitfinex.com/v2/tickers?symbols=tNEARUSD",
          },
        },
        {
          medianTask: {
            tasks: [
              {
                jsonParseTask: {
                  path: "$[0][1]",
                },
              },
              {
                jsonParseTask: {
                  path: "$[0][3]",
                },
              },
              {
                jsonParseTask: {
                  path: "$[0][7]",
                },
              },
            ],
          },
        },
      ],
    })
  ).finish()
);
