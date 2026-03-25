import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Convert Instagram shortcode to numeric media ID
// Instagram uses a custom base64 alphabet for shortcodes
function shortcodeToMediaId(shortcode) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let id = BigInt(0);
  for (const char of shortcode) {
    id = id * 64n + BigInt(alphabet.indexOf(char));
  }
  return id.toString();
}

app.get('/reel/:reelId', (req, res) => {
  const reelId = req.params.reelId;
  const mediaId = shortcodeToMediaId(reelId);
  const webUrl = `https://www.instagram.com/reel/${reelId}/`;
  const iosDeepLink = `instagram://media?id=${mediaId}`;
  const intentUrl = `intent://www.instagram.com/reel/${reelId}/#Intent;package=com.instagram.android;scheme=https;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Opening Instagram...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #fafafa;
      color: #262626;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 20px;
    }
    .container { max-width: 360px; }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid #dbdbdb;
      border-top-color: #262626;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    p { font-size: 14px; color: #8e8e8e; margin-bottom: 20px; }
    a {
      display: inline-block;
      background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
      color: white;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
    }
  </style>
  <script>
    (function() {
      var iosDeepLink = '${iosDeepLink}';
      var intentUrl = '${intentUrl}';
      var webUrl = '${webUrl}';

      var ua = navigator.userAgent.toLowerCase();
      var isIOS = /iphone|ipad|ipod/.test(ua);
      var isAndroid = /android/.test(ua);

      if (isIOS) {
        // instagram://media?id=NUMERIC_ID opens the specific reel in the app
        window.location = iosDeepLink;
        setTimeout(function() { window.location.replace(webUrl); }, 1500);
      } else if (isAndroid) {
        // Android intent with Instagram package
        window.location = intentUrl;
        setTimeout(function() { window.location.replace(webUrl); }, 1500);
      } else {
        // Desktop: go straight to web
        window.location.replace(webUrl);
      }
    })();
  </script>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>Opening Instagram</h1>
    <p>You should be redirected to the Instagram app automatically.</p>
    <a href="${webUrl}">Open in Browser Instead</a>
  </div>
</body>
</html>`);
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// Root redirect
app.get('/', (req, res) => res.redirect('https://kaizencollective.com.au'));

app.listen(PORT, () => {
  console.log(`Deep link redirector running on port ${PORT}`);
});
