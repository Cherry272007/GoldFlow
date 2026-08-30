import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * HTTPS client for a single GoldFlow endpoint.
 *
 * Handles authentication, POST requests, connection errors and retries.
 */
public class GoldFlowApiClient {

    private final String baseUrl;
    private final String apiKey;
    private final int timeoutSeconds;
    private final int maxRetries;
    private final HttpClient http;

    public GoldFlowApiClient(String baseUrl, String apiKey) {
        this(baseUrl, apiKey, 10, 3);
    }

    public GoldFlowApiClient(String baseUrl, String apiKey, int timeoutSeconds, int maxRetries) {
        this.baseUrl = trimTrailingSlash(baseUrl);
        this.apiKey = apiKey;
        this.timeoutSeconds = timeoutSeconds;
        this.maxRetries = maxRetries;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(timeoutSeconds))
                .build();
    }

    /**
     * POST the given JSON payload to the Bookmap ingest endpoint.
     * Returns the HTTP status code, or -1 when every attempt failed.
     */
    public int postBookmap(String jsonPayload) {
        return post("/api/bookmap", jsonPayload);
    }

    private int post(String path, String json) {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + path))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

        int attempt = 0;
        while (attempt <= maxRetries) {
            try {
                HttpResponse<String> response = http.send(request,
                        HttpResponse.BodyHandlers.ofString());
                return response.statusCode();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return -1;
            } catch (Exception e) {
                attempt++;
                if (attempt > maxRetries) {
                    System.out.println("GoldFlow: " + e.getMessage());
                    return -1;
                }
                sleep(300L * attempt);
            }
        }
        return -1;
    }

    /**
     * Lightweight heartbeat so the add-on can show server Connectivity.
     * Returns true when the GoldFlow server responds.
     */
    public boolean pingServer() {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/api/health"))
                .timeout(Duration.ofSeconds(5))
                .GET()
                .build();
        try {
            HttpResponse<String> response = http.send(request,
                    HttpResponse.BodyHandlers.ofString());
            return response.statusCode() == 200;
        } catch (Exception e) {
            return false;
        }
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private static String trimTrailingSlash(String url) {
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        return url;
    }
}