# Making MH Music a real website

Two pieces make this a site anyone can open with their own account:

```
  static site (this repo's dist/)          accounts server (server/auth-server.mjs)
  ─────────────────────────────            ─────────────────────────────────────
  anyone can load it, no keys              register / login / logout / session
  talks to the server when configured      hashes passwords, issues tokens
```

The frontend is a **hash-routed static build** (`#/home`, `#/albums`, …), which
means it needs no server-side routing or rewrite rules — any static host works.

---

## 1. Put the accounts server online (5 minutes)

The server is one file with no dependencies. Pick any Node host — Render,
Railway, Fly.io, a VPS, or a Cloudflare Worker with small edits.

```bash
node server/auth-server.mjs              # listens on :8787
PORT=9000 DATA=/var/mh/users.json CORS_ORIGIN=https://your-site.example node server/auth-server.mjs
```

| env | meaning |
|---|---|
| `PORT` | port to listen on (hosts usually inject this) |
| `DATA` | path to the JSON store — **point this at a persistent disk**, or accounts vanish on redeploy |
| `CORS_ORIGIN` | your site's origin, e.g. `https://mh-music.pages.dev`. Leave `*` only while testing |

Then verify it:

```bash
curl -X POST https://your-server.example/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"t@example.com","password":"secret1"}'
# → {"user":{...},"token":"…"}
```

**Before real users arrive:** serve it over HTTPS (`https://`, not `http://`) —
tokens travel in a header and would otherwise be readable in transit.

## 2. Build the frontend against it

```bash
VITE_AUTH_URL=https://your-server.example npm run build
```

Set `VITE_AUTH_URL` and accounts become real and cross-device. Omit it and the
site still works — the local adapter stores the account in that browser only.

## 3. Publish `dist/`

Any static host. Hash routing means no rewrite rules are needed for the app
itself — but the **lyrics proxy** is a real endpoint, so a host that can run
functions is worth using (Netlify already is):

- **Netlify** — drag the `dist` folder, or `netlify deploy --prod` from the
  project root. `npm run build` also prepares `dist/` for a manual drop: it
  copies the lyric function to `dist/netlify/functions/lyrics.mjs` and writes
  `dist/_redirects` (`/api/lyrics` → that function, then the SPA fallback), which
  is the layout Netlify needs from a dropped folder. Without those two files a
  dropped build has no lyric proxy and online lyrics resolve to nothing.
- **Vercel** — `vercel deploy --prod`; add `api/lyrics.js` with the same body as
  the Netlify function.
- **Cloudflare Pages** — build `npm run build`, output `dist`; use a Pages
  Function at `functions/api/lyrics.js` with the same body.
- **GitHub Pages / plain static** — the site itself works, but the lyric lookup
  has no proxy to call, so online lyrics will not resolve. Either point the app
  at your own proxy (below) or use the sidecar workflow.

Open the URL on your phone: the site loads, the intro plays, and you can register
an account that works from any browser.

---

## Lyrics

Tracks that ship without words can have them looked up online. The lookup runs
**on a server, never in the page**: the public lyric APIs answer without
`Access-Control-Allow-Origin`, so a page-level `fetch` is refused by CORS before
the body can be read. That is why the deployed static site had no lyrics at all.

Two proxies ship here and both answer the same shape (`GET /api/lyrics
?title&artist&album&provider` → `{lyrics, source}`):

| proxy | runs on | path |
|---|---|---|
| `netlify/functions/lyrics.mjs` | Netlify (or any Node host) | `/api/lyrics` |
| `server/auth-server.mjs` | your own server | `/api/lyrics` |

Provider chain (the one the [lyricFlow](https://github.com/laoning666/lyricFlow)
utility uses — it is a batch tool that writes `.lrc` files, so its *providers*
are what a browser app can reuse):

| provider | env | notes |
|---|---|---|
| LrcApi (`https://api.lrc.cx`) | `LRCAPI_URL`, `LRCAPI_AUTH` | default; returns LRC directly |
| TuneHub (`https://music-dl.sayqz.com`) | `API_BASE_URL` | aggregates NetEase / Kuwo / QQ |

Set `API_PROVIDER=tunehub` to try TuneHub first. Both are third-party services:
lyric text is copyrighted by its owners, lyricFlow itself is **CC BY-NC 4.0
(non-commercial)**, and neither is bundled with this project.

A miss is reported honestly: LrcApi fuzzy-matches, so a reply with no timings is
only accepted when the asked-for title or artist actually appears in it —
otherwise a bulk fill would put someone else's words on a track.

**If your music lives in a folder on disk**, the simpler route is lyricFlow
itself: run it against that folder and it writes a `.lrc` beside each file (and
can embed the words into the tags). Then press **重新扫描** in **文件夹** here —
sidecar files and embedded tags are both read at scan time. Nothing to host.

In the app: **设置 → 歌词来源** has 自动获取, the endpoint, the provider order, a
**补齐整库歌词** sweep, and **导出歌词 / 恢复歌词** (a JSON backup matched back by
title + artist — the only pair that survives a re-scan or a re-upload).

---

## What is server-side now, and what is still local

| | where it lives | why |
|---|---|---|
| Account, password, session | **server** | one account, any device |
| Library, playlists, favourites, settings, lyrics | per-user, in the browser | moved to the server next if you want sync across devices |
| The audio files themselves | **the listener's own machine** | see below |

**The music stays local on purpose.** A browser can read a folder you grant it,
but a website cannot reach into a visitor's disk for them — and uploading
listeners' files to a server means storing and serving music, which is a
licensing question, not a technical one. So each visitor adds their own folders
and hears their own files, while the account system is genuinely shared.

If you want the library itself to follow the account across devices, the next
step is storage on the server (S3/R2 + a tracks table) plus a rights decision
about the audio. The frontend is already shaped for it: the scanner, the library
store and the delete paths all funnel through a small number of call sites.

## Checklist before you call it live

- [ ] Accounts server on HTTPS, `CORS_ORIGIN` set to the site origin, `DATA` on a persistent disk
- [ ] `VITE_AUTH_URL` set at build time, and the site rebuilt
- [ ] Register + sign out + sign in verified on the deployed URL
- [ ] Lyric lookup verified on the deployed URL: `设置 → 歌词来源 → 补齐整库歌词` finds something (a static host with no function cannot answer `/api/lyrics`)
- [ ] `server/users.json` is **not** in git (it holds password hashes and live tokens)
- [ ] A privacy note on the site telling visitors what you store (email, display name, password hash)
