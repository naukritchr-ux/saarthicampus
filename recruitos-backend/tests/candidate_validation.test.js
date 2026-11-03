const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { validateCandidatePayload } = require('../candidateValidation');

test('Candidate Apply Form 12 Mandatory Fields Validation Test Suite', async (t) => {
  const validBasePayload = {
    name: 'Aarav Sharma',
    email: 'aarav.sharma@example.edu',
    phone: '9876543210',
    college_id: 'col-12345',
    degree: 'B.Tech',
    branch: 'Computer Science',
    cgpa: 8.75,
    passing_year: 2026,
    tenth_percentage: 92.5,
    twelfth_percentage: 89.0,
    skills: ['React', 'Node.js', 'Python', 'SQL'],
    resume_url: 'https://example.com/resumes/1792768140_aarav_resume.pdf',
  };

  await t.test('1. Valid payload passes unit validation', () => {
    const res = validateCandidatePayload(validBasePayload);
    assert.equal(res.valid, true);
    assert.equal(res.cleanPhone, '9876543210');
    assert.deepEqual(res.skillsArray, ['React', 'Node.js', 'Python', 'SQL']);
  });

  await t.test('2. Missing or short Full Name is rejected', () => {
    const res1 = validateCandidatePayload({ ...validBasePayload, name: '' });
    assert.equal(res1.valid, false);
    assert.equal(res1.field, 'name');

    const res2 = validateCandidatePayload({ ...validBasePayload, name: 'A' });
    assert.equal(res2.valid, false);
    assert.equal(res2.field, 'name');
  });

  await t.test('3. Missing or invalid Email Address is rejected', () => {
    const res1 = validateCandidatePayload({ ...validBasePayload, email: '' });
    assert.equal(res1.valid, false);
    assert.equal(res1.field, 'email');

    const res2 = validateCandidatePayload({ ...validBasePayload, email: 'not-an-email' });
    assert.equal(res2.valid, false);
    assert.equal(res2.field, 'email');
  });

  await t.test('4. Missing or non-10-digit Mobile Number is rejected', () => {
    const res1 = validateCandidatePayload({ ...validBasePayload, phone: '' });
    assert.equal(res1.valid, false);
    assert.equal(res1.field, 'phone');

    const res2 = validateCandidatePayload({ ...validBasePayload, phone: '12345' });
    assert.equal(res2.valid, false);
    assert.equal(res2.field, 'phone');

    const res3 = validateCandidatePayload({ ...validBasePayload, phone: '9876543210123' });
    assert.equal(res3.valid, false);
    assert.equal(res3.field, 'phone');
  });

  await t.test('5. Missing College / University is rejected (neither college_id nor college_other provided)', () => {
    const res1 = validateCandidatePayload({ ...validBasePayload, college_id: '', college_other: '' });
    assert.equal(res1.valid, false);
    assert.equal(res1.field, 'college');

    // Manual college entry is accepted
    const res2 = validateCandidatePayload({ ...validBasePayload, college_id: '', college_other: 'National Institute of Tech' });
    assert.equal(res2.valid, true);
  });

  await t.test('6. Missing Degree is rejected', () => {
    const res = validateCandidatePayload({ ...validBasePayload, degree: '' });
    assert.equal(res.valid, false);
    assert.equal(res.field, 'degree');
  });

  await t.test('7. Missing Branch / Specialization is rejected', () => {
    const res = validateCandidatePayload({ ...validBasePayload, branch: '' });
    assert.equal(res.valid, false);
    assert.equal(res.field, 'branch');
  });

  await t.test('8. Missing or out-of-range CGPA / Percentage is rejected', () => {
    const res1 = validateCandidatePayload({ ...validBasePayload, cgpa: '' });
    assert.equal(res1.valid, false);
    assert.equal(res1.field, 'cgpa');

    const res2 = validateCandidatePayload({ ...validBasePayload, cgpa: 0 });
    assert.equal(res2.valid, false);
    assert.equal(res2.field, 'cgpa');

    const res3 = validateCandidatePayload({ ...validBasePayload, cgpa: 105 });
    assert.equal(res3.valid, false);
    assert.equal(res3.field, 'cgpa');
  });

  await t.test('9. Missing or out-of-range Passing Year is rejected', () => {
    const res1 = validateCandidatePayload({ ...validBasePayload, passing_year: '' });
    assert.equal(res1.valid, false);
    assert.equal(res1.field, 'passing_year');

    const res2 = validateCandidatePayload({ ...validBasePayload, passing_year: 1985 });
    assert.equal(res2.valid, false);
    assert.equal(res2.field, 'passing_year');

    const res3 = validateCandidatePayload({ ...validBasePayload, passing_year: 2050 });
    assert.equal(res3.valid, false);
    assert.equal(res3.field, 'passing_year');
  });

  await t.test('10. Missing or out-of-range 10th Percentage is rejected', () => {
    const res1 = validateCandidatePayload({ ...validBasePayload, tenth_percentage: '' });
    assert.equal(res1.valid, false);
    assert.equal(res1.field, 'tenth_percentage');

    const res2 = validateCandidatePayload({ ...validBasePayload, tenth_percentage: 0 });
    assert.equal(res2.valid, false);
    assert.equal(res2.field, 'tenth_percentage');

    const res3 = validateCandidatePayload({ ...validBasePayload, tenth_percentage: 101 });
    assert.equal(res3.valid, false);
    assert.equal(res3.field, 'tenth_percentage');
  });

  await t.test('11. Missing or out-of-range 12th / Diploma Percentage is rejected', () => {
    const res1 = validateCandidatePayload({ ...validBasePayload, twelfth_percentage: '' });
    assert.equal(res1.valid, false);
    assert.equal(res1.field, 'twelfth_percentage');

    const res2 = validateCandidatePayload({ ...validBasePayload, twelfth_percentage: 0 });
    assert.equal(res2.valid, false);
    assert.equal(res2.field, 'twelfth_percentage');

    const res3 = validateCandidatePayload({ ...validBasePayload, twelfth_percentage: 102 });
    assert.equal(res3.valid, false);
    assert.equal(res3.field, 'twelfth_percentage');
  });

  await t.test('12. Missing Technical / Domain Skills is rejected', () => {
    const res1 = validateCandidatePayload({ ...validBasePayload, skills: [] });
    assert.equal(res1.valid, false);
    assert.equal(res1.field, 'skills');

    const res2 = validateCandidatePayload({ ...validBasePayload, skills: '   ' });
    assert.equal(res2.valid, false);
    assert.equal(res2.field, 'skills');

    // Comma separated string is accepted
    const res3 = validateCandidatePayload({ ...validBasePayload, skills: 'Java, Spring Boot, MySQL' });
    assert.equal(res3.valid, true);
    assert.deepEqual(res3.skillsArray, ['Java', 'Spring Boot', 'MySQL']);
  });

  await t.test('13. Missing or invalid Resume PDF URL is rejected', () => {
    const res1 = validateCandidatePayload({ ...validBasePayload, resume_url: '' });
    assert.equal(res1.valid, false);
    assert.equal(res1.field, 'resume_url');

    const res2 = validateCandidatePayload({ ...validBasePayload, resume_url: 'https://example.com/file.docx' });
    assert.equal(res2.valid, false);
    assert.equal(res2.field, 'resume_url');
  });

  // HTTP Integration test with mocked Supabase
  await t.test('14. HTTP POST /api/candidates endpoint enforcement', async () => {
    const mockDb = [];
    const mockSupabase = {
      from: (table) => ({
        select: () => ({
          eq: (col, val) => ({
            maybeSingle: async () => {
              const found = mockDb.find((r) => r[col] === val);
              return { data: found || null, error: null };
            },
          }),
        }),
        insert: (rows) => ({
          select: () => ({
            single: async () => {
              const newRow = { id: `cand-${Date.now()}`, ...rows[0] };
              mockDb.push(newRow);
              return { data: newRow, error: null };
            },
          }),
        }),
        update: (updates) => ({
          eq: (col, val) => ({
            select: () => ({
              single: async () => {
                const idx = mockDb.findIndex((r) => r[col] === val);
                if (idx !== -1) {
                  mockDb[idx] = { ...mockDb[idx], ...updates };
                  return { data: mockDb[idx], error: null };
                }
                return { data: null, error: new Error('Not found') };
              },
            }),
          }),
        }),
      }),
    };

    const app = express();
    app.use(express.json());

    app.post('/api/candidates', async (req, res) => {
      const validation = validateCandidatePayload(req.body);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error, field: validation.field });
      }

      const {
        name, email, degree, branch, cgpa, passing_year,
        college_id, college_other, tenth_percentage, twelfth_percentage,
        resume_url, photo_url, active_backlogs, linkedin_url, github_url
      } = req.body;

      const payload = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: validation.cleanPhone,
        degree: degree.trim(),
        branch: branch.trim(),
        cgpa: Number(cgpa),
        passing_year: Number(passing_year),
        college_id: college_id || null,
        college_other: college_other || null,
        tenth_percentage: Number(tenth_percentage),
        twelfth_percentage: Number(twelfth_percentage),
        skills: validation.skillsArray,
        resume_url: resume_url.trim(),
        photo_url: photo_url || null,
        active_backlogs: Boolean(active_backlogs),
        linkedin_url: linkedin_url || null,
        github_url: github_url || null,
      };

      const { data: existing } = await mockSupabase
        .from('candidates')
        .select('id')
        .eq('email', payload.email)
        .maybeSingle();

      let candidate;
      if (existing) {
        const { data } = await mockSupabase
          .from('candidates')
          .update(payload)
          .eq('id', existing.id)
          .select()
          .single();
        candidate = data;
      } else {
        const { data } = await mockSupabase
          .from('candidates')
          .insert([payload])
          .select()
          .single();
        candidate = data;
      }

      return res.status(201).json({ success: true, candidate });
    });

    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      // Missing required field returns 400
      const badRes = await fetch(`${baseUrl}/api/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Aarav' }), // missing other 11 fields
      });
      assert.equal(badRes.status, 400);
      const badData = await badRes.json();
      assert.match(badData.error, /Email Address is required/i);

      // Complete valid payload returns 201
      const goodRes = await fetch(`${baseUrl}/api/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBasePayload),
      });
      assert.equal(goodRes.status, 201);
      const goodData = await goodRes.json();
      assert.equal(goodData.success, true);
      assert.equal(goodData.candidate.name, 'Aarav Sharma');
      assert.equal(goodData.candidate.email, 'aarav.sharma@example.edu');
      assert.equal(goodData.candidate.phone, '9876543210');
      assert.equal(goodData.candidate.cgpa, 8.75);
      assert.equal(goodData.candidate.passing_year, 2026);
      assert.equal(goodData.candidate.tenth_percentage, 92.5);
      assert.equal(goodData.candidate.twelfth_percentage, 89.0);
      assert.deepEqual(goodData.candidate.skills, ['React', 'Node.js', 'Python', 'SQL']);
    } finally {
      server.close();
    }
  });
});
