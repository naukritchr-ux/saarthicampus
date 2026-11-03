const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAuthMiddleware } = require('../authHelpers');

test('Admin Candidate Deletion & Cascade Isolation Test Suite', async (t) => {
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

  const db = {
    candidates: [
      { id: '11111111-1111-1111-1111-111111111111', name: 'Test Student', email: 'student@test.com' }
    ],
    applications: [
      { id: 'app-1', candidate_id: '11111111-1111-1111-1111-111111111111', job_id: 'job-1' }
    ],
    interviews: [
      { id: 'int-1', candidate_id: '11111111-1111-1111-1111-111111111111', job_id: 'job-1' }
    ],
    gd_participants: [
      { id: 'gd-1', candidate_id: '11111111-1111-1111-1111-111111111111' }
    ],
    offers: [
      { id: 'off-1', candidate_id: '11111111-1111-1111-1111-111111111111', job_id: 'job-1' }
    ],
    joining: [
      { id: 'join-1', candidate_id: '11111111-1111-1111-1111-111111111111' }
    ],
    aptitude_results: [
      { id: 'apt-1', candidate_id: '11111111-1111-1111-1111-111111111111' }
    ],
    saved_candidates: [
      { id: 'sc-1', candidate_id: '11111111-1111-1111-1111-111111111111' }
    ],
    ai_interview_invites: [
      { id: 'ai-1', candidate_id: '11111111-1111-1111-1111-111111111111' }
    ],
    profilesList: [
      { id: 'usr-cand', candidate_id: '11111111-1111-1111-1111-111111111111' }
    ]
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
    from: (tableName) => {
      if (tableName === 'profiles') {
        return {
          select: () => ({
            eq: (col, val) => ({
              single: async () => ({ data: profiles[val], error: null }),
              maybeSingle: async () => ({ data: profiles[val], error: null }),
            }),
          }),
          update: (updates) => ({
            eq: (col, val) => {
              db.profilesList.forEach(p => {
                if (p[col] === val) Object.assign(p, updates);
              });
              return Promise.resolve({ error: null });
            }
          })
        };
      }

      return {
        select: (cols, options) => ({
          eq: (col, val) => ({
            maybeSingle: async () => {
              const row = (db[tableName] || []).find(r => r[col] === val);
              return { data: row || null, error: null };
            },
            then: (resolve) => {
              const matched = (db[tableName] || []).filter(r => r[col] === val);
              if (options?.head && options?.count === 'exact') {
                return resolve({ count: matched.length, error: null });
              }
              return resolve({ data: matched, count: matched.length, error: null });
            }
          }),
        }),
        delete: () => ({
          eq: (col, val) => ({
            select: () => {
              const before = (db[tableName] || []).length;
              const deleted = (db[tableName] || []).filter(r => r[col] === val);
              db[tableName] = (db[tableName] || []).filter(r => r[col] !== val);
              return Promise.resolve({ data: deleted, error: null });
            },
            then: (resolve) => {
              db[tableName] = (db[tableName] || []).filter(r => r[col] !== val);
              return resolve({ error: null });
            }
          })
        })
      };
    }
  };

  const { requireAdmin } = createAuthMiddleware(mockSupabase);
  const app = express();
  app.use(express.json());

  // Mount candidate dependencies
  app.get('/api/admin/candidates/:id/dependencies', requireAdmin, async (req, res) => {
    const { id } = req.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ error: 'Invalid candidate ID format' });
    }

    const { data: candidate } = await mockSupabase.from('candidates').select('*').eq('id', id).maybeSingle();
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const appsRes = await mockSupabase.from('applications').select('id', { count: 'exact', head: true }).eq('candidate_id', id);
    const intsRes = await mockSupabase.from('interviews').select('id', { count: 'exact', head: true }).eq('candidate_id', id);

    return res.status(200).json({
      candidate,
      dependencies: {
        applications: appsRes.count || 0,
        interviews: intsRes.count || 0,
      }
    });
  });

  // Mount candidate delete
  app.delete('/api/admin/candidates/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ error: 'Invalid candidate ID format' });
    }

    const { data: candidate } = await mockSupabase.from('candidates').select('*').eq('id', id).maybeSingle();
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    const tables = ['interviews', 'gd_participants', 'offers', 'joining', 'aptitude_results', 'saved_candidates', 'ai_interview_invites', 'applications'];
    for (const tbl of tables) {
      await mockSupabase.from(tbl).delete().eq('candidate_id', id);
    }
    await mockSupabase.from('profiles').update({ candidate_id: null }).eq('candidate_id', id);
    await mockSupabase.from('candidates').delete().eq('id', id);

    return res.status(200).json({
      success: true,
      message: `Candidate "${candidate.name}" and all associated records deleted successfully.`,
      deletedCandidate: candidate
    });
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => {
    server.close();
  });

  // 1. Unauthenticated request is blocked with 401
  await t.test('1. Unauthenticated delete request is blocked with 401', async () => {
    const res = await fetch(`${baseUrl}/api/admin/candidates/11111111-1111-1111-1111-111111111111`, {
      method: 'DELETE',
    });
    assert.strictEqual(res.status, 401);
  });

  // 2. Candidate role is blocked with 403
  await t.test('2. Candidate role is blocked with 403 from deleting candidates', async () => {
    const res = await fetch(`${baseUrl}/api/admin/candidates/11111111-1111-1111-1111-111111111111`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer cand-token' },
    });
    assert.strictEqual(res.status, 403);
  });

  // 3. Corporate role is blocked with 403
  await t.test('3. Corporate role is blocked with 403 from deleting candidates', async () => {
    const res = await fetch(`${baseUrl}/api/admin/candidates/11111111-1111-1111-1111-111111111111`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer corp-token' },
    });
    assert.strictEqual(res.status, 403);
  });

  // 4. Invalid UUID format is rejected with 400
  await t.test('4. Invalid candidate ID format returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/admin/candidates/not-a-valid-uuid`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Invalid candidate ID format/);
  });

  // 5. Non-existent candidate returns 404
  await t.test('5. Non-existent candidate ID returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/admin/candidates/00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.match(data.error, /Candidate not found/);
  });

  // 6. Admin can query candidate dependencies
  await t.test('6. Admin can query candidate dependencies before deletion', async () => {
    const res = await fetch(`${baseUrl}/api/admin/candidates/11111111-1111-1111-1111-111111111111/dependencies`, {
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.dependencies.applications, 1);
    assert.strictEqual(data.dependencies.interviews, 1);
  });

  // 7. Admin can cascade delete candidate and clean all associated records
  await t.test('7. Admin can delete candidate and cascade across all tables', async () => {
    const res = await fetch(`${baseUrl}/api/admin/candidates/11111111-1111-1111-1111-111111111111`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer admin-token' },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.deletedCandidate.id, '11111111-1111-1111-1111-111111111111');

    // Verify all child tables were cleaned up
    assert.strictEqual(db.candidates.length, 0);
    assert.strictEqual(db.applications.length, 0);
    assert.strictEqual(db.interviews.length, 0);
    assert.strictEqual(db.gd_participants.length, 0);
    assert.strictEqual(db.offers.length, 0);
    assert.strictEqual(db.joining.length, 0);
    assert.strictEqual(db.aptitude_results.length, 0);
    assert.strictEqual(db.saved_candidates.length, 0);
    assert.strictEqual(db.ai_interview_invites.length, 0);
    assert.strictEqual(db.profilesList[0].candidate_id, null);
  });
});
