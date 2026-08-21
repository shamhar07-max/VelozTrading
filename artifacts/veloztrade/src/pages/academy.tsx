import { useEffect, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, CheckCircle, Clock, Award, Search, BarChart2, TrendingUp, Shield, Star, Bitcoin, Globe } from "lucide-react";

/* ── Full course content ─────────────────────────────────────────────────── */
const COURSE_CONTENT: Record<number, Array<{ title: string; body: string }>> = {
  1: [
    { title: "What is a CFD?", body: `A Contract for Difference (CFD) is a financial derivative that allows you to speculate on the price movement of an asset — without actually owning the underlying asset.

**How it works:** You and the broker agree to exchange the difference in the asset's price between when you open and when you close the trade. If the price moves in your predicted direction, you profit. If it moves against you, you lose.

**Example:** EUR/USD is at 1.0850. You believe it will rise. You open a BUY for 1 lot. If price rises to 1.0900, the difference is 50 pips. On 1 lot (€100,000), each pip = $10. Your profit = $500.

**Key advantages of CFDs:**
- Access thousands of markets from one account
- Trade long (buy) or short (sell) on any instrument
- Use leverage to control large positions with small capital
- No stamp duty or physical delivery
- Trade 24/5 (or 24/7 for crypto)

**The important risk:** CFDs are leveraged, which means your losses can exceed your deposit. This is why risk management is critical.` },
    { title: "Understanding Leverage", body: `Leverage allows you to control a position much larger than your actual deposit. It is expressed as a ratio.

**VelozTrade Leverage by Asset:**
| Asset Class | Leverage |
|---|---|
| Forex | 1:1000 |
| Commodities | 1:100 |
| Stocks | 1:10 |
| Indices | 1:10 |
| Crypto | 1:5 |

**Practical example with 1:1000 leverage:**
- You deposit $100 as margin
- You control $100,000 worth of EUR/USD
- A 1% move in your favour = $1,000 profit (10× your deposit)
- A 1% move against you = $1,000 loss — more than your deposit

**The leverage formula:**
Position Size = Margin × Leverage

If you have $500 margin and use 1:100 leverage → you control $50,000 of the asset.

**Critical rule:** Higher leverage does not mean more risk if you size positions correctly. A trader using 1:1000 with 0.01 lots takes the same risk as one using 1:10 with 0.1 lots on the same instrument. What matters is your dollar exposure per pip.` },
    { title: "Margin & Margin Calls", body: `**What is Margin?**
Margin is the amount of money you must deposit to open and maintain a leveraged position. It is not a fee — it is collateral held by the broker while your trade is open.

Required Margin = (Position Size × Current Price) ÷ Leverage

**Example:** BTC/USD at $67,000. You open 0.1 BTC with 1:5 leverage.
- Notional value = 0.1 × $67,000 = $6,700
- Margin required = $6,700 ÷ 5 = $1,340

**Free Margin:** Account equity minus used margin. This is what you have available to open new trades.

**Margin Level = (Equity ÷ Used Margin) × 100%**

On VelozTrade:
- **100% margin level = Margin Call.** You receive an alert to add funds or close positions.
- **50% margin level = Stop Out.** Positions are automatically closed (largest loss first) to prevent negative balance.

**How to avoid a margin call:**
1. Never use all available margin
2. Always keep free margin above 200%
3. Use stop losses on every trade
4. Monitor open positions regularly` },
    { title: "Bid, Ask & Spreads", body: `Every market has two prices: the **Bid** (what you sell at) and the **Ask** (what you buy at). The difference between them is the **spread** — the broker's compensation.

**When you BUY:** You pay the Ask price
**When you SELL:** You receive the Bid price

**Example:** EUR/USD
- Bid: 1.08740
- Ask: 1.08750
- Spread: 0.00010 = 1 pip

**Spread types on VelozTrade:**
- Silver: From 0.5–0.7 pips (spread-only, no commission)
- Gold: Raw ECN pricing + $3.00/lot commission
- Platinum: From 0.1 pips + $1.50/lot
- VIP: 0.0 pips raw + volume-based commission

**Pip values:**
- Forex majors: 1 pip = $10 per standard lot (100,000 units)
- JPY pairs: 1 pip = $7–9 (because JPY quoted to 2 decimals not 4)
- Gold: 1 pip = $1 per 1 oz position

Your trade starts at a loss equal to the spread. This is why tight spreads matter for active traders.` },
    { title: "Market vs Limit Orders", body: `**Market Order:** Executes immediately at the best available price. Ideal when you want to enter right now and price precision is less critical. On VelozTrade, market orders execute in 5ms under normal conditions.

**Limit Order:** Executes only when the price reaches your specified level. You set it in advance and it waits.
- Buy Limit: Below current price (you expect price to dip before rising)
- Sell Limit: Above current price (you expect price to rise before falling)

**Example:** EUR/USD is at 1.0880. You believe if it dips to 1.0850 it will bounce. You place a Buy Limit at 1.0850. The order only fills if price reaches that level.

**Stop Orders:**
- Buy Stop: Above current price (breakout entry)
- Sell Stop: Below current price (breakdown entry)

**Slippage:** The difference between your expected fill price and actual execution price. Market orders during volatile news events can experience slippage. Limit orders never slip — but they may not fill at all if price doesn't reach your level.

**Best practice:** Use market orders for entries in liquid hours. Use limit orders when you have a specific entry target and patience.` },
    { title: "Stop Loss & Take Profit", body: `These are the two most important risk management tools in trading. Both are pending orders that close your position automatically at a preset price.

**Stop Loss (SL):** Automatically closes your trade at a loss to prevent further loss.
- On a BUY: Set SL below your entry price
- On a SELL: Set SL above your entry price

**Take Profit (TP):** Automatically locks in profit when price hits your target.
- On a BUY: Set TP above your entry price
- On a SELL: Set TP below your entry price

**Why always use a Stop Loss:**
Without an SL, a single bad trade can wipe your entire account. Even the best traders use stop losses. Professional traders say: "Your first loss is your smallest loss."

**Risk:Reward Ratio:**
If your SL is 20 pips and TP is 60 pips → R:R = 1:3
You can lose 2 out of 3 trades and still break even.
Professional traders target minimum 1:2 R:R.

**Setting SL levels:**
- Below support (for buys)
- Above resistance (for sells)
- Below/above recent candle swing
- Never "just round numbers" — give the trade breathing room

**On VelozTrade:** Set SL and TP in the order panel before clicking Buy/Sell, or modify them after by clicking "Edit" on your open position.` },
    { title: "Risk Management Basics", body: `Risk management is the difference between traders who survive and those who blow their accounts. Even with a poor strategy, good risk management can keep you in the game.

**The 1% Rule:** Never risk more than 1% of your account on a single trade.
- Account: $5,000
- Max loss per trade: $50 (1%)
- If your SL is 25 pips on EUR/USD (pip value $10/lot)
- Max position: $50 ÷ $25 = 2 mini lots (0.2 standard lots)

**Position Sizing Formula:**
Lots = (Account × Risk%) ÷ (SL in pips × Pip value)

**Diversification:** Never have all positions in the same direction or correlated assets. EUR/USD and GBP/USD often move together — holding both is doubling your risk.

**Keep a trading journal:** Record every trade:
- Entry/exit price, SL/TP
- Reason for entry
- Outcome and lessons learned

Within 30 trades, patterns emerge that reveal your actual strengths and weaknesses.

**Drawdown management:** If you lose 5 trades in a row, reduce position size by 50% until you recover. Protect capital above all else.` },
    { title: "Your First Trade Walkthrough", body: `Let's walk through placing your first trade on VelozTrade step by step.

**Step 1: Navigate to Markets & Trade**
Click "Markets & Trade" in the left sidebar. The page loads with the instrument list on the left and chart on the right.

**Step 2: Select an Instrument**
For beginners, start with EUR/USD — the most liquid, lowest spread pair. Click it in the left panel.

**Step 3: Read the Chart**
Set the interval to 1H (one hour). Identify the recent trend: Is price making higher highs (uptrend) or lower lows (downtrend)? Look for a clear support or resistance level.

**Step 4: Enter Your Order**
In the right panel:
- Choose BUY or SELL direction
- Set Volume to 0.01 (micro lot — smallest size, lowest risk)
- Set Stop Loss: 30 pips from your entry
- Set Take Profit: 60 pips from your entry (2:1 R:R)
- Click the BUY or SELL button

**Step 5: Monitor Your Position**
Scroll down to the positions table. You'll see your trade with live P&L updating in real time.

**Step 6: Close the Trade**
Click "Close" to close at market price, or let it close automatically at your TP or SL.

**Practice first:** Use the $10,000 demo account to complete at least 20 trades before going live. Your confidence and discipline will thank you.` },
  ],
  2: [
    { title: "Bar vs Candlestick Charts", body: `Charts are the primary tool traders use to read price action. Two main chart types exist on most platforms.

**Bar Charts:** Each bar represents price action for a specific time period. The vertical line shows the range (high to low). A left tick shows the open, a right tick shows the close. Bars are clean and informational but take practice to read quickly.

**Candlestick Charts:** The most popular chart type among professional traders. Developed in 17th-century Japan by rice merchants. Each candle shows Open, High, Low, Close (OHLC) for the chosen timeframe.

Candlestick anatomy:
- **Body:** The filled rectangle between open and close
- **Wick (shadow):** Thin lines above and below showing the high and low
- **Bullish candle:** Close > Open (usually green or white)
- **Bearish candle:** Close < Open (usually red or black)

**Why candlesticks matter:**
The candle body size and wick length tell a story about buying and selling pressure. A long wick below a bearish candle suggests buyers stepped in to reject lower prices — a bullish signal. A small body with long wicks in both directions shows indecision.

On VelozTrade, candlestick charts are the default. Use the interval buttons (1m, 5m, 15m, 1h, 4h, 1D, 1W) to switch timeframes.` },
    { title: "Anatomy of a Candle", body: `Understanding what each part of a candle communicates is fundamental to reading markets.

**The Body:**
Large body = strong conviction in that direction
Small body (Doji) = indecision, possible reversal

**The Upper Wick:**
Shows how high price went before sellers pushed it back down. A long upper wick on a bullish candle = sellers are active at higher prices.

**The Lower Wick:**
Shows how low price went before buyers pushed it back up. A long lower wick = buyers defended lower prices aggressively.

**Reading candle psychology:**

🟢 Long green body, small wicks → Strong bullish momentum, buyers in full control

🔴 Long red body, small wicks → Strong bearish momentum, sellers in control

⚪ Small body, wicks both sides → Indecision. Neither buyers nor sellers won this candle.

🔴 Long upper wick, small body at bottom → Shooting Star — bearish reversal signal at resistance

🟢 Long lower wick, small body at top → Hammer — bullish reversal signal at support

**Candle size context:**
A large candle after a series of small ones signals a momentum shift. Volume alongside candle size gives even stronger confirmation.` },
    { title: "Bullish & Bearish Patterns", body: `Candlestick patterns are formations of one or more candles that signal likely future price direction.

**Single Candle Patterns:**

Hammer 🔨 — Small body at top, long lower wick (2× body size). Appears at the bottom of a downtrend. Bullish reversal signal.

Shooting Star ⭐ — Small body at bottom, long upper wick. Appears at the top of an uptrend. Bearish reversal signal.

Doji ➕ — Open and close nearly equal. Long wicks. Signals indecision — watch for confirmation.

Marubozu — Full body candle, no wicks. Pure momentum in one direction.

**Two-Candle Patterns:**

Bullish Engulfing — Small red candle followed by large green candle that engulfs it. Strong buy signal at support.

Bearish Engulfing — Small green candle followed by large red candle. Strong sell signal at resistance.

**Three-Candle Patterns:**

Morning Star — Bearish candle, small Doji, large bullish candle. Powerful bottom reversal.

Evening Star — Bullish candle, small Doji, large bearish candle. Powerful top reversal.

Three White Soldiers — Three consecutive bullish candles. Strong uptrend confirmation.

**Key rule:** Patterns are signals, not certainties. Always confirm with support/resistance levels and volume. A pattern appearing at a key level is far more significant than one in the middle of nowhere.` },
    { title: "Support & Resistance", body: `Support and resistance are the foundation of technical analysis. Nearly every other technique builds on these concepts.

**Support:** A price level where buying pressure is strong enough to prevent further decline. Price has bounced from this level multiple times.

**Resistance:** A price level where selling pressure is strong enough to prevent further advance. Price has reversed from this level multiple times.

**Why they work:**
Traders have memory. When price was at $67,000 last month and bounced, many traders remember that level. When price returns, those same traders buy again — creating a self-fulfilling prophecy.

**Identifying strong levels:**
1. The more times price tested a level, the stronger it is
2. Levels on higher timeframes (daily, weekly) are more significant
3. Round numbers (1.0900, 2000, 50,000) attract orders from many traders
4. Levels where significant volume traded are especially important

**Support becomes Resistance (and vice versa):**
When a support level breaks, it often becomes resistance. Former buyers who are now underwater want to sell at breakeven when price returns to their entry. This is called a "role reversal."

**Trading levels:** 
- Buy near support with SL below it
- Sell near resistance with SL above it
- Look for confluence: pattern + support/resistance + volume = high probability setup` },
    { title: "Trend Lines", body: `Trend lines are straight lines drawn along price highs or lows, showing the market's directional bias.

**Drawing an uptrend line:**
Connect at least two significant higher lows. The more touches the line has, the more valid it is. Price should respect this line — when it reaches it and bounces, that is a buy opportunity.

**Drawing a downtrend line:**
Connect at least two significant lower highs. Price breaking above this line signals the downtrend may be ending.

**Trend line rules:**
- Need minimum 2 points to draw, 3+ to validate
- Must connect swing lows (for uptrend) or swing highs (for downtrend)
- Angle matters: very steep trends are unsustainable
- A trend line break signals a potential reversal

**Channels:**
Draw a parallel line on the other side of price to create a channel. Price tends to oscillate between channel lines. Buy at the lower channel line, sell at the upper.

**VelozTrade drawing tools:**
Use the Trend drawing tool in the chart toolbar (click the Trend button, then click two points on the chart). H-Line tool draws horizontal support/resistance lines. Clear all drawings with the trash icon.

**Common mistakes:**
- Forcing a line through candle bodies (use wicks)
- Drawing too many trend lines (creates confusion)
- Ignoring the overall trend on higher timeframes` },
    { title: "Moving Averages", body: `Moving averages smooth out price data to show the underlying trend direction. They are the most widely used technical indicators.

**Simple Moving Average (SMA):**
Calculates the average closing price over N periods. An SMA(20) averages the last 20 candles.
When price is above the SMA, the trend is considered bullish. Below = bearish.

**Exponential Moving Average (EMA):**
Gives more weight to recent prices, so it reacts faster to price changes. More popular among active traders.
Common EMAs: 9, 20, 50, 100, 200

**The 200 EMA:**
The most watched moving average across all markets. When price is above the 200 EMA, institutional funds generally prefer to buy. Below = they prefer to sell. Major hedge funds use this as a core filter.

**Moving Average Crossovers:**
Golden Cross: Fast MA (50 EMA) crosses above slow MA (200 EMA) → Bullish signal
Death Cross: Fast MA (50 EMA) crosses below slow MA (200 EMA) → Bearish signal

**Dynamic Support/Resistance:**
In a trending market, the 20 or 50 EMA often acts as support (in uptrend) or resistance (in downtrend). Price frequently "bounces" off these lines, giving entry opportunities.

**Limitation:** Moving averages are lagging indicators — they react after price moves. They work well in trending markets but give false signals in choppy, sideways conditions.` },
    { title: "Volume Analysis", body: `Volume is the number of units traded in a given period. It is the "fuel" behind price moves. High-volume moves are more significant and trustworthy than low-volume moves.

**Reading Volume:**
Volume bars appear at the bottom of most charts. Green bars = volume on up candles, red bars = volume on down candles.

**Volume confirmation rules:**
- Uptrend: Volume should increase on up candles, decrease on down candles ✅
- Downtrend: Volume should increase on down candles, decrease on up candles ✅
- High volume breakout = genuine move, likely to continue
- Low volume breakout = suspect, may reverse ("fakeout")

**Volume at key levels:**
Extremely high volume at a support level = large buyers absorbing selling. This is called "accumulation."
Extremely high volume at resistance = large sellers distributing. This is called "distribution."

**Volume Spikes:**
A sudden spike in volume (2–3× average) during a price move signals major institutional participation. These often mark turning points or acceleration.

**On VelozTrade:** Volume histogram appears automatically at the bottom of the chart. Compare current volume to the average of recent bars. A simple rule: trust moves that come with above-average volume.` },
    { title: "Timeframe Selection", body: `The timeframe you choose determines the type of trading you're doing. Different traders use different timeframes based on their schedule, personality, and strategy.

**Common timeframes and their uses:**

1-minute (M1): Scalping. Very short trades lasting seconds to minutes. Extremely fast decision-making required. High noise, many false signals. Not recommended for beginners.

5-minute (M5): Day trading. Trades lasting minutes to hours. Still noisy but more manageable than M1.

15-minute (M15): Short-term day trading. Good balance of signal quality and trade frequency.

1-hour (H1): Swing trading. Trades lasting hours to days. Excellent for working traders who can check charts every few hours.

4-hour (H4): Medium-term swing trading. High signal quality. Major institutional players use this timeframe.

Daily (D1): Position trading. Trades lasting days to weeks. Clean signals, minimal noise, best for part-time traders.

Weekly (W1): Long-term investing. Macro trends visible here. Very few setups.

**Multi-Timeframe Analysis (MTA):**
The most powerful approach. Use a higher timeframe to identify trend and key levels, then drop to a lower timeframe for precise entry.
Example: Check D1 for trend direction → Check H4 for a pattern → Enter on H1.

**Best for beginners:** H1 or H4. Enough time to think, not too many false signals.` },
    { title: "Common Reversal Patterns", body: `Chart patterns are formations in price action that signal a likely reversal of the current trend. Unlike single candlestick patterns, these develop over days to weeks.

**Head and Shoulders (bearish reversal):**
Three peaks: left shoulder, higher head, right shoulder. Neckline drawn through the two troughs. When price breaks below the neckline, the pattern is confirmed. Target = distance from head to neckline, projected downward.

**Inverse Head and Shoulders (bullish reversal):**
Mirror image. Three troughs with a lower middle. Breakout above the neckline = buy signal.

**Double Top (bearish):**
Price tests the same resistance level twice, fails both times. Break below the trough between the two tops confirms. Signals the bulls are exhausted.

**Double Bottom (bullish):**
Price tests the same support twice. Break above the peak between the two bottoms confirms. Signals bears are exhausted.

**Rising Wedge (bearish):**
Price makes higher highs and higher lows, but the lows are rising faster. Upward channel narrows. Eventually breaks down.

**Falling Wedge (bullish):**
Opposite. Downward channel narrows. Eventually breaks upward.

**Pattern reliability ranking:**
1. Head and Shoulders (most reliable)
2. Double Top/Bottom
3. Wedges
4. Triangles (symmetrical, ascending, descending)

All patterns must be confirmed by a close beyond the breakout level on above-average volume.` },
  ],
  3: [
    { title: "Currency Pairs & Quoting", body: `Forex is the world's largest financial market, trading over $7 trillion per day. It operates as a global network of banks, institutions, and brokers.

**Currency pair structure:**
Every forex trade involves two currencies. EUR/USD means:
- EUR = Base currency (what you're buying or selling)
- USD = Quote currency (what you use to buy/sell)
- Price = How much USD needed to buy 1 EUR

When you BUY EUR/USD, you're buying EUR and selling USD.
When you SELL EUR/USD, you're selling EUR and buying USD.

**Three categories:**

Major Pairs (include USD): EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CHF, USD/CAD, NZD/USD
- Highest liquidity, tightest spreads
- Best for beginners

Cross Pairs (no USD): EUR/GBP, EUR/JPY, GBP/JPY
- Less liquid, wider spreads
- Can move sharply

Exotic Pairs: USD/ZAR, EUR/TRY, USD/PKR
- Very wide spreads, volatile
- Not recommended for beginners

**Long vs Short:**
Going Long = Buying the base currency (profit if it rises)
Going Short = Selling the base currency (profit if it falls)

**Pips:**
Price movement in forex is measured in pips. For EUR/USD (4 decimal places), 1 pip = 0.0001. For USD/JPY (2 decimal places), 1 pip = 0.01.` },
    { title: "Forex Market Sessions", body: `The forex market operates 24 hours a day, 5 days a week. However, not all hours are equal. Understanding sessions dramatically improves your trading.

**The Four Major Sessions:**

🇦🇺 Sydney (10pm–7am GMT): Opens the trading week. Quietest session. AUD, NZD pairs most active. Low volume, wide spreads.

🇯🇵 Tokyo/Asian (12am–9am GMT): Moderate activity. JPY pairs most active. Markets often range (sideways). Breakouts from Asian range during London open are common.

🇬🇧 London (8am–5pm GMT): The most active session. About 35% of all forex volume. EUR, GBP pairs most volatile. Major trend moves begin here. Tightest spreads.

🇺🇸 New York (1pm–10pm GMT): Second largest session. USD pairs most active. Overlaps with London 1pm–5pm GMT = highest volatility of the day.

**Session Overlaps (highest volume and opportunity):**
- Tokyo/London overlap: 8am–9am GMT (GBP/JPY, EUR/JPY opportunities)
- London/New York overlap: 1pm–5pm GMT — THE golden window for forex traders

**What to do outside active sessions:**
During Asian session on non-JPY pairs: ranges tend to be narrow. Good for limit orders, poor for breakout trades.

**Day of week patterns:**
- Monday: Slow start, thin liquidity
- Tuesday–Thursday: Best volume and trends
- Friday: Good until NY afternoon, then avoid — liquidity drops sharply` },
    { title: "Central Banks & Interest Rates", body: `Central banks are the most powerful force in currency markets. Understanding their role gives you a significant edge.

**Key central banks for forex traders:**
- Federal Reserve (Fed) — United States (USD)
- European Central Bank (ECB) — Eurozone (EUR)
- Bank of England (BoE) — United Kingdom (GBP)
- Bank of Japan (BoJ) — Japan (JPY)
- Reserve Bank of Australia (RBA) — Australia (AUD)
- Swiss National Bank (SNB) — Switzerland (CHF)

**How interest rates affect currencies:**
Higher interest rates = higher returns on assets in that currency = international capital flows in = currency strengthens.
Lower interest rates = capital flows out = currency weakens.

**Rate decisions:** Usually monthly. The actual decision and forward guidance both move markets. Often, the market "prices in" expected decisions in advance.

**Hawkish vs Dovish:**
Hawkish central bank = signalling higher rates ahead. Currency tends to strengthen.
Dovish central bank = signalling lower rates or economic concern. Currency tends to weaken.

**Interest rate differentials:**
The difference in interest rates between two countries drives long-term currency trends. This is the basis of carry trades (borrowing low-rate currency to buy high-rate currency).

**Example:** If the Fed raises rates while the ECB holds steady, USD strengthens against EUR — EUR/USD falls.` },
    { title: "Economic Data & NFP", body: `Economic data releases create some of the largest price moves in forex. Knowing which reports matter and how to trade them is essential.

**Tier 1 Data (market-moving):**

Non-Farm Payrolls (NFP) — Released first Friday of every month at 1:30pm GMT. Measures US job creation. One of the single biggest market movers of any month. Expected vs Actual = direction of move.

CPI (Consumer Price Index) — Inflation data. If CPI rises above expectations, central banks may hike rates. Currency strengthens.

GDP — Quarterly measure of economic output. Surprise beats = currency strength.

Central Bank Rate Decisions — Scheduled monthly. Both the decision and the press conference statement move markets.

PMI (Purchasing Managers Index) — Monthly business activity survey. Above 50 = expansion. Key leading indicator.

**How to trade data:**

The "buy the rumour, sell the news" approach: If data is expected to be strong, price may already be priced in. The actual release can reverse the move.

**Risk around data:** Spreads widen dramatically just before major releases. Slippage is common. Consider staying out of positions during major data unless you're experienced.

**Economic calendar on VelozTrade:** Visit the Calendar page in the sidebar. All major events are listed with impact level (high/medium/low), previous result, and consensus forecast.` },
  ],
  4: [
    { title: "RSI Divergence", body: `The Relative Strength Index (RSI) is a momentum oscillator that measures the speed and change of price movements. It ranges from 0 to 100.

**Reading RSI:**
- Above 70 = Overbought (potential sell signal)
- Below 30 = Oversold (potential buy signal)
- 50 = Neutral / midline

**Standard RSI use:** Sell when RSI crosses above 70 and back below. Buy when RSI crosses below 30 and back above. Simple but prone to false signals in strong trends.

**RSI Divergence — the advanced use:**

**Bullish Divergence:** Price makes a lower low, but RSI makes a higher low. This shows that selling momentum is weakening even as price continues down. Powerful bullish reversal signal.

**Bearish Divergence:** Price makes a higher high, but RSI makes a lower high. Shows that buying momentum is weakening even as price rises. Powerful bearish reversal signal.

**Why divergence works:**
RSI measures the speed of moves. When price makes new extremes but momentum doesn't confirm, it suggests the move is exhausting. The divergence precedes the reversal.

**Best timeframes for RSI divergence:** H1 and H4 give the most reliable signals. Daily is even more reliable but fewer setups.

**RSI Settings:** Standard is 14-period. Some traders use 7 for faster signals or 21 for smoother reads.` },
    { title: "MACD Signals", body: `The Moving Average Convergence Divergence (MACD) shows the relationship between two exponential moving averages. It is a trend-following momentum indicator.

**MACD Components:**
- MACD Line: 12-period EMA minus 26-period EMA
- Signal Line: 9-period EMA of the MACD line
- Histogram: MACD line minus Signal line (shows when they're converging or diverging)

**Standard settings: (12, 26, 9)**

**Three ways to use MACD:**

1. **Signal Line Crossovers:**
MACD crosses above Signal line → Bullish, consider buying
MACD crosses below Signal line → Bearish, consider selling
(Most common use but generates many false signals in sideways markets)

2. **Zero Line Crossovers:**
MACD crosses above 0 → Short-term EMA crossed above long-term EMA = trend turning bullish
MACD crosses below 0 → Trend turning bearish
(More reliable but slower)

3. **Divergence (same concept as RSI divergence):**
Price makes new high, MACD histogram makes lower high = bearish divergence
Price makes new low, MACD histogram makes higher low = bullish divergence

**Combining with other indicators:**
MACD signals on H4 confirmed by RSI > 50 (for buys) or < 50 (for sells) gives significantly higher win rate. Never use MACD alone.

**Histogram shrinking:** When the MACD histogram bars are getting shorter, momentum is slowing. This often precedes a crossover.` },
    { title: "Fibonacci Retracement", body: `Fibonacci retracement is one of the most widely used tools in technical analysis. It identifies potential support and resistance levels based on the Fibonacci sequence (0, 1, 1, 2, 3, 5, 8, 13, 21...).

**Key Fibonacci levels:**
- 23.6%
- 38.2%
- 50% (not a true Fibonacci number, but widely watched)
- 61.8% — the Golden Ratio — the most important level
- 78.6%

**How to draw Fibonacci retracement:**
1. Identify a clear swing move (from swing low to swing high in an uptrend)
2. Draw the Fibonacci tool from the bottom to the top
3. The horizontal lines show potential retracement support levels

**In an uptrend:** Price advances, then pulls back. The pullback commonly finds support at the 38.2%, 50%, or 61.8% Fibonacci levels before continuing higher.

**The 61.8% Golden Ratio:**
The most powerful level. Price frequently bounces from exactly 61.8% retracements in strong trends. This is where professional traders often set limit buy orders.

**Combining Fibonacci with other analysis:**
Fibonacci level + moving average + candlestick pattern = confluence zone = high probability entry

**Fibonacci extensions:** Used to project price targets after a retracement. Common targets: 100%, 127.2%, 161.8% of the original move.

**Pitfalls:** Don't draw Fibonacci on small moves. Only use it on significant, clean swing moves with clear high and low points.` },
  ],
  5: [
    { title: "Why Most Traders Lose", body: `Studies consistently show 70–85% of retail traders lose money. Understanding why helps you be in the minority that doesn't.

**The top reasons traders fail:**

1. **No edge:** Trading based on tips, hunches, or random signals rather than a systematic, tested strategy.

2. **Overleveraging:** Using maximum leverage on every trade. One bad streak wipes the account.

3. **No risk management:** Trading without stop losses. One catastrophic loss can end a trading career.

4. **Emotional trading:** Fear causes premature exits of winning trades. Greed causes holding losers too long. Revenge trading after losses leads to bigger losses.

5. **Overtrading:** Taking too many trades, often out of boredom. Quality over quantity always wins.

6. **Lack of consistency:** Jumping between strategies after a few losses. No strategy works 100% of the time — abandoning one after 3 losses and trying another creates a cycle of failure.

7. **Unrealistic expectations:** Expecting 50% monthly returns. Professionals aim for 2–5% monthly. Consistent compounding of modest returns creates real wealth.

8. **Not keeping records:** Without a trading journal, you repeat the same mistakes endlessly.

**What winning traders do differently:**
- Follow a written trading plan
- Risk no more than 1–2% per trade
- Accept that losses are part of the business
- Focus on process, not outcomes
- Track every trade and learn from losses` },
    { title: "The 1% Rule & Position Sizing", body: `The single most important rule in trading is: **Never risk more than 1–2% of your account on any single trade.**

This rule protects you from the inevitable losing streak. Even if you lose 10 trades in a row (unlikely with a proper strategy), you've only lost 10% of your account — fully recoverable.

**Why 1% matters:**
With 1% risk per trade and a 50% win rate with 1:2 R:R:
- Win 5, lose 5 of 10 trades
- Wins: +5 × 2% = +10%
- Losses: -5 × 1% = -5%
- Net: +5% on 10 trades

**Position Sizing Formula:**
Position Size (lots) = (Account Balance × Risk %) ÷ (SL in pips × Pip Value)

Example:
- Account: $2,000
- Risk 1% = $20
- Trade: EUR/USD, SL = 20 pips
- Pip value on 0.1 lot = $1/pip
- Position: $20 ÷ (20 × $1) = 1.0... wait, that's 1 mini lot (0.1 standard)
- Check: 20 pips × $1/pip × 1 = $20 ✅

**Scaling up gradually:**
Don't increase position size when winning — it leads to overconfidence. Instead, increase size only when your account grows proportionally, keeping the 1% rule consistent.

**Compound growth of capital:**
$10,000 growing at 3% per month for 3 years = $289,000. Consistent small returns, compounded, create life-changing results.` },
    { title: "Trading Psychology", body: `Psychology is responsible for the majority of trading losses. You can have a perfect strategy and still lose if your emotions override your rules.

**The core emotional biases:**

**Fear of Missing Out (FOMO):** Seeing a move and entering late, chasing price. Leads to buying at tops and selling at bottoms.

**Loss Aversion:** Psychological research shows losses feel twice as painful as equivalent gains feel good. This causes traders to hold losing positions too long (hoping they recover) and cut winners too early.

**Confirmation Bias:** Only looking for information that confirms your existing view. If you're bullish EUR/USD, you ignore bearish signals. Dangerous.

**Overconfidence:** After a winning streak, believing you "have the market figured out." Usually precedes a large loss.

**Recency Bias:** Giving too much weight to recent events. If EUR/USD just fell 200 pips, assuming it will keep falling.

**Building psychological discipline:**

1. **Write your rules before the market opens.** No rules during live trading.
2. **Commit to stop losses before entry.** Never move SL further away once in a trade.
3. **Take regular breaks.** Staring at charts for hours clouds judgment.
4. **Meditate or exercise.** Physical and mental health directly affect trading performance.
5. **Expect losses.** Budget for them. A 40% win rate with great R:R is profitable. Losses are tuition.
6. **Never revenge trade.** After a loss, if you feel the urge to "get it back" immediately — stop trading for the day.` },
  ],
  6: [
    { title: "Bitcoin Halving Cycles", body: `Bitcoin's most powerful structural feature is the halving — a pre-programmed event occurring every 210,000 blocks (~4 years) that cuts the mining reward in half. This directly reduces new supply entering circulation.

**Historical halvings:**
- 2012: 50 → 25 BTC per block. Price: $13 → $1,150 within 12 months
- 2016: 25 → 12.5 BTC. Price: $650 → $19,000 within 18 months
- 2020: 12.5 → 6.25 BTC. Price: $9,000 → $69,000 within 18 months
- 2024: 6.25 → 3.125 BTC. New cycle underway.

**The supply shock mechanism:**
Miners must sell BTC to cover electricity costs. When rewards halve, their selling pressure halves. If demand stays constant, price rises. If demand grows (ETF inflows, adoption), price rises significantly more.

**Cycle anatomy:**
Pre-halving accumulation → Post-halving bull run (6–18 months) → Speculative peak → Bear market (12–24 months) → Accumulation phase → Next halving

**Trading the cycle on VelozTrade:**
Use BTC/USD CFDs to go long in accumulation zones (typically 12–18 months post-peak) or short in speculative excess (RSI > 85 on weekly, parabolic move).

With 1:5 leverage on crypto, position size conservatively. Bitcoin regularly moves 10–30% in a week.

**Important:** Crypto is extremely volatile. Never risk more than 0.5% per trade. Use wider stops than on forex.` },
    { title: "On-Chain Analysis", body: `On-chain analysis examines data directly from the blockchain to understand market dynamics. Unlike price-only technical analysis, it shows what actual participants are doing with their coins.

**Key on-chain metrics:**

**HODL Waves:** Shows what percentage of the Bitcoin supply has not moved in various time periods. When long-term holders (1+ year coins) are increasing, it's a bullish signal — they're accumulating.

**Exchange Flows:**
Coins moving from wallets to exchanges = likely selling pressure ahead (bearish)
Coins moving from exchanges to wallets = long-term holding intent (bullish)
Monitoring: Glassnode, CryptoQuant

**MVRV Ratio (Market Value to Realized Value):**
Compares current market cap to realized cap (what people paid for their coins).
MVRV > 3.5 = Historically overbought territory. Previous Bitcoin peaks occurred here.
MVRV < 1 = Historically undervalued. Prime accumulation zones.

**Hash Rate:** The computing power securing the Bitcoin network. Rising hash rate = healthy, secure network. Miners are confident enough to invest in equipment. Falling hash rate = concern.

**Funding Rates:** In perpetual futures markets, when longs pay shorts (positive funding), the market is long-heavy and vulnerable to a "long squeeze." Extreme positive funding = contrarian sell signal.

**Combining on-chain with price:** Use on-chain data as a macro filter. If MVRV is extreme and exchange inflows are spiking, be cautious even in a bull market. If MVRV < 1 and coins are leaving exchanges, consider building a long position despite negative news.` },
  ],
  7: [
    { title: "How AutoCopy Works", body: `AutoCopy trading on VelozTrade allows you to mirror the trades of verified top traders automatically. When they open a position, an equivalent position opens in your account proportionally to your allocation.

**Step-by-step setup:**

1. **Navigate to AutoCopy** in the left sidebar
2. **Browse and filter** traders by: win rate, monthly return, total return, risk score, tier, and number of copiers
3. **Review the trader profile:** Check their strategy description, instruments traded, time in service, and drawdown history
4. **Click AutoCopy** and configure:
   - **Copy Amount:** The capital allocated to copy this trader. More allocation = proportionally larger position sizes.
   - **Stop Copy Loss:** The maximum loss (%) you'll accept before AutoCopy stops automatically. Recommended: 20–30% to allow for normal drawdowns.
5. **Confirm and activate**

**How proportionality works:**
If you copy with $500 and the trader has $50,000 in their account:
- Trader opens 1.0 lot EUR/USD
- You open: $500/$50,000 × 1.0 = 0.01 lots

**Performance fee:** 20% of profits on copied trades only. No fee on losing trades. This aligns the trader's incentive with yours.

**Managing active copies:**
View all active copies in your dashboard. You can adjust the stop loss %, add more allocation, or stop copying at any time. Any open positions at the time of stopping copy remain open in your account — you must close them manually.

**Best practice:** Copy 3–5 traders with different strategies (some forex, some crypto, some indices) to diversify risk.` },
    { title: "Evaluating Trader Stats", body: `Choosing the right trader to copy is more important than any other decision in copy trading. Don't be fooled by headline return numbers alone.

**The metrics that matter:**

**Win Rate:** Percentage of trades closed in profit. 60%+ is good. 70%+ is excellent. However, a trader with 90% win rate but poor R:R (small wins, catastrophic losses) can still lose money overall.

**Monthly Return:** Average monthly profit %. Be sceptical of traders consistently showing 30%+ monthly returns — this usually involves very high risk. 5–15% monthly consistently is realistic and sustainable.

**Total Return / Equity Curve:** Look for a smooth, upward-sloping curve. Avoid traders with large drawdowns or equity spikes that then fall sharply.

**Maximum Drawdown:** The largest peak-to-trough loss in their history. A drawdown of 30%+ indicates high risk-taking. Drawdown under 15% is ideal for conservative copying.

**Risk Score (VelozTrade):** Displayed as 1–5 bars. Based on average position size, leverage used, and drawdown history. Lower is safer.

**Number of trades:** More trades = more data. A trader with 1,000 trades has a much more statistically significant track record than one with 20.

**Average trade duration:** Long-duration trades (days) suggest a swing trader — generally lower frequency, higher R:R. Very short duration = scalper — high frequency, tighter stops.

**Red flags:**
- Recently started, very high returns (insufficient track record)
- Very low win rate but huge returns (one or two lucky trades)
- Frequent large position sizes relative to account` },
  ],
};

