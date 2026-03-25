# Instagram Deep Link Redirector

Redirects Instagram Reel links to the native app on mobile, with web fallback.

## URL Format
`https://link.kaizencollective.com.au/reel/REEL_ID`

## How it works
- Mobile: tries instagram:// deep link, falls back to web after 1.5s
- Android: uses intent:// for better app detection
- Desktop: immediate redirect to instagram.com
