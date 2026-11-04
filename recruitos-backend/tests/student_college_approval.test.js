const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAuthMiddleware } = require('../authHelpers');

test('Student New College + Admin Approval Workflow Test Suite', async (t) => {
  // Test Data Fixtures
  const users = {
    'admin-token': { id: 'usr-admin', email: 'admin@talentcorner.in' },
    'cand-token': { id: 'usr-cand', email: 'student@campus.edu' },
  };

  const profiles = {
    'usr-admin': { id: 'usr-admin', name: 'Master Admin', role: 'admin', approved: true },
    'usr-cand': { id: 'usr-cand', name: 'Student Applicant', role: 'candidate', approved: true },
  };

  // Shared College Directory
  let colleges = {
    'col-1': {
      id: 'col-1',
      name: 'Indian Institute of Technology Bombay',
      city: 'Mumbai',
      state: 'Maharashtra',
      course: 'Engineering',
      institution_type: 'Engineering',
      status: 'Active',
      tpo: 'Dr. Placement Officer',
    },
    'col-2': {
      id: 'col-2',
      name: 'St. Xavier\'s College',
      city: 'Mumbai',
      state: 'Maharashtra',
      course: 'Arts & Science',
      institution_type: 'Arts & Science',
      status: 'Active',
      tpo: 'Fr. Principal',
    },
  };

  // Shared Coordinator Registrations Queue
  let registrations = {};

  // Candidates & Applications
  let candidates = {};
  let placementCoordinators = {};

  // Mock Supabase
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

      if (table === 'colleges') {
        return {
          select: () => ({
            ilike: (col, pattern) => {
              const clean = pattern.replace(/%/g, '').toLowerCase().trim();
              const matches = Object.values(colleges).filter((c) =>
                c[col]?.toLowerCase().includes(clean)
              );
              return {
                ilike: (col2, pattern2) => {
                  const clean2 = pattern2.replace(/%/g, '').toLowerCase().trim();
                  const matches2 = matches.filter((c) =>
                    c[col2]?.toLowerCase().includes(clean2)
                  );
                  return {
                    limit: () => Promise.resolve({ data: matches2, error: null }),
                    then: (resolve) => resolve({ data: matches2, error: null }),
                  };
                },
                limit: () => Promise.resolve({ data: matches, error: null }),
                then: (resolve) => resolve({ data: matches, error: null }),
              };
            },
            eq: (col, val) => ({
              single: async () => ({ data: colleges[val] || null, error: null }),
            }),
          }),
          insert: (rows) => ({
            select: () => ({
              single: async () => {
                const row = { id: `col-${Date.now()}-${Math.floor(Math.random() * 1000)}`, ...rows[0] };
                colleges[row.id] = row;
                return { data: row, error: null };
              },
            }),
          }),
        };
      }

      if (table === 'coordinator_registrations') {
        return {
          select: () => ({
            eq: (col, val) => {
              if (col === 'id') {
                return {
                  single: async () => ({ data: registrations[val] || null, error: null }),
                };
              }
              return {
                ilike: (col2, val2) => ({
                  limit: () => {
                    const list = Object.values(registrations).filter(
                      (r) => r[col] === val && r[col2]?.toLowerCase() === val2.toLowerCase()
                    );
                    return Promise.resolve({ data: list, error: null });
                  },
                  then: (resolve) => {
                    const list = Object.values(registrations).filter(
                      (r) => r[col] === val && r[col2]?.toLowerCase() === val2.toLowerCase()
                    );
                    return resolve({ data: list, error: null });
                  },
                }),
              };
            },
          }),
          insert: (rows) => ({
            select: () => ({
              single: async () => {
                const row = { id: `reg-${Date.now()}-${Math.floor(Math.random() * 1000)}`, ...rows[0] };
                registrations[row.id] = row;
                return { data: row, error: null };
              },
            }),
          }),
          update: (fields) => ({
            eq: (col, val) => ({
              select: () => ({
                single: async () => {
                  if (registrations[val]) {
                    Object.assign(registrations[val], fields);
                    return { data: registrations[val], error: null };
                  }
                  return { data: null, error: new Error('Registration not found') };
                },
              }),
            }),
          }),
        };
      }

      if (table === 'candidates') {
        return {
          select: () => ({
            eq: (col, val) => ({
              maybeSingle: async () => {
                const match = Object.values(candidates).find((c) => c[col] === val);
                return { data: match || null, error: null };
              },
            }),
          }),
          insert: (rows) => ({
            select: () => ({
              single: async () => {
                const row = { id: `cand-${Date.now()}-${Math.floor(Math.random() * 1000)}`, ...rows[0] };
                candidates[row.id] = row;
                return { data: row, error: null };
              },
            }),
          }),
          update: (fields) => ({
            is: (colIs, valIs) => ({
              ilike: (colLike, pattern) => {
                const clean = pattern.replace(/%/g, '').toLowerCase().trim();
                let count = 0;
                Object.values(candidates).forEach((c) => {
                  const isNullMatch = valIs === null ? c[colIs] === null : c[colIs] === valIs;
                  const likeMatch = c[colLike]?.toLowerCase() === clean;
                  if (isNullMatch && likeMatch) {
                    Object.assign(c, fields);
                    count++;
                  }
                });
                return Promise.resolve({ count, error: null });
              },
            }),
          }),
        };
      }

      if (table === 'placement_coordinators') {
        return {
          select: () => ({
            eq: () => ({
              or: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
          insert: (rows) => ({
            select: () => {
              const row = { id: `coord-${Date.now()}`, ...rows[0] };
              placementCoordinators[row.id] = row;
              return Promise.resolve({ data: [row], error: null });
            },
          }),
        };
      }

      return {
        select: () => Promise.resolve({ data: [], error: null }),
      };
    },
  };

  const { requireStaff } = createAuthMiddleware(mockSupabase);

  const app = express();
  app.use(express.json());

  // 1. POST /api/colleges/submit-pending route
  app.post('/api/colleges/submit-pending', async (req, res) => {
    try {
      const {
        college_name,
        city,
        state,
        category,
        website,
        student_name,
        student_email,
        student_phone,
      } = req.body || {};

      if (!college_name || typeof college_name !== 'string' || !college_name.trim()) {
        return res.status(400).json({ error: 'College name is required' });
      }
      const cleanCollegeName = college_name.trim().replace(/\s+/g, ' ');

      if (!city || typeof city !== 'string' || !city.trim()) {
        return res.status(400).json({ error: 'City is required' });
      }
      const cleanCity = city.trim().replace(/\s+/g, ' ');

      if (!state || typeof state !== 'string' || !state.trim()) {
        return res.status(400).json({ error: 'State is required' });
      }
      const cleanState = state.trim().replace(/\s+/g, ' ');

      // Check existing approved directory with city/state alignment
      const { data: approvedMatches } = await mockSupabase
        .from('colleges')
        .select('id, name, city, state, course, website')
        .ilike('name', cleanCollegeName);

      if (approvedMatches && approvedMatches.length > 0) {
        const matchingApproved = approvedMatches.find((c) => {
          const cCity = (c.city || '').trim().toLowerCase();
          const subCity = cleanCity.toLowerCase();
          const cState = (c.state || '').trim().toLowerCase();
          const subState = cleanState.toLowerCase();

          if (cCity && subCity && cCity !== subCity) return false;
          if (cState && subState && cState !== subState) return false;
          return true;
        });

        if (matchingApproved) {
          return res.status(200).json({
            message: 'College already exists in approved directory',
            is_approved: true,
            is_existing: true,
            college_id: matchingApproved.id,
            college: matchingApproved,
          });
        }
      }

      // Check existing pending queue with city/state alignment
      const { data: pendingMatches } = await mockSupabase
        .from('coordinator_registrations')
        .select('id, college_name, city, state, category, status, created_at')
        .eq('status', 'pending')
        .ilike('college_name', cleanCollegeName);

      if (pendingMatches && pendingMatches.length > 0) {
        const matchingPending = pendingMatches.find((r) => {
          const rCity = (r.city || '').trim().toLowerCase();
          const subCity = cleanCity.toLowerCase();
          const rState = (r.state || '').trim().toLowerCase();
          const subState = cleanState.toLowerCase();

          if (rCity && subCity && rCity !== subCity) return false;
          if (rState && subState && rState !== subState) return false;
          return true;
        });

        if (matchingPending) {
          return res.status(200).json({
            message: 'College is already pending admin review',
            is_duplicate: true,
            is_pending: true,
            registration_id: matchingPending.id,
            college_name: matchingPending.college_name,
            status: 'pending',
          });
        }
      }

      // Insert new pending registration
      const newRegPayload = {
        college_name: cleanCollegeName,
        city: cleanCity,
        state: cleanState,
        category: category?.trim() || 'Engineering',
        website: website?.trim() || null,
        full_name: student_name?.trim() || 'Student Applicant',
        official_email: student_email?.trim() || 'student@applicant.edu',
        phone: student_phone?.trim() || '0000000000',
        designation: 'Student Applicant',
        status: 'pending',
        remarks: 'Submitted via Student Apply Form (Pending Admin Approval)',
      };

      const { data: insertedReg, error: regError } = await mockSupabase
        .from('coordinator_registrations')
        .insert([newRegPayload])
        .select()
        .single();

      if (regError) {
        return res.status(500).json({ error: regError.message });
      }

      return res.status(201).json({
        message: 'College submitted for admin review successfully',
        is_new: true,
        registration_id: insertedReg.id,
        college_name: cleanCollegeName,
        status: 'pending',
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 2. Candidate Creation route with existing college protection
  app.post('/api/candidates', async (req, res) => {
    const { name, email, college_id, college_other } = req.body;
    const cleanEmail = email.trim().toLowerCase();

    const { data: existing } = await mockSupabase
      .from('candidates')
      .select('id, college_id')
      .eq('email', cleanEmail)
      .maybeSingle();

    let cand;
    if (existing) {
      // Preserve verified college_id if update does not specify a valid approved college_id
      const finalCollegeId = college_id || existing.college_id || null;
      Object.assign(existing, { name, college_id: finalCollegeId, college_other: college_other || null });
      cand = existing;
    } else {
      const { data: newCand } = await mockSupabase
        .from('candidates')
        .insert([{
          name,
          email: cleanEmail,
          college_id: college_id || null,
          college_other: college_other || null,
        }])
        .select()
        .single();
      cand = newCand;
    }

    return res.status(201).json({ candidate: cand });
  });

  // 3. Admin Approval route
  app.post('/api/placement-coordinators/registrations/:id/approve', requireStaff, async (req, res) => {
    const { id } = req.params;
    const { create_new } = req.body || {};

    const { data: reg } = await mockSupabase
      .from('coordinator_registrations')
      .select('*')
      .eq('id', id)
      .single();

    if (!reg) return res.status(404).json({ error: 'Registration not found' });

    const isStudentApplicant = reg.designation === 'Student' || reg.designation === 'Student Applicant';

    let finalCollegeId = null;
    if (create_new) {
      // Check if college directory already has an institution with this exact name and city
      const { data: existingExact } = await mockSupabase
        .from('colleges')
        .select('id')
        .ilike('name', reg.college_name.trim())
        .ilike('city', reg.city.trim());

      if (existingExact && existingExact.length > 0) {
        finalCollegeId = existingExact[0].id;
      } else {
        const newCollegeRow = {
          name: reg.college_name.trim(),
          city: reg.city.trim(),
          state: reg.state.trim(),
          course: reg.category.trim(),
          institution_type: reg.category.trim(),
          website: reg.website || null,
          tpo: isStudentApplicant ? null : (reg.full_name ? reg.full_name.trim() : null),
          status: 'Interested',
        };
        const { data: createdCollege } = await mockSupabase
          .from('colleges')
          .insert([newCollegeRow])
          .select()
          .single();
        finalCollegeId = createdCollege.id;
      }
    }

    if (!isStudentApplicant) {
      await mockSupabase.from('placement_coordinators').insert([{
        college_id: finalCollegeId,
        name: reg.full_name,
      }]);
    }

    await mockSupabase
      .from('coordinator_registrations')
      .update({ status: 'approved', matched_college_id: finalCollegeId })
      .eq('id', id)
      .select()
      .single();

    // Link candidates strictly where college_id IS NULL and college_other ILIKE reg.college_name
    await mockSupabase
      .from('candidates')
      .update({ college_id: finalCollegeId })
      .is('college_id', null)
      .ilike('college_other', reg.college_name.trim());

    return res.json({
      success: true,
      college_id: finalCollegeId,
      message: 'College approved and candidates updated successfully',
    });
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
    await t.test('1. Validation: Rejects missing mandatory fields in pending college', async () => {
      const res = await request('POST', '/api/colleges/submit-pending', {
        college_name: 'Incomplete College',
      });
      assert.strictEqual(res.status, 400);
      assert.match(res.body.error, /City is required/);
    });

    await t.test('2. Deduplication: Detects if college already exists in approved Directory', async () => {
      const res = await request('POST', '/api/colleges/submit-pending', {
        college_name: '  Indian   Institute   of Technology Bombay  ',
        city: 'Mumbai',
        state: 'Maharashtra',
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.is_approved, true);
      assert.strictEqual(res.body.college_id, 'col-1');
    });

    await t.test('3. Non-merging: Same generic name in DIFFERENT city is NOT merged', async () => {
      // St. Xavier's College in Mumbai is col-2. A submission for St. Xavier's College in Kolkata must NOT be merged!
      const res = await request('POST', '/api/colleges/submit-pending', {
        college_name: 'St. Xavier\'s College',
        city: 'Kolkata',
        state: 'West Bengal',
        category: 'Arts & Science',
        student_name: 'Siddharth Sen',
        student_email: 'siddharth@example.edu',
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.is_new, true);
      assert.notStrictEqual(res.body.college_id, 'col-2');
    });

    let pendingRegistrationId = null;
    const testCollegeName = 'Modern Institute of Engineering and Research';

    await t.test('4. Flow B: Student submits new college pending approval', async () => {
      const res = await request('POST', '/api/colleges/submit-pending', {
        college_name: `  ${testCollegeName}  `,
        city: 'Pune',
        state: 'Maharashtra',
        category: 'Engineering',
        student_name: 'Arjun Verma',
        student_email: 'arjun.verma@example.edu',
        student_phone: '9876543210',
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.is_new, true);
      assert.ok(res.body.registration_id);
      pendingRegistrationId = res.body.registration_id;

      // Pending queue verification
      const reg = registrations[pendingRegistrationId];
      assert.ok(reg);
      assert.strictEqual(reg.status, 'pending');
      assert.strictEqual(reg.designation, 'Student Applicant');
      assert.strictEqual(reg.college_name, testCollegeName);

      // Verify NOT added directly to approved directory
      const existsInColleges = Object.values(colleges).some((c) => c.name === testCollegeName);
      assert.strictEqual(existsInColleges, false, 'Pending college must NOT be in approved colleges directory');
    });

    await t.test('5. Deduplication: Second submission with whitespace variation prevents duplicate', async () => {
      const res = await request('POST', '/api/colleges/submit-pending', {
        college_name: 'Modern   Institute  of   Engineering   and   Research',
        city: 'Pune',
        state: 'Maharashtra',
        student_name: 'Priya Sharma',
        student_email: 'priya.sharma@example.edu',
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.is_duplicate, true);
      assert.strictEqual(res.body.registration_id, pendingRegistrationId);
    });

    let createdCandId = null;
    let unrelatedCandId = null;
    let existingApprovedCandId = null;

    await t.test('6. Candidate Setup: Create matching, unrelated, and existing-college candidates', async () => {
      // Cand 1: Submitting student with pending college
      const res1 = await request('POST', '/api/candidates', {
        name: 'Arjun Verma',
        email: 'arjun.verma@example.edu',
        college_id: null,
        college_other: testCollegeName,
      });
      assert.strictEqual(res1.status, 201);
      createdCandId = res1.body.candidate.id;

      // Cand 2: Unrelated candidate with different college but happens to have same contact email
      const res2 = await request('POST', '/api/candidates', {
        name: 'Unrelated Student',
        email: 'unrelated@example.edu',
        college_id: null,
        college_other: 'Delhi Technical University',
      });
      assert.strictEqual(res2.status, 201);
      unrelatedCandId = res2.body.candidate.id;

      // Cand 3: Candidate who already has a verified college_id pointing to col-1
      const res3 = await request('POST', '/api/candidates', {
        name: 'IIT Alum',
        email: 'iit.alum@example.edu',
        college_id: 'col-1',
        college_other: testCollegeName, // e.g. entered in text
      });
      assert.strictEqual(res3.status, 201);
      existingApprovedCandId = res3.body.candidate.id;
    });

    await t.test('7. Candidate Preservation: Existing verified college_id is not overwritten by null', async () => {
      // Re-apply by existing approved candidate with college_id: null
      const res = await request('POST', '/api/candidates', {
        name: 'IIT Alum Updated',
        email: 'iit.alum@example.edu',
        college_id: null,
        college_other: 'Pending New College',
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.candidate.college_id, 'col-1', 'Verified college_id must be preserved');
    });

    await t.test('8. Security: Non-admin users cannot approve pending college', async () => {
      const res = await request(
        'POST',
        `/api/placement-coordinators/registrations/${pendingRegistrationId}/approve`,
        { create_new: true },
        { Authorization: 'Bearer cand-token' }
      );
      assert.strictEqual(res.status, 403);
    });

    let approvedCollegeId = null;
    await t.test('9. Admin Approval: Approves college & links ONLY candidates with null college_id and matching college_other', async () => {
      const res = await request(
        'POST',
        `/api/placement-coordinators/registrations/${pendingRegistrationId}/approve`,
        { create_new: true },
        { Authorization: 'Bearer admin-token' }
      );
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.college_id);
      approvedCollegeId = res.body.college_id;

      // Verify college is now in approved directory
      const approvedCol = colleges[approvedCollegeId];
      assert.ok(approvedCol);
      assert.strictEqual(approvedCol.name, testCollegeName);
      assert.strictEqual(approvedCol.city, 'Pune');
      assert.strictEqual(approvedCol.state, 'Maharashtra');
      assert.strictEqual(approvedCol.tpo, null, 'Student applicant must not be marked as TPO');

      // Crucial: No placement coordinator created for student applicant
      const coordExists = Object.values(placementCoordinators).some((c) => c.name === 'Arjun Verma');
      assert.strictEqual(coordExists, false, 'No placement coordinator row created for student applicant');

      // Check Cand 1 (matching): updated
      const updatedCand1 = candidates[createdCandId];
      assert.strictEqual(updatedCand1.college_id, approvedCollegeId, 'Matching candidate college_id linked');

      // Check Cand 2 (unrelated): NOT updated
      const updatedCand2 = candidates[unrelatedCandId];
      assert.strictEqual(updatedCand2.college_id, null, 'Unrelated candidate college_id remains null');

      // Check Cand 3 (already had col-1): NEVER overwritten
      const updatedCand3 = candidates[existingApprovedCandId];
      assert.strictEqual(updatedCand3.college_id, 'col-1', 'Existing approved candidate college_id never overwritten');
    });

    await t.test('10. Directory Single Record: Duplicate approval call does not create duplicate college', async () => {
      const countBefore = Object.values(colleges).filter((c) => c.name === testCollegeName).length;
      assert.strictEqual(countBefore, 1);

      // Simulate an approval call for another registration that shares the exact same college
      const mockReg2 = {
        id: 'reg-second',
        college_name: testCollegeName,
        city: 'Pune',
        state: 'Maharashtra',
        category: 'Engineering',
        full_name: 'Second Coordinator',
        official_email: 'coord2@example.edu',
        designation: 'Student Applicant',
        status: 'pending',
      };
      registrations['reg-second'] = mockReg2;

      const res2 = await request(
        'POST',
        `/api/placement-coordinators/registrations/reg-second/approve`,
        { create_new: true },
        { Authorization: 'Bearer admin-token' }
      );
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res2.body.college_id, approvedCollegeId, 'Reuses existing college_id instead of duplicating');

      const countAfter = Object.values(colleges).filter((c) => c.name === testCollegeName).length;
      assert.strictEqual(countAfter, 1, 'College directory count remains exactly 1');
    });
  } finally {
    server.close();
  }
});
