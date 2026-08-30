import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(root, 'dist');
const port = Number.parseInt(process.env.PORT || '8080', 10);
const configuredOrigin = process.env.SAFE_ZONE_VPS_ORIGIN || 'https://safe.quorix.io.vn';

function parseVpsOrigin(value) {
  const origin = new URL(value.endsWith('/') ? value : `${value}/`);
  if (!['https:', 'http:'].includes(origin.protocol)) {
    throw new Error('SAFE_ZONE_VPS_ORIGIN must use http or https');
  }
  if (origin.username || origin.password) {
    throw new Error('SAFE_ZONE_VPS_ORIGIN must not contain credentials');
  }
  origin.pathname = '/';
  origin.search = '';
  origin.hash = '';
  return origin;
}

const vpsOrigin = parseVpsOrigin(configuredOrigin);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};

const DEMO_MESSAGE = 'AI Studio demo: this action is simulated locally. Safe Zone production was not changed.';
const DEMO_SESSION = {
  username: 'AI Studio',
  role: 'demo',
  read_only: true,
  // Keep all production navigation visible for the showcase. The server
  // still treats every mutation as a local no-op below.
  can_mutate: true,
  can_view_settings: true,
  guest_message: 'Đây là bản trình diễn AI Studio. Các nút điều khiển chỉ mô phỏng và không thay đổi Safe Zone production.',
};

function setCommonHeaders(response, contentType = 'application/json; charset=utf-8') {
  response.setHeader('Content-Type', contentType);
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('X-Safe-Zone-Demo', 'true');
}

function sendJson(response, status, payload, extraHeaders = {}) {
  setCommonHeaders(response);
  for (const [name, value] of Object.entries(extraHeaders)) {
    response.setHeader(name, value);
  }
  response.statusCode = status;
  response.end(JSON.stringify(payload));
}

function sendText(response, status, body, contentType = 'text/plain; charset=utf-8', extraHeaders = {}) {
  setCommonHeaders(response, contentType);
  for (const [name, value] of Object.entries(extraHeaders)) {
    response.setHeader(name, value);
  }
  response.statusCode = status;
  response.end(body);
}

function nowIso(offsetMinutes = 0) {
  return new Date(Date.now() - offsetMinutes * 60_000).toISOString();
}

function validDomain(value) {
  return value.length > 0
    && value.length <= 253
    && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);
}

function demoAnalysis(domain) {
  const normalized = domain.toLowerCase();
  if (normalized.includes('secure-wallet') || normalized.includes('malware')) {
    return {
      domain,
      verdict: 'MALICIOUS',
      confidence: 0.96,
      score: 92,
      reasons: ['High-risk financial lure keyword', 'Newly observed destination pattern', 'Domain structure matches known abuse heuristics'],
      category: 'phishing',
      cache_hit: false,
      analyzed_at: nowIso(),
      evidence: [{
        domain,
        source_url: 'https://safe.quorix.io.vn/app/',
        source_title: 'Demo signal fixture',
        source_type: 'demo',
        confidence: 0.96,
        matched_terms: ['wallet', 'secure'],
        retrieved_at: nowIso(),
      }],
      url_ml: { sampled: false, evaluated: false, would_promote: false },
    };
  }

  if (normalized.includes('login-update') || normalized.includes('verify-account')) {
    return {
      domain,
      verdict: 'SUSPICIOUS',
      confidence: 0.88,
      score: 74,
      reasons: ['Credential-themed keyword combination', 'Unusual hyphenation pattern', 'Destination requires additional verification'],
      category: 'suspicious',
      cache_hit: false,
      analyzed_at: nowIso(),
      evidence: [{
        domain,
        source_url: 'https://safe.quorix.io.vn/app/',
        source_title: 'Demo signal fixture',
        source_type: 'demo',
        confidence: 0.88,
        matched_terms: ['login', 'update'],
        retrieved_at: nowIso(),
      }],
      url_ml: { sampled: false, evaluated: false, would_promote: false },
    };
  }

  return {
    domain,
    verdict: 'SAFE',
    confidence: 0.99,
    score: 4,
    reasons: ['No high-risk lexical signals detected'],
    category: 'benign',
    cache_hit: true,
    analyzed_at: nowIso(),
    evidence: [],
    url_ml: { sampled: false, evaluated: false, would_promote: false },
  };
}

