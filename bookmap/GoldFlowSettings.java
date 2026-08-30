import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Properties;

/**
 * GoldFlow add-on settings.
 *
 * Stores everything the customer configures: API key, server URL,
 * instrument, update frequency and which data sources are enabled.
 */
public class GoldFlowSettings {

    private String apiKey = "GF_xxxxxxxxxxxxxxxxxxxxxxxxx";
    private String serverUrl = "https://YOUR-GOLDFLOW-SITE.onrender.com";
    private String instrument = "GC";
    private long updateFrequencyMs = 250;
    private boolean dataTrades = true;
    private boolean dataBbo = true;
    private boolean dataDepth = true;

    public synchronized String getApiKey() { return apiKey; }
    public synchronized void setApiKey(String apiKey) { this.apiKey = apiKey; }

    public synchronized String getServerUrl() { return serverUrl; }
    public synchronized void setServerUrl(String serverUrl) { this.serverUrl = serverUrl; }

    public synchronized String getInstrument() { return instrument; }
    public synchronized void setInstrument(String instrument) { this.instrument = instrument; }

    public synchronized long getUpdateFrequencyMs() { return updateFrequencyMs; }
    public synchronized void setUpdateFrequencyMs(long ms) {
        this.updateFrequencyMs = Math.max(100, ms);
    }

    public synchronized boolean isDataTradesEnabled() { return dataTrades; }
    public synchronized void setDataTradesEnabled(boolean enabled) { dataTrades = enabled; }

    public synchronized boolean isDataBboEnabled() { return dataBbo; }
    public synchronized void setDataBboEnabled(boolean enabled) { dataBbo = enabled; }

    public synchronized boolean isDataDepthEnabled() { return dataDepth; }
    public synchronized void setDataDepthEnabled(boolean enabled) { dataDepth = enabled; }

    public synchronized void save(String path) {
        Properties props = new Properties();
        props.setProperty("apiKey", apiKey);
        props.setProperty("serverUrl", serverUrl);
        props.setProperty("instrument", instrument);
        props.setProperty("updateFrequencyMs", String.valueOf(updateFrequencyMs));
        props.setProperty("dataTrades", String.valueOf(dataTrades));
        props.setProperty("dataBbo", String.valueOf(dataBbo));
        props.setProperty("dataDepth", String.valueOf(dataDepth));
        try (OutputStream out = new FileOutputStream(path)) {
            props.store(out, "GoldFlow add-on settings");
        } catch (Exception e) {
            System.out.println("GoldFlow: could not save settings: " + e.getMessage());
        }
    }

    public static GoldFlowSettings load(String path) {
        GoldFlowSettings settings = new GoldFlowSettings();
        Properties props = new Properties();
        try (InputStream in = new FileInputStream(path)) {
            props.load(in);
            settings.setApiKey(props.getProperty("apiKey", settings.apiKey));
            settings.setServerUrl(props.getProperty("serverUrl", settings.serverUrl));
            settings.setInstrument(props.getProperty("instrument", settings.instrument));
            settings.setUpdateFrequencyMs(
                    Long.parseLong(props.getProperty("updateFrequencyMs", "250")));
            settings.setDataTradesEnabled(Boolean.parseBoolean(
                    props.getProperty("dataTrades", "true")));
            settings.setDataBboEnabled(Boolean.parseBoolean(
                    props.getProperty("dataBbo", "true")));
            settings.setDataDepthEnabled(Boolean.parseBoolean(
                    props.getProperty("dataDepth", "true")));
        } catch (Exception e) {
            // No saved settings yet - defaults are fine.
        }
        return settings;
    }
}