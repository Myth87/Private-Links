const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
require('../web/dist/cleaner.js');

test('Facebook share link expansion returns a cleaned direct destination', async () => {
  const { resolveShare } = await import('../web/worker.js');
  const short = 'https://www.facebook.com/share/p/example/';
  const direct = 'https://www.facebook.com/story.php?story_fbid=123&id=456';
  const result = await resolveShare(short, async (url, options) => {
    assert.equal(url, short);
    assert.equal(options.redirect, 'manual');
    return Response.redirect(direct + '&rdid=tracking&share_url=' + encodeURIComponent(short));
  });
  assert.equal(result, direct);
});

test('Facebook share link expansion rejects redirects to other sites', async () => {
  const { resolveShare } = await import('../web/worker.js');
  const short = 'https://www.facebook.com/share/p/example/';
  const result = await resolveShare(short, async url => {
    assert.equal(url, short);
    return Response.redirect('https://example.test/');
  });
  assert.equal(result, null);
});

test('the installed web app accepts a shared link locally without reflecting active HTML', async () => {
  const scope = 'https://example.test/private-links/';
  const handlers = new Map();
  const html = readFileSync(require.resolve('../web/dist/index.html'), 'utf8');
  runInNewContext(readFileSync(require.resolve('../web/dist/sw.js'), 'utf8'), {
    URL,
    Response,
    self: {
      registration: { scope },
      addEventListener: (event, handler) => handlers.set(event, handler),
    },
    caches: { match: async () => new Response(html) },
    fetch: () => assert.fail('A shared link must stay in the service worker.'),
  });
  const form = new URLSearchParams({
    url: 'https://youtu.be/abc?si=example',
    text: '</script><script>alert(1)</script> $&',
  });
  const request = new Request(scope + 'share', { method: 'POST', body: form });
  let reply;
  handlers.get('fetch')({ request, respondWith: response => { reply = response; } });
  const response = await reply;
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const rendered = await response.text();
  assert.doesNotMatch(rendered, /<script>alert/);
  const payload = rendered.match(/id="shared-input" type="application\/json">([^<]+)<\/script>/)[1];
  assert.equal(JSON.parse(payload), form.get('url') + '\n' + form.get('text'));
});