function demoRecentAnalyses() {
  return [
    demoAnalysis('example.com'),
    demoAnalysis('login-update.test'),
    demoAnalysis('secure-wallet.test'),
    demoAnalysis('docs.example.org'),
    demoAnalysis('verify-account.test'),
  ].map((item, index) => ({
    ...item,
    analyzed_at: nowIso(index * 17 + 3),
  }));
}

function demoRawInspection(domain) {
  const risky = /secure-wallet|malware|login-update|verify-account/i.test(domain);
  return {
    domain,
    dns: {
      resolved: true,
      nameservers: ['ns1.demo.safe-zone.local', 'ns2.demo.safe-zone.local'],
    },
    tls: {
      has_tls: true,
      valid: !risky,
      self_signed: false,
      expired: false,
      issuer: 'Demo Certificate Authority',
      subject: domain,
      san_match: !risky,
      cert_age_days: risky ? 11 : 148,
      is_wildcard: false,
      not_before: nowIso(148 * 24 * 60),
      not_after: nowIso(-217 * 24 * 60),
      score: risky ? 12 : 0,
      reasons: risky ? ['Certificate context is inconsistent with the destination profile'] : [],
    },
    whois: {
      found: true,
      registered_date: nowIso(148 * 24 * 60),
      domain_age_days: risky ? 11 : 148,
      registrar: 'Demo Registrar',
      privacy_guard: risky,
      score: risky ? 18 : 0,
      reasons: risky ? ['Very young registration'] : [],
    },
    inspect_at: nowIso(),
  };
}

function demoTelemetryEntries() {
  const records = [
    ['example.com', 'SAFE', 4, 0.99, 'dns'],
    ['docs.example.org', 'SAFE', 7, 0.98, 'cache'],
    ['login-update.test', 'SUSPICIOUS', 74, 0.88, 'heuristics'],
    ['secure-wallet.test', 'MALICIOUS', 92, 0.96, 'osint'],
    ['verify-account.test', 'SUSPICIOUS', 68, 0.84, 'heuristics'],
    ['status.example.net', 'SAFE', 3, 0.99, 'cache'],
    ['malware-download.test', 'MALICIOUS', 96, 0.97, 'osint'],
    ['portal.example.com', 'SAFE', 9, 0.95, 'dns'],
  ];
  return records.map(([domain, verdict, score, confidence, source], index) => ({
    id: index + 1,
    domain,
    verdict,
    score,
    confidence,
    reasons: verdict === 'SAFE' ? ['No high-risk lexical signals detected'] : ['Demo threat signal matched'],
    cache_hit: source === 'cache',
    source,
    analyzed_at: nowIso(index * 23 + 6),
    created_at: nowIso(index * 23 + 6),
    client_ip: 'demo',
    client_id: 'ai-studio-demo',
  }));
}

function demoTelemetryStats(period) {
  const trend = Array.from({ length: 8 }, (_, index) => ({
    timestamp: nowIso((7 - index) * 180),
    safe: 112 + index * 9,
    suspicious: 10 + (index % 3) * 4,
    malicious: 4 + (index % 2) * 3,
    threats: 14 + (index % 3) * 7,
  }));
  return {
    total: 1537,
    safe: 1324,
    suspicious: 120,
    malicious: 93,
    cache_hits: 941,
    period,
    score_bands: [
      { label: '0–20', value: 1324 },
      { label: '21–40', value: 78 },
      { label: '41–60', value: 42 },
      { label: '61–80', value: 58 },
      { label: '81–100', value: 35 },
    ],
    trend,
  };
}

function demoAgentStatus() {
  return {
    enabled: true,
    tasks: [
      { name: 'feed_sync', state: 'idle', interval: '15m', last_run: nowIso(18), next_run: nowIso(-12), run_count: 284, error_count: 0, last_error: '' },
      { name: 'telemetry_retention', state: 'idle', interval: '1h', last_run: nowIso(41), next_run: nowIso(-19), run_count: 132, error_count: 0, last_error: '' },
    ],
    whitelist_stats: {
      loaded_domains: 79747,
      bloom_size_ram_kb: 512.24,
      bloom_hashes: 7,
      bloom_bits: 4194304,
      fpr: 0.0001,
    },
    database_stats: {
      file_size_mb: 18.42,
      disk_free_gb: 59.8,
    },
    telemetry_retention_days: 30,
  };
}

