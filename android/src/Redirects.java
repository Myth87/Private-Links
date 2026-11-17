package app.privatelinks.cleaner;

import java.io.IOException;
import java.net.Proxy;
import java.net.URI;
import java.util.Locale;
import javax.net.ssl.HttpsURLConnection;

final class Redirects {
    private Redirects() {}

    private static String platform(String host) {
        if (host == null) return "";
        switch (host.toLowerCase(Locale.ROOT)) {
            case "tiktok.com": case "m.tiktok.com": case "www.tiktok.com":
            case "vm.tiktok.com": case "vt.tiktok.com": return "TikTok";
            case "fb.com": case "www.fb.com": case "fb.watch": case "facebook.com":
            case "m.facebook.com": case "mbasic.facebook.com": case "www.facebook.com": return "Facebook";
            case "instagram.com": case "m.instagram.com": case "www.instagram.com": return "Instagram";
            case "reddit.com": case "www.reddit.com": case "new.reddit.com":
            case "old.reddit.com": case "redd.it": return "Reddit";
            case "pinterest.com": case "www.pinterest.com": case "pin.it": return "Pinterest";
            case "snapchat.com": case "www.snapchat.com": case "t.snapchat.com": return "Snapchat";
            default: return "";
        }
    }

    private static boolean shortPath(URI url) {
        String host = url.getHost().toLowerCase(Locale.ROOT);
        String path = url.getPath();
        switch (host) {
            case "vm.tiktok.com": case "vt.tiktok.com": case "fb.watch":
            case "fb.com": case "www.fb.com": case "pin.it": case "t.snapchat.com":
                return path.length() > 1;
            default:
                switch (platform(host)) {
                    case "TikTok": return path.matches("/t/[^/]+/?");
                    case "Facebook": return path.matches("/share(?:/.*|\\.php)|/flx/warn(?:/.*)?");
                    case "Instagram": return path.startsWith("/share/");
                    case "Reddit": return path.matches("/r/[^/]+/s/[^/]+/?");
                    case "Snapchat": return path.startsWith("/t/");
                    default: return false;
                }
        }
    }

    private static boolean safe(URI url, String platform) {
        return "https".equalsIgnoreCase(url.getScheme()) && url.getPort() == -1 &&
                url.getRawUserInfo() == null && platform.equals(platform(url.getHost()));
    }

    static String resolve(String input) {
        if (input == null || input.length() > 8192) return null;
        try {
            URI current = URI.create(input.replaceFirst("(?i)^http://", "https://"));
            String platform = platform(current.getHost());
            if (platform.isEmpty() || !safe(current, platform) || !shortPath(current)) return null;
            for (int count = 0; count < 5 && !Thread.currentThread().isInterrupted(); count++) {
                HttpsURLConnection connection = (HttpsURLConnection) current.toURL().openConnection(Proxy.NO_PROXY);
                try {
                    connection.setInstanceFollowRedirects(false);
                    connection.setUseCaches(false);
                    connection.setConnectTimeout(3000);
                    connection.setReadTimeout(3000);
                    if (platform.equals("Facebook")) {
                        connection.setRequestProperty("User-Agent", "PrivateLinks/1.0");
                    } else {
                        connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36");
                    }
                    int status = connection.getResponseCode();
                    String location = connection.getHeaderField("Location");
                    if (location == null || (status != 301 && status != 302 && status != 303 && status != 307 && status != 308)) return null;
                    current = current.resolve(location);
                    if (!safe(current, platform)) return null;
                    if (!shortPath(current)) return current.toASCIIString();
                } finally {
                    connection.disconnect();
                }
            }
        } catch (IOException | IllegalArgumentException ignored) {
            // An invalid or expired link has no verified destination.
        }
        return null;
    }
}
