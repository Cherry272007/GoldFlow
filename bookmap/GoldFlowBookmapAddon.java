import javax.swing.*;
import java.awt.*;
import java.io.File;

/**
 * GoldFlow Bookmap add-on (entry point).
 *
 * Runs inside Bookmap and pushes order-flow data to GoldFlow Cloud.
 * The add-on NEVER opens, closes or modifies a position - it only sends data.
 *
 * WIRING TO BOOKMAP:
 *   Wire the market feed into the methods below, matching the data your
 *   Bookmap connection actually provides. Do not invent listeners your
 *   Bookmap build does not support.
 *
 *   TradeDataListener      -> onTrade(price, volume, side, timestamp)
 *   BboListener            -> onBbo(price, bid, ask, bidVolume, askVolume)
 *   DepthDataListener      -> onDepth(price, volume, side)
 *   MarketByOrderDepth...  -> onDepth(price, volume, side) (best-effort)
 *
 * Each onXxx() method only stashes the value into the current sample; the
 * GoldFlowConnection posts it on its own schedule.
 *
 * Standalone test: java GoldFlowBookmapAddon <base-url> <api-key>
 */
public class GoldFlowBookmapAddon {

    private static final String SETTINGS_FILE = "goldflow_bookmap.properties";

    private final GoldFlowSettings settings;
    private final GoldFlowDataProcessor processor;
    private final GoldFlowApiClient apiClient;
    private final GoldFlowConnection connection;
    private final GoldFlowDataProcessor.BookmapSample sample;

    public GoldFlowBookmapAddon(GoldFlowSettings settings) {
        this.settings = settings;
        this.processor = new GoldFlowDataProcessor();
        this.apiClient = new GoldFlowApiClient(
                settings.getServerUrl(), settings.getApiKey());
        this.connection = new GoldFlowConnection(settings, apiClient, processor);
        this.sample = new GoldFlowDataProcessor.BookmapSample(settings.getInstrument());
        this.sample.flow = "NEUTRAL";
        this.connection.updateSample(sample);
    }

    public GoldFlowConnection getConnection() { return connection; }

    // ---- Market data entry points (wired to Bookmap listeners) ----

    /** BboListener bridge. */
    public void onBbo(Double price, Double bid, Double ask,
                      Double bidVolume, Double askVolume, long timestamp) {
        if (settings.isDataBboEnabled()) {
            if (price != null) sample.price = price;
            if (bid != null) sample.bid = bid;
            if (ask != null) sample.ask = ask;
            if (bidVolume != null) sample.bidVolume = bidVolume;
            if (askVolume != null) sample.askVolume = askVolume;
        }
    }

    /** TradeDataListener bridge. */
    public void onTrade(Double price, double volume, boolean aggressiveSideBuy,
                        long timestamp) {
        if (settings.isDataTradesEnabled()) {
            if (price != null) sample.price = price;
            if (sample.tradeVolume == null) sample.tradeVolume = 0.0;
            sample.tradeVolume += volume;
            sample.delta += aggressiveSideBuy ? volume : -volume;
        }
    }

    /** DepthDataListener bridge (best-effort depth/liquidity data). */
    public void onDepth(Double price, double volume, boolean sideBid) {
        if (!settings.isDataDepthEnabled() || price == null) return;
        if (sideBid) {
            if (sample.bidVolume == null) sample.bidVolume = 0.0;
            sample.bidVolume += volume;
        } else {
            if (sample.askVolume == null) sample.askVolume = 0.0;
            sample.askVolume += volume;
        }
    }

    /** Call periodically (or on every trade) to refresh the flow label. */
    public void updateFlow() {
        double delta = sample.delta;
        Double bidVol = sample.bidVolume;
        Double askVol = sample.askVolume;
        if (delta > 0) {
            sample.flow = "BUYING";
        } else if (delta < 0) {
            sample.flow = "SELLING";
        } else if (bidVol != null && askVol != null) {
            sample.flow = bidVol > askVol ? "BUYING" : bidVol < askVol ? "SELLING" : "NEUTRAL";
        } else {
            sample.flow = "NEUTRAL";
        }
    }

    // ---- Connection lifecycle ----

    public void start() {
        updateFlow();
        connection.connect();
    }

    public void stop() {
        connection.disconnect();
    }

    // ---- Customer configuration UI (simple, non-technical) ----