function demoGroups() {
  return {
    items: [
      { id: 1, name: 'Default', description: 'Default policy group for Safe Zone demo clients.', block_categories: ['malware', 'phishing'], strict_phishing: true, strict_malware: true },
      { id: 2, name: 'Research', description: 'Relaxed group for controlled testing.', block_categories: ['malware'], strict_phishing: false, strict_malware: true },
    ],
  };
}

function demoMappings() {
  return {
    items: [{ id: 1, mapping_type: 'client_id', value: 'ai-studio-demo', group_id: 1, group_name: 'Default', created_at: nowIso(240) }],
  };
}

function demoOverrides() {
  return {
    items: [
      { domain: 'example.com', action: 'allow', reason: 'Demo allow-list example', source: 'demo', created_at: nowIso(90) },
      { domain: 'secure-wallet.test', action: 'block', reason: 'Demo threat fixture', source: 'demo', created_at: nowIso(180) },
    ],
  };
}

function demoReports(requestUrl) {
  const reports = [
    { id: 1, domain: 'login-update.test', contact: 'demo-reporter@example.test', note: 'Looks like a credential lure.', status: 'pending', created_at: nowIso(70), review_reason: '', reviewed_by: '', reviewed_at: '', resolution_action: '' },
    { id: 2, domain: 'secure-wallet.test', contact: '', note: 'Wallet verification page reported by demo user.', status: 'resolved', created_at: nowIso(260), review_reason: 'Confirmed threat fixture for demo', reviewed_by: 'AI Studio', reviewed_at: nowIso(220), resolution_action: 'resolved' },
    { id: 3, domain: 'portal.example.com', contact: '', note: 'False positive sample.', status: 'rejected', created_at: nowIso(420), review_reason: 'Benign sample domain', reviewed_by: 'AI Studio', reviewed_at: nowIso(380), resolution_action: 'rejected' },
  ];
  const status = requestUrl.searchParams.get('status');
  const query = (requestUrl.searchParams.get('q') || '').trim().toLowerCase();
  const filtered = reports.filter((report) => {
    if (status && status !== 'all' && report.status !== status) return false;
    if (query && !`${report.domain} ${report.note} ${report.contact}`.toLowerCase().includes(query)) return false;
    return true;
  });
  const offset = Math.max(0, Number.parseInt(requestUrl.searchParams.get('offset') || '0', 10) || 0);
  const limit = Math.min(100, Math.max(1, Number.parseInt(requestUrl.searchParams.get('limit') || '12', 10) || 12));
  return {
    reports: filtered.slice(offset, offset + limit),
    total: filtered.length,
    counts: {
      pending: reports.filter((report) => report.status === 'pending').length,
      resolved: reports.filter((report) => report.status === 'resolved').length,
      rejected: reports.filter((report) => report.status === 'rejected').length,
    },
  };
}

function demoSettingsBundle() {
  return {
    settings: {
      telemetry_retention_days: 30,
      // Deliberately blank: never expose a real Gemini key in a demo bundle.
      gemini_api_key: '',
      agent_webhook_url: '',
    },
    analysis_config: {
      punycode_score: 35,
      long_domain_length: 24,
      long_domain_score: 15,
      hyphen_count_threshold: 3,
      hyphen_score: 10,
      digit_ratio_threshold: 0.25,
      digit_ratio_score: 10,
      mixed_script_score: 25,
      keywords: ['login', 'verify', 'wallet'],
      keyword_base_score: 15,
      keyword_match_score: 10,
      keyword_multiple_bonus: 10,
      brand_spoofing_score: 50,
      entropy_threshold: 3,
      entropy_score: 35,
    },
    guest_access: { username: 'guest', exists: true, enabled: true },
  };
}

function demoMetrics() {
  return {
    service: 'core-api',
    status: 'ok',
    metrics: {
      started_at: nowIso(24 * 60),
      uptime_seconds: 86400,
      request_summary: {
        'GET /v1/analyze': { count: 428, bytes: 184320, total_duration_ms: 18420, max_duration_ms: 180, last_status: 200 },
        'GET /v1/status': { count: 96, bytes: 48200, total_duration_ms: 820, max_duration_ms: 32, last_status: 200 },
        'GET /healthz': { count: 148, bytes: 14600, total_duration_ms: 1120, max_duration_ms: 18, last_status: 200 },
      },
      counters: { requests_total: 672, analyses_total: 428, cache_hits_total: 941 },
    },
  };
}

function demoReady() {
  return { service: 'core-api', status: 'ready', redis: 'demo', mode: 'read-only' };
}

