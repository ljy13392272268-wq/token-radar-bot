// Token Radar's farm-plan engine: one pure function of a protocol's own record, called by main.ts to fill
// board.json's farm_steps and by the page to render a detail view, so the data and the screen cannot drift
// apart. Nothing is keyed to a name: the category decides the action, the chains where and at what gas, the
// TVL the size, the age the hold and the checks. A plan is 8 or 9 steps, each {text, cost, time}.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RadarPlan = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // What one transaction costs on a chain, in whole dollars: a public estimate, not a quote. A chain the
  // table does not name costs about $0.6, the middle of the low-fee chains it does name.
  var GAS = {
    ethereum: 9, bitcoin: 4, tron: 2, ripple: 1.5, tempo: 1,
    base: 0.4, arbitrum: 0.4, optimism: 0.4, polygon: 0.4, binance: 0.4, avalanche: 0.4,
    unichain: 0.3, ink: 0.3, katana: 0.3, plume: 0.3, sonic: 0.3, flare: 0.3, plasma: 0.3,
    'robinhood chain': 0.3, bera: 0.5, berachain: 0.5, monad: 0.4, mantle: 0.4, linea: 0.4,
    scroll: 0.5, zksync: 0.4, 'zksync era': 0.4, blast: 0.4, bob: 0.6, citrea: 0.5, hemi: 0.5,
    tac: 0.4, arc: 0.4, stable: 0.4, fluent: 0.4, celo: 0.1, stellar: 0.1, solana: 0.2,
    sui: 0.2, aptos: 0.2, sei: 0.2, starknet: 0.2, 'hyperliquid l1': 0.3,
  };
  var DEFAULT_GAS = 0.6;

  function gasFor(chain) {
    if (!chain) return DEFAULT_GAS;
    var key = String(chain).toLowerCase();
    return GAS[key] !== undefined ? GAS[key] : DEFAULT_GAS;
  }

  /**
   * Where to farm: the chain the record lists first, which is the one carrying most of the protocol's
   * TVL (DefiLlama orders a protocol's chains that way, so the biggest lending and DEX protocols all
   * lead with Ethereum), then the second it lists for a smaller position. Gas is quoted for both,
   * because on Ethereum a transaction costs about twenty times what it costs on Base.
   */
  function routeChains(chains) {
    var main = chains.length > 0 ? chains[0] : null;
    var second = chains.length > 1 ? chains[1] : null;
    return { chain: main, gas: gasFor(main), second: second, secondGas: gasFor(second) };
  }

  /** The category's family: which sentence shapes the plan. Never a protocol's name. */
  function familyOf(category) {
    var c = (category || '').toLowerCase();
    if (c === '') return 'app';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('liquidity manager') >= 0 || c.indexOf('collateral management') >= 0) return 'vault';
    if (c.indexOf('yield') >= 0 || c.indexOf('farm') >= 0 || c.indexOf('basis') >= 0) return 'vault';
    if (c.indexOf('cdp') >= 0) return 'cdp';
    if (c.indexOf('stable') >= 0 || c.indexOf('reserve currency') >= 0 || c.indexOf('algo') >= 0) return 'stable';
    if (c.indexOf('lend') >= 0 || c.indexOf('collateral market') >= 0) return 'lend';
    if (c.indexOf('dex') >= 0) return 'dex';
    if (c.indexOf('rwa') >= 0 || c.indexOf('synthetic') >= 0 || c.indexOf('index') >= 0 || c.indexOf('btc') >= 0) return 'rwa';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('option') >= 0) return 'deriv';
    if (c.indexOf('prediction') >= 0) return 'predict';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'stake';
    if (c.indexOf('bridge') >= 0) return 'bridge';
    if (c === 'chain') return 'chain';
    if (c.indexOf('insurance') >= 0) return 'cover';
    return 'app';
  }

  /** The position's size, from the protocol's TVL: a larger protocol's snapshot is worth a larger stake. */
  function capitalFor(tvl) {
    if (tvl >= 5e9) return 500;
    if (tvl >= 1e9) return 300;
    if (tvl >= 25e7) return 200;
    if (tvl >= 5e7) return 150;
    if (tvl >= 1e7) return 75;
    return 50;
  }

  /** How long it takes to open the position, by the action's shape. */
  var SETUP_MIN = { vault: 10, lend: 20, cdp: 20, stable: 15, dex: 25, rwa: 25, deriv: 15, predict: 10, stake: 10, bridge: 20, chain: 25, cover: 10, app: 15 };
  /** How long the weekly touch takes, by the action's shape. */
  var WEEK_MIN = { vault: 10, lend: 15, cdp: 15, stable: 10, dex: 20, rwa: 10, deriv: 15, predict: 10, stake: 10, bridge: 15, chain: 15, cover: 10, app: 10 };
  /** Whether the weekly touch spends gas: a reading or a re-check costs nothing. */
  var WEEK_GAS = { vault: false, cover: false, rwa: false, chain: false };

  /** How long to hold, from the protocol's age: a young protocol needs longer to prove the position is real. */
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 45;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }

  var money = function (n) { return '$' + n; };
  var gasText = function (g) { return '$' + (g % 1 === 0 ? g : g.toFixed(1)) + ' of gas'; };
  var gasTag = function (g) { return '$' + (g % 1 === 0 ? g : g.toFixed(1)) + ' gas'; };

  // ---------------------------------------------------------------- the sentences
  //
  // One object per family. check is the due-diligence step, act opens the position, keep is the weekly
  // touch, exit closes it. x carries the record already turned into words: name, chain, cap, gas.

  var FAMILY = {
    vault: {
      check: function (x) { return 'Read ' + x.name + '\'s vault page on ' + x.chain + ' first: the fee it takes from the yield, the venue it allocates to, and whether a withdrawal is instant or queued.'; },
      act: function (x) { return 'Deposit ' + money(x.cap) + ' of USDC into ' + x.name + '\'s USDC vault on ' + x.chain + ' and keep the shares; the shares are the position a snapshot counts.'; },
      keep: function (x) { return 'Read ' + x.name + '\'s allocation report once a week: a vault that rotates venue is worth following, one that stops reporting is worth leaving.'; },
      exit: function (x) { return 'Redeem the shares for USDC and check the exit terms first: a queued withdrawal can take days, so start before you need the cash.'; },
    },
    lend: {
      check: function (x) { return 'Check ' + x.name + '\'s market on ' + x.chain + ' first: the collateral factor, the liquidation threshold and the oracle decide how much you can safely borrow.'; },
      act: function (x) { return 'Supply ' + money(x.cap) + ' of USDC to ' + x.name + '\'s market on ' + x.chain + ', borrow about half in the chain\'s main stablecoin, and keep both sides open.'; },
      keep: function (x) { return 'Repay a slice and re-borrow it once a week so the borrow side keeps reporting activity, and stop adding when the health factor nears 1.5.'; },
      exit: function (x) { return 'Repay in full, then withdraw the supply: a farm left with open debt is the one that gets liquidated in a drawdown.'; },
    },
    cdp: {
      check: function (x) { return 'Check ' + x.name + '\'s vault on ' + x.chain + ' first: the collateral it accepts, the stability fee it charges and the ratio at which it liquidates.'; },
      act: function (x) { return 'Open a ' + x.name + ' vault on ' + x.chain + ' with ' + money(x.cap) + ' of the collateral it accepts, mint its stablecoin against about half, and hold both sides.'; },
      keep: function (x) { return 'Repay a little of the minted stablecoin each week and mint it back, keeping the ratio well clear of the liquidation line.'; },
      exit: function (x) { return 'Repay the minted stablecoin, close the vault and withdraw the collateral; a vault left open across a price drop is a liquidation waiting to happen.'; },
    },
    stable: {
      check: function (x) { return 'Read ' + x.name + '\'s mint terms on ' + x.chain + ' first: the collateral behind the stablecoin, the redemption route and any fee on minting.'; },
      act: function (x) { return 'Mint ' + money(x.cap) + ' of ' + x.name + '\'s stablecoin on ' + x.chain + ' against the collateral it accepts and hold it; the mint is what the protocol counts.'; },
      keep: function (x) { return 'Mint and redeem a small amount through ' + x.name + ' once a week, so both directions stay in use on the same wallet.'; },
      exit: function (x) { return 'Redeem through ' + x.name + '\'s own route and check the fee and the wait before you need the funds.'; },
    },
    dex: {
      check: function (x) { return 'Check ' + x.name + '\'s deepest pool on ' + x.chain + ' first: its fee tier, depth and 24-hour volume decide whether fees beat slippage.'; },
      act: function (x) { return 'Add ' + money(x.cap) + ' of liquidity to ' + x.name + '\'s busiest pool on ' + x.chain + ', in the pair the pool trades, and keep the LP token.'; },
      keep: function (x) { return 'Claim the fees and check the range once a week: a position that drifts out of range stops earning while it stays open.'; },
      exit: function (x) { return 'Remove the liquidity, claim the fees and swap the leftover side back to USDC; count the impermanent loss before you call it profit.'; },
    },
    rwa: {
      check: function (x) { return 'Read ' + x.name + '\'s redemption terms on ' + x.chain + ' first: who holds the underlying, how long a redemption takes and what it costs.'; },
      act: function (x) { return 'Mint ' + money(x.cap) + ' of ' + x.name + '\'s yield-bearing asset on ' + x.chain + ' against USDC and hold the receipt; the receipt is what a snapshot counts.'; },
      keep: function (x) { return 'Check the yield accrual and the redemption window once a week, and top up only while the rate holds.'; },
      exit: function (x) { return 'Redeem through ' + x.name + '\'s own window; RWA redemptions can take days, so start early and keep the receipt until it settles.'; },
    },
    deriv: {
      check: function (x) { return 'Check ' + x.name + '\'s margin tiers and oracle on ' + x.chain + ' first: the maintenance level and the funding rate decide what the position really costs.'; },
      act: function (x) { return 'Deposit ' + money(x.cap) + ' of USDC as margin on ' + x.name + ' on ' + x.chain + ' and open one small hedge against the exposure you already hold.'; },
      keep: function (x) { return 'Roll the hedge once a week and keep the margin above the maintenance level; a hedge that lapses is worse than none.'; },
      exit: function (x) { return 'Close the position, withdraw the margin and count the funding paid before you call the hedge a gain.'; },
    },
    predict: {
      check: function (x) { return 'Read ' + x.name + '\'s market rules on ' + x.chain + ' first: who resolves the market, when, and what a disputed result pays.'; },
      act: function (x) { return 'Fund ' + money(x.cap) + ' of USDC on ' + x.name + ' and take one position in a market you can judge, at a price you would take without the farm.'; },
      keep: function (x) { return 'Settle one market and open another each week; volume and settled positions are what a launch usually counts.'; },
      exit: function (x) { return 'Sell or settle before the market resolves; a farm still open at resolution is a bet you did not choose.'; },
    },
    stake: {
      check: function (x) { return 'Check ' + x.name + '\'s validator set, fee and unbonding period on ' + x.chain + ' first: the receipt token is only as good as the queue behind it.'; },
      act: function (x) { return 'Stake ' + money(x.cap) + ' of ' + x.chain + '\'s native token through ' + x.name + ' and keep the receipt it mints; the receipt is the position a snapshot counts.'; },
      keep: function (x) { return 'Claim the staking rewards once a week and restake them, so the position grows without a new deposit.'; },
      exit: function (x) { return 'Unstake through ' + x.name + '\'s own queue and note the unbonding period before you need the funds; the receipt can also be sold, usually at a discount.'; },
    },
    bridge: {
      check: function (x) { return 'Check ' + x.name + '\'s route on ' + x.chain + ' first: whether it is native or validator-secured, how long finality takes and what it charges.'; },
      act: function (x) { return 'Bridge ' + money(x.cap) + ' of USDC to ' + x.chain + ' through ' + x.name + ' and use the funds in the app on the other side; the bridge fee plus gas is the cost of the route.'; },
      keep: function (x) { return 'Bridge a small amount back, or on to one more chain, through ' + x.name + ' once a week so the route keeps seeing the address.'; },
      exit: function (x) { return 'Move the funds back through the same route and check the finality time before you count on the money arriving.'; },
    },
    chain: {
      check: function (x) { return 'Read ' + x.name + '\'s own docs on ' + x.chain + ' first: which bridge it endorses, which staking app it runs and what its gas token costs to hold.'; },
      act: function (x) { return 'Bridge ' + money(x.cap) + ' of USDC into ' + x.name + ', stake or deposit it in the chain\'s own staking or lending app, and keep the position live.'; },
      keep: function (x) { return 'Use the chain\'s main app once a week: a swap, a stake or a vote, whichever its own campaign counts.'; },
      exit: function (x) { return 'Unstake, then bridge back through the route ' + x.name + ' endorses, and leave enough gas token for the exit.'; },
    },
    cover: {
      check: function (x) { return 'Read ' + x.name + '\'s cover terms on ' + x.chain + ' first: what the policy pays, what it excludes and how a claim is filed.'; },
      act: function (x) { return 'Buy ' + money(x.cap) + ' of cover from ' + x.name + ' on ' + x.chain + ' for the position you already hold, and keep the policy token.'; },
      keep: function (x) { return 'Check the cover terms once a week and renew before the policy expires; a lapsed policy pays nothing.'; },
      exit: function (x) { return 'Let the policy run to its term or cancel it for the pro-rata refund, and count the premium against what it protected.'; },
    },
    app: {
      check: function (x) { return 'Read ' + x.name + '\'s own docs on ' + x.chain + ' first: what the app does with the money, what it charges, and whether a token or points program is already announced.'; },
      act: function (x) { return 'Deposit ' + money(x.cap) + ' of USDC into ' + x.name + ' on ' + x.chain + ' and keep the position open; use the app\'s own route rather than a third-party front end.'; },
      keep: function (x) { return 'Make one qualifying action a week on ' + x.name + ', such as a deposit, a withdrawal or a vote, so the address stays active between snapshots.'; },
      exit: function (x) { return 'Withdraw through ' + x.name + '\'s own app and confirm the balance in your wallet before you close the log.'; },
    },
  };

  function routeStep(x) {
    if (x.chains.length <= 1) {
      return {
        text: 'Farm ' + x.name + ' on ' + x.chain + ', the only chain its record lists: a transaction there costs about ' + gasText(x.gas) + ', and every cost below is priced for it.',
        cost: 'nothing to plan',
        time: '2 minutes',
      };
    }
    var count = x.chains.length > 12 ? 'more than a dozen chains' : x.chains.length + ' chains';
    var tail = x.second && x.second !== x.chain ? ' A smaller second position on ' + x.second + ' follows in step 5.' : '';
    return {
      text: x.name + ' is live on ' + count + '. Put the main position on ' + x.chain + ', the chain its record lists first, where one transaction costs about ' + gasText(x.gas) + '.' + tail,
      cost: 'nothing to plan',
      time: '2 minutes',
    };
  }

  /** Age in words: months under two years, years above it, so "1.0 years" never appears. */
  function ageText(age) {
    if (age < 730) return Math.round(age / 30.4) + ' months';
    var y = age / 365;
    var r = y >= 3 ? Math.round(y) : Math.round(y * 10) / 10;
    return r + (r === 1 ? ' year' : ' years');
  }

  function ageStep(x) {
    if (x.age === null) {
      return {
        text: x.name + ' carries no first-listed date in the snapshot, so read its own launch post and audit before you commit: an untracked protocol is where an audit matters most.',
        cost: 'nothing but the reading',
        time: '20 minutes',
      };
    }
    if (x.age < 180) {
      return {
        text: x.name + ' has been tracked ' + x.age + ' days, so check its audits and its TVL history before you deposit: a young protocol\'s yield is a risk premium, not free money.',
        cost: 'nothing but the reading',
        time: '20 minutes',
      };
    }
    if (x.age < 730) {
      return {
        text: x.name + ' has run about ' + ageText(x.age) + ' with no token; check that one audit covers the contract you will use on ' + x.chain + ', and skim its last two governance posts.',
        cost: 'nothing but the reading',
        time: '20 minutes',
      };
    }
    return {
      text: x.name + ' has run about ' + ageText(x.age) + ' with no token, so check its docs and governance forum for a points program already running, and for the date its last snapshot closed.',
      cost: 'nothing but the reading',
      time: '20 minutes',
    };
  }

  /** The commitment step: the qualifying minimum, the snapshot dates, and the hold that spans them. */
  function commitStep(x) {
    return {
      text: 'Note ' + x.name + '\'s qualifying minimum and snapshot dates, then hold at least ' + x.hold + ' days in the same wallet so the position spans more than one round: a claim is usually paid to the address that held at the snapshot.',
      cost: 'the ' + money(x.cap) + ' stays in the position',
      time: x.hold + ' days',
    };
  }

  /**
   * The plan for one protocol: 8 steps, 9 when it is live on more than one chain. Every step carries a
   * cost and a time, and every sentence is built from the protocol's own record.
   */
  function planFor(p) {
    var chains = p.chains || [];
    var route = routeChains(chains);
    var fam = familyOf(p.category);
    var f = FAMILY[fam] || FAMILY.app;
    var cap = capitalFor(p.tvl_usd);
    var age = p.age_days === null || p.age_days === undefined ? null : p.age_days;
    var x = {
      name: p.name,
      chain: route.chain || 'its main chain',
      gas: route.gas === Infinity ? DEFAULT_GAS : route.gas,
      second: route.second,
      chains: chains,
      cap: cap,
      age: age,
      hold: holdDaysFor(age),
    };
    var setup = SETUP_MIN[fam] || 15;
    var week = WEEK_MIN[fam] || 10;

    var steps = [
      routeStep(x),
      { text: f.check(x), cost: 'nothing but the reading', time: setup + 5 + ' minutes' },
      ageStep(x),
      { text: f.act(x), cost: money(cap) + ' capital + ' + gasTag(x.gas), time: setup + ' minutes to open' },
    ];
    if (route.second && route.second !== x.chain) {
      var half = Math.max(25, Math.round(cap / 2));
      steps.push({
        text: 'Repeat the position on ' + route.second + ' with ' + money(half) + ' so it is live on two chains, not one, and keep both deposits in the same log.',
        cost: money(half) + ' capital + ' + gasTag(route.secondGas),
        time: setup + ' minutes to open',
      });
    }
    var weeklyCost = WEEK_GAS[fam] === false ? 'nothing to read' : 'about $' + Math.max(1, Math.round(x.gas * 2)) + ' of gas a week';
    steps.push({ text: f.keep(x), cost: weeklyCost, time: week + ' minutes a week' });
    steps.push(commitStep(x));
    steps.push({ text: f.exit(x), cost: 'about ' + gasTag(x.gas) + ' and whatever the exit fee is', time: '20 minutes' });
    return steps;
  }

  /** One step as one string, the shape board.json carries: its action, then its cost and time. */
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + ' Keep the position and check the protocol\'s own page.';
    return s;
  }

  return {
    planFor: planFor,
    stepText: stepText,
    familyOf: familyOf,
    gasFor: gasFor,
    capitalFor: capitalFor,
    routeChains: routeChains,
    holdDaysFor: holdDaysFor,
  };
});
