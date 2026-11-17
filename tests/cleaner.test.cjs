const assert = require('node:assert/strict');
const { test } = require('node:test');
require('../web/dist/cleaner.js');
const { clean } = globalThis.PrivateLinks;

const directCases = [
  ['YouTube', 'Check this out (https://youtu.be/abcdef12345?si=sender&t=42).', 'https://youtu.be/abcdef12345?t=42'],
  ['YouTube', 'https://www.youtube.com/watch?v=123&si=abc&list=abc&index=3#t=10', 'https://www.youtube.com/watch?v=123&list=abc&index=3#t=10'],
  ['Instagram', 'instagram.com/p/example/?igsh=abc&%75tm_source=app&img_index=2', 'https://instagram.com/p/example/?img_index=2'],
  ['Instagram', 'https://www.instagram.com/reel/DfFvOJZIhTB/?utm_source=ig_web_copy_link&xtok=example==&srtk=example==', 'https://www.instagram.com/reel/DfFvOJZIhTB/'],
  ['Instagram', 'https://www.instagram.com/p/DXcCiJIiG65/?utm_source=ig_web_copy_link&psln=example==&srtk=example==', 'https://www.instagram.com/p/DXcCiJIiG65/'],
  ['TikTok', 'https://www.tiktok.com/@creator/video/12345?_t=abc&_r=1&share_app_id=12&sender_device=pc', 'https://www.tiktok.com/@creator/video/12345'],
  ['Facebook', 'https://www.facebook.com/story.php?story_fbid=123&id=456&mibextid=abc&__cft__[0]=abc', 'https://www.facebook.com/story.php?story_fbid=123&id=456'],
  ['X / Twitter', 'https://x.com/creator/status/123?s=20&t=identifier', 'https://x.com/creator/status/123'],
  ['Reddit', 'https://www.reddit.com/r/example/comments/abc/a/?share_id=123&utm_medium=web', 'https://www.reddit.com/r/example/comments/abc/a/'],
  ['Threads', 'https://www.threads.com/@creator/post/123?xmt=abc', 'https://www.threads.com/@creator/post/123'],
  ['LinkedIn', 'https://www.linkedin.com/posts/example/?trackingId=123&rcm=abc', 'https://www.linkedin.com/posts/example/'],
  ['Pinterest', 'https://www.pinterest.com/pin/123456/?nic_v3=identifier', 'https://www.pinterest.com/pin/123456/'],
  ['Snapchat', 'https://www.snapchat.com/spotlight/abc?share_id=identifier', 'https://www.snapchat.com/spotlight/abc'],
];

for (const [platform, input, expected] of directCases) {
  test(platform + ' keeps the content address and removes known tracking', () => {
    assert.equal(clean(input).url, expected);
    assert.equal(clean(expected).url, expected);
  });
}

test('unwraps a link shim locally', () => {
  const direct = 'https://www.instagram.com/reel/example/?igsh=secret';
  assert.equal(clean('https://l.facebook.com/l.php?u=' + encodeURIComponent(direct)).url,
    'https://www.instagram.com/reel/example/');
});

test('keeps serialization of retained query parameters', () => {
  assert.equal(clean('https://example.org/?word=a%20b&flag&word=%7e&utm_medium=share').url,
    'https://example.org/?word=a%20b&flag&word=%7e');
});

test('flags opaque short links', () => {
  for (const url of ['https://vm.tiktok.com/code/', 'https://www.tiktok.com/t/code/',
    'https://www.facebook.com/share/r/code/', 'https://fb.watch/code/',
    'https://www.instagram.com/share/code/', 'https://www.reddit.com/r/example/s/code',
    'https://pin.it/code', 'https://t.snapchat.com/code', 'https://t.co/code']) {
    assert.equal(clean(url).kind, 'short', url);
  }
});

test('requires an identifiable destination after a redirect', () => {
  assert.equal(clean('https://www.tiktok.com/@creator/video/12345?_r=1', true).kind, 'clean');
  assert.equal(clean('https://www.facebook.com/login/?next=https://www.facebook.com/', true).kind, 'unresolved');
  assert.equal(clean('https://www.instagram.com/', true).kind, 'unresolved');
});

test('does not apply platform-specific rules to lookalike hosts', () => {
  assert.equal(clean('https://youtube.com.example.org/?t=1&si=secret').kind, 'unknown');
  assert.throws(() => clean('https://youtube.com:secret@example.org/watch?v=123'));
  assert.throws(() => clean('javascript:alert(1)'));
});
