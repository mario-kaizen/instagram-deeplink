import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/reel/:reelId', (req, res) => {
  const reelId = req.params.reelId;
  const webUrl = `https://www.instagram.com/reel/${reelId}/`;
  const appUrl = `instagram://reel/${reelId}/`;
  const intentUrl = `intent://reel/${reelId}/#Intent;package=com.instagram.android;scheme=https;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;

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
      var webUrl = '${webUrl}';
      var intentUrl = '${intentUrl}';

      var ua = navigator.userAgent.toLowerCase();
      var isAndroid = /android/.test(ua);

      // Universal Links: redirecting to the instagram.com URL from a real browser
      // triggers iOS/Android to open the app directly to the reel.
      // The custom scheme (instagram://) only opens the home screen.
      if (isAndroid) {
        window.location = intentUrl;
        setTimeout(function() { window.location.replace(webUrl); }, 1500);
      } else {
        // iOS + Desktop: instagram.com Universal Link handles app open
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
