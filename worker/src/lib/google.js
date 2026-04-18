import {
  asSheetValue,
  base64UrlEncodeString,
  normalizeKey,
  signJwt
} from './utils.js';

const GOOGLE_OAUTH_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
let googleTokenCache = null;

function getServiceAccount(env) {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON');
  }

  return JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
}

async function requestGoogleAccessToken(env) {
  const serviceAccount = getServiceAccount(env);
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncodeString(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncodeString(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: GOOGLE_OAUTH_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }));
  const signingInput = `${header}.${payload}`;
  const signature = await signJwt(serviceAccount.private_key, signingInput);
  const assertion = `${signingInput}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  const payloadJson = await response.json();

  if (!response.ok) {
    throw new Error(`Google token request failed: ${payloadJson.error || response.status}`);
  }

  googleTokenCache = {
    accessToken: payloadJson.access_token,
    expiresAt: Date.now() + ((payloadJson.expires_in - 60) * 1000)
  };

  return googleTokenCache.accessToken;
}

async function getGoogleAccessToken(env) {
  if (googleTokenCache && googleTokenCache.expiresAt > Date.now()) {
    return googleTokenCache.accessToken;
  }

  return requestGoogleAccessToken(env);
}

async function googleFetch(env, path, options = {}, retry = true) {
  if (!env.GOOGLE_SHEET_ID) {
    throw new Error('Missing GOOGLE_SHEET_ID');
  }

  const accessToken = await getGoogleAccessToken(env);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEET_ID}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {})
    }
  });

  if (response.status === 401 && retry) {
    googleTokenCache = null;
    return googleFetch(env, path, options, false);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Sheets request failed (${response.status}): ${text}`);
  }

  return response;
}

export async function getSheetValues(env, range) {
  const response = await googleFetch(env, `/values/${encodeURIComponent(range)}`);
  const payload = await response.json();
  return payload.values || [];
}

export async function appendSheetValues(env, range, values) {
  const response = await googleFetch(
    env,
    `/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    }
  );

  return response.json();
}

export async function updateSheetValues(env, range, values) {
  const response = await googleFetch(
    env,
    `/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    }
  );

  return response.json();
}

export async function readSheetTable(env, sheetName) {
  const values = await getSheetValues(env, `${sheetName}!A:AZ`);
  const headerRow = (values[0] || []).map(normalizeKey);
  const rows = values.slice(1).map((row, index) => {
    const mapped = {
      _rowNumber: index + 2
    };

    headerRow.forEach((header, headerIndex) => {
      if (header) {
        mapped[header] = row[headerIndex] || '';
      }
    });

    return mapped;
  });

  return {
    headers: headerRow,
    rows
  };
}

export async function findSheetRowByField(env, sheetName, fieldName, expectedValue) {
  const table = await readSheetTable(env, sheetName);
  const normalizedField = normalizeKey(fieldName);
  const match = table.rows.find(row => String(row[normalizedField] || '') === String(expectedValue || ''));
  return {
    headers: table.headers,
    row: match || null
  };
}

export function objectToSheetRow(object, headers) {
  return headers.map(header => asSheetValue(object[header]));
}

export async function appendSheetObject(env, sheetName, headers, object) {
  return appendSheetValues(env, `${sheetName}!A:AZ`, [objectToSheetRow(object, headers)]);
}

export async function updateSheetObjectRow(env, sheetName, headers, rowNumber, object) {
  const endColumnIndex = headers.length - 1;
  const endColumn = toSheetColumn(endColumnIndex + 1);
  const range = `${sheetName}!A${rowNumber}:${endColumn}${rowNumber}`;
  return updateSheetValues(env, range, [objectToSheetRow(object, headers)]);
}

function toSheetColumn(columnNumber) {
  let value = columnNumber;
  let column = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }

  return column;
}
