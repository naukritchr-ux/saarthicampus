const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const path = require('node:path');
const { createAuthMiddleware } = require('../authHelpers');
const { moveApplicationStage } = require('../pipelineSync');

function createMockSupabase({ users = {}, profiles = {} } = {}) {
  return {
    auth: {
      getUser: async (token) => {
        if (!token || !users[token]) {
          return { data: { user: null }, error: new Error('Invalid JWT') };
        }
        return { data: { user: users[token] }, error: null };
      },
    },
    from: (table) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: (_col, val) => ({
              single: async () => {
                const profile = profiles[val] || null;
                return { data: profile, error: profile ? null : new Error('Profile not found') };
              },
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) };
    },
  };
}

test('Corporate GD Multi-Tenant Security & Isolation Test Suite', async (t) => {
  const companyA = '11111111-1111-1111-1111-111111111111';
  const companyB = '22222222-2222-2222-2222-222222222222';
  const jobA = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const jobB = 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const candidate1 = 'c1111111-1111-1111-1111-111111111111';
  const candidate2 = 'c2222222-2222-2222-2222-222222222222';

  const mockUsers = {
    'admin-jwt': { id: 'u-admin', email: 'admin@example.com' },
    'corp-a-jwt': { id: 'u-corp-a', email: 'corpA@example.com' },
    'corp-b-jwt': { id: 'u-corp-b', email: 'corpB@example.com' },
  };

  const mockProfiles = {
    'u-admin': { id: 'u-admin', role: 'admin', approved: true },
    'u-corp-a': { id: 'u-corp-a', role: 'corporate', company_id: companyA, approved: true },
    'u-corp-b': { id: 'u-corp-b', role: 'corporate', company_id: companyB, approved: true },
  };

  const mockSupabase = createMockSupabase({ users: mockUsers, profiles: mockProfiles });
  const { requireAdminOrCorporate, requireAdmin } = createAuthMiddleware(mockSupabase);

  const app = express();
  app.use(express.json());

  let sessions = [
    { id: 'sess-a', topic: 'Company A Discussion', job_id: jobA, company_id: companyA, status: 'Pending', mode: 'online' },
    { id: 'sess-b', topic: 'Company B Discussion', job_id: jobB, company_id: companyB, status: 'Pending', mode: 'online' },
    { id: 'sess-admin', topic: 'Platform Admin Session', job_id: null, company_id: null, status: 'Pending', mode: 'offline' }
  ];

  let participants = [
    { id: 'part-a1', session_id: 'sess-a', candidate_id: candidate1, candidate_name: 'Student 1', candidate_email: 's1@test.com', join_token: 'tok-a1', shortlisted: false },
    { id: 'part-b1', session_id: 'sess-b', candidate_id: candidate2, candidate_name: 'Student 2', candidate_email: 's2@test.com', join_token: 'tok-b1', shortlisted: false }
  ];

  let applications = [
    { id: 'app-a1', candidate_id: candidate1, job_id: jobA, stage: 'GD' },
    { id: 'app-b1', candidate_id: candidate1, job_id: jobB, stage: 'GD' }
  ];

  // Route: GET /api/gd/:id
  app.get('/api/gd/:id', requireAdminOrCorporate, (req, res) => {
    const session = sessions.find((s) => s.id === req.params.id);
    if (!session) return res.status(404).json({ error: 'GD session not found' });
    if (req.userProfile?.role === 'corporate' && session.company_id !== req.userProfile?.company_id) {
      return res.status(403).json({ error: 'Access denied. You do not own this GD session.' });
    }
    const parts = participants.filter((p) => p.session_id === session.id);
    res.json({ session, participants: parts });
  });

  // Route: POST /api/gd/:id/shortlist
  app.post('/api/gd/:id/shortlist', requireAdminOrCorporate, (req, res) => {
    const session = sessions.find((s) => s.id === req.params.id);
    if (!session) return res.status(404).json({ error: 'GD session not found' });
    if (req.userProfile?.role === 'corporate' && session.company_id !== req.userProfile?.company_id) {
      return res.status(403).json({ error: 'Access denied. You do not own this GD session.' });
    }
    const { participantIds } = req.body;
    const parts = participants.filter((p) => p.session_id === session.id && participantIds.includes(p.id));
    if (parts.length !== participantIds.length) {
      return res.status(400).json({ error: 'One or more participants do not belong to this session' });
    }
    parts.forEach((p) => {
      p.shortlisted = true;
      if (p.candidate_id && session.job_id) {
        applications.forEach((app) => {
          if (app.candidate_id === p.candidate_id && app.job_id === session.job_id && app.stage === 'GD') {
            app.stage = 'Interview';
          }
        });
      }
    });
    res.json({ success: true });
  });

  // Route: POST /api/gd/create
  app.post('/api/gd/create', requireAdminOrCorporate, (req, res) => {
    const { topic, job_id, candidates } = req.body;
    const userRole = req.userProfile?.role;
    const userCompanyId = req.userProfile?.company_id;

    if (!topic || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: 'Topic and candidates required' });
    }

    if (userRole === 'corporate') {
      if (!userCompanyId) return res.status(403).json({ error: 'Corporate profile is not linked to any company.' });
      if (!job_id) return res.status(400).json({ error: 'Job profile is required for Corporate GD sessions.' });
      if (job_id !== jobA) {
        return res.status(403).json({ error: 'Selected job profile does not belong to your company.' });
      }
    }
    res.json({ success: true, session: { topic, job_id, company_id: userRole === 'corporate' ? userCompanyId : null } });
  });

  // Route: Candidate Join
  app.get('/api/gd/:id/join', (req, res) => {
    const session = sessions.find((s) => s.id === req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'Ended') return res.status(410).json({ error: 'This GD session has already ended.' });
    const part = participants.find((p) => p.session_id === session.id && p.join_token === req.query.token);
    if (!part) return res.status(404).json({ error: 'Invalid link' });
    res.json({ participant: part });
  });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await t.test('TC-01: Admin can access all sessions across companies and platform-wide sessions', async () => {
      const resA = await fetch(`${baseUrl}/api/gd/sess-a`, {
        headers: { authorization: 'Bearer admin-jwt' }
      });
      assert.equal(resA.status, 200);

      const resAdmin = await fetch(`${baseUrl}/api/gd/sess-admin`, {
        headers: { authorization: 'Bearer admin-jwt' }
      });
      assert.equal(resAdmin.status, 200);
    });

    await t.test('TC-02: Corporate A can read only Company A session', async () => {
      const resA = await fetch(`${baseUrl}/api/gd/sess-a`, {
        headers: { authorization: 'Bearer corp-a-jwt' }
      });
      assert.equal(resA.status, 200);
      const data = await resA.json();
      assert.equal(data.session.company_id, companyA);
    });

    await t.test('TC-03: Corporate A is BLOCKED with 403 from reading Company B session', async () => {
      const resB = await fetch(`${baseUrl}/api/gd/sess-b`, {
        headers: { authorization: 'Bearer corp-a-jwt' }
      });
      assert.equal(resB.status, 403);
      const data = await resB.json();
      assert.match(data.error, /do not own this GD session/i);
    });

    await t.test('TC-04: Corporate A cannot create a GD session using Company B job', async () => {
      const res = await fetch(`${baseUrl}/api/gd/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer corp-a-jwt'
        },
        body: JSON.stringify({
          topic: 'Unauthorized Session',
          job_id: jobB,
          candidates: [{ id: candidate1, name: 'Student 1', email: 's1@test.com' }]
        })
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.match(data.error, /does not belong to your company/i);
    });

    await t.test('TC-05: Multi-Job Candidate Isolation: Shortlisting in Company A does NOT affect Company B application', async () => {
      assert.equal(applications.find((a) => a.id === 'app-a1').stage, 'GD');
      assert.equal(applications.find((a) => a.id === 'app-b1').stage, 'GD');

      const res = await fetch(`${baseUrl}/api/gd/sess-a/shortlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer corp-a-jwt'
        },
        body: JSON.stringify({ participantIds: ['part-a1'] })
      });
      assert.equal(res.status, 200);

      assert.equal(applications.find((a) => a.id === 'app-a1').stage, 'Interview');
      assert.equal(applications.find((a) => a.id === 'app-b1').stage, 'GD');
    });

    await t.test('TC-06: Candidate with valid token can join active session', async () => {
      const res = await fetch(`${baseUrl}/api/gd/sess-a/join?token=tok-a1`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.participant.candidate_name, 'Student 1');
    });

    await t.test('TC-07: Ended session rejects candidate joining with 410 Gone', async () => {
      sessions.find((s) => s.id === 'sess-a').status = 'Ended';
      const res = await fetch(`${baseUrl}/api/gd/sess-a/join?token=tok-a1`);
      assert.equal(res.status, 410);
      const data = await res.json();
      assert.match(data.error, /already ended/i);
    });

    await t.test('TC-08: Candidate token from Session A CANNOT join Session B (token hopping blocked)', async () => {
      // Participant from Session A tries to use their token on Session B
      const res = await fetch(`${baseUrl}/api/gd/sess-b/join?token=tok-a1`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.match(data.error, /invalid link/i);
    });

    await t.test('TC-09: Forged / random token is rejected with 404', async () => {
      const res = await fetch(`${baseUrl}/api/gd/sess-b/join?token=random-forged-token-xyz`);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.match(data.error, /invalid link/i);
    });

    await t.test('TC-10: pipelineSync moveApplicationStage multi-job protection vs single-job fallback', async () => {
      // Case 1: Candidate with multiple applications in stage, but no jobId passed -> MUST return null to prevent cross-job updates
      const mockDbMulti = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({
                data: [
                  { id: 'app-1', job_id: 'job-1', stage: 'GD' },
                  { id: 'app-2', job_id: 'job-2', stage: 'GD' }
                ],
                error: null
              })
            })
          })
        })
      };

      const resultMulti = await moveApplicationStage(mockDbMulti, {
        candidateId: 'cand-multi',
        jobId: null,
        fromStage: 'GD',
        toStage: 'Interview'
      });
      assert.equal(resultMulti, null, 'Must refuse to bulk-advance multiple applications without jobId');

      // Case 2: Candidate with exactly 1 application in stage, no jobId passed -> safely advances single application
      let updatedApps = [];
      const mockDbSingle = {
        from: (table) => ({
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({
                data: [{ id: 'app-only-1', job_id: 'job-1', stage: 'Aptitude' }],
                error: null
              })
            })
          }),
          update: (payload) => ({
            in: (_col, ids) => ({
              select: () => {
                updatedApps = ids;
                return Promise.resolve({ data: [{ id: 'app-only-1', ...payload }], error: null });
              }
            })
          })
        })
      };

      const resultSingle = await moveApplicationStage(mockDbSingle, {
        candidateId: 'cand-single',
        jobId: null,
        fromStage: 'Aptitude',
        toStage: 'GD'
      });
      assert.ok(resultSingle, 'Safely advances single application when candidate has only 1 job application');
      assert.deepEqual(updatedApps, ['app-only-1']);
    });

  } finally {
    server.close();
  }
});
