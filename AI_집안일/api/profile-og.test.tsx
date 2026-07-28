import { PassThrough } from 'node:stream';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describe, expect, it } from 'vitest';

import handler from './profile-og';

describe('profile OG image endpoint', () => {
  it('renders a 1200×630 PNG with cache headers', async () => {
    const chunks: Buffer[] = [];
    const headers = new Map<string, string>();
    const response = new PassThrough() as PassThrough & {
      setHeader(name: string, value: string): void;
      status(code: number): typeof response;
      json(body: unknown): void;
      statusCode: number;
    };

    response.statusCode = 200;
    response.setHeader = (name, value) => {
      headers.set(name.toLowerCase(), value);
    };
    response.status = (code) => {
      response.statusCode = code;
      return response;
    };
    response.json = (body) => {
      response.end(JSON.stringify(body));
    };
    response.on('data', (chunk: Buffer) => chunks.push(chunk));

    const finished = new Promise<void>((resolve, reject) => {
      response.once('finish', resolve);
      response.once('error', reject);
    });

    await handler(
      {
        method: 'GET',
        url: '/api/profile-og?n=%EC%A7%80%EC%88%98&c=25&t=kitchen',
        headers: {
          host: 'localhost:5174',
          'x-forwarded-proto': 'http',
        },
      } as unknown as VercelRequest,
      response as unknown as VercelResponse,
    );
    await finished;

    const image = Buffer.concat(chunks);

    expect(response.statusCode).toBe(200);
    expect(headers.get('content-type')).toBe('image/png');
    expect(headers.get('cache-control')).toContain('immutable');
    expect(image.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(image.readUInt32BE(16)).toBe(1200);
    expect(image.readUInt32BE(20)).toBe(630);
  });
});
