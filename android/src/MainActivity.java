package app.privatelinks.cleaner;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://private-links.invalid";
    private static final String HOME = ORIGIN + "/index.html";
    private static final int BACKGROUND = 0xff000000;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private Future<?> lookup;
    private WebView view;
    private boolean pageReady;
    private String shared;

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(BACKGROUND);
        getWindow().setNavigationBarColor(BACKGROUND);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BACKGROUND);
        view = new WebView(this);
        if (Build.VERSION.SDK_INT >= 35) {
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets safe = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        view.setBackgroundColor(BACKGROUND);
        view.getSettings().setJavaScriptEnabled(true);
        view.getSettings().setDomStorageEnabled(true);
        view.getSettings().setAllowFileAccess(false);
        view.getSettings().setAllowContentAccess(false);
        view.getSettings().setSaveFormData(false);
        view.addJavascriptInterface(new Bridge(), "PrivateLinksAndroid");
        view.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView webView, WebResourceRequest request) {
                Uri withoutFragment = request.getUrl().buildUpon().fragment(null).build();
                return !HOME.equals(withoutFragment.toString());
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView webView, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if ("GET".equals(request.getMethod()) && url.startsWith(ORIGIN + "/")) {
                    String asset = url.substring(ORIGIN.length() + 1);
                    String type = assetType(asset);
                    if (type != null) {
                        try {
                            return new WebResourceResponse(type, type.startsWith("image/") ? null : "utf-8",
                                    getAssets().open(asset));
                        } catch (IOException ignored) {
                            // Fall through to the local error response.
                        }
                    }
                }
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found",
                        Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }

            @Override
            public void onPageFinished(WebView webView, String url) {
                if (HOME.equals(url)) {
                    pageReady = true;
                    deliverShare();
                }
            }
        });
        root.addView(view, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        receive(getIntent());
        view.loadUrl(HOME);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        receive(intent);
    }

    private static String assetType(String asset) {
        switch (asset) {
            case "index.html": return "text/html";
            case "style.css": return "text/css";
            case "app.js":
            case "languages.js":
            case "cleaner.js": return "text/javascript";
            case "icon-192.png":
            case "icon-512.png": return "image/png";
            case "manifest.webmanifest": return "application/manifest+json";
            default: return null;
        }
    }

    private void receive(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (text == null && intent.getClipData() != null && intent.getClipData().getItemCount() > 0) {
            text = intent.getClipData().getItemAt(0).getText();
        }
        if (text == null) text = intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT);
        shared = text == null ? "" : text.subSequence(0, Math.min(32768, text.length())).toString();
        setIntent(new Intent(this, MainActivity.class));
        deliverShare();
    }

    private void deliverShare() {
        if (pageReady && shared != null) {
            view.evaluateJavascript("privateLinksReceive(" + JSONObject.quote(shared) + ")", null);
            shared = null;
        }
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        view.removeJavascriptInterface("PrivateLinksAndroid");
        if (view.getParent() instanceof android.view.ViewGroup) {
            ((android.view.ViewGroup) view.getParent()).removeView(view);
        }
        view.destroy();
        super.onDestroy();
    }

    public final class Bridge {
        @JavascriptInterface
        public void openInfoLink(String value) {
            if (value == null) return;
            switch (value) {
                case "https://www.versesbgw.com/APP/links/privacy-policy.html":
                case "https://www.versesbgw.com/APP/links/legal-notes.html":
                case "https://github.com/Myth87/Private-Links":
                    runOnUiThread(() -> {
                        try {
                            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(value)));
                        } catch (ActivityNotFoundException ignored) {
                            // The device has no browser to open this link.
                        }
                    });
                    break;
                default:
                    break;
            }
        }

        @JavascriptInterface
        public boolean copy(String value) {
            if (value == null || value.length() > 32768) return false;
            ClipboardManager clipboard = getSystemService(ClipboardManager.class);
            if (clipboard == null) return false;
            clipboard.setPrimaryClip(ClipData.newPlainText("Cleaned link", value));
            return true;
        }

        @JavascriptInterface
        public void resolve(String value, int requestId) {
            runOnUiThread(() -> {
                if (isDestroyed()) return;
                if (lookup != null) lookup.cancel(true);
                lookup = executor.submit(() -> {
                    String resolved = Redirects.resolve(value);
                    if (Thread.currentThread().isInterrupted()) return;
                    runOnUiThread(() -> {
                        if (isDestroyed()) return;
                        String target = resolved == null ? "null" : JSONObject.quote(resolved);
                        view.evaluateJavascript("privateLinksResolved(" + requestId + "," + target + ")", null);
                    });
                });
            });
        }
    }
}
