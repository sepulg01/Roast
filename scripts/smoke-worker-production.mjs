const DEFAULT_BASE_URL = 'https://caferoast.cl';

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.ROAST_WORKER_BASE_URL || DEFAULT_BASE_URL
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--base-url') {
      args.baseUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--base-url=')) {
      args.baseUrl = arg.slice('--base-url='.length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function buildUrl(baseUrl, pathname) {
  const url = new URL(pathname, baseUrl);
  url.pathname = pathname;
  return url;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();

  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(`${options.label || url.pathname} returned non-JSON response: ${text.slice(0, 180)}`);
  }

  return { response, payload };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertStatus(response, expected, label) {
  assert(
    response.status === expected,
    `${label} expected HTTP ${expected}, received HTTP ${response.status}`
  );
}

async function checkHealth(baseUrl) {
  const label = 'GET /api/health';
  const { response, payload } = await fetchJson(buildUrl(baseUrl, '/api/health'), { label });

  assertStatus(response, 200, label);
  assert(payload?.ok === true, `${label} expected ok true`);
  assert(payload?.service === 'roast-worker', `${label} expected service roast-worker`);

  const features = payload?.features || {};
  for (const feature of ['confirmation_number', 'terms_only_checkout', 'resend_notifications']) {
    assert(features[feature] === true, `${label} expected feature flag ${feature}=true`);
  }
}

async function checkPublicCatalog(baseUrl) {
  const label = 'GET /api/public-catalog';
  const { response, payload } = await fetchJson(buildUrl(baseUrl, '/api/public-catalog'), { label });

  assertStatus(response, 200, label);
  assert(payload?.ok === true, `${label} expected ok true`);
}

async function checkCheckoutValidation(baseUrl) {
  const label = 'POST /api/checkout-orders empty items validation';
  const { response, payload } = await fetchJson(buildUrl(baseUrl, '/api/checkout-orders'), {
    label,
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      first_name: 'Smoke',
      last_name: 'Test',
      email: 'smoke-test@example.com',
      phone: '+56912345678',
      commune: 'Providencia',
      address: 'Av. Providencia 1234',
      items: [],
      payment_method: 'transfer',
      accept_terms: true,
      channel: 'ci_smoke',
      origin: 'worker_production_smoke'
    })
  });

  assert(response.status >= 400, `${label} expected an error status, received HTTP ${response.status}`);
  assert(payload?.ok === false, `${label} expected ok false`);

  const error = String(payload?.error || '');
  assert(/item/i.test(error), `${label} expected a missing items error, received: ${error}`);
  assert(!/accept_total/i.test(error), `${label} returned legacy accept_total error: ${error}`);
}

async function main() {
  const { baseUrl } = parseArgs(process.argv.slice(2));
  const normalizedBaseUrl = new URL(baseUrl);

  await checkHealth(normalizedBaseUrl);
  await checkPublicCatalog(normalizedBaseUrl);
  await checkCheckoutValidation(normalizedBaseUrl);

  console.log(`Worker production smoke passed for ${normalizedBaseUrl.origin}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
