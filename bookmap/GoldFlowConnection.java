import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Owns the connect/disconnect/reconnect cycle.
 *
 * A background scheduler posts the latest Bookmap sample to GoldFlow
 * at the configured update frequency and periodically heartbeats the
 * server so the add-on UI can show reliable connected status.
 */
public class GoldFlowConnection {

    private final GoldFlowSettings settings;
    private final GoldFlowApiClient apiClient;
    private final GoldFlowDataProcessor processor;

    private final AtomicReference<GoldFlowDataProcessor.BookmapSample> latestSample =
            new AtomicReference<>();
    private final AtomicBoolean connected = new AtomicBoolean(false);
    private final AtomicBoolean serverReachable = new AtomicBoolean(false);

    private ScheduledExecutorService scheduler;
    private volatile long lastSendMs;
    private volatile long lastErrorMs;
    private volatile String lastError = "";

    public GoldFlowConnection(GoldFlowSettings settings,
                              GoldFlowApiClient apiClient,
                              GoldFlowDataProcessor processor) {
        this.settings = settings;
        this.apiClient = apiClient;
        this.processor = processor;
    }

    public synchronized void connect() {
        if (scheduler != null && !scheduler.isShutdown()) return;
        scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "goldflow-connection");
            t.setDaemon(true);
            return t;
        });
        long freq = Math.max(settings.getUpdateFrequencyMs(), 100L);
        scheduler.scheduleAtFixedRate(this::cycle, 0, freq, TimeUnit.MILLISECONDS);
        scheduler.scheduleAtFixedRate(this::heartbeat, 0, 5, TimeUnit.SECONDS);
        connected.set(true);
    }

    public synchronized void disconnect() {
        if (scheduler != null) {
            scheduler.shutdownNow();
            scheduler = null;
        }
        connected.set(false);
        serverReachable.set(false);
    }

    public boolean isConnected() { return connected.get(); }
    public boolean isServerReachable() { return serverReachable.get(); }
    public boolean isSendingData() { return System.currentTimeMillis() - lastSendMs < 5000; }

    public String getLastError() {
        return System.currentTimeMillis() - lastErrorMs < 5000 ? lastError : "";
    }

    /** Called by the add-on whenever fresh order-flow data arrives. */
    public void updateSample(GoldFlowDataProcessor.BookmapSample sample) {
        sample.timestamp = System.currentTimeMillis();
        latestSample.set(sample);
    }

    private void cycle() {
        if (!connected.get()) return;
        GoldFlowDataProcessor.BookmapSample sample = latestSample.get();
        if (sample == null) return; // nothing to report yet

        String json = processor.toJson(sample);
        int status = apiClient.postBookmap(json);
        if (status == 200) {
            lastSendMs = System.currentTimeMillis();
            serverReachable.set(true);
        } else {
            lastError = "server responded " + status;
            lastErrorMs = System.currentTimeMillis();
            serverReachable.set(false);
        }
    }

    private void heartbeat() {
        boolean reachable = apiClient.pingServer();
        serverReachable.set(reachable);
        if (!reachable) {
            lastError = "server unreachable";
            lastErrorMs = System.currentTimeMillis();
        }
    }
}