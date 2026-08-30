/**
 * Converts Bookmap order-flow events into the GoldFlow data format and
 * renders the JSON payload that the add-on posts to the cloud.
 *
 * The data fields are the ones GoldFlow understands today:
 *   symbol       - the Bookmap instrument, e.g. "GC"
 *   price        - last trade price
 *   bid / ask    - touch prices
 *   bid_volume   - resting liquidity on the bid (returned rolled-up)
 *   ask_volume   - resting liquidity on the ask
 *   trade_volume - total traded volume during the current interval
 *   delta        - net buying minus selling volume
 *   flow         - BUYING / SELLING / NEUTRAL
 *   timestamp    - unix seconds / milliseconds
 */
public class GoldFlowDataProcessor {

    /** A single snapshot of the Bookmap market we want to report. */
    public static class BookmapSample {
        public String symbol = "GC";
        public Double price;
        public Double bid;
        public Double ask;
        public Double bidVolume;
        public Double askVolume;
        public Double tradeVolume;
        public double delta = 0;
        public String flow = "NEUTRAL";
        public Long timestamp = System.currentTimeMillis();

        public BookmapSample(String symbol) {
            this.symbol = symbol;
        }
    }

    public String toJson(BookmapSample sample) {
        StringBuilder b = new StringBuilder(256);
        b.append('{');
        appendString(b, "symbol", sample.symbol);
        appendNumber(b, "price", sample.price);
        appendNumber(b, "bid", sample.bid);
        appendNumber(b, "ask", sample.ask);
        appendNumber(b, "bid_volume", sample.bidVolume);
        appendNumber(b, "ask_volume", sample.askVolume);
        appendNumber(b, "trade_volume", sample.tradeVolume);
        appendNumber(b, "delta", sample.delta);
        appendString(b, "flow", sample.flow);
        appendNumber(b, "timestamp", sample.timestamp == null ? null : sample.timestamp.doubleValue());
        b.setLength(b.length() - 1); // drop trailing comma
        b.append('}');
        return b.toString();
    }

    private static void appendString(StringBuilder b, String key, String value) {
        if (value == null) return;
        b.append('"').append(key).append("\":\"")
         .append(escape(value)).append("\",");
    }

    private static void appendNumber(StringBuilder b, String key, Double value) {
        if (value == null) return;
        b.append('"').append(key).append("\":").append(value).append(',');
    }

    private static String escape(String raw) {
        StringBuilder out = new StringBuilder(raw.length());
        for (int i = 0; i < raw.length(); i++) {
            char ch = raw.charAt(i);
            switch (ch) {
                case '"':  out.append("\\\""); break;
                case '\\': out.append("\\\\"); break;
                case '\n': out.append("\\n"); break;
                case '\r': out.append("\\r"); break;
                case '\t': out.append("\\t"); break;
                default:   out.append(ch);
            }
        }
        return out.toString();
    }
}