const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAuthMiddleware } = require('../authHelpers');

test('Admin Dashboard Endpoint Security & Parameter Validation Test Suite', async (t) => {
  const users = {
    'admin-token': { id: 'usr-admin', email: 'admin@saarthi.com' },
    'corp-token': { id: 'usr-corp', email: 'hr@alpha.com' },
    'cand-token': { id: 'usr-cand', email: 'student@campus.edu' },
  };

  const profiles = {
    'usr-admin': { id: 'usr-admin', role: 'admin', approved: true },
    'usr-corp': { id: 'usr-corp', role: 'corporate', company_id: 'comp-alpha', approved: true },
    'usr-cand': { id: 'usr-cand', role: 'user', approved: true },
  };

  const mockSupabase = {
    auth: {
      getUser: async (token) => {
        if (users[token]) {
          return { data: { user: users[token] }, error: null };
        }
        return { data: { user: null }, error: new Error('Invalid token') };
      },
    },
    from: (table) => ({
      select: () => ({
        eq: (col, val) => ({
          single: async () => ({ data: profiles[val], error: null }),
          maybeSingle: async () => ({ data: profiles[val], error: null }),
        }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  };

  const { requireStaff } = createAuthMiddleware(mockSupabase);
  const app = express();
  app.use(express.json());

  const ALLOWED_ADMIN_SORT_FIELDS = new Set([
    'applications',
    'interviews',
    'created_at',
    'title',
    'company',
    'name',
    'registered',
    'selected',
    'joined',
  ]);
  const ALLOWED_ADMIN_ORDERS = new Set(['asc', 'desc']);

  app.get('/api/admin/dashboard', requireStaff, async (req, res) => {
    const { sort, order } = req.query;
    if (sort && !ALLOWED_ADMIN_SORT_FIELDS.has(String(sort).toLowerCase())) {
      return res.status(400).json({ error: 'Invalid sort field: ' + sort });
    }
    if (order && !ALLOWED_ADMIN_ORDERS.has(String(order).toLowerCase())) {
      return res.status(400).json({ error: 'Invalid sort order: ' + order });
    }

    res.json({
      candidates: [],
      jobs: [],
      companies: [],
      colleges: [],
      applications: [],
      offers: [],
      joining: [],
      interviews: [],
      gdSessions: [],
    });
  });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => server.close());

  // 1. Unauthenticated request to /api/admin/dashboard is blocked with 401
  await t.test('1. Unauthenticated request is blocked with 401', async () => {
    const res = await fetch(`${baseUrl}/api/admin/dashboard`);
    assert.strictEqual(res.status, 401);
  });

  // 2. Candidate role cannot access admin dashboard (blocked with 403)
  await t.test('2. Candidate role is blocked with 403', async () => {
    const res = await fetch(`${baseUrl}/api/admin/dashboard`, {
      headers: { Authorization: 'Bearer cand-token' },
    });
    assert.strictEqual(res.status, 403);
  });

  // 3. Corporate role cannot access admin dashboard (blocked with 403)
  await t.test('3. Corporate role is blocked with 403', async () => {
    const res = await fetch(`${baseUrl}/api/admin/dashboard`, {
      headers: { Authorization: 'Bearer corp-token' },
    });
    assert.strictEqual(res.status, 403);
  });

  // 4. Admin role has access with 200
  await t.test('4. Admin role has access with 200', async () => {
    const res = await fetch(`${baseUrl}/api/admin/dashboard`, {
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.candidates));
  });

  // 5. Invalid sort query parameter is rejected with 400
  await t.test('5. Invalid sort query parameter is rejected with 400', async () => {
    const res = await fetch(`${baseUrl}/api/admin/dashboard?sort=malicious_col%3BDROP+TABLE`, {
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Invalid sort field/);
  });

  // 6. Invalid order query parameter is rejected with 400
  await t.test('6. Invalid order query parameter is rejected with 400', async () => {
    const res = await fetch(`${baseUrl}/api/admin/dashboard?order=sideways`, {
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Invalid sort order/);
  });

  // 7. Whitelisted sort and order query parameters are accepted with 200
  await t.test('7. Whitelisted sort and order query parameters return 200', async () => {
    const res = await fetch(`${baseUrl}/api/admin/dashboard?sort=applications&order=desc`, {
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.strictEqual(res.status, 200);
  });
});
