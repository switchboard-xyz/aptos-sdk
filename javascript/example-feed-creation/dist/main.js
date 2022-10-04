var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, {get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable});
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? {get: () => module2.default, enumerable: true} : {value: module2, enumerable: true})), module2);
};

// src/main.ts
var import_buffer = __toModule(require("buffer"));
var import_aptos = __toModule(require("aptos"));
var import_aptos2 = __toModule(require("@switchboard-xyz/aptos.js"));

// node_modules/big.js/big.mjs
var DP = 20;
var RM = 1;
var MAX_DP = 1e6;
var MAX_POWER = 1e6;
var NE = -7;
var PE = 21;
var STRICT = false;
var NAME = "[big.js] ";
var INVALID = NAME + "Invalid ";
var INVALID_DP = INVALID + "decimal places";
var INVALID_RM = INVALID + "rounding mode";
var DIV_BY_ZERO = NAME + "Division by zero";
var P = {};
var UNDEFINED = void 0;
var NUMERIC = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;
function _Big_() {
  function Big2(n) {
    var x = this;
    if (!(x instanceof Big2))
      return n === UNDEFINED ? _Big_() : new Big2(n);
    if (n instanceof Big2) {
      x.s = n.s;
      x.e = n.e;
      x.c = n.c.slice();
    } else {
      if (typeof n !== "string") {
        if (Big2.strict === true && typeof n !== "bigint") {
          throw TypeError(INVALID + "value");
        }
        n = n === 0 && 1 / n < 0 ? "-0" : String(n);
      }
      parse(x, n);
    }
    x.constructor = Big2;
  }
  Big2.prototype = P;
  Big2.DP = DP;
  Big2.RM = RM;
  Big2.NE = NE;
  Big2.PE = PE;
  Big2.strict = STRICT;
  Big2.roundDown = 0;
  Big2.roundHalfUp = 1;
  Big2.roundHalfEven = 2;
  Big2.roundUp = 3;
  return Big2;
}
function parse(x, n) {
  var e, i, nl;
  if (!NUMERIC.test(n)) {
    throw Error(INVALID + "number");
  }
  x.s = n.charAt(0) == "-" ? (n = n.slice(1), -1) : 1;
  if ((e = n.indexOf(".")) > -1)
    n = n.replace(".", "");
  if ((i = n.search(/e/i)) > 0) {
    if (e < 0)
      e = i;
    e += +n.slice(i + 1);
    n = n.substring(0, i);
  } else if (e < 0) {
    e = n.length;
  }
  nl = n.length;
  for (i = 0; i < nl && n.charAt(i) == "0"; )
    ++i;
  if (i == nl) {
    x.c = [x.e = 0];
  } else {
    for (; nl > 0 && n.charAt(--nl) == "0"; )
      ;
    x.e = e - i - 1;
    x.c = [];
    for (e = 0; i <= nl; )
      x.c[e++] = +n.charAt(i++);
  }
  return x;
}
function round(x, sd, rm, more) {
  var xc = x.c;
  if (rm === UNDEFINED)
    rm = x.constructor.RM;
  if (rm !== 0 && rm !== 1 && rm !== 2 && rm !== 3) {
    throw Error(INVALID_RM);
  }
  if (sd < 1) {
    more = rm === 3 && (more || !!xc[0]) || sd === 0 && (rm === 1 && xc[0] >= 5 || rm === 2 && (xc[0] > 5 || xc[0] === 5 && (more || xc[1] !== UNDEFINED)));
    xc.length = 1;
    if (more) {
      x.e = x.e - sd + 1;
      xc[0] = 1;
    } else {
      xc[0] = x.e = 0;
    }
  } else if (sd < xc.length) {
    more = rm === 1 && xc[sd] >= 5 || rm === 2 && (xc[sd] > 5 || xc[sd] === 5 && (more || xc[sd + 1] !== UNDEFINED || xc[sd - 1] & 1)) || rm === 3 && (more || !!xc[0]);
    xc.length = sd;
    if (more) {
      for (; ++xc[--sd] > 9; ) {
        xc[sd] = 0;
        if (sd === 0) {
          ++x.e;
          xc.unshift(1);
          break;
        }
      }
    }
    for (sd = xc.length; !xc[--sd]; )
      xc.pop();
  }
  return x;
}
function stringify(x, doExponential, isNonzero) {
  var e = x.e, s = x.c.join(""), n = s.length;
  if (doExponential) {
    s = s.charAt(0) + (n > 1 ? "." + s.slice(1) : "") + (e < 0 ? "e" : "e+") + e;
  } else if (e < 0) {
    for (; ++e; )
      s = "0" + s;
    s = "0." + s;
  } else if (e > 0) {
    if (++e > n) {
      for (e -= n; e--; )
        s += "0";
    } else if (e < n) {
      s = s.slice(0, e) + "." + s.slice(e);
    }
  } else if (n > 1) {
    s = s.charAt(0) + "." + s.slice(1);
  }
  return x.s < 0 && isNonzero ? "-" + s : s;
}
P.abs = function() {
  var x = new this.constructor(this);
  x.s = 1;
  return x;
};
P.cmp = function(y) {
  var isneg, x = this, xc = x.c, yc = (y = new x.constructor(y)).c, i = x.s, j = y.s, k = x.e, l = y.e;
  if (!xc[0] || !yc[0])
    return !xc[0] ? !yc[0] ? 0 : -j : i;
  if (i != j)
    return i;
  isneg = i < 0;
  if (k != l)
    return k > l ^ isneg ? 1 : -1;
  j = (k = xc.length) < (l = yc.length) ? k : l;
  for (i = -1; ++i < j; ) {
    if (xc[i] != yc[i])
      return xc[i] > yc[i] ^ isneg ? 1 : -1;
  }
  return k == l ? 0 : k > l ^ isneg ? 1 : -1;
};
P.div = function(y) {
  var x = this, Big2 = x.constructor, a = x.c, b = (y = new Big2(y)).c, k = x.s == y.s ? 1 : -1, dp = Big2.DP;
  if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
    throw Error(INVALID_DP);
  }
  if (!b[0]) {
    throw Error(DIV_BY_ZERO);
  }
  if (!a[0]) {
    y.s = k;
    y.c = [y.e = 0];
    return y;
  }
  var bl, bt, n, cmp, ri, bz = b.slice(), ai = bl = b.length, al = a.length, r = a.slice(0, bl), rl = r.length, q = y, qc = q.c = [], qi = 0, p = dp + (q.e = x.e - y.e) + 1;
  q.s = k;
  k = p < 0 ? 0 : p;
  bz.unshift(0);
  for (; rl++ < bl; )
    r.push(0);
  do {
    for (n = 0; n < 10; n++) {
      if (bl != (rl = r.length)) {
        cmp = bl > rl ? 1 : -1;
      } else {
        for (ri = -1, cmp = 0; ++ri < bl; ) {
          if (b[ri] != r[ri]) {
            cmp = b[ri] > r[ri] ? 1 : -1;
            break;
          }
        }
      }
      if (cmp < 0) {
        for (bt = rl == bl ? b : bz; rl; ) {
          if (r[--rl] < bt[rl]) {
            ri = rl;
            for (; ri && !r[--ri]; )
              r[ri] = 9;
            --r[ri];
            r[rl] += 10;
          }
          r[rl] -= bt[rl];
        }
        for (; !r[0]; )
          r.shift();
      } else {
        break;
      }
    }
    qc[qi++] = cmp ? n : ++n;
    if (r[0] && cmp)
      r[rl] = a[ai] || 0;
    else
      r = [a[ai]];
  } while ((ai++ < al || r[0] !== UNDEFINED) && k--);
  if (!qc[0] && qi != 1) {
    qc.shift();
    q.e--;
    p--;
  }
  if (qi > p)
    round(q, p, Big2.RM, r[0] !== UNDEFINED);
  return q;
};
P.eq = function(y) {
  return this.cmp(y) === 0;
};
P.gt = function(y) {
  return this.cmp(y) > 0;
};
P.gte = function(y) {
  return this.cmp(y) > -1;
};
P.lt = function(y) {
  return this.cmp(y) < 0;
};
P.lte = function(y) {
  return this.cmp(y) < 1;
};
P.minus = P.sub = function(y) {
  var i, j, t, xlty, x = this, Big2 = x.constructor, a = x.s, b = (y = new Big2(y)).s;
  if (a != b) {
    y.s = -b;
    return x.plus(y);
  }
  var xc = x.c.slice(), xe = x.e, yc = y.c, ye = y.e;
  if (!xc[0] || !yc[0]) {
    if (yc[0]) {
      y.s = -b;
    } else if (xc[0]) {
      y = new Big2(x);
    } else {
      y.s = 1;
    }
    return y;
  }
  if (a = xe - ye) {
    if (xlty = a < 0) {
      a = -a;
      t = xc;
    } else {
      ye = xe;
      t = yc;
    }
    t.reverse();
    for (b = a; b--; )
      t.push(0);
    t.reverse();
  } else {
    j = ((xlty = xc.length < yc.length) ? xc : yc).length;
    for (a = b = 0; b < j; b++) {
      if (xc[b] != yc[b]) {
        xlty = xc[b] < yc[b];
        break;
      }
    }
  }
  if (xlty) {
    t = xc;
    xc = yc;
    yc = t;
    y.s = -y.s;
  }
  if ((b = (j = yc.length) - (i = xc.length)) > 0)
    for (; b--; )
      xc[i++] = 0;
  for (b = i; j > a; ) {
    if (xc[--j] < yc[j]) {
      for (i = j; i && !xc[--i]; )
        xc[i] = 9;
      --xc[i];
      xc[j] += 10;
    }
    xc[j] -= yc[j];
  }
  for (; xc[--b] === 0; )
    xc.pop();
  for (; xc[0] === 0; ) {
    xc.shift();
    --ye;
  }
  if (!xc[0]) {
    y.s = 1;
    xc = [ye = 0];
  }
  y.c = xc;
  y.e = ye;
  return y;
};
P.mod = function(y) {
  var ygtx, x = this, Big2 = x.constructor, a = x.s, b = (y = new Big2(y)).s;
  if (!y.c[0]) {
    throw Error(DIV_BY_ZERO);
  }
  x.s = y.s = 1;
  ygtx = y.cmp(x) == 1;
  x.s = a;
  y.s = b;
  if (ygtx)
    return new Big2(x);
  a = Big2.DP;
  b = Big2.RM;
  Big2.DP = Big2.RM = 0;
  x = x.div(y);
  Big2.DP = a;
  Big2.RM = b;
  return this.minus(x.times(y));
};
P.neg = function() {
  var x = new this.constructor(this);
  x.s = -x.s;
  return x;
};
P.plus = P.add = function(y) {
  var e, k, t, x = this, Big2 = x.constructor;
  y = new Big2(y);
  if (x.s != y.s) {
    y.s = -y.s;
    return x.minus(y);
  }
  var xe = x.e, xc = x.c, ye = y.e, yc = y.c;
  if (!xc[0] || !yc[0]) {
    if (!yc[0]) {
      if (xc[0]) {
        y = new Big2(x);
      } else {
        y.s = x.s;
      }
    }
    return y;
  }
  xc = xc.slice();
  if (e = xe - ye) {
    if (e > 0) {
      ye = xe;
      t = yc;
    } else {
      e = -e;
      t = xc;
    }
    t.reverse();
    for (; e--; )
      t.push(0);
    t.reverse();
  }
  if (xc.length - yc.length < 0) {
    t = yc;
    yc = xc;
    xc = t;
  }
  e = yc.length;
  for (k = 0; e; xc[e] %= 10)
    k = (xc[--e] = xc[e] + yc[e] + k) / 10 | 0;
  if (k) {
    xc.unshift(k);
    ++ye;
  }
  for (e = xc.length; xc[--e] === 0; )
    xc.pop();
  y.c = xc;
  y.e = ye;
  return y;
};
P.pow = function(n) {
  var x = this, one = new x.constructor("1"), y = one, isneg = n < 0;
  if (n !== ~~n || n < -MAX_POWER || n > MAX_POWER) {
    throw Error(INVALID + "exponent");
  }
  if (isneg)
    n = -n;
  for (; ; ) {
    if (n & 1)
      y = y.times(x);
    n >>= 1;
    if (!n)
      break;
    x = x.times(x);
  }
  return isneg ? one.div(y) : y;
};
P.prec = function(sd, rm) {
  if (sd !== ~~sd || sd < 1 || sd > MAX_DP) {
    throw Error(INVALID + "precision");
  }
  return round(new this.constructor(this), sd, rm);
};
P.round = function(dp, rm) {
  if (dp === UNDEFINED)
    dp = 0;
  else if (dp !== ~~dp || dp < -MAX_DP || dp > MAX_DP) {
    throw Error(INVALID_DP);
  }
  return round(new this.constructor(this), dp + this.e + 1, rm);
};
P.sqrt = function() {
  var r, c, t, x = this, Big2 = x.constructor, s = x.s, e = x.e, half = new Big2("0.5");
  if (!x.c[0])
    return new Big2(x);
  if (s < 0) {
    throw Error(NAME + "No square root");
  }
  s = Math.sqrt(x + "");
  if (s === 0 || s === 1 / 0) {
    c = x.c.join("");
    if (!(c.length + e & 1))
      c += "0";
    s = Math.sqrt(c);
    e = ((e + 1) / 2 | 0) - (e < 0 || e & 1);
    r = new Big2((s == 1 / 0 ? "5e" : (s = s.toExponential()).slice(0, s.indexOf("e") + 1)) + e);
  } else {
    r = new Big2(s + "");
  }
  e = r.e + (Big2.DP += 4);
  do {
    t = r;
    r = half.times(t.plus(x.div(t)));
  } while (t.c.slice(0, e).join("") !== r.c.slice(0, e).join(""));
  return round(r, (Big2.DP -= 4) + r.e + 1, Big2.RM);
};
P.times = P.mul = function(y) {
  var c, x = this, Big2 = x.constructor, xc = x.c, yc = (y = new Big2(y)).c, a = xc.length, b = yc.length, i = x.e, j = y.e;
  y.s = x.s == y.s ? 1 : -1;
  if (!xc[0] || !yc[0]) {
    y.c = [y.e = 0];
    return y;
  }
  y.e = i + j;
  if (a < b) {
    c = xc;
    xc = yc;
    yc = c;
    j = a;
    a = b;
    b = j;
  }
  for (c = new Array(j = a + b); j--; )
    c[j] = 0;
  for (i = b; i--; ) {
    b = 0;
    for (j = a + i; j > i; ) {
      b = c[j] + yc[i] * xc[j - i - 1] + b;
      c[j--] = b % 10;
      b = b / 10 | 0;
    }
    c[j] = b;
  }
  if (b)
    ++y.e;
  else
    c.shift();
  for (i = c.length; !c[--i]; )
    c.pop();
  y.c = c;
  return y;
};
P.toExponential = function(dp, rm) {
  var x = this, n = x.c[0];
  if (dp !== UNDEFINED) {
    if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
      throw Error(INVALID_DP);
    }
    x = round(new x.constructor(x), ++dp, rm);
    for (; x.c.length < dp; )
      x.c.push(0);
  }
  return stringify(x, true, !!n);
};
P.toFixed = function(dp, rm) {
  var x = this, n = x.c[0];
  if (dp !== UNDEFINED) {
    if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
      throw Error(INVALID_DP);
    }
    x = round(new x.constructor(x), dp + x.e + 1, rm);
    for (dp = dp + x.e + 1; x.c.length < dp; )
      x.c.push(0);
  }
  return stringify(x, false, !!n);
};
P[Symbol.for("nodejs.util.inspect.custom")] = P.toJSON = P.toString = function() {
  var x = this, Big2 = x.constructor;
  return stringify(x, x.e <= Big2.NE || x.e >= Big2.PE, !!x.c[0]);
};
P.toNumber = function() {
  var n = Number(stringify(this, true, true));
  if (this.constructor.strict === true && !this.eq(n.toString())) {
    throw Error(NAME + "Imprecise conversion");
  }
  return n;
};
P.toPrecision = function(sd, rm) {
  var x = this, Big2 = x.constructor, n = x.c[0];
  if (sd !== UNDEFINED) {
    if (sd !== ~~sd || sd < 1 || sd > MAX_DP) {
      throw Error(INVALID + "precision");
    }
    x = round(new Big2(x), sd, rm);
    for (; x.c.length < sd; )
      x.c.push(0);
  }
  return stringify(x, sd <= x.e || x.e <= Big2.NE || x.e >= Big2.PE, !!n);
};
P.valueOf = function() {
  var x = this, Big2 = x.constructor;
  if (Big2.strict === true) {
    throw Error(NAME + "valueOf disallowed");
  }
  return stringify(x, x.e <= Big2.NE || x.e >= Big2.PE, true);
};
var Big = _Big_();
var big_default = Big;

