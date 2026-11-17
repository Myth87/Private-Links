const facebookShort = /^\/(?:share\/[pvr]\/)?[a-z0-9]+\/?$/i;
const facebookHosts = new Set(['facebook.com', 'www.facebook.com', 'm.facebook.com', 'mbasic.facebook.com', 'fb.watch']);

function facebookUrl(url) {
  return url.protocol === 'https:' && !url.username && !url.password &&
    !url.port && facebookHosts.has(url.hostname);
}

async function resolveShare(value, get = fetch) {
  let current;
  try {
    current = new URL(value);
  } catch {
    return null;
  }
  if (!facebookUrl(current) ||
      (!current.pathname.startsWith('/share/') && current.hostname !== 'fb.watch') ||
      !facebookShort.test(current.pathname)) return null;
  const signal = AbortSignal.timeout(5500);
  for (let hop = 0; hop < 4; hop++) {
    const response = await get(current.href, {
      redirect: 'manual',
      signal,
      headers: { 'User-Agent': 'PrivateLinks/1.0' },
    });
    const location = response.headers.get('Location');
    await response.body?.cancel();
    if (!location || ![301, 302, 303, 307, 308].includes(response.status)) return null;
    current = new URL(location, current);
    if (!facebookUrl(current)) return null;
    if (PrivateLinks.isShort(current, 'Facebook')) {
      if (!facebookShort.test(current.pathname)) return null;
      continue;
    }
    const result = PrivateLinks.clean(current.href, true);
    return result.kind === 'clean' && result.name === 'Facebook' ? result.url : null;
  }
  return null;
}

async function handleResolve(request, url) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.method !== 'POST' || request.headers.get('Origin') !== url.origin ||
      request.headers.get('Content-Type') !== 'application/json' ||
      Number(request.headers.get('Content-Length')) > 4096) {
    return Response.json({ url: null }, { status: 400, headers });
  }
  try {
    const text = await request.text();
    if (text.length > 4096) return Response.json({ url: null }, { status: 400, headers });
    const { url: input } = JSON.parse(text);
    const resolved = typeof input === 'string' && await resolveShare(input);
    return Response.json({ url: resolved || null }, { status: resolved ? 200 : 422, headers });
  } catch {
    return Response.json({ url: null }, { status: 422, headers });
  }
}

export default {
  fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/resolve') return handleResolve(request, url);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
    const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!Object.hasOwn(assets, name)) return new Response(null, { status: 404 });
    const { body, type, binary } = assets[name];
    const headers = { 'Content-Type': type, 'Cache-Control': 'no-cache' };
    return new Response(request.method === 'HEAD' ? null :
      binary ? Uint8Array.from(atob(body), character => character.charCodeAt(0)) : body, { headers });
  },
};

export { resolveShare };
