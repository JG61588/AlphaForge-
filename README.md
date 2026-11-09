# AlphaForge: Quantitative Trading Research & Paper Trading Terminal

AlphaForge is a Python-powered alternative to TradingView built with **Streamlit** and **Plotly**. It is designed for quantitative developers, algorithmic traders, and researchers to write custom Python trading bots, backtest them across historical data, tweak risk parameters in real-time, and execute paper trading orders with live visual telemetry.

---

## 🚀 Key Features

1. **Dual Data Feeds & Secure API Vault**:
   - **Primary**: Alpaca Markets (`alpaca-py`) free Basic tier (IEX market feed) for real-time quotes, historical bars, and Paper Trading order execution.
   - **Fallback**: Yahoo Finance (`yfinance`) with exponential backoff retry logic to handle rate limits automatically.
   - **Graceful Degradation**: Seamlessly runs backtests and simulated paper trading even with zero API keys configured.

2. **In-App Python Strategy Editor & AST Runner**:
   - Built-in syntax validator (`ast.parse`) providing instant error checking with line numbers.
   - Dynamic class compilation and execution for any bot implementing `on_bar(self, bar, history_df)`.

3. **Dynamic Plotly Dark Candlestick Charting**:
   - Multi-pane charts with price action, Fast & Slow Moving Averages, and Volume.
   - RSI oscillator with 70/30 threshold guidelines.
   - Clear signal overlay markers: **Green Up-Arrows** for buy entries and **Red Down-Arrows** for sell exits.

4. **Deep Quantitative Analytics & Parameter Sliders**:
   - Instant re-calculation when adjusting sidebar sliders (Fast/Slow MA periods, RSI oversold/overbought, Stop Loss %, Take Profit %).
   - Comprehensive performance metrics:
     - **Total Return (%)** and Net PnL ($)
     - **Annualized Sharpe Ratio**
     - **Sortino Ratio** (downside volatility penalization)
     - **Maximum Drawdown (%)**
     - **Win Rate (%)** and Win/Loss count
     - **Profit Factor** (Gross Profit / Gross Loss)
     - **Mathematical Trade Expectancy ($)**

5. **Live Bot Telemetry & Paper Trading Engine**:
   - Dedicated auto-scrolling terminal log displaying the bot's thoughts and bar evaluations.
   - State-persisted paper trading simulator with real-time equity and cash tracking.

---

## 📦 Installation & Setup

### 1. Clone or Open the Repository
```bash
git clone <your-repo-url>
cd alphaforge
```

### 2. Create and Activate a Virtual Environment
```bash
# macOS/Linux
python3 -m venv venv
source venv/bin/activate

# Windows
python -m venv venv
venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Streamlit Application
```bash
streamlit run app.py
```

The application will start automatically in your default browser at `http://localhost:8501`.

---

## 🔐 Configuring Alpaca API Keys (Optional)

You can provide your Alpaca Paper Trading keys in either of two ways:

1. **Directly in the Sidebar**:
   - Expand the **Alpaca API Vault** accordion in the sidebar.
   - Paste your **API Key ID** and **Secret Key**.
2. **Via Environment Variables**:
   ```bash
   export ALPACA_API_KEY="your_alpaca_key_id"
   export ALPACA_SECRET_KEY="your_alpaca_secret_key"
   streamlit run app.py
   ```

*Note: If no keys are provided, AlphaForge will automatically use Yahoo Finance for historical data and run in Simulated Paper Trading mode.*

---

## 🛠️ Strategy Interface

Custom strategies implement the `MyStrategy` interface:

```python
class MyStrategy:
    def __init__(self, params=None):
        self.params = params or {}
        self.position = 0
        self.log_messages = []

    def log(self, message: str):
        self.log_messages.append(message)

    def on_bar(self, bar: dict, history_df=None) -> str:
        """
        bar: dict with {timestamp, open, high, low, close, volume}
        history_df: DataFrame of prior bars with precomputed indicators
        returns: "BUY", "SELL", or "HOLD"
        """
        # Your strategy logic here
        return "HOLD"
```

A complete reference implementation is available in `strategy_template.py`.

---

## 📂 Project Structure

```
├── app.py                  # Main Streamlit application
├── requirements.txt        # Python package dependencies
├── strategy_template.py    # Reference quantitative strategy class
└── README.md               # Setup and usage documentation
```