function filterTelemetry(requestUrl) {
  const domain = (requestUrl.searchParams.get('domain') || '').trim().toLowerCase();
  const verdict = (requestUrl.searchParams.get('verdict') || '').trim().toUpperCase();
  const source = (requestUrl.searchParams.get('source') || '').trim().toLowerCase();
  const offset = Math.max(0, Number.parseInt(requestUrl.searchParams.get('offset') || '0', 10) || 0);
  const limit = Math.min(100, Math.max(1, Number.parseInt(requestUrl.searchParams.get('limit') || '12', 10) || 12));
  const filtered = demoTelemetryEntries().filter((entry) => {
    if (domain && !entry.domain.includes(domain)) return false;
    if (verdict && entry.verdict !== verdict) return false;
    if (source && entry.source !== source) return false;
    return true;
  });
  return { items: filtered.slice(offset, offset + limit), total: filtered.length };
}

async function proxyJson(response, target, fallback) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const upstream = await fetch(target, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'user-agent': 'safe-zone-ai-studio-demo/0.1',
      },
      redirect: 'error',
      signal: controller.signal,
    });
    const text = await upstream.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
    if (upstream.ok && payload !== null) {
      sendJson(response, upstream.status, payload, { 'X-Safe-Zone-Source': 'vps-read-only' });
      return;
    }
    if (fallback !== undefined) {
      sendJson(response, 200, { ...fallback, demo_fallback: true }, { 'X-Safe-Zone-Source': 'demo-fixture' });
      return;
    }
    sendJson(response, upstream.status || 502, { error: 'VPS returned an invalid response' });
  } catch (error) {
    if (fallback !== undefined) {
      sendJson(response, 200, { ...fallback, demo_fallback: true }, { 'X-Safe-Zone-Source': 'demo-fixture' });
      return;
    }
    const message = error?.name === 'AbortError' ? 'VPS request timed out' : 'VPS request failed';
    sendJson(response, 502, { error: message });
  } finally {
    clearTimeout(timeout);
  }
}

function staticFilePath(requestPath) {
  const cleanPath = decodeURIComponent(requestPath.split('?')[0]).replace(/^\/+/, '');
  const candidate = path.resolve(distRoot, cleanPath || 'index.html');
  if (candidate !== distRoot && !candidate.startsWith(`${distRoot}${path.sep}`)) return null;
  return candidate;
}

async function serveStatic(request, response) {
  const requestPath = new URL(request.url || '/', 'http://localhost').pathname;
  let filePath = staticFilePath(requestPath);

  if (!filePath) {
    sendJson(response, 400, { error: 'Invalid path' });
    return;
  }

  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) throw new Error('Not a file');
  } catch {
    const acceptsHtml = String(request.headers.accept || '').includes('text/html');
    if (!acceptsHtml || requestPath.includes('.')) {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }
    filePath = path.join(distRoot, 'index.html');
  }

  try {
    const contents = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    setCommonHeaders(response, MIME_TYPES[extension] || 'application/octet-stream');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; font-src 'self' data: https://fonts.gstatic.com; object-src 'none'; base-uri 'self'",
    );
    response.statusCode = 200;
    response.end(contents);
  } catch {
    sendJson(response, 503, { error: 'Demo build is not available. Run npm run build first.' });
  }
}

function mutationResponse(response) {
  sendJson(response, 200, { status: 'ok', simulated: true, demo: true, message: DEMO_MESSAGE });
}

function readJsonBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    let rejected = false;
    request.on('data', (chunk) => {
      if (rejected) return;
      size += chunk.length;
      if (size > 128 * 1024) {
        rejected = true;
        resolve({});
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (rejected) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        resolve({});
      }
    });
    request.on('error', () => resolve({}));
  });
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', 'http://localhost');

  if (request.method === 'POST' && requestUrl.pathname === '/v1/analyze') {
    const body = await readJsonBody(request);
    const domain = typeof body.domain === 'string' ? body.domain.trim().toLowerCase() : '';
    if (!validDomain(domain)) {
      sendJson(response, 400, { error: 'Enter a valid domain name' });
      return;
    }
    sendJson(response, 200, {
      ...demoAnalysis(domain),
      demo: true,
      url_ml: { sampled: false, evaluated: true, would_promote: false },
    });
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/v1/config/analysis/reset') {
    request.resume();
    sendJson(response, 200, { ...demoSettingsBundle().analysis_config, demo: true, simulated: true });
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/v1/url-ml/feedback') {
    request.resume();
    sendJson(response, 200, { recorded: false, reason: 'Demo mode does not persist labels', demo: true, simulated: true });
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    // Do not forward request bodies, cookies, authorization headers, or any
    // other write operation to the VPS. The copied production UI can still
    // demonstrate its controls because every mutation is a local no-op.
    request.resume();
    mutationResponse(response);
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/v1/auth/session') {
    sendJson(response, 200, DEMO_SESSION);
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/healthz') {
    await proxyJson(response, new URL('/healthz', vpsOrigin), { service: 'core-api', status: 'ok', time: nowIso() });
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/readyz') {
    await proxyJson(response, new URL('/readyz', vpsOrigin), demoReady());
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/v1/status') {
    await proxyJson(response, new URL('/v1/status', vpsOrigin), {
      service: 'core-api',
      status: 'ok',
      mode: 'api',
      deployment_tier: 'budget-vps',
      redis: { configured: true, status: 'ok' },
      feed_sync: { configured: false, status: 'disabled', total_domains: 0, last_sync: '' },
      adblock: { enabled: true, loaded_rules: 79747, status: 'ok' },
      rate_limiting: { enabled: true },
    });
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/v1/version') {
    await proxyJson(response, new URL('/v1/version', vpsOrigin), { version: 'demo', source: 'AI Studio demo' });
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/v1/analyze') {
    const domain = (requestUrl.searchParams.get('domain') || '').trim().toLowerCase();
    if (!validDomain(domain)) {
      sendJson(response, 400, { error: 'Enter a valid domain name' });
      return;
    }
    const target = new URL('/v1/analyze', vpsOrigin);
    target.searchParams.set('domain', domain);
    target.searchParams.set('include_evidence', '1');
    await proxyJson(response, target, demoAnalysis(domain));
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/v1/analyze/raw') {
    const domain = (requestUrl.searchParams.get('domain') || '').trim().toLowerCase();
    if (!validDomain(domain)) {
      sendJson(response, 400, { error: 'Enter a valid domain name' });
      return;
    }
    const target = new URL('/v1/analyze/raw', vpsOrigin);
    target.searchParams.set('domain', domain);
    await proxyJson(response, target, demoRawInspection(domain));
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/v1/analysis/recent') {
    sendJson(response, 200, { items: demoRecentAnalyses() });
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/v1/osint/evidence') {
    sendJson(response, 200, { items: [], evidence: [], demo: true });
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/v1/telemetry/stats') {
    sendJson(response, 200, demoTelemetryStats(requestUrl.searchParams.get('period') || '24h'));
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/v1/telemetry/recent') {
    sendJson(response, 200, filterTelemetry(requestUrl));
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/v1/agent/status') {
    sendJson(response, 200, demoAgentStatus());
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/v1/groups') {
    sendJson(response, 200, demoGroups());
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/v1/mappings') {
    sendJson(response, 200, demoMappings());
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/v1/overrides') {
    sendJson(response, 200, demoOverrides());
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/v1/reports') {
    sendJson(response, 200, demoReports(requestUrl));
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/v1/settings/bundle') {
    sendJson(response, 200, demoSettingsBundle());
    return;
  }

  if (request.method === 'GET' && (requestUrl.pathname === '/v1/settings' || requestUrl.pathname === '/v1/config/analysis')) {
    const bundle = demoSettingsBundle();
    sendJson(response, 200, requestUrl.pathname.endsWith('/settings') ? bundle.settings : bundle.analysis_config);
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/v1/brands') {
    sendJson(response, 200, { items: ['Google', 'Microsoft', 'Apple', 'PayPal'], demo: true });
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/metrics') {
    sendJson(response, 200, demoMetrics());
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/v1/logs/export') {
    const body = JSON.stringify({ generated_at: nowIso(), mode: 'read-only-demo', events: demoTelemetryEntries() }, null, 2);
    sendText(response, 200, body, 'application/json; charset=utf-8', {
      'Content-Disposition': 'attachment; filename="safe-zone-ai-studio-demo-logs.json"',
    });
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/block') {
    sendJson(response, 200, { status: 'demo', message: DEMO_MESSAGE });
    return;
  }

  await serveStatic(request, response);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Safe Zone AI Studio demo listening on http://0.0.0.0:${port}`);
  console.log(`Read-only VPS origin: ${vpsOrigin.origin}`);
});
