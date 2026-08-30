//+------------------------------------------------------------------+
//|                                                GoldFlowEA.mq5     |
//|                  GoldFlow alert-only XAUUSD data sender          |
//|                                                                  |
//| ALERT-ONLY. This EA NEVER opens, closes or modifies trades.      |
//| It only reads market data and sends it to the GoldFlow cloud.    |
//|                                                                  |
//| Setup:                                                           |
//|   1. Compile this file in MetaEditor.                            |
//|   2. MT5 -> Tools -> Options -> Expert Advisors.                 |
//|   3. Enable "Allow WebRequest for listed URL".                   |
//|   4. Add your exact GoldFlow site base URL, e.g.                 |
//|      https://your-site.onrender.com                              |
//|   5. Attach the EA to the XAUUSD chart.                          |
//+------------------------------------------------------------------+
#property copyright "GoldFlow"
#property version   "1.00"
#property strict

//--- Configuration (edit before compiling)
input string   InpServerURL   = "https://YOUR-GOLDFLOW-SITE.onrender.com/api/mt5";
input string   InpAPIKey      = "GF_xxxxxxxxxxxxxxxxxxxxxxxxx"; // Authorization: Bearer <key>
input string   InpSymbol      = "XAUUSD";
input int      InpSendSeconds = 2;
input int      InpEMA_Fast    = 20;
input int      InpEMA_Slow    = 50;

int            g_handle_fast = INVALID_HANDLE;
int            g_handle_slow = INVALID_HANDLE;
datetime       g_last_send   = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   if(StringLen(InpAPIKey) < 5 || StringFind(InpAPIKey, "GF_") != 0)
   {
      Print("GoldFlow: invalid API key. Use a key starting with GF_.");
      return(INIT_PARAMETERS_INCORRECT);
   }
   g_handle_fast = iMA(_Symbol, PERIOD_H1, InpEMA_Fast, 0, MODE_EMA, PRICE_CLOSE);
   g_handle_slow = iMA(_Symbol, PERIOD_H1, InpEMA_Slow, 0, MODE_EMA, PRICE_CLOSE);
   if(g_handle_fast == INVALID_HANDLE || g_handle_slow == INVALID_HANDLE)
   {
      Print("GoldFlow: failed to create indicator handles.");
      return(INIT_FAILED);
   }
   EventSetTimer(1);
   Print("GoldFlowEA starting on ", _Symbol, ". Sends data only; never trades.");
   return(INIT_SUCCEEDED);
}
//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   if(g_handle_fast != INVALID_HANDLE) IndicatorRelease(g_handle_fast);
   if(g_handle_slow != INVALID_HANDLE) IndicatorRelease(g_handle_slow);
}
//+------------------------------------------------------------------+
//| Timer function - throttled sending                               |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(TimeCurrent() - g_last_send < InpSendSeconds) return;
   g_last_send = TimeCurrent();
   SendState();
}
//+------------------------------------------------------------------+
//| Trend helper: EMA fast vs slow considered "BUY"/"SELL"/"NEUTRAL" |
//+------------------------------------------------------------------+
string Trend(const ENUM_TIMEFRAMES tf, const int fastPeriod, const int slowPeriod)
{
   double fast[], slow[];
   ArraySetAsSeries(fast, true);
   ArraySetAsSeries(slow, true);

   int hFast = iMA(_Symbol, tf, fastPeriod, 0, MODE_EMA, PRICE_CLOSE);
   int hSlow = iMA(_Symbol, tf, slowPeriod, 0, MODE_EMA, PRICE_CLOSE);
   if(hFast == INVALID_HANDLE || hSlow == INVALID_HANDLE) return("NEUTRAL");

   int nFast = CopyBuffer(hFast, 0, 0, 2, fast);
   int nSlow = CopyBuffer(hSlow, 0, 0, 2, slow);
   IndicatorRelease(hFast);
   IndicatorRelease(hSlow);
   if(nFast < 2 || nSlow < 2) return("NEUTRAL");

   if(fast[0] > slow[0]) return("BULLISH");
   if(fast[0] < slow[0]) return("BEARISH");
   return("NEUTRAL");
}
//+------------------------------------------------------------------+
//| Build and send the JSON payload                                  |
//+------------------------------------------------------------------+
void SendState()
{
   MqlTick tick;
   if(!SymbolInfoTick(_Symbol, tick)) return;

   if(_Symbol != InpSymbol)
   {
      // The EA must run on the configured instrument.
      Print("GoldFlow: attached to ", _Symbol, " but configured for ", InpSymbol,
            ". Attach the EA to ", InpSymbol);
   }

   string h1    = Trend(PERIOD_H1, InpEMA_Fast, InpEMA_Slow);
   string m15   = Trend(PERIOD_M15, InpEMA_Fast, InpEMA_Slow);
   double spread = (tick.ask - tick.bid) / _Point;
   if(spread < 0) spread = 0;

   string json = StringFormat(
      "{\"symbol\":\"%s\",\"bid\":%.5f,\"ask\":%.5f,\"spread\":%.2f,"
      "\"timestamp\":%I64d,\"h1_trend\":\"%s\",\"m15_structure\":\"%s\"}",
      InpSymbol, tick.bid, tick.ask, spread,
      (long)TimeCurrent(), h1, m15
   );

   char payload[], response[];
   string response_headers;
   StringToCharArray(json, payload, 0, WHOLE_ARRAY, CP_UTF8);
   string headers = "Content-Type: application/json\r\n"
                  + "Authorization: Bearer " + InpAPIKey + "\r\n";

   ResetLastError();
   int code = WebRequest("POST", InpServerURL, headers, 5000,
                         payload, response, response_headers);
   if(code == -1)
      Print("GoldFlow: WebRequest failed (error ", GetLastError(), "). ",
            "Add your server URL in MT5 Tools/Options/Expert Advisors ",
            "\"Allow WebRequest for listed URL\".");
   else
      Print("GoldFlow: HTTP ", code, " ", CharArrayToString(response, 0, WHOLE_ARRAY, CP_UTF8));
}
//+------------------------------------------------------------------+
//| Placeholder execution guard - the EA never trades                |
//+------------------------------------------------------------------+
// Deliberately no OnTrade(), no OrderSend(), no PositionModify(),
// no trade functions anywhere in this file.