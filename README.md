# Stock Pattern Analyzer - Chrome Extension

A production-ready Chrome extension that identifies candlestick patterns in stock data using the FLUEY algorithm and displays annotated charts with a beautiful glassmorphism interface.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- 🎯 **47 Pattern Recognition** - Complete FLUEY algorithm implementation
- 📊 **Interactive Charts** - Candlestick charts with pattern annotations
- 🎨 **Glassmorphism UI** - Beautiful golden-brown liquid glass design
- 🔍 **Smart Filtering** - Confidence-based pattern filtering (>70%)
- 💾 **Data Caching** - 1-hour cache for faster repeated queries
- 📈 **Alpha Vantage Integration** - Real-time stock data

## Installation

### Prerequisites

1. **Google Chrome Browser** (version 88 or higher)
2. **Alpha Vantage API Key** (free tier available)

### Step 1: Get Your API Key

1. Visit [Alpha Vantage](https://www.alphavantage.co/support/#api-key)
2. Click "Get Free API Key"
3. Fill out the form and receive your key via email
4. Save your API key - you'll need it in Step 3

### Step 2: Load the Extension

1. Download or clone this repository:
   ```bash
   git clone https://github.com/Chembia/day-trading-extension.git
   ```

2. Open Chrome and navigate to:
   ```
   chrome://extensions/
   ```

3. Enable "Developer mode" (toggle in top-right corner)

4. Click "Load unpacked"

5. Select the `day-trading-extension` folder

6. The extension icon should appear in your Chrome toolbar

### Step 3: Configure API Key

1. Click the extension icon in Chrome toolbar
2. Click the ⚙️ Settings button
3. Enter your Alpha Vantage API key
4. Click "Save"

You're ready to analyze stock patterns!

## Usage Guide

### Basic Analysis

1. **Click the extension icon** in your Chrome toolbar

2. **Enter stock symbol** (e.g., AAPL, TSLA, SPY, GOOGL)

3. **Select date range** 
   - Start date: Beginning of analysis period
   - End date: End of analysis period
   - Default: Last 30 days

4. **Click "Analyze Patterns"**

5. **View results** in the new tab that opens

### Understanding Results

The results page displays:

- **Candlestick Chart** - Visual representation with pattern boxes
- **Pattern Table** - Detailed list of detected patterns
- **Confidence Scores** - Pattern reliability (70-100%)
- **Pattern Types** - Bullish (green), Bearish (red), Neutral (amber)
- **Suggested Actions** - Buy, Sell, Hold, Monitor

### Pattern Boxes on Chart

- **Green boxes** - Bullish patterns (potential uptrend)
- **Red boxes** - Bearish patterns (potential downtrend)
- **Amber boxes** - Neutral patterns

Hover over boxes to see pattern details.

### Downloading Charts

Click the "Download Chart" button to save the annotated chart as PNG.

## Recognized Patterns (47 Total)

### Japanese Candlestick Patterns

1. **Hammer** - Bullish reversal with long lower shadow
2. **Hanging Man** - Bearish pattern in uptrend
3. **Bullish Engulfing** - Large bullish candle engulfing bearish
4. **Bearish Engulfing** - Large bearish candle engulfing bullish
5. **Tweezer Top** - Two candles with same high
6. **Tweezer Bottom** - Two candles with same low
7. **Abandoned Baby Bullish** - Gap-down doji followed by gap-up
8. **Abandoned Baby Bearish** - Gap-up doji followed by gap-down
9. **Three White Soldiers** - Three consecutive bullish candles
10. **Three Black Crows** - Three consecutive bearish candles
11. **Rising Three Methods** - 5-candle bullish continuation
12. **Falling Three Methods** - 5-candle bearish continuation

### Statistical Extreme Patterns

13-14. **Extreme Body (Bullish/Bearish)** - Large body ratio patterns

### Trend-Conditioned Patterns (32 variations)

All base patterns with uptrend/downtrend conditions:
- Hammer in uptrend/downtrend
- Hanging Man in uptrend/downtrend
- Bullish Engulfing in uptrend/downtrend
- ... (32 total variations)

### Volatility Patterns

- **Volatility Expansion 1.5x** - Range exceeds 1.5x avg volatility
- **Volatility Expansion 2.0x** - Range exceeds 2.0x avg volatility
- **Volatility Expansion 2.5x** - Range exceeds 2.5x avg volatility

### Liquidity Sweep Patterns

- **Liquidity Sweep High** - Price sweeps high then reverses
- **Liquidity Sweep Low** - Price sweeps low then reverses

## Example Stocks to Try

- **AAPL** - Apple Inc. (tech leader with clear patterns)
- **TSLA** - Tesla (volatile, many patterns)
- **SPY** - S&P 500 ETF (market trends)
- **GOOGL** - Alphabet Inc.
- **MSFT** - Microsoft
- **AMZN** - Amazon
- **NVDA** - NVIDIA (volatile tech)

Try date ranges:
- **30 days** - Recent patterns
- **90 days** - Quarterly trends
- **1 year** - Long-term analysis

## Troubleshooting

### "Please configure your API key"
- Click Settings (⚙️) and enter your Alpha Vantage API key
- Verify the key is correct (no extra spaces)

### "Invalid stock symbol"
- Check symbol spelling (e.g., AAPL not APPLE)
- Use official ticker symbols
- Try on [Yahoo Finance](https://finance.yahoo.com) first

### "API rate limit exceeded"
- Free tier: 5 calls/min, 25 calls/day
- Wait 1 minute between requests
- Upgrade to premium if needed
- Extension caches data for 1 hour to reduce calls

### "No patterns found"
- Try longer date range (60-90 days)
- Try different stock with more volatility
- Markets in consolidation may have fewer patterns

### "No data available for date range"
- Check dates are not weekends/holidays
- Ensure end date is not in future
- Try broader date range

### Extension not appearing
- Check Developer mode is enabled
- Reload extension from chrome://extensions/
- Try removing and re-adding extension

### Network errors
- Check internet connection
- Verify firewall allows alphavantage.co
- Try again in a few minutes

## API Rate Limits

**Free Tier:**
- 5 API calls per minute
- 25 API calls per day

**Tips to stay within limits:**
- Use cached data (auto-cached for 1 hour)
- Analyze multiple date ranges for same stock
- Wait between different stock analyses

**Upgrade:**
Visit [Alpha Vantage Premium](https://www.alphavantage.co/premium/) for higher limits.

## Technical Details

### Algorithm: FLUEY

The FLUEY algorithm uses:
- **Parametric constants** for body/shadow ratios
- **Feature engineering** for trend and volatility
- **Pattern registration system** for extensibility
- **Multi-candle analysis** (1-5 candles)
- **Confidence scoring** for filtering

### Confidence Scoring

Patterns are scored 0-100% based on:
- Pattern-specific quality metrics
- Trend alignment bonuses (+20%)
- Multi-candle pattern bonuses (+10%)
- Large body bonuses (+5%)

Only patterns >70% confidence are shown, limited to top 15.

### Technologies Used

- **Chart.js 4.4.0** - Charting library
- **chartjs-chart-financial** - Candlestick plugin
- **chartjs-plugin-annotation** - Pattern boxes
- **Alpha Vantage API** - Stock data
- **Chrome Extension Manifest V3** - Modern extension format

## File Structure

```
day-trading-extension/
├── manifest.json              # Extension configuration
├── README.md                  # This file
├── popup/
│   ├── popup.html            # Extension popup UI
│   ├── popup.css             # Popup styles
│   └── popup.js              # Popup logic
├── results/
│   ├── results.html          # Results page UI
│   ├── results.css           # Results page styles
│   └── results.js            # Results page logic
├── scripts/
│   ├── fluey-algorithm.js    # FLUEY pattern recognition
│   ├── api-client.js         # Alpha Vantage API client
│   ├── chart-generator.js    # Chart creation & annotations
│   └── pattern-filter.js     # Confidence scoring & filtering
├── styles/
│   └── common.css            # Shared glassmorphism styles
└── assets/
    └── icons/                # Extension icons
        ├── icon16.png
        ├── icon48.png
        └── icon128.png
```

## Privacy & Data

- **No data collection** - All analysis happens locally
- **Cached data** - Stored only in browser (chrome.storage.local)
- **API calls** - Direct to Alpha Vantage (no intermediary)
- **No tracking** - No analytics or telemetry

Cache is automatically cleared after 1 hour.

## Browser Compatibility

- ✅ **Google Chrome** 88+ (Recommended)
- ✅ **Microsoft Edge** 88+ (Chromium-based)
- ✅ **Brave** (Chromium-based)
- ✅ **Opera** (Chromium-based)
- ❌ Firefox (different extension format)
- ❌ Safari (different extension format)

## Known Limitations

1. **Data availability** - Limited by Alpha Vantage free tier
2. **Pattern accuracy** - Not financial advice, use for education
3. **Real-time data** - Daily data only (no intraday)
4. **Market hours** - Data updates after market close

## Credits

- **FLUEY Algorithm** - Pattern recognition framework
- **Chart.js** - [chartjs.org](https://www.chartjs.org/)
- **Alpha Vantage** - [alphavantage.co](https://www.alphavantage.co/)
- **Icons** - Custom-designed for this extension

## Disclaimer

⚠️ **This extension is for educational purposes only.**

- Not financial advice
- Past patterns don't guarantee future results
- Always do your own research
- Consult financial advisors before trading
- Trading involves risk of loss

## Support

For issues, questions, or suggestions:

1. Check the Troubleshooting section above
2. Review [Alpha Vantage documentation](https://www.alphavantage.co/documentation/)
3. Check Chrome extension [developer documentation](https://developer.chrome.com/docs/extensions/)

## License

MIT License - See LICENSE file for details

## Version History

### v1.0.0 (2024)
- Initial release
- 47 pattern recognition
- Glassmorphism UI
- Confidence scoring
- Chart annotations
- API caching

---

Made with 📈 for pattern traders