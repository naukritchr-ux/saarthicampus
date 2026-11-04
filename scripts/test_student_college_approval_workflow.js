// =============================================================================
// Comprehensive Test Suite: Student Apply Form Add New College + Admin Approval Workflow
// File: scripts/test_student_college_approval_workflow.js
// =============================================================================

const path = require("path");
const base = "C:\\Users\\Pranay\\Downloads\\saarthicampus\\recruitos-backend";
const { createClient } = require(path.join(base, "node_modules", "@supabase", "supabase-js"));
require(path.join(base, "node_modules", "dotenv")).config({ path: path.join(base, ".env") });
const http = require("http");

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
  }
}

let testServerPort = 5000;

async function requestJson(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const options = {
      hostname: "127.0.0.1",
      port: testServerPort,
      path: urlPath,
      method: method,
      headers: {
        "Content-Type": "application/json",
        ...(dataString ? { "Content-Length": Buffer.byteLength(dataString) } : {}),
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let respBody = "";
      res.on("data", (chunk) => (respBody += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(respBody);
          resolve({ status: res.statusCode, body: json });
        } catch {
          resolve({ status: res.statusCode, body: respBody });
        }
      });
    });

    req.on("error", reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runWorkflowTests() {
  console.log("\n=================================================================");
  console.log("RUNNING STUDENT APPLY NEW COLLEGE + ADMIN APPROVAL WORKFLOW TEST");
  console.log("=================================================================\n");

  const testSuffix = Date.now();
  const testCollegeName = `Alpha Tech Test University ${testSuffix}`;
  const testCity = "Pune";
  const testState = "Maharashtra";
  const testCategory = "Engineering/Tech";
  const studentEmail = `student.test.${testSuffix}@example.com`;
  const studentName = `Student Tester ${testSuffix}`;
  const studentPhone = "9876543210";

  let createdRegistrationId = null;
  let createdCandidateId = null;
  let approvedCollegeId = null;
  let createdJobId = null;
  let createdAppId = null;

  try {
    // ---------------------------------------------------------------------------
    // Step 1: Existing Colleges Directory Inspection
    // ---------------------------------------------------------------------------
    console.log("--- Step 1: Shared Colleges Directory Inspection ---");
    const { data: initialColleges, error: colErr } = await sb
      .from("colleges")
      .select("id, name, city, state")
      .limit(5);

    assert(!colErr && initialColleges.length > 0, "Approved Colleges Directory is populated and readable");
    const sampleExistingCollege = initialColleges[0];
    console.log(`  Sample existing college: "${sampleExistingCollege.name}" (ID: ${sampleExistingCollege.id})`);

    // ---------------------------------------------------------------------------
    // Step 2: Flow A - Student Applies with Existing Approved College
    // ---------------------------------------------------------------------------
    console.log("\n--- Step 2: Flow A - Student Applies with Existing College ---");
    const studentExistingEmail = `student.existing.${testSuffix}@example.com`;
    const candExistingRes = await requestJson("POST", "/api/candidates", {
      name: "Existing College Student",
      email: studentExistingEmail,
      phone: "9876543211",
      degree: "B.Tech",
      branch: "Computer Science",
      cgpa: 8.5,
      passing_year: 2026,
      college_id: sampleExistingCollege.id,
      tenth_percentage: 90,
      twelfth_percentage: 88,
      skills: ["React", "Node.js"],
      resume_url: "https://example.com/resume.pdf",
    });

    assert(candExistingRes.status === 201, "Candidate with existing college created with 201 Created");
    assert(candExistingRes.body?.candidate?.college_id === sampleExistingCollege.id, "Candidate college_id points directly to approved college");
    const existingCandId = candExistingRes.body?.candidate?.id;

    // ---------------------------------------------------------------------------
    // Step 3: Flow B - Student Enters New College (Pending Approval)
    // ---------------------------------------------------------------------------
    console.log("\n--- Step 3: Flow B - Student Submits New College Pending Approval ---");

    // 3a. Call /api/colleges/submit-pending
    const pendingSubmitRes = await requestJson("POST", "/api/colleges/submit-pending", {
      college_name: testCollegeName,
      city: testCity,
      state: testState,
      category: testCategory,
      website: "https://alphatech.test.edu.in",
      student_name: studentName,
      student_email: studentEmail,
      student_phone: studentPhone,
    });

    assert(pendingSubmitRes.status === 201, "New college submitted pending admin approval with 201 Created");
    assert(pendingSubmitRes.body?.is_new === true, "Response confirms is_new: true");
    assert(Boolean(pendingSubmitRes.body?.registration_id), "Response returns registration_id");
    createdRegistrationId = pendingSubmitRes.body?.registration_id;

    // 3b. Verify new college is in coordinator_registrations with status = 'pending'
    const { data: regRow } = await sb
      .from("coordinator_registrations")
      .select("*")
      .eq("id", createdRegistrationId)
      .single();

    assert(regRow && regRow.status === "pending", "New college saved in coordinator_registrations with status = 'pending'");
    assert(regRow && regRow.college_name === testCollegeName, "College name matches submitted name");
    assert(regRow && regRow.designation === "Student Applicant", "Designation is 'Student Applicant'");
    assert(regRow && regRow.remarks.includes("Student Job Application"), "Remarks indicate source was Student Apply Form");

    // 3c. Verify new college is NOT in colleges directory yet
    const { data: earlyColCheck } = await sb
      .from("colleges")
      .select("id")
      .ilike("name", testCollegeName);

    assert(!earlyColCheck || earlyColCheck.length === 0, "Pending college is NOT directly added to the approved College Directory");

    // ---------------------------------------------------------------------------
    // Step 4: Deduplication Check - Second submission of same pending college
    // ---------------------------------------------------------------------------
    console.log("\n--- Step 4: Duplicate Submission Prevention ---");
    const duplicateSubmitRes = await requestJson("POST", "/api/colleges/submit-pending", {
      college_name: testCollegeName,
      city: testCity,
      state: testState,
      category: testCategory,
      student_name: "Another Student",
      student_email: `student2.${testSuffix}@example.com`,
    });

    assert(duplicateSubmitRes.status === 200, "Second submission for same pending college handled gracefully with 200 OK");
    assert(duplicateSubmitRes.body?.is_duplicate === true, "Second submission detected is_duplicate: true");
    assert(duplicateSubmitRes.body?.registration_id === createdRegistrationId, "Second submission reuses existing pending registration_id");

    // ---------------------------------------------------------------------------
    // Step 5: Student Submits Candidate & Application Immediately (Not Blocked)
    // ---------------------------------------------------------------------------
    console.log("\n--- Step 5: Student Submits Candidate & Job Application Immediately ---");
    const candPendingRes = await requestJson("POST", "/api/candidates", {
      name: studentName,
      email: studentEmail,
      phone: studentPhone,
      degree: "B.Tech",
      branch: "Information Technology",
      cgpa: 9.0,
      passing_year: 2026,
      college_id: null,
      college_other: testCollegeName,
      tenth_percentage: 92,
      twelfth_percentage: 91,
      skills: ["Python", "Machine Learning"],
      resume_url: "https://example.com/resume_alpha.pdf",
    });

    assert(candPendingRes.status === 201, "Candidate with pending college created immediately with 201 Created");
    assert(candPendingRes.body?.candidate?.college_id === null, "Candidate college_id is null pending approval");
    assert(candPendingRes.body?.candidate?.college_other === testCollegeName, "Candidate college_other stores pending college name");
    createdCandidateId = candPendingRes.body?.candidate?.id;

    // Pick an existing job profile to apply to
    const { data: existingJobs } = await sb
      .from("job_profiles")
      .select("id, title, company_id")
      .limit(1);

    assert(existingJobs && existingJobs.length > 0, "Found active Job Profile for application test");
    const testJob = existingJobs[0];
    createdJobId = testJob.id;

    // Student applies to job immediately
    const { data: testApp, error: appErr } = await sb
      .from("applications")
      .insert([
        {
          candidate_id: createdCandidateId,
          job_id: createdJobId,
          stage: "Resume Review",
        },
      ])
      .select()
      .single();

    assert(!appErr && Boolean(testApp?.id), "Student job application saved successfully without waiting for college approval");
    createdAppId = testApp.id;

    // ---------------------------------------------------------------------------
    // Step 6: Admin Approval Workflow
    // ---------------------------------------------------------------------------
    console.log("\n--- Step 6: Admin Approval Workflow ---");

    // Fetch an admin user for authentication token/profile
    const { data: adminProfiles } = await sb
      .from("profiles")
      .select("id, role, approved, name, email")
      .eq("role", "admin")
      .eq("approved", true)
      .limit(1);

    assert(adminProfiles && adminProfiles.length > 0, "Found active Admin user for approval test");
    const adminUser = adminProfiles[0];

    // Approve the registration via backend endpoint (as staff/admin)
    // Generate real staff auth session token for live test
    const linkRes = await sb.auth.admin.generateLink({
      type: "magiclink",
      email: adminUser.email,
    });
    const otp = linkRes.data?.properties?.email_otp;
    const sessionRes = await sb.auth.verifyOtp({
      email: adminUser.email,
      token: otp,
      type: "magiclink",
    });
    const adminToken = sessionRes.data?.session?.access_token;
    assert(Boolean(adminToken), "Successfully acquired valid Admin Supabase Auth token");

    const approveRes = await requestJson(
      "POST",
      `/api/placement-coordinators/registrations/${createdRegistrationId}/approve`,
      { create_new: true },
      { Authorization: `Bearer ${adminToken}` }
    );

    assert(approveRes.status === 200, "Admin approved registration successfully with 200 OK");
    assert(Boolean(approveRes.body?.college_id), "Approval response returns newly created college_id");
    approvedCollegeId = approveRes.body?.college_id;

    // ---------------------------------------------------------------------------
    // Step 7: Post-Approval Verifications
    // ---------------------------------------------------------------------------
    console.log("\n--- Step 7: Post-Approval Verifications ---");

    // 7a. College is now in colleges table (Directory)
    const { data: approvedCollege } = await sb
      .from("colleges")
      .select("*")
      .eq("id", approvedCollegeId)
      .single();

    assert(approvedCollege && approvedCollege.name === testCollegeName, "Approved college is now present in the shared College Directory");
    assert(approvedCollege && approvedCollege.city === testCity, "Approved college city is correctly saved");
    assert(approvedCollege && approvedCollege.state === testState, "Approved college state is correctly saved");
    assert(approvedCollege && approvedCollege.status === "Interested", "Approved college status set to Interested");

    // 7b. Candidate college_id is automatically updated to the approved college
    const { data: updatedCand } = await sb
      .from("candidates")
      .select("id, college_id, college_other")
      .eq("id", createdCandidateId)
      .single();

    assert(updatedCand && updatedCand.college_id === approvedCollegeId, "Candidate college_id is automatically updated to approved college_id");

    // 7c. Application join now resolves the approved college name
    const { data: appWithCollege } = await sb
      .from("applications")
      .select("id, candidates ( id, name, college_id, colleges ( id, name, city ) )")
      .eq("id", createdAppId)
      .single();

    assert(
      appWithCollege?.candidates?.colleges?.name === testCollegeName,
      "Job application resolves the approved college directory record cleanly"
    );

    // 7d. Public search returns the approved college
    const publicSearchRes = await requestJson(
      "GET",
      `/api/colleges/public-search?q=${encodeURIComponent(testCollegeName.slice(0, 15))}`
    );
    const searchFound = (publicSearchRes.body || []).some((c) => c.id === approvedCollegeId);
    assert(searchFound, "Approved college is now returned by public-search and selectable in Student Apply & Coordinator Register forms");
  } catch (err) {
    console.error("Test execution error:", err);
  } finally {
    console.log("\n--- Cleanup Test Artifacts ---");
    if (createdAppId) await sb.from("applications").delete().eq("id", createdAppId);
    if (createdCandidateId) await sb.from("candidates").delete().eq("id", createdCandidateId);
    if (createdRegistrationId) await sb.from("coordinator_registrations").delete().eq("id", createdRegistrationId);
    if (approvedCollegeId) {
      await sb.from("placement_coordinators").delete().eq("college_id", approvedCollegeId);
      await sb.from("colleges").delete().eq("id", approvedCollegeId);
    }
    console.log("  ✓ Cleanup completed.");
  }

  console.log("\n=================================================================");
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("=================================================================\n");

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

async function main() {
  const app = require(path.join(base, "index"));
  const server = app.listen(0);
  testServerPort = server.address().port;
  console.log(`Ephemeral test server running on port ${testServerPort}`);

  try {
    await runWorkflowTests();
  } finally {
    server.close();
  }
}

main();