const COURSES = [
  { id:1, category:"Beginner", title:"Introduction to CFD Trading", desc:"Learn what CFDs are, how leverage works, margin calls, and how to place your first trade safely.", icon:BookOpen, color:"bg-emerald-500/10 text-emerald-400", badge:"🎓 Start Here", lessonCount:8, duration:"45 min" },
  { id:2, category:"Beginner", title:"Reading Charts & Candlesticks", desc:"Understand candlestick patterns, chart types, support/resistance, volume, and timeframes.", icon:BarChart2, color:"bg-blue-500/10 text-blue-400", badge:"📊 Essential", lessonCount:9, duration:"60 min" },
  { id:3, category:"Intermediate", title:"Forex Trading Fundamentals", desc:"Currency pairs, market sessions, central banks, and economic data that moves markets.", icon:Globe, color:"bg-cyan-500/10 text-cyan-400", badge:"💱 Forex", lessonCount:4, duration:"50 min" },
  { id:4, category:"Intermediate", title:"Technical Analysis Masterclass", desc:"RSI divergence, MACD, Fibonacci retracement, and advanced indicator combinations.", icon:TrendingUp, color:"bg-violet-500/10 text-violet-400", badge:"📈 Advanced", lessonCount:3, duration:"45 min" },
  { id:5, category:"Intermediate", title:"Risk Management & Psychology", desc:"The most important skill in trading — protecting capital and controlling emotions.", icon:Shield, color:"bg-amber-500/10 text-amber-400", badge:"🛡️ Critical", lessonCount:3, duration:"40 min" },
  { id:6, category:"Advanced", title:"Cryptocurrency Trading", desc:"Bitcoin halving cycles, on-chain analysis, and crypto-specific strategies.", icon:Bitcoin, color:"bg-orange-500/10 text-orange-400", badge:"₿ Crypto", lessonCount:2, duration:"35 min" },
  { id:7, category:"Advanced", title:"AutoCopy & Social Trading", desc:"How to select, evaluate, and copy top traders to maximise your copy trading returns.", icon:Star, color:"bg-rose-500/10 text-rose-400", badge:"🔁 AutoCopy", lessonCount:2, duration:"30 min" },
];
const CATEGORIES = ["All","Beginner","Intermediate","Advanced"];

