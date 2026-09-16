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

Any static host. No rewrite rules needed (hash routing):

- **Netlify** — drag the `dist` folder onto the dashboard, or `netlify deploy --prod --dir dist`
- **Vercel** — `vercel deploy --prod` (framework: Vite, output `dist`)
- **Cloudflare Pages** — build command `npm run build`, output directory `dist`
- **GitHub Pages** — commit `dist/` to a `gh-pages` branch

Open the URL on your phone: the site loads, the intro plays, and you can register
an account that works from any browser.

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
- [ ] `server/users.json` is **not** in git (it holds password hashes and live tokens)
- [ ] A privacy note on the site telling visitors what you store (email, display name, password hash)
