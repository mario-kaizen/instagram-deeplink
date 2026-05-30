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

// ---------------------------------------------------------------------------
// STRONG Pilates deep links — reverse-engineered from Branch.io + Hapana API
// ---------------------------------------------------------------------------
const HAPANA_API = 'https://api.hapana.com';
const HAPANA_KEY = process.env.HAPANA_API_KEY || '';
const IOS_STORE = 'https://apps.apple.com/au/app/strong-pilates/id1663390750';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.hapana.strongpilates';

// In-memory cache: slug → { siteID, siteName, packages: [{packageID, name, slug}] }
let siteCache = new Map();
let cacheReady = false;

function slugify(name) {
  return name.toLowerCase().replace(/^strong\s+/i, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function hapanaGet(path, siteID) {
  const headers = { 'accessID': HAPANA_KEY };
  if (siteID) headers['siteID'] = siteID;
  const r = await fetch(`${HAPANA_API}${path}`, { headers });
  return r.json();
}

async function refreshCache() {
  try {
    const sitesRes = await hapanaGet('/v2/site');
    if (!sitesRes.success) return;
    const newCache = new Map();
    for (const site of sitesRes.data) {
      const slug = slugify(site.siteName);
      newCache.set(slug, {
        siteID: site.siteID,
        siteName: site.siteName,
        country: site.siteCountry,
        region: site.siteRegion,
        packages: null,
      });
    }
    siteCache = newCache;
    cacheReady = true;
    console.log(`Hapana cache: ${newCache.size} sites loaded`);
  } catch (e) {
    console.error('Cache refresh failed:', e.message);
  }
}

async function getPackages(siteSlug) {
  const site = siteCache.get(siteSlug);
  if (!site) return null;
  if (site.packages) return site;
  try {
    const pkgRes = await hapanaGet('/v2/site/packages', site.siteID);
    if (!pkgRes.success) return site;
    site.packages = pkgRes.data
      .filter(p => p.validPurchase)
      .map(p => ({
        packageID: p.packageID,
        name: p.name,
        slug: slugify(p.name),
        amount: p.amount,
        type: p.type,
        category: p.category,
        introOffer: p.introOffer,
      }));
    return site;
  } catch (e) {
    console.error('Package fetch failed:', e.message);
    return site;
  }
}

function buildLinkClickId(siteID, packageID) {
  const data = {
    '$canonical_identifier': 'packageDetail',
    packageID,
    siteID,
    '~channel': 'package_deeplink',
    '~feature': 'kaizen_trampoline',
  };
  return 'a-' + Buffer.from(JSON.stringify(data)).toString('base64url');
}

function renderTrampoline(res, siteID, packageID, siteName, packageName) {
  const linkClickId = buildLinkClickId(siteID, packageID);
  const encodedSiteID = encodeURIComponent(siteID);
  const encodedPkgID = encodeURIComponent(packageID);

  // Strategy: try 3 schemes in sequence on iOS
  // 1. Plain query params on hapana://open (app's own handler)
  // 2. hapana://packageDetail with params (alternate path)
  // 3. Branch link_click_id format (Branch SDK handler)
  const scheme1 = `hapana://open?screen=packageDetail&packageID=${encodedPkgID}&siteID=${encodedSiteID}`;
  const scheme2 = `hapana://packageDetail?packageID=${encodedPkgID}&siteID=${encodedSiteID}`;
  const scheme3 = `hapana://open?link_click_id=${linkClickId}`;

  const intentUrl = `intent://open?packageID=${encodedPkgID}&siteID=${encodedSiteID}&screen=packageDetail#Intent;package=com.hapana.strongpilates;scheme=hapana;S.browser_fallback_url=${encodeURIComponent(PLAY_STORE)};end`;
  const displayName = siteName || 'STRONG Pilates';
  const displayPkg = packageName || 'package';

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${displayName} | ${displayPkg}</title>
  <meta property="og:title" content="${displayName} | ${displayPkg}" />
  <meta property="og:description" content="Open in the STRONG Pilates app" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a; color: #fff;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; text-align: center; padding: 20px;
    }
    .container { max-width: 380px; }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid #333; border-top-color: #fff;
      border-radius: 50%; animation: spin .8s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 6px; }
    .pkg { font-size: 15px; color: #ccc; margin-bottom: 16px; }
    p { font-size: 14px; color: #888; margin-bottom: 24px; }
    .stores { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .stores a {
      display: inline-block; background: #fff; color: #0a0a0a;
      text-decoration: none; padding: 12px 20px; border-radius: 8px;
      font-size: 14px; font-weight: 600;
    }
    .debug { font-size: 11px; color: #555; margin-top: 20px; word-break: break-all; }
  </style>
  <script>
    (function() {
      var schemes = [
        ${JSON.stringify(scheme1)},
        ${JSON.stringify(scheme2)},
        ${JSON.stringify(scheme3)}
      ];
      var intentUrl = ${JSON.stringify(intentUrl)};
      var ua = navigator.userAgent.toLowerCase();
      var isIOS = /iphone|ipad|ipod/.test(ua);
      var isAndroid = /android/.test(ua);

      if (isIOS) {
        // Try first scheme; if app doesn't open in 1.5s, try next
        var attempt = 0;
        function tryScheme() {
          if (attempt < schemes.length) {
            window.location = schemes[attempt];
            attempt++;
            setTimeout(function() {
              if (!document.hidden) tryScheme();
            }, 1500);
          } else {
            window.location.replace(${JSON.stringify(IOS_STORE)});
          }
        }
        tryScheme();
      } else if (isAndroid) {
        window.location = intentUrl;
      } else {
        document.addEventListener('DOMContentLoaded', function() {
          document.querySelector('.spinner').style.display = 'none';
          document.querySelector('.loading-text').textContent = 'Download the STRONG Pilates app to view this package.';
        });
      }
    })();
  </script>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>${displayName}</h1>
    <div class="pkg">${displayPkg}</div>
    <p class="loading-text">Opening the STRONG Pilates app...</p>
    <div class="stores">
      <a href="${IOS_STORE}">App Store</a>
      <a href="${PLAY_STORE}">Google Play</a>
    </div>
  </div>
</body>
</html>`);
}

// Route 1: Friendly URL — /strong/buy/bankstown/7-classes-for-50
app.get('/strong/buy/:site/:package', async (req, res) => {
  if (!cacheReady) await refreshCache();
  const site = await getPackages(req.params.site);
  if (!site) return res.status(404).send('Studio not found');
  const pkg = site.packages?.find(p => p.slug === req.params.package);
  if (!pkg) return res.status(404).send(`Package not found at ${site.siteName}. Available: ${(site.packages || []).map(p => p.slug).join(', ')}`);
  renderTrampoline(res, site.siteID, pkg.packageID, site.siteName, pkg.name);
});

// Route 2: Direct encrypted IDs — /strong/buy?siteID=...&packageID=...
app.get('/strong/buy', (req, res) => {
  const { siteID, packageID } = req.query;
  if (!siteID || !packageID) return res.status(400).send('Missing siteID or packageID');
  renderTrampoline(res, siteID, packageID);
});

// Route 3: List all sites — /strong/sites
app.get('/strong/sites', async (req, res) => {
  if (!cacheReady) await refreshCache();
  const sites = [...siteCache.entries()]
    .filter(([, s]) => !s.siteName.includes('HQ') && !s.siteName.includes('Head Office') && !s.siteName.includes('Sandbox'))
    .map(([slug, s]) => ({ slug, name: s.siteName, country: s.country, region: s.region }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json({ count: sites.length, sites });
});

// Route 4: List packages for a site — /strong/sites/bankstown/packages
app.get('/strong/sites/:site/packages', async (req, res) => {
  if (!cacheReady) await refreshCache();
  const site = await getPackages(req.params.site);
  if (!site) return res.status(404).send('Studio not found');
  res.json({ siteName: site.siteName, siteID: site.siteID, packages: site.packages });
});

// TEST: plain HTTP 302 redirect to a Branch long link.
// Question: does a domain redirect into the Branch Universal Link open the app
// on iOS, or land the user on Branch's web page? (San Juan VIP Unlimited)
app.get('/sj-test', (req, res) => {
  const branchLong = 'https://strongpilatesmobi.app.link/?$canonical_identifier=packageDetail&$deeplink_path=packageDetail&packageID=VHBML1VqTkJFaTd1OHVMRGlBNnREUT09&siteID=ZU9lSnllTWNIT3E2UUVlUXkzbEc1dz09';
  res.redirect(302, branchLong);
});

// Boot cache on startup
if (HAPANA_KEY) {
  refreshCache();
  setInterval(refreshCache, 60 * 60 * 1000);
}

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// Root redirect
app.get('/', (req, res) => res.redirect('https://kaizencollective.com.au'));

app.listen(PORT, () => {
  console.log(`Deep link redirector running on port ${PORT}`);
});
