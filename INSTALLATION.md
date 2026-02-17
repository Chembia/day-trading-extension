# Quick Start Guide - Stock Pattern Analyzer

## Installation Steps

### 1. Load Extension in Chrome

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the `day-trading-extension` folder
6. Extension icon should appear in toolbar

### 2. Configure API Key

1. Get free API key from https://www.alphavantage.co/support/#api-key
2. Click extension icon in Chrome toolbar
3. Click ⚙️ Settings button
4. Enter API key
5. Click "Save"

### 3. Test the Extension

**Test Case 1: Basic Analysis**
- Symbol: AAPL
- Start Date: 2024-01-01
- End Date: 2024-01-31
- Expected: Opens results page with candlestick chart

**Test Case 2: Volatile Stock**
- Symbol: TSLA
- Start Date: 2024-01-01
- End Date: 2024-03-31
- Expected: Multiple patterns detected

**Test Case 3: Error Handling**
- Symbol: INVALID
- Expected: Error message about invalid symbol

## Verification Checklist

- [ ] Extension loads without errors
- [ ] Popup displays with glassmorphism design
- [ ] Settings modal opens and closes
- [ ] API key saves successfully
- [ ] Form validation works (empty fields)
- [ ] Loading spinner shows during analysis
- [ ] Results page opens in new tab
- [ ] Chart displays with candlesticks
- [ ] Pattern boxes appear on chart
- [ ] Pattern table shows filtered results
- [ ] Confidence scores are displayed
- [ ] Download chart button works
- [ ] New Analysis button returns to popup
- [ ] Error messages display correctly
- [ ] Cache works (repeat query is faster)

## Known Chrome Extension Limitations

1. **chrome.action.openPopup()** - Cannot be called from content script
   - Workaround: "New Analysis" button closes current tab
   
2. **Cross-origin requests** - Must use host_permissions
   - Already configured for alphavantage.co

3. **Storage limits** - chrome.storage.local has 5MB limit
   - Cache is cleared after 1 hour

## Troubleshooting

### Extension doesn't load
- Check manifest.json is valid JSON
- Verify all file paths exist
- Look for errors in chrome://extensions/

### Popup doesn't open
- Check popup.html path in manifest.json
- Verify popup.html, popup.css, popup.js exist
- Check browser console for errors

### API calls fail
- Verify API key is saved
- Check network tab in DevTools
- Confirm alphavantage.co is accessible

### Charts don't render
- Verify CDN links for Chart.js are accessible
- Check browser console for errors
- Confirm canvas element exists

### Patterns not detected
- Check date range has data
- Verify stock symbol is valid
- Confirm FLUEY algorithm loaded (47 patterns)

## Developer Tools

### View Extension Logs
1. Right-click extension icon
2. Select "Inspect popup"
3. Console tab shows logs

### View Results Page Logs
1. Open results page
2. F12 to open DevTools
3. Console tab shows logs

### Clear Extension Storage
```javascript
chrome.storage.local.clear(() => {
    console.log('Storage cleared');
});
```

### Check Pattern Count
Open browser console on results page:
```javascript
console.log('Total patterns:', window.PATTERNS.length);
```

## File Checklist

Required files for extension to work:
- [x] manifest.json
- [x] popup/popup.html
- [x] popup/popup.css
- [x] popup/popup.js
- [x] results/results.html
- [x] results/results.css
- [x] results/results.js
- [x] scripts/fluey-algorithm.js
- [x] scripts/api-client.js
- [x] scripts/pattern-filter.js
- [x] scripts/chart-generator.js
- [x] styles/common.css
- [x] assets/icons/icon16.png
- [x] assets/icons/icon48.png
- [x] assets/icons/icon128.png

All files present and accounted for! ✓
