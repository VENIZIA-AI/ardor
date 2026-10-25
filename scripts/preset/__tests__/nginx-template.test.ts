import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BUILDERS = resolve(import.meta.dir, '../../../presets/app/files/.configs/builders');
const read = (file: string): string => readFileSync(join(BUILDERS, file), 'utf8');

/** The file without its comment lines: a directive that is only commented out is not there. */
const withoutComments = (text: string): string => {
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('#'))
    .join('\n');
};

const TEMPLATE = withoutComments(read('nginx.conf.template'));
const HEADERS = withoutComments(read('nginx-snippets/security-headers.conf'));
const API_PROXY = withoutComments(read('nginx-snippets/api-proxy.conf'));
const DOCKERFILE = read('Dockerfile');

/** Every `location` of the server, by its match, with the body between its braces (none is nested). */
const locations = (): Array<{ match: string; body: string }> => {
  return [...TEMPLATE.matchAll(/location\s+([^{]+?)\s*\{([^}]*)\}/g)].map((found) => {
    return { match: found[1]!, body: found[2]! };
  });
};

const location = (match: string): string => {
  const found = locations().find((candidate) => candidate.match === match);

  if (!found) {
    throw new Error(`[nginx-template.test] no location ${match}`);
  }

  return found.body;
};

describe('nginx.conf.template', () => {
  test('compresses text, JavaScript, CSS, JSON and SVG', () => {
    expect(TEMPLATE).toMatch(/^\s*gzip on;/m);
    expect(TEMPLATE).toMatch(/^\s*gzip_vary on;/m);

    const types = /gzip_types\s+([^;]+);/.exec(TEMPLATE)?.[1]?.split(/\s+/) ?? [];

    for (const type of [
      'text/plain',
      'text/css',
      'text/javascript',
      'application/javascript',
      'application/json',
      'image/svg+xml',
    ]) {
      expect(types).toContain(type);
    }
  });

  test('/health answers 200 from nginx alone', () => {
    const body = location('= /health');

    expect(body).toMatch(/return 200 "ok\\n";/);
    expect(body).not.toContain('proxy_pass');
    expect(body).toContain('access_log off;');
    expect(body).toContain('Cache-Control "no-store"');
  });

  test('the template holds no /api proxy of its own; it includes the rendered locations', () => {
    expect(TEMPLATE).not.toContain('proxy_pass');
    expect(TEMPLATE).not.toContain('API_UPSTREAM');
    expect(locations().map((candidate) => candidate.match)).not.toContain('/api/');
    expect(TEMPLATE).toContain('include /etc/nginx/conf.d/*.locations;');
  });

  test('every location that sets add_header includes the security headers again', () => {
    // nginx inherits add_header into a location only when the location sets none: a miss drops the headers.
    const withHeaders = locations().filter((candidate) => candidate.body.includes('add_header'));

    expect(withHeaders.length).toBeGreaterThanOrEqual(4);

    for (const candidate of withHeaders) {
      expect(candidate.body).toContain('include /etc/nginx/snippets/security-headers.conf;');
    }
    expect(TEMPLATE).toMatch(/^\s{2}include \/etc\/nginx\/snippets\/security-headers\.conf;/m);
  });

  test('keeps the cache rules', () => {
    expect(location('= /config.js')).toContain('add_header Cache-Control "no-store";');
    expect(location('= /config.js')).toContain('try_files $uri =404;');

    expect(location('/assets/')).toContain('expires 1y;');
    expect(location('/assets/')).toContain('add_header Cache-Control "public, immutable";');
    expect(location('/assets/')).toContain('try_files $uri =404;');

    expect(location('/')).toContain('add_header Cache-Control "no-cache";');
    expect(location('/')).toContain('try_files $uri $uri/ /index.html;');
  });
});

describe('security-headers.conf', () => {
  test('sends the three safe headers on every response, errors included', () => {
    expect(HEADERS).toContain('add_header X-Content-Type-Options "nosniff" always;');
    expect(HEADERS).toContain(
      'add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
    );
    expect(HEADERS).toContain('add_header X-Frame-Options "SAMEORIGIN" always;');
  });

  test('a Content-Security-Policy is only a commented example', () => {
    expect(HEADERS).not.toContain('Content-Security-Policy');
    expect(read('nginx-snippets/security-headers.conf')).toMatch(
      /^# add_header Content-Security-Policy /m,
    );
  });
});

describe('api-proxy.conf', () => {
  test('is the /api proxy, with the two variables the script fills in', () => {
    expect(API_PROXY).toContain('location /api/ {');
    expect(API_PROXY).toContain('proxy_pass $api_upstream;');
    expect(API_PROXY).toContain('set $api_upstream ${API_UPSTREAM};');
    expect(API_PROXY).toContain('resolver ${NGINX_LOCAL_RESOLVERS} valid=10s ipv6=off;');
  });
});

describe('Dockerfile', () => {
  test('copies the snippets and the executable proxy script into the image', () => {
    expect(DOCKERFILE).toMatch(
      /COPY --from=builder \S*\/\.configs\/builders\/nginx-snippets \/etc\/nginx\/snippets/,
    );
    expect(DOCKERFILE).toMatch(
      /COPY --from=builder --chmod=0755 \S*\/45-api-proxy\.sh \/docker-entrypoint\.d\/45-api-proxy\.sh/,
    );
  });

  test('keeps http://api:3000 as the default upstream', () => {
    expect(DOCKERFILE).toContain('ENV API_UPSTREAM=http://api:3000');
  });
});
