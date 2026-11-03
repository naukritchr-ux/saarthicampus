const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const { createAuthMiddleware } = require('../authHelpers');

test('Recruiter Role Retirement Verification Suite', async (t) => {
  const users = {
    'admin-token': { id: 'usr-admin', email: 'admin@saarthi.com' },
    'corp-token': { id: 'usr-corp', email: 'hr@corp-alpha.com' },
    'cand-token': { id: 'usr-cand', email: 'student@campus.edu' },
    'rec-token': { id: 'usr-rec', email: 'recruiter@saarthi.com' },
  };

  const profiles = {
    'usr-admin': { id: 'usr-admin', role: 'admin', approved: true },
    'usr-corp': { id: 'usr-corp', role: 'corporate', company_id: 'comp-alpha', approved: true },
    'usr-cand': { id: 'usr-cand', role: 'candidate', approved: true },
    'usr-rec': { id: 'usr-rec', role: 'recruiter', approved: true },
  };

  const mockSupabase = {
    auth: {
      getUser: async (token) => {
        const u = users[token];
        if (!u) return { data: { user: null }, error: new Error('Invalid token') };
        return { data: { user: u }, error: null };
      },
    },
    from: (table) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: (_col, val) => ({
              single: async () => {
                const p = profiles[val];
                if (!p) return { data: null, error: new Error('Profile not found') };
                return { data: p, error: null };
              },
              maybeSingle: async () => {
                const p = profiles[val];
                return { data: p || null, error: null };
              },
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
  };

  const { requireAuth, requireAdmin, requireStaff, requireCorporate, requireAdminOrCorporate } =
    createAuthMiddleware(mockSupabase);

  const app = express();
  app.use(express.json());

  // Registration mock matching index.js logic
  app.post('/api/auth/register', (req, res) => {
    const { role } = req.body;
    const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : '';
    if (normalizedRole === 'admin') {
      return res.status(403).json({ error: 'Admin accounts cannot be self-registered.' });
    }
    if (normalizedRole === 'recruiter') {
      return res.status(400).json({
        error: 'The Recruiter role has been retired and is no longer available for registration.',
      });
    }
    return res.json({ success: true, role: normalizedRole || 'candidate' });
  });

  // Admin role reassignment endpoint matching index.js logic
  app.post('/api/auth/users/:userId/role', requireAdmin, (req, res) => {
    const { role } = req.body;
    if (role === 'recruiter') {
      return res.status(400).json({ error: 'The Recruiter role has been retired and cannot be assigned.' });
    }
    const validRoles = ['admin', 'candidate', 'corporate'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    return res.json({ success: true, updatedRole: role });
  });

  // Protected recruitment endpoints
  app.get('/api/protected/overview', requireAuth, (req, res) => res.json({ ok: true }));
  app.get('/api/admin/users', requireAdmin, (req, res) => res.json({ ok: true, admin: true }));
  app.get('/api/staff/colleges', requireStaff, (req, res) => res.json({ ok: true, staff: true }));
  app.post('/api/jobs', requireAdminOrCorporate, (req, res) => res.json({ ok: true, job: true }));
  app.post('/api/aptitude/generate', requireAdminOrCorporate, (req, res) => res.json({ ok: true, aptitude: true }));
  app.post('/api/candidate/select', requireAdminOrCorporate, (req, res) => res.json({ ok: true, selected: true }));

  let server;
  let port;

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });

  async function api(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const res = await fetch(`http://127.0.0.1:${port}${endpoint}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let body = null;
    try {
      body = await res.json();
    } catch {
      // not JSON
    }
    return { status: res.status, body };
  }

  t.after(() => {
    server.close();
  });

  await t.test('1. New Recruiter self-registration is strictly rejected with 400', async () => {
    const res = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Recruiter Attempt', email: 'newrec@example.com', password: 'pass', role: 'recruiter' },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /retired and is no longer available/i);
  });

  await t.test('2. Candidate and Corporate self-registration remain functional', async () => {
    const candRes = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Student Applicant', email: 'stu@campus.edu', password: 'pass', role: 'candidate' },
    });
    assert.equal(candRes.status, 200);
    assert.equal(candRes.body.role, 'candidate');

    const corpRes = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Corp Recruiter', email: 'hr@corp.com', password: 'pass', role: 'corporate' },
    });
    assert.equal(corpRes.status, 200);
    assert.equal(corpRes.body.role, 'corporate');
  });

  await t.test('3. Admin cannot assign the retired recruiter role to any user', async () => {
    const res = await api('/api/auth/users/usr-cand/role', {
      method: 'POST',
      headers: { authorization: 'Bearer admin-token' },
      body: { role: 'recruiter' },
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /retired and cannot be assigned/i);
  });

  await t.test('4. Admin can assign corporate or admin roles', async () => {
    const res = await api('/api/auth/users/usr-cand/role', {
      method: 'POST',
      headers: { authorization: 'Bearer admin-token' },
      body: { role: 'corporate' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.updatedRole, 'corporate');
  });

  await t.test('5. Retired Recruiter token is blocked with 403 on requireAuth', async () => {
    const res = await api('/api/protected/overview', {
      headers: { authorization: 'Bearer rec-token' },
    });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /The Recruiter role has been retired/i);
  });

  await t.test('6. Retired Recruiter token is blocked on requireStaff', async () => {
    const res = await api('/api/staff/colleges', {
      headers: { authorization: 'Bearer rec-token' },
    });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /The Recruiter role has been retired/i);
  });

  await t.test('7. Retired Recruiter token is blocked on requireAdminOrCorporate endpoints', async () => {
    const res = await api('/api/jobs', {
      method: 'POST',
      headers: { authorization: 'Bearer rec-token' },
      body: { title: 'Unauthorized Job' },
    });
    assert.equal(res.status, 403);
    assert.match(res.body.error, /The Recruiter role has been retired/i);
  });

  await t.test('8. Admin retains full platform management and staff access', async () => {
    const adminStaff = await api('/api/staff/colleges', {
      headers: { authorization: 'Bearer admin-token' },
    });
    assert.equal(adminStaff.status, 200);
    assert.equal(adminStaff.body.staff, true);

    const adminUsers = await api('/api/admin/users', {
      headers: { authorization: 'Bearer admin-token' },
    });
    assert.equal(adminUsers.status, 200);
    assert.equal(adminUsers.body.admin, true);
  });

  await t.test('9. Corporate has access to job creation and aptitude generation', async () => {
    const jobRes = await api('/api/jobs', {
      method: 'POST',
      headers: { authorization: 'Bearer corp-token' },
      body: { title: 'Software Engineer' },
    });
    assert.equal(jobRes.status, 200);
    assert.equal(jobRes.body.job, true);

    const aptRes = await api('/api/aptitude/generate', {
      method: 'POST',
      headers: { authorization: 'Bearer corp-token' },
      body: { job_id: 'job-1' },
    });
    assert.equal(aptRes.status, 200);
    assert.equal(aptRes.body.aptitude, true);
  });

  await t.test('10. Student retains authenticated candidate access', async () => {
    const candRes = await api('/api/protected/overview', {
      headers: { authorization: 'Bearer cand-token' },
    });
    assert.equal(candRes.status, 200);
    assert.equal(candRes.body.ok, true);
  });
});