// src/main.ts
var NODE_URL = "https://fullnode.testnet.aptoslabs.com/v1";
var FAUCET_URL = "https://faucet.testnet.aptoslabs.com";
var SWITCHBOARD_TESTNET_ADDRESS = "0xc9b4bb0b1f7a343687c4f8bc6eea36dd2a3aa8d654e640050ab5b8635a6b9cbd";
var SWITCHBOARD_QUEUE_ADDRESS = "0xc9b4bb0b1f7a343687c4f8bc6eea36dd2a3aa8d654e640050ab5b8635a6b9cbd";
var SWITCHBOARD_CRANK_ADDRESS = "0xc9b4bb0b1f7a343687c4f8bc6eea36dd2a3aa8d654e640050ab5b8635a6b9cbd";
(async () => {
  const client = new import_aptos.AptosClient(NODE_URL);
  const faucetClient = new import_aptos.FaucetClient(NODE_URL, FAUCET_URL);
  let user = new import_aptos.AptosAccount();
  await faucetClient.fundAccount(user.address(), 5e4);
  console.log(`User account ${user.address().hex()} created + funded.`);
  const aggregator_acct = new import_aptos.AptosAccount();
  await faucetClient.fundAccount(aggregator_acct.address(), 5e4);
  const serializedJob = import_buffer.Buffer.from(import_aptos2.OracleJob.encodeDelimited(import_aptos2.OracleJob.create({
    tasks: [
      {
        httpTask: {
          url: "https://www.binance.us/api/v3/ticker/price?symbol=BTCUSD"
        }
      },
      {
        jsonParseTask: {
          path: "$.price"
        }
      }
    ]
  })).finish());
  const [aggregator, createFeedTx] = await (0, import_aptos2.createFeed)(client, user, {
    authority: user.address(),
    queueAddress: SWITCHBOARD_QUEUE_ADDRESS,
    batchSize: 1,
    minJobResults: 1,
    minOracleResults: 1,
    minUpdateDelaySeconds: 5,
    varianceThreshold: new big_default(0),
    coinType: "0x1::aptos_coin::AptosCoin",
    crankAddress: SWITCHBOARD_CRANK_ADDRESS,
    initialLoadAmount: 1e3,
    jobs: [
      {
        name: "BTC/USD",
        metadata: "binance",
        authority: user.address().hex(),
        data: serializedJob.toString("base64"),
        weight: 1
      }
    ]
  }, SWITCHBOARD_TESTNET_ADDRESS);
  console.log(`Created Aggregator and Lease resources at account address ${aggregator.address}. Tx hash ${createFeedTx}`);
  console.log("logging all data objects");
  console.log("Aggregator:", await aggregator.loadData());
  console.log("Lease:", await new import_aptos2.LeaseAccount(client, aggregator.address, SWITCHBOARD_TESTNET_ADDRESS).loadData(SWITCHBOARD_QUEUE_ADDRESS));
  console.log("Load aggregator jobs data", await aggregator.loadJobs());
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL21haW4udHMiLCAiLi4vbm9kZV9tb2R1bGVzL2JpZy5qcy9iaWcubWpzIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFXQSxvQkFBdUI7QUFDdkIsbUJBQW1FO0FBQ25FLG9CQU9POzs7QUNIUCxJQUFJLEtBQUs7QUFBVCxJQVVFLEtBQUs7QUFWUCxJQWFFLFNBQVM7QUFiWCxJQWdCRSxZQUFZO0FBaEJkLElBdUJFLEtBQUs7QUF2QlAsSUE4QkUsS0FBSztBQTlCUCxJQXFDRSxTQUFTO0FBckNYLElBNENFLE9BQU87QUE1Q1QsSUE2Q0UsVUFBVSxPQUFPO0FBN0NuQixJQThDRSxhQUFhLFVBQVU7QUE5Q3pCLElBK0NFLGFBQWEsVUFBVTtBQS9DekIsSUFnREUsY0FBYyxPQUFPO0FBaER2QixJQW1ERSxJQUFJO0FBbkROLElBb0RFLFlBQVk7QUFwRGQsSUFxREUsVUFBVTtBQU1aLGlCQUFpQjtBQVFmLGdCQUFhLEdBQUc7QUFDZCxRQUFJLElBQUk7QUFHUixRQUFJLENBQUUsY0FBYTtBQUFNLGFBQU8sTUFBTSxZQUFZLFVBQVUsSUFBSSxLQUFJO0FBR3BFLFFBQUksYUFBYSxNQUFLO0FBQ3BCLFFBQUUsSUFBSSxFQUFFO0FBQ1IsUUFBRSxJQUFJLEVBQUU7QUFDUixRQUFFLElBQUksRUFBRSxFQUFFO0FBQUEsV0FDTDtBQUNMLFVBQUksT0FBTyxNQUFNLFVBQVU7QUFDekIsWUFBSSxLQUFJLFdBQVcsUUFBUSxPQUFPLE1BQU0sVUFBVTtBQUNoRCxnQkFBTSxVQUFVLFVBQVU7QUFBQTtBQUk1QixZQUFJLE1BQU0sS0FBSyxJQUFJLElBQUksSUFBSSxPQUFPLE9BQU87QUFBQTtBQUczQyxZQUFNLEdBQUc7QUFBQTtBQUtYLE1BQUUsY0FBYztBQUFBO0FBR2xCLE9BQUksWUFBWTtBQUNoQixPQUFJLEtBQUs7QUFDVCxPQUFJLEtBQUs7QUFDVCxPQUFJLEtBQUs7QUFDVCxPQUFJLEtBQUs7QUFDVCxPQUFJLFNB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
