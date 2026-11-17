# Private Links

Private Links removes known sharing and analytics parameters from social media URLs. It keeps the address of the original content, including query fields that identify a post, playlist, timestamp, or carousel image.

## Android

Install `android/build/Private-Links.apk`, then open a social app and choose **Share → Private Links**. The Android app accepts shared URLs or text containing a URL, cleans the first link, and copies it to the clipboard. You can also open Private Links and paste a link manually.

Build the APK on Windows with JDK 17 or later, Android SDK Platform 36, and Build Tools 36.0.0.

```powershell
./android/build.ps1 -Sdk 'C:/path/to/Android/Sdk'
```

The script produces a debug-signed APK for testing and sideloading.

Pass `-BundleTool 'C:/path/to/bundletool-all.jar'` to also build and validate an unsigned Android App Bundle for Google Play. Sign the bundle with your Google Play upload key using `jarsigner`.

## Web

The hosted webpage cleans full URLs in the browser and automatically expands supported Facebook short links through its ChatGPT Sites resolver. For a local preview of direct-link cleaning, serve the files with Python.

```powershell
python -m http.server 8125 --bind 127.0.0.1 --directory web/dist
```

Open `http://127.0.0.1:8125/`, paste a link or a shared message, and choose **Clean & copy**. Chromium browsers that support installed web share targets can receive links through the system share sheet. If the browser requires a tap to write to the clipboard, the cleaned link stays visible with a **Copy** button.

## Link handling

Both versions use the same rules for Facebook, TikTok, Instagram, YouTube, X, Reddit, Threads, LinkedIn, Pinterest, and Snapchat. Both also remove common analytics fields such as `utm_source` and `fbclid` on other links.

Direct links are processed locally. For supported short links, Android contacts the platform over HTTPS, follows a limited number of redirects within the same platform, and checks for a direct content address before copying. On the web, the Facebook resolver sends the original short URL, including its share token, to Facebook. For other short links, open the original in your browser and paste the full destination address.

Cleaning a URL removes known fields from the outgoing link. The platform can still log visits and recognize signed-in users. A URL that points to your own profile or post still identifies the account that owns it.

```powershell
node --test tests/*.test.cjs
```
