(function () {
  'use strict';

  const domains = {
    YouTube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
    Instagram: ['instagram.com', 'www.instagram.com', 'm.instagram.com'],
    TikTok: ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
    Facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'mbasic.facebook.com', 'fb.watch', 'fb.com', 'www.fb.com'],
    'X / Twitter': ['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'],
    Reddit: ['reddit.com', 'www.reddit.com', 'old.reddit.com', 'new.reddit.com', 'redd.it'],
    Threads: ['threads.com', 'www.threads.com', 'threads.net', 'www.threads.net'],
    LinkedIn: ['linkedin.com', 'www.linkedin.com'],
    Pinterest: ['pinterest.com', 'www.pinterest.com', 'pin.it'],
    Snapchat: ['snapchat.com', 'www.snapchat.com', 't.snapchat.com'],
  };
  const hosts = new Map(Object.entries(domains).flatMap(([name, list]) => list.map(host => [host, name])));
  const globalTracking = /^(utm_[a-z0-9_]+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|ttclid|twclid|igshid|mc_cid|mc_eid|li_fat_id)$/i;
  const tracking = {
    YouTube: /^(si|feature|app)$/i,
    Instagram: /^(igsh|ig_mid|ig_rid|ig_web_copy_link|xtok|psln|srtk)$/i,
    TikTok: /^(share[a-z0-9_]*|sender_[a-z0-9_]+|source|referer_url|referer_video_id|is_from_webapp|_r|_t|_d|_branch_match_id|_branch_referrer|sec_user_id|u_code|timestamp|social_share_type|user_id|preview_pb|checksum|ugbiz_name|region|mid)$/i,
    Facebook: /^(mibextid|ref|refid|refsrc|_rdc|_rdr|rdid|sfnsn|sfns|__cft__.*|__tn__|paipv|locale|extid|share_url)$/i,
    'X / Twitter': /^(s|t|ref_src|ref_url|cxt|mx)$/i,
    Reddit: /^(share_id|rdt|ref|ref_source|context_type)$/i,
    Threads: /^(xmt|igsh|ig_mid|share_id)$/i,
    LinkedIn: /^(trk|trackingid|lipi|midtoken|midsig|refid|originalsubdomain|shareactive|rcm)$/i,
    Pinterest: /^(nic_v[0-9]+|s|source|invite_code|share_id)$/i,
    Snapchat: /^(share_id|shareid|sender_web_id|sender_id|sid|source|sc_referrer)$/i,
  };
  const wrapperHosts = new Map([
    ['l.facebook.com', 'u'], ['lm.facebook.com', 'u'], ['l.instagram.com', 'u'],
    ['www.google.com', 'q'], ['google.com', 'q'],
  ]);

  function getUrl(value) {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('Enter a public HTTP or HTTPS link without login credentials.');
    }
    return url;
  }

  function extract(input) {
    const value = String(input).trim();
    const match = value.match(/https?:\/\/[^\s<>"`]+/i);
    if (match) {
      const url = match[0].replace(/[.,!?;”’]+$/u, '');
      return ['(', '[', '{'].reduce((clean, open, i) => {
        const close = [')', ']', '}'][i];
        while (clean.endsWith(close) && clean.split(close).length > clean.split(open).length) {
          clean = clean.slice(0, -1);
        }
        return clean;
      }, url);
    }
    if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#][^\s]*)?$/i.test(value)) return 'https://' + value;
    throw new Error('Paste a link or a message that contains one.');
  }

  function unwrap(url) {
    for (let hop = 0; hop < 4; hop++) {
      const field = wrapperHosts.get(url.hostname);
      const facebookShare = hosts.get(url.hostname) === 'Facebook' && /^\/sharer(?:\/sharer\.php)?\/?$/.test(url.pathname);
      const youtubeRedirect = hosts.get(url.hostname) === 'YouTube' && url.pathname === '/redirect';
      const googleRedirect = field === 'q' && url.pathname === '/url';
      const trackedWrapper = field === 'u' && url.pathname === '/l.php';
      if (!facebookShare && !youtubeRedirect && !googleRedirect && !trackedWrapper) return url;
      url = getUrl(url.searchParams.get(facebookShare ? 'u' : field || 'q') ||
        (googleRedirect && url.searchParams.get('url')) || '');
    }
    throw new Error('Open the destination and paste its direct link.');
  }

  function isShort(url, name) {
    const { hostname: host, pathname: path } = url;
    return ['vm.tiktok.com', 'vt.tiktok.com', 'fb.watch', 'pin.it', 't.snapchat.com', 't.co', 'lnkd.in'].includes(host) ||
      (name === 'TikTok' && /^\/t\//i.test(path)) ||
      (name === 'Facebook' && (host.endsWith('fb.com') || /^\/(share(?:\.php)?|sharer|flx\/warn)(\/|$)/i.test(path))) ||
      (name === 'Instagram' && /^\/share(?:\/|$)/i.test(path)) ||
      (name === 'Reddit' && /^\/r\/[^/]+\/s\//i.test(path)) ||
      (name === 'Snapchat' && /^\/t\//i.test(path));
  }

  function isContent(url, name) {
    const path = url.pathname;
    if (name === 'Facebook' && /^\/(?:story|permalink)\.php$/i.test(path)) {
      return Boolean(url.searchParams.get('story_fbid') && url.searchParams.get('id'));
    }
    return {
      TikTok: /^\/@[^/]+\/(?:video|photo)\/\d+\/?$|^\/v\/\d+(?:\.html)?\/?$/i,
      Facebook: /\/(?:posts|videos|reel|permalink)\/[^/]+\/?$|^\/(?:watch\/?|photo\.php|photo\/?|groups\/[^/]+)\/?$/i,
      Instagram: /^\/(?:reel|p|tv)\/[\w-]+\/?$/i,
      Reddit: /\/comments\/[a-z0-9]+(?:\/|$)/i,
      Pinterest: /^\/pin\/\d+\/?$/i,
      Snapchat: /^\/(?:spotlight|add)\/[\w.-]+\/?$/i,
      'X / Twitter': /^\/[^/]+\/status\/\d+(?:\/|$)/i,
      LinkedIn: /^\/(?:posts|feed\/update)\/[^/]+/i,
    }[name]?.test(path) || (name === 'Reddit' && url.hostname === 'redd.it' && /^\/[a-z0-9]+\/?$/i.test(path));
  }

  function contentFields(url, name) {
    if (name === 'Facebook' && /^\/(?:story|permalink)\.php$/i.test(url.pathname)) {
      return new Set(['story_fbid', 'id', 'comment_id', 'reply_comment_id']);
    }
    if (name === 'Instagram' && isContent(url, name)) return new Set(['img_index']);
    return null;
  }

  function clean(input, resolved = false) {
    const original = getUrl(extract(input));
    const url = unwrap(new URL(original.href));
    const name = url.port ? undefined : hosts.get(url.hostname);
    if ((!url.port && isShort(url, name)) || wrapperHosts.get(url.hostname) === 'u') {
      return { kind: 'short', url: url.href, name: name || 'Short link' };
    }
    if (resolved && !isContent(url, name)) return { kind: 'unresolved' };

    const fields = url.search.slice(1).split('&').filter(Boolean);
    const allowed = contentFields(url, name);
    const removed = [];
    const retained = fields.filter(field => {
      // Preserve the original serialization of every retained field.
      const key = new URLSearchParams(field).keys().next().value;
      if (allowed ? allowed.has(key) : !globalTracking.test(key) && !tracking[name]?.test(key)) return true;
      removed.push(key);
      return false;
    });
    if (removed.length) url.search = retained.length ? '?' + retained.join('&') : '';

    return {
      kind: name || removed.length || !resolved && url.href !== original.href ? 'clean' : 'unknown',
      url: url.href,
      name: name || url.hostname,
      removed,
      changed: resolved || url.href !== original.href,
    };
  }

  globalThis.PrivateLinks = { clean, isShort, platform: host => hosts.get(host) };
})();
