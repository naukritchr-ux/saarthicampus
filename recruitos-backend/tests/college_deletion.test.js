const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAuthMiddleware } = require('../authHelpers');

test('Admin College Deletion Security & Dependency Protection Test Suite', async (t) => {
  const users = {
    'admin-token': { id: 'usr-admin', email: 'admin@saarthi.com' },
    'corp-token': { id: 'usr-corp', email: 'hr@alpha.com' },
    'cand-token': { id: 'usr-cand', email: 'student@campus.edu' },
  };

  const profiles = {
    'usr-admin': { id: 'usr-admin', role: 'admin', approved: true },
    'usr-corp': { id: 'usr-corp', role: 'corporate', company_id: 'comp-alpha', approved: true },
    'usr-cand': { id: 'usr-cand', role: 'candidate', approved: true },
  };

  let colleges = {
    '11111111-1111-1111-1111-111111111111': {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Unused Test College',
      city: 'Pune',
      state: 'Maharashtra',
    },
    '22222222-2222-2222-2222-222222222222': {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'College With Students',
      city: 'Mumbai',
      state: 'Maharashtra',
    },
    '33333333-3333-3333-3333-333333333333': {
      id: '33333333-3333-3333-3333-333333333333',
      name: 'College With Coordinators',
      city: 'Bangalore',
      state: 'Karnataka',
    },
    '44444444-4444-4444-4444-444444444444': {
      id: '44444444-4444-4444-4444-444444444444',
      name: 'College With Drives',
      city: 'Delhi',
      state: 'Delhi',
    },
  };

  let candidates = {
    'cand-1': { id: 'cand-1', name: 'John Doe', college_id: '22222222-2222-2222-2222-222222222222' },
  };

  let placementCoordinators = {
    'coord-1': { id: 'coord-1', name: 'Dr. Officer', college_id: '33333333-3333-3333-3333-333333333333' },
  };

  let coordinatorRegistrations = {};

  let drives = {
    'drive-1': { id: 'drive-1', title: 'Tech Drive', college_id: '44444444-4444-4444-4444-444444444444' },
  };

  let coordinatorHistory = {};

  const mockSupabase = {
    auth: {
      getUser: async (token) => {
        if (users[token]) {
          return { data: { user: users[token] }, error: null };
        }
        return { data: { user: null }, error: new Error('Invalid token') };
      },
    },
    from: (table) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: (_col, val) => ({
              single: async () => ({ data: profiles[val] || null, error: null }),
              maybeSingle: async () => ({ data: profiles[val] || null, error: null }),
            }),
          }),
        };
      }

      if (table === 'colleges') {
        return {
          select: () => ({
            eq: (_col, val) => ({
              maybeSingle: async () => ({ data: colleges[val] || null, error: null }),
            }),
          }),
          delete: () => ({
            eq: (_col, val) => {
              delete colleges[val];
              return Promise.resolve({ error: null });
            },
          }),
        };
      }

      if (table === 'candidates') {
        return {
          select: (_fields, opts) => ({
            eq: (_col, val) => {
              const matches = Object.values(candidates).filter((c) => c[_col] === val);
              return Promise.resolve({ count: matches.length, data: matches, error: null });
            },
          }),
        };
      }

      if (table === 'placement_coordinators') {
        return {
          select: (_fields, opts) => ({
            eq: (_col, val) => {
              const matches = Object.values(placementCoordinators).filter((c) => c[_col] === val);
              return Promise.resolve({ count: matches.length, data: matches, error: null });
            },
          }),
        };
      }

      if (table === 'coordinator_registrations') {
        return {
          select: (_fields, opts) => ({
            eq: (_col, val) => {
              const matches = Object.values(coordinatorRegistrations).filter((r) => r[_col] === val);
              return Promise.resolve({ count: matches.length, data: matches, error: null });
            },
          }),
        };
      }

      if (table === 'drives') {
        return {
          select: (_fields, opts) => ({
            eq: (_col, val) => {
              const matches = Object.values(drives).filter((d) => d[_col] === val);
              return Promise.resolve({ count: matches.length, data: matches, error: null });
            },
          }),
        };
      }

      if (table === 'placement_coordinator_history') {
        return {
          delete: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }

      return {
        select: () => Promise.resolve({ count: 0, data: [], error: null }),
      };
    },
  };

  const { requireAdmin } = createAuthMiddleware(mockSupabase);

  const app = express();
  app.use(express.json());

  app.get('/api/colleges/:id/dependencies', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return res.status(400).json({ error: 'Invalid college ID format. Must be a valid UUID.' });
      }

      const { data: college, error: fetchErr } = await mockSupabase
        .from('colleges')
        .select('id, name, city, state')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) return res.status(500).json({ error: fetchErr.message });
      if (!college) return res.status(404).json({ error: 'College not found' });

      const [candRes, coordRes, regRes, driveRes] = await Promise.all([
        mockSupabase.from('candidates').select('id', { count: 'exact', head: true }).eq('college_id', id),
        mockSupabase.from('placement_coordinators').select('id', { count: 'exact', head: true }).eq('college_id', id),
        mockSupabase.from('coordinator_registrations').select('id', { count: 'exact', head: true }).eq('matched_college_id', id),
        mockSupabase.from('drives').select('id', { count: 'exact', head: true }).eq('college_id', id),
      ]);

      const studentCount = candRes.count || 0;
      const coordinatorCount = coordRes.count || 0;
      const registrationCount = regRes.count || 0;
      const driveCount = driveRes.count || 0;
      const canDelete = studentCount === 0 && coordinatorCount === 0 && registrationCount === 0 && driveCount === 0;

      res.json({
        college_id: id,
        college_name: college.name,
        canDelete,
        counts: {
          candidates: studentCount,
          placement_coordinators: coordinatorCount,
          coordinator_registrations: registrationCount,
          drives: driveCount,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/colleges/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return res.status(400).json({ error: 'Invalid college ID format. Must be a valid UUID.' });
      }

      const { data: college, error: fetchErr } = await mockSupabase
        .from('colleges')
        .select('id, name, city, state')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) return res.status(500).json({ error: 'Failed to query college: ' + fetchErr.message });
      if (!college) return res.status(404).json({ error: 'College not found' });

      const [candRes, coordRes, regRes, driveRes] = await Promise.all([
        mockSupabase.from('candidates').select('id', { count: 'exact', head: true }).eq('college_id', id),
        mockSupabase.from('placement_coordinators').select('id', { count: 'exact', head: true }).eq('college_id', id),
        mockSupabase.from('coordinator_registrations').select('id', { count: 'exact', head: true }).eq('matched_college_id', id),
        mockSupabase.from('drives').select('id', { count: 'exact', head: true }).eq('college_id', id),
      ]);

      const studentCount = candRes.count || 0;
      const coordinatorCount = coordRes.count || 0;
      const registrationCount = regRes.count || 0;
      const driveCount = driveRes.count || 0;

      const blockingReasons = [];
      if (studentCount > 0) blockingReasons.push(`${studentCount} student / candidate record(s)`);
      if (coordinatorCount > 0) blockingReasons.push(`${coordinatorCount} placement coordinator(s)`);
      if (registrationCount > 0) blockingReasons.push(`${registrationCount} coordinator registration(s)`);
      if (driveCount > 0) blockingReasons.push(`${driveCount} campus drive(s)`);

      if (blockingReasons.length > 0) {
        return res.status(409).json({
          error: `Cannot delete "${college.name}" because it is currently linked to ${blockingReasons.join(', ')}. To protect student records and applications, this college cannot be deleted. Please reassign or unlink these records first.`,
          blocked: true,
          details: {
            candidates: studentCount,
            placement_coordinators: coordinatorCount,
            coordinator_registrations: registrationCount,
            drives: driveCount,
          },
        });
      }

      try {
        await mockSupabase.from('placement_coordinator_history').delete().eq('college_id', id);
      } catch (e) {
        // non-fatal
      }

      const { error: delErr } = await mockSupabase.from('colleges').delete().eq('id', id);
      if (delErr) return res.status(500).json({ error: 'Failed to delete college: ' + delErr.message });

      return res.json({
        success: true,
        message: `College "${college.name}" has been permanently deleted from the directory.`,
        deletedCollege: college,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  async function request(method, path, body = null, headers = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, body: data };
  }

  try {
    await t.test('1. Unauthenticated request to delete college is blocked with 401', async () => {
      const res = await request('DELETE', '/api/colleges/11111111-1111-1111-1111-111111111111');
      assert.strictEqual(res.status, 401);
    });

    await t.test('2. Candidate token cannot delete college (blocked with 403)', async () => {
      const res = await request(
        'DELETE',
        '/api/colleges/11111111-1111-1111-1111-111111111111',
        null,
        { Authorization: 'Bearer cand-token' }
      );
      assert.strictEqual(res.status, 403);
    });

    await t.test('3. Corporate token cannot delete college (blocked with 403)', async () => {
      const res = await request(
        'DELETE',
        '/api/colleges/11111111-1111-1111-1111-111111111111',
        null,
        { Authorization: 'Bearer corp-token' }
      );
      assert.strictEqual(res.status, 403);
    });

    await t.test('4. Invalid college UUID format is rejected with 400', async () => {
      const res = await request(
        'DELETE',
        '/api/colleges/invalid-id-not-uuid',
        null,
        { Authorization: 'Bearer admin-token' }
      );
      assert.strictEqual(res.status, 400);
      assert.match(res.body.error, /Invalid college ID format/);
    });

    await t.test('5. Non-existent college returns 404', async () => {
      const res = await request(
        'DELETE',
        '/api/colleges/00000000-0000-0000-0000-000000000000',
        null,
        { Authorization: 'Bearer admin-token' }
      );
      assert.strictEqual(res.status, 404);
      assert.match(res.body.error, /College not found/);
    });

    await t.test('6. College linked to student candidates is BLOCKED with 409 Conflict', async () => {
      const res = await request(
        'DELETE',
        '/api/colleges/22222222-2222-2222-2222-222222222222',
        null,
        { Authorization: 'Bearer admin-token' }
      );
      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.blocked, true);
      assert.match(res.body.error, /linked to 1 student \/ candidate record\(s\)/);
      // Verify college was NOT deleted
      assert.ok(colleges['22222222-2222-2222-2222-222222222222']);
      // Verify candidate was NOT cascade deleted
      assert.ok(candidates['cand-1']);
    });

    await t.test('7. College linked to placement coordinators is BLOCKED with 409 Conflict', async () => {
      const res = await request(
        'DELETE',
        '/api/colleges/33333333-3333-3333-3333-333333333333',
        null,
        { Authorization: 'Bearer admin-token' }
      );
      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.blocked, true);
      assert.match(res.body.error, /linked to 1 placement coordinator\(s\)/);
      assert.ok(colleges['33333333-3333-3333-3333-333333333333']);
      assert.ok(placementCoordinators['coord-1']);
    });

    await t.test('8. College linked to campus drives is BLOCKED with 409 Conflict', async () => {
      const res = await request(
        'DELETE',
        '/api/colleges/44444444-4444-4444-4444-444444444444',
        null,
        { Authorization: 'Bearer admin-token' }
      );
      assert.strictEqual(res.status, 409);
      assert.strictEqual(res.body.blocked, true);
      assert.match(res.body.error, /linked to 1 campus drive\(s\)/);
      assert.ok(colleges['44444444-4444-4444-4444-444444444444']);
    });

    await t.test('9. Dependencies endpoint returns accurate counts and canDelete: false for linked college', async () => {
      const res = await request(
        'GET',
        '/api/colleges/22222222-2222-2222-2222-222222222222/dependencies',
        null,
        { Authorization: 'Bearer admin-token' }
      );
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.canDelete, false);
      assert.strictEqual(res.body.counts.candidates, 1);
    });

    await t.test('10. Dependencies endpoint returns canDelete: true for unlinked college', async () => {
      const res = await request(
        'GET',
        '/api/colleges/11111111-1111-1111-1111-111111111111/dependencies',
        null,
        { Authorization: 'Bearer admin-token' }
      );
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.canDelete, true);
      assert.strictEqual(res.body.counts.candidates, 0);
    });

    await t.test('11. Unused / unlinked college is successfully deleted by Admin with 200 OK', async () => {
      const res = await request(
        'DELETE',
        '/api/colleges/11111111-1111-1111-1111-111111111111',
        null,
        { Authorization: 'Bearer admin-token' }
      );
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.match(res.body.message, /permanently deleted/);
      // Verify college is removed
      assert.strictEqual(colleges['11111111-1111-1111-1111-111111111111'], undefined);
    });
  } finally {
    server.close();
  }
});
