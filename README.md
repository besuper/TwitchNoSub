# TwitchNoSub

TwitchNoSub plays some subscriber-only Twitch VODs when their files are still available on Twitch's CDN.

## Install

### Chrome, Edge, Brave, and other Chromium browsers

1. Download the Chromium archive from the [latest release](https://github.com/besuper/TwitchNoSub/releases/latest).
2. Extract it to a permanent folder.
3. Open your browser's extensions page and enable developer mode.
4. Choose **Load unpacked** and select the extracted folder.
5. Reload Twitch.

Chrome 111 or newer is required.

### Firefox

Download the signed XPI from the [latest release](https://github.com/besuper/TwitchNoSub/releases/latest), open it with Firefox, and reload Twitch.

Firefox 140 or newer is required. The `-unsigned.xpi` built locally is only for testing or AMO submission.

### Userscript

Install [the userscript](https://github.com/besuper/TwitchNoSub/raw/master/userscript/twitchnosub.user.js) with Tampermonkey or Violentmonkey.

The userscript loads its worker patch from jsDelivr. The browser extensions use a local copy.

## How it works

The extension hooks the worker used by Twitch's player. When Twitch rejects a subscriber-only VOD playlist, TwitchNoSub reads the VOD's public metadata, checks which qualities are still available on Twitch's CDN, and builds a playlist for Twitch's normal player.

It does not decrypt media or provide subscriber credentials.

## Limits

- The VOD and at least one quality must still be available on Twitch's CDN.
- Deleted, expired, geo-blocked, or otherwise protected VODs may not work.
- Subscriber-only live streams, clips, Stream Rewind, Kick, and other platforms are not supported.
- Twitch player, API, or CDN changes can break the extension.
- Other extensions that modify Twitch's player can conflict with TwitchNoSub.

## Troubleshooting

- Use the latest GitHub release, not a third-party store listing.
- Reload the extension, then reload the Twitch tab.
- Test with other Twitch extensions and userscripts disabled.
- When reporting a bug, include the VOD URL, browser version, TwitchNoSub version, player error, and the first relevant `[TNS]` console message.

## Development

The project uses Node.js and has no runtime dependencies.

```sh
npm test
npm run package
```

`npm test` runs the test suite. `npm run package` creates the Chromium and Firefox archives in `dist/`.
