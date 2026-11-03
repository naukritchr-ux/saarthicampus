const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const { createAuthMiddleware } = require('../authHelpers');

test('Corporate Phase 2 Architecture & Isolation Test Suite', async (t) => {
  const users = {
    'admin-token': { id: 'usr-admin', email: 'admin@saarthi.com' },
    'corp-a-token': { id: 'usr-corp-a', email: 'hr@alpha.com' },
    'corp-b-token': { id: 'usr-corp-b', email: 'hr@beta.com' },
    'cand-token': { id: 'usr-cand', email: 'student@campus.edu' },
  };

  const profiles = {
    'usr-admin': { id: 'usr-admin', role: 'admin', approved: true },
    'usr-corp-a': { id: 'usr-corp-a', role: 'corporate', company_id: 'comp-alpha', approved: true },
    'usr-corp-b': { id: 'usr-corp-b', role: 'corporate', company_id: 'comp-beta', approved: true },
    'usr-cand': { id: 'usr-cand', role: 'candidate', approved: true },
  };

  const jobs = {
    'job-alpha': { id: 'job-alpha', title: 'Frontend Engineer', company: 'Alpha Inc', company_id: 'comp-alpha' },
    'job-beta': { id: 'job-beta', title: 'Backend Engineer', company: 'Beta Corp', company_id: 'comp-beta' },
  };

  const applications = {
    'app-alpha-1': { id: 'app-alpha-1', candidate_id: 'cand-1', job_id: 'job-alpha', stage: 'Interview', resume_score: 85 },
    'app-beta-1': { id: 'app-beta-1', candidate_id: 'cand-2', job_id: 'job-beta', stage: 'GD', resume_score: 90 },
  };

  const offers = {};

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
              maybeSingle: async () => ({ data: profiles[val] || null, error: null }),
            }),
          }),
        };
      }
      if (table === 'job_profiles') {
        return {
          select: () => ({
            eq: (_col, val) => {
              if (_col === 'id') {
                return {
                  maybeSingle: async () => ({ data: jobs[val] || null, error: null }),
                };
              }
              if (_col === 'company_id') {
                const list = Object.values(jobs).filter((j) => j.company_id === val);
                return Promise.resolve({ data: list, error: null });
              }
              return Promise.resolve({ data: [], error: null });
            },
          }),
        };
      }
      if (table === 'applications') {
        return {
          select: () => ({
            eq: (_col, val) => ({
              eq: (_col2, val2) => ({
                maybeSingle: async () => {
                  const match = Object.values(applications).find(
                    (a) => a[_col] === val && a[_col2] === val2
                  );
                  return { data: match || null, error: null };
                },
              }),
              maybeSingle: async () => ({ data: applications[val] || null, error: null }),
            }),
            in: (_col, valArray) => {
              const list = Object.values(applications).filter((a) => valArray.includes(a.job_id));
              return Promise.resolve({ data: list, error: null });
            },
          }),
          update: (fields) => ({
            eq: (_col, val) => ({
              select: () => ({
                single: async () => {
                  if (applications[val]) {
                    Object.assign(applications[val], fields);
                    return { data: applications[val], error: null };
                  }
                  return { data: null, error: new Error('Application not found') };
                },
              }),
            }),
          }),
        };
      }
      if (table === 'offers') {
        return {
          select: () => ({
            eq: (_col, val) => ({
              eq: (_col2, val2) => ({
                maybeSingle: async () => {
                  const match = Object.values(offers).find(
                    (o) => o[_col] === val && o[_col2] === val2
                  );
                  return { data: match || null, error: null };
                },
              }),
            }),
            in: (_col, valArray) => {
              const list = Object.values(offers).filter((o) => valArray.includes(o.job_id));
              return Promise.resolve({ data: list, error: null });
            },
          }),
          insert: (rows) => ({
            select: () => ({
              single: async () => {
                const row = { id: `off-${Date.now()}`, ...rows[0] };
                offers[row.id] = row;
                return { data: row, error: null };
              },
            }),
          }),
        };
      }
      if (table === 'interviews') {
        return {
          select: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
          insert: (rows) => ({
            select: () => ({
              single: async () => {
                const row = { id: `int-${Date.now()}`, ...rows[0] };
                return { data: row, error: null };
              },
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      };
    },
  };

  const { requireAuth, requireCorporate, requireAdminOrCorporate } = createAuthMiddleware(mockSupabase);

  const app = express();
  app.use(express.json());

  // Test route 1: GET /api/corporate/kpis
  app.get('/api/corporate/kpis', requireCorporate, async (req, res) => {
    const profile = req.userProfile;
    if (!profile.company_id) {
      return res.json({ jobsPosted: 0, applications: 0 });
    }
    const { data: jobList } = await mockSupabase.from('job_profiles').select('*').eq('company_id', profile.company_id);
    const jIds = (jobList || []).map((j) => j.id);
    const { data: appList } = await mockSupabase.from('applications').select('*').in('job_id', jIds);

    res.json({
      jobsPosted: jIds.length,
      activeJobs: jIds.length,
      applications: (appList || []).length,
      shortlisted: (appList || []).filter((a) => a.stage === 'Interview').length,
      interviews: (appList || []).filter((a) => a.stage === 'Interview').length,
      offers: 0,
      joined: 0,
      matchRate: 85,
      hiringConversion: 0,
    });
  });

  // Test route 2: POST /api/offers with multi-tenant company isolation
  app.post('/api/offers', requireAdminOrCorporate, async (req, res) => {
    const { candidate_id, job_id, ctc } = req.body;
    const profile = req.userProfile;

    if (!candidate_id || !job_id) {
      return res.status(400).json({ error: 'candidate_id and job_id are required' });
    }

    if (profile.role === 'corporate') {
      const { data: job } = await mockSupabase.from('job_profiles').select('*').eq('id', job_id).maybeSingle();
      if (!job || job.company_id !== profile.company_id) {
        return res.status(403).json({ error: 'Access denied: cannot create offer for another company job' });
      }
    }

    const { data: appRow } = await mockSupabase.from('applications').select('*').eq('candidate_id', candidate_id).eq('job_id', job_id).maybeSingle();
    if (!appRow) {
      return res.status(400).json({ error: 'Candidate has no active application for this job profile' });
    }

    const { data: existing } = await mockSupabase.from('offers').select('*').eq('candidate_id', candidate_id).eq('job_id', job_id).maybeSingle();
    if (existing) {
      return res.status(409).json({ error: 'Offer already exists' });
    }

    const { data: created } = await mockSupabase.from('offers').insert([{ candidate_id, job_id, ctc }]).select().single();
    return res.status(201).json(created);
  });

  // Test route 3: PATCH /api/applications/:id/stage with company isolation
  app.patch('/api/applications/:id/stage', requireAdminOrCorporate, async (req, res) => {
    const { id } = req.params;
    const { stage } = req.body;
    const profile = req.userProfile;

    const ALLOWED = ['Resume Review', 'Aptitude', 'GD', 'Interview', 'Selected', 'Joined', 'Rejected'];
    if (!stage || !ALLOWED.includes(stage)) {
      return res.status(400).json({ error: 'Invalid stage' });
    }

    const appRow = applications[id];
    if (!appRow) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (profile.role === 'corporate') {
      const job = jobs[appRow.job_id];
      if (!job || job.company_id !== profile.company_id) {
        return res.status(403).json({ error: 'Access denied: cannot move application of another company' });
      }
    }

    const { data: updated } = await mockSupabase.from('applications').update({ stage }).eq('id', id).select().single();
    res.json({ success: true, application: updated });
  });

  // Test route 4: POST /api/interviews with company isolation
  app.post('/api/interviews', requireAdminOrCorporate, async (req, res) => {
    const { candidate_id, job_id, type } = req.body;
    const profile = req.userProfile;

    if (!candidate_id || !job_id) {
      return res.status(400).json({ error: 'candidate_id and job_id required' });
    }

    if (profile.role === 'corporate') {
      const job = jobs[job_id];
      if (!job || job.company_id !== profile.company_id) {
        return res.status(403).json({ error: 'Access denied: cannot add interview for another company' });
      }
    }

    const { data } = await mockSupabase.from('interviews').insert([{ candidate_id, job_id, type }]).select().single();
    res.status(201).json(data);
  });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  t.after(() => server.close());

  // 1. Unauthenticated requests are blocked with 401
  await t.test('1. Unauthenticated request to corporate endpoints is blocked with 401', async () => {
    const res = await fetch(`${baseUrl}/api/corporate/kpis`);
    assert.strictEqual(res.status, 401);
  });

  // 2. Candidate role cannot access corporate KPIs (blocked with 403)
  await t.test('2. Candidate token cannot access corporate KPIs (blocked with 403)', async () => {
    const res = await fetch(`${baseUrl}/api/corporate/kpis`, {
      headers: { Authorization: 'Bearer cand-token' },
    });
    assert.strictEqual(res.status, 403);
  });

  // 3. Corporate A receives real KPI metrics for Company A
  await t.test('3. Corporate A receives real KPI metrics scoped to Company A', async () => {
    const res = await fetch(`${baseUrl}/api/corporate/kpis`, {
      headers: { Authorization: 'Bearer corp-a-token' },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.jobsPosted, 1);
    assert.strictEqual(body.applications, 1);
    assert.strictEqual(body.matchRate, 85);
  });

  // 4. Multi-Tenant Offer Isolation: Corporate A cannot create offer for Company B job
  await t.test('4. Corporate A is BLOCKED with 403 from creating offer for Company B job', async () => {
    const res = await fetch(`${baseUrl}/api/offers`, {
      method: 'POST',
      headers: { Authorization: 'Bearer corp-a-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_id: 'cand-2', job_id: 'job-beta', ctc: '5 LPA' }),
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.match(body.error, /Access denied/);
  });

  // 5. Corporate A can create offer for Company A job
  await t.test('5. Corporate A can create offer for candidate applied to Company A job', async () => {
    const res = await fetch(`${baseUrl}/api/offers`, {
      method: 'POST',
      headers: { Authorization: 'Bearer corp-a-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_id: 'cand-1', job_id: 'job-alpha', ctc: '6 LPA' }),
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.candidate_id, 'cand-1');
  });

  // 6. Duplicate offer is rejected with 409
  await t.test('6. Duplicate offer is rejected with 409 conflict', async () => {
    const res = await fetch(`${baseUrl}/api/offers`, {
      method: 'POST',
      headers: { Authorization: 'Bearer corp-a-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_id: 'cand-1', job_id: 'job-alpha', ctc: '6 LPA' }),
    });
    assert.strictEqual(res.status, 409);
  });

  // 7. Multi-Tenant Pipeline Isolation: Corporate A cannot move Company B application stage
  await t.test('7. Corporate A is BLOCKED with 403 from moving Company B application stage', async () => {
    const res = await fetch(`${baseUrl}/api/applications/app-beta-1/stage`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer corp-a-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'Selected' }),
    });
    assert.strictEqual(res.status, 403);
  });

  // 8. Corporate A can move Company A application stage
  await t.test('8. Corporate A can move Company A application stage', async () => {
    const res = await fetch(`${baseUrl}/api/applications/app-alpha-1/stage`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer corp-a-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'Selected' }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.application.stage, 'Selected');
  });

  // 9. Admin has platform-wide permission to move application stage
  await t.test('9. Admin has platform-wide permission to move any application stage', async () => {
    const res = await fetch(`${baseUrl}/api/applications/app-beta-1/stage`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'Selected' }),
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.application.stage, 'Selected');
  });

  // 10. Multi-Tenant Interview Isolation: Corporate A cannot add interview for Company B job
  await t.test('10. Corporate A is BLOCKED with 403 from adding interview for Company B job', async () => {
    const res = await fetch(`${baseUrl}/api/interviews`, {
      method: 'POST',
      headers: { Authorization: 'Bearer corp-a-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_id: 'cand-2', job_id: 'job-beta', type: 'Mock' }),
    });
    assert.strictEqual(res.status, 403);
  });
});