    /** Open a simple config dialog; returns true when saved and connected. */
    public boolean showConfigDialog() {
        JPanel panel = new JPanel(new GridBagLayout());
        GridBagConstraints c = new GridBagConstraints();
        c.insets = new Insets(6, 6, 6, 6);
        c.gridx = 0;
        c.gridy = 0;

        JTextField apiKey = new JTextField(settings.getApiKey(), 28);
        JTextField server = new JTextField(settings.getServerUrl(), 28);
        JTextField instrument = new JTextField(settings.getInstrument(), 12);
        JSpinner freqSpin = new JSpinner(new SpinnerNumberModel(
                settings.getUpdateFrequencyMs(), 100L, 5000L, 50L));
        JCheckBox trades = new JCheckBox("Trades", settings.isDataTradesEnabled());
        JCheckBox bbo = new JCheckBox("BBO", settings.isDataBboEnabled());
        JCheckBox depth = new JCheckBox("Depth", settings.isDataDepthEnabled());

        addRow(panel, c, "API Key", apiKey);
        addRow(panel, c, "GoldFlow Server", server);
        addRow(panel, c, "Instrument", instrument);
        addRow(panel, c, "Update Frequency (ms)", new JComponent[]{freqSpin});

        JPanel dataBox = new JPanel(new FlowLayout(FlowLayout.LEFT, 4, 0));
        dataBox.add(trades);
        dataBox.add(bbo);
        dataBox.add(depth);
        addRow(panel, c, "Data", new JComponent[]{dataBox});

        int result = JOptionPane.showConfirmDialog(null, panel,
                "GoldFlow", JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE);
        if (result == JOptionPane.OK_OPTION) {
            settings.setApiKey(apiKey.getText().trim());
            settings.setServerUrl(server.getText().trim());
            settings.setInstrument(instrument.getText().trim().toUpperCase());
            settings.setUpdateFrequencyMs(((Number) freqSpin.getValue()).longValue());
            settings.setDataTradesEnabled(trades.isSelected());
            settings.setDataBboEnabled(bbo.isSelected());
            settings.setDataDepthEnabled(depth.isSelected());
            settings.save(SETTINGS_FILE);
            sample.symbol = settings.getInstrument();
            connection.connect();
            return true;
        }
        return false;
    }

    private static void addRow(JPanel panel, GridBagConstraints c,
                               String label, JComponent... field) {
        c.gridx = 0;
        c.anchor = GridBagConstraints.EAST;
        panel.add(new JLabel(label), c);
        c.gridx = 1;
        c.anchor = GridBagConstraints.WEST;
        panel.add(field.length == 1 ? field[0] : wrap(field), c);
        c.gridy++;
    }

    private static JComponent wrap(JComponent[] items) {
        JPanel p = new JPanel(new FlowLayout(FlowLayout.LEFT, 4, 0));
        for (JComponent item : items) p.add(item);
        return p;
    }

    // ---- Entry point for standalone testing on the desktop ----

    public static void main(String[] args) {
        GoldFlowSettings settings = new File(SETTINGS_FILE).exists()
                ? GoldFlowSettings.load(SETTINGS_FILE) : new GoldFlowSettings();
        if (args.length >= 1) settings.setServerUrl(args[0]);
        if (args.length >= 2) settings.setApiKey(args[1]);
        if (args.length >= 3) settings.setInstrument(args[2]);

        GoldFlowBookmapAddon addon = new GoldFlowBookmapAddon(settings);
        System.out.println("GoldFlow add-on demo. Sending sample data every "
                + settings.getUpdateFrequencyMs() + " ms to " + settings.getServerUrl());
        addon.start();

        // Simulate a feed so the cloud receives something real.
        final GoldFlowDataProcessor.BookmapSample sim = addon.sample;
        java.util.concurrent.ScheduledExecutorService feed =
                java.util.concurrent.Executors.newSingleThreadScheduledExecutor();
        feed.scheduleAtFixedRate(() -> {
            double price = 3400 + Math.random() * 40;
            addon.onTrade(price, 50 + Math.random() * 200, Math.random() > 0.5,
                    System.currentTimeMillis());
            addon.onBbo(price, price - 0.25, price + 0.25,
                    800 + Math.random() * 400, 800 + Math.random() * 400,
                    System.currentTimeMillis());
            addon.updateFlow();
        }, 1, 1, java.util.concurrent.TimeUnit.SECONDS);

        // Keep the demo alive until Ctrl-C.
        java.util.concurrent.CountDownLatch latch =
                new java.util.concurrent.CountDownLatch(1);
        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}