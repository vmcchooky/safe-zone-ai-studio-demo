# Safe Zone · AI Studio Demo

Standalone, read-only showcase of the Safe Zone dashboard for Google AI Studio. The `src/` UI is copied from the production `ui/` app so the demo keeps the same layout, visual system, routes, and responsive behavior. The production dashboard remains on the VPS at <https://safe.quorix.io.vn/app/>.

## Scope

- The original production React dashboard source and assets, with a demo-only auth provider.
- Stable local fixtures for Analysis, Telemetry, Endpoints, Overrides, Reports, System, and Settings.
- Narrow, read-only live calls to the VPS through the Node server:
  - `GET /healthz`
  - `GET /readyz`
  - `GET /v1/status`
  - `GET /v1/version`
  - `GET /v1/analyze?domain=...`
  - `GET /v1/analyze/raw?domain=...`
- All other read paths use demo fixtures, and every `POST`, `PUT`, `PATCH`, or `DELETE` is handled as a local no-op.
- No login, admin session, admin API key, SSH key, certificate, or production secret is included.

The browser only calls same-origin `/v1/*` paths, exactly like production. The server has a fixed VPS origin and only constructs upstream URLs for the small allow-list above; it never accepts an arbitrary upstream URL, forwards browser credentials, or acts as an open proxy.

## Local run

Requires Node.js 22+.

```powershell
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. The dev command starts both the Vite UI and the local read-only proxy.

Production-like local check:

```powershell
npm run check
npm start
```

Then open <http://127.0.0.1:8080>. If port 8080 is already in use, choose another `PORT`.

To point the proxy at another read-only Safe Zone origin, set `SAFE_ZONE_VPS_ORIGIN`; do not add credentials to `.env`.

## Import and publish in Google AI Studio

1. Create or push this standalone app to its own GitHub repository, for example `safe-zone-ai-studio-demo`.
2. In AI Studio Build mode choose **Add files → Import from GitHub** and import this repository.
3. Run the app and verify that the copied dashboard shows the **demo/read-only** notice. Analysis and system health may use the narrow VPS GET proxy; the remaining panels use fixtures.
4. Use **Publish → Get Started → Publish App**. Choose a unique `*.ai.studio` URL such as `safe-zone-demo` if available.

The app does not require an AI Studio secret for the first version. If a future version needs a server-side, read-only token, add a narrowly scoped demo token in AI Studio Secrets; never copy the production `admin_api_key` into this repository or frontend bundle.

## Security boundaries

The demo intentionally cannot change DNS policies, overrides, settings, agent tasks, users, or reports on the VPS. Buttons in those areas keep the copied production interaction but are intercepted locally and return a demo notice. A production-switch button is intentionally not included in this first version.

Do not commit `.env`, private keys, certificates, or credentials.