function CourseReader({ courseId, onBack }: { courseId: number; onBack: () => void }) {
  const lessons = COURSE_CONTENT[courseId] ?? [];
  const course = COURSES.find(c => c.id === courseId);
  const [lessonIdx, setLessonIdx] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const lesson = lessons[lessonIdx];

  const markDone = () => {
    const next = new Set(completed);
    next.add(lessonIdx);
    setCompleted(next);
  };

  if (!lesson || !course) return null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5 group">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"/> Back to Academy
      </button>

      <div className="grid md:grid-cols-4 gap-5">
        {/* Lesson list sidebar */}
        <div className="md:col-span-1">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mb-3 ${course.color}`}>{course.badge}</div>
          <h2 className="font-bold text-sm mb-3 leading-tight">{course.title}</h2>
          <div className="space-y-1">
            {lessons.map((l, i) => (
              <button
                key={i}
                onClick={() => setLessonIdx(i)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-start gap-2 ${lessonIdx === i ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
              >
                <div className={`w-4 h-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${completed.has(i) ? "bg-success border-success" : lessonIdx === i ? "border-primary" : "border-border"}`}>
                  {completed.has(i) && <CheckCircle className="w-3 h-3 text-white"/>}
                </div>
                <span className="leading-tight">{l.title}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-xs text-muted-foreground mb-1">{completed.size}/{lessons.length} completed</div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width:`${(completed.size/lessons.length)*100}%` }}/>
            </div>
          </div>
        </div>

        {/* Lesson content */}
        <div className="md:col-span-3 glass-card rounded-2xl border border-border p-5 md:p-7">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lesson {lessonIdx + 1} of {lessons.length}</span>
            {completed.has(lessonIdx) && (
              <span className="flex items-center gap-1 text-xs font-semibold text-success"><CheckCircle className="w-3.5 h-3.5"/> Completed</span>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-bold mb-5 leading-tight">{lesson.title}</h1>

          {/* Render lesson body with markdown-ish formatting */}
          <div className="prose-lesson space-y-4">
            {lesson.body.split('\n\n').map((block, bi) => {
              if (block.startsWith('**') && block.split('\n').length === 1) {
                // Bold heading
                const txt = block.replace(/\*\*/g, '');
                return <p key={bi} className="font-bold text-foreground text-base mt-6 mb-2">{txt}</p>;
              }
              if (block.includes('|') && block.includes('---')) {
                // Table
                const rows = block.split('\n').filter(r => r.trim() && !r.includes('---'));
                return (
                  <div key={bi} className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-sm">
                      {rows.map((row, ri) => {
                        const cells = row.split('|').filter(c => c.trim());
                        return (
                          <tr key={ri} className={`border-b border-border/50 last:border-0 ${ri === 0 ? "bg-muted/40 font-semibold" : "hover:bg-muted/20"}`}>
                            {cells.map((cell, ci) => (
                              <td key={ci} className="px-4 py-2.5 text-xs">{cell.trim()}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </table>
                  </div>
                );
              }
              // Regular paragraph with inline bold
              const parts = block.split(/\*\*(.*?)\*\*/g);
              return (
                <p key={bi} className="text-sm text-muted-foreground leading-relaxed">
                  {parts.map((part, pi) => pi % 2 === 1
                    ? <strong key={pi} className="text-foreground font-semibold">{part}</strong>
                    : part
                  )}
                </p>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-5 border-t border-border gap-3 flex-wrap">
            <button
              onClick={() => { if (lessonIdx > 0) setLessonIdx(lessonIdx - 1); }}
              disabled={lessonIdx === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-semibold disabled:opacity-40 hover:bg-muted transition-all"
            >
              <ChevronLeft className="w-4 h-4"/> Previous
            </button>

            <button
              onClick={() => {
                markDone();
                if (lessonIdx < lessons.length - 1) setLessonIdx(lessonIdx + 1);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all"
            >
              {completed.has(lessonIdx) && lessonIdx < lessons.length - 1 ? "Next Lesson" : lessonIdx === lessons.length - 1 ? "Complete Course ✓" : "Mark Done & Continue"}
              {lessonIdx < lessons.length - 1 && <ChevronRight className="w-4 h-4"/>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Academy() {
  useEffect(() => { document.title = "Academy | VelozTrade"; }, []);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [openCourse, setOpenCourse] = useState<number | null>(null);
  const [completedCourses, setCompletedCourses] = useState<Set<number>>(new Set());

  if (openCourse !== null) {
    return <CourseReader courseId={openCourse} onBack={() => setOpenCourse(null)}/>;
  }

  const filtered = COURSES.filter(c => {
    const catOk = category === "All" || c.category === category;
    const searchOk = !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.desc.toLowerCase().includes(search.toLowerCase());
    return catOk && searchOk;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><BookOpen className="w-7 h-7 text-primary"/> VelozTrade Academy</h1>
        <p className="text-muted-foreground mt-1 text-sm">Complete written trading courses — no videos needed. Learn at your own pace.</p>
      </div>

      {/* Progress banner */}
      <div className="glass-card rounded-2xl border border-primary/20 p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Award className="w-6 h-6 text-primary"/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm mb-1">Your Learning Progress</div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width:`${(completedCourses.size/COURSES.length)*100}%` }}/>
          </div>
          <div className="text-xs text-muted-foreground">{completedCourses.size} of {COURSES.length} courses completed · Start with "Introduction to CFD Trading"</div>
        </div>
        <button onClick={() => setOpenCourse(1)} className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shrink-0">Start Learning</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-40 max-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search courses…" className="w-full pl-9 pr-3 py-2 bg-muted/40 border border-border rounded-xl text-xs focus:outline-none focus:border-primary"/>
        </div>
        <div className="flex gap-1 p-1 bg-muted rounded-xl overflow-x-auto">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={()=>setCategory(cat)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${category===cat?"bg-card text-foreground shadow":"text-muted-foreground"}`}>{cat}</button>
          ))}
        </div>
      </div>

      {/* Course grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(course => (
          <button
            key={course.id}
            onClick={() => setOpenCourse(course.id)}
            className="text-left glass-card rounded-2xl border border-border p-5 hover:border-primary/30 transition-all group"
          >
            <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-bold mb-3 ${course.color}`}>{course.badge}</div>
            {completedCourses.has(course.id) && (
              <span className="float-right text-success text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Done</span>
            )}
            <h3 className="font-bold text-sm mb-1.5 group-hover:text-primary transition-colors leading-tight">{course.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">{course.desc}</p>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><BookOpen className="w-3 h-3"/> {course.lessonCount} lessons</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {course.duration}</span>
              <span className="flex items-center gap-1 text-primary font-semibold">Start <ChevronRight className="w-3 h-3"/></span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
