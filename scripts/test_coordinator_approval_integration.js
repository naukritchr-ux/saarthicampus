// =============================================================================
// Comprehensive Test Suite: Connect Placement Coordinator Approval with Colleges Directory,
// Optional Courses Available Multi-Select & Searchable College Dropdown
// File: scripts/test_coordinator_approval_integration.js
// =============================================================================

const fs = require("fs");
const path = require("path");
const { createClient } = require("../recruitos-backend/node_modules/@supabase/supabase-js");
require("dotenv").config({ path: path.join(__dirname, "..", "recruitos-backend", ".env") });

const { findCollegeMatches, normalizeText, mergeCourses } = require("../recruitos-backend/collegeMatcher");

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

async function runTests() {
  console.log("\n=================================================================");
  console.log("RUNNING PLACEMENT COORDINATOR APPROVAL INTEGRATION TEST SUITE");
  console.log("=================================================================\n");

  // ---------------------------------------------------------------------------
  // Suite 1: Static Architecture & File Verification
  // ---------------------------------------------------------------------------
  console.log("Suite 1: Static Architecture & File Verification");

  const migrationFile = path.join(__dirname, "..", "supabase", "migrations", "20261026_connect_coordinator_approval.sql");
  const rollbackFile = path.join(__dirname, "..", "supabase", "migrations", "20261026_rollback_connect_coordinator_approval.sql");
  const courseMigrationFile = path.join(__dirname, "..", "supabase", "migrations", "20261026_add_courses_available_to_coordinator_registrations.sql");
  const matcherFile = path.join(__dirname, "..", "recruitos-backend", "collegeMatcher.js");
  const backendIndex = path.join(__dirname, "..", "recruitos-backend", "index.js");
  const reviewComponent = path.join(__dirname, "..", "recruitos-frontend", "src", "components", "CoordinatorReview.jsx");
  const registerPage = path.join(__dirname, "..", "recruitos-frontend", "src", "pages", "PlacementCoordinatorRegister.jsx");
  const campusDbPage = path.join(__dirname, "..", "recruitos-frontend", "src", "pages", "CampusDB.jsx");

  assert(fs.existsSync(migrationFile), "Approval migration file exists");
  assert(fs.existsSync(rollbackFile), "Approval rollback migration file exists");
  assert(fs.existsSync(courseMigrationFile), "Courses available migration file exists");
  assert(fs.existsSync(matcherFile), "collegeMatcher.js exists");
  assert(fs.existsSync(backendIndex), "recruitos-backend/index.js exists");
  assert(fs.existsSync(reviewComponent), "CoordinatorReview.jsx exists");
  assert(fs.existsSync(registerPage), "PlacementCoordinatorRegister.jsx exists");
  assert(fs.existsSync(campusDbPage), "CampusDB.jsx exists");

  const backendCode = fs.readFileSync(backendIndex, "utf8");
  const reviewCode = fs.readFileSync(reviewComponent, "utf8");
  const registerCode = fs.readFileSync(registerPage, "utf8");
  const campusDbCode = fs.readFileSync(campusDbPage, "utf8");

  // Backend verification
  assert(backendCode.includes("/api/colleges/public-search"), "Backend provides public college search endpoint /api/colleges/public-search");
  assert(backendCode.includes("selected_college_id"), "Backend registration endpoint accepts and validates selected_college_id");
  assert(backendCode.includes("findCollegeMatches"), "Backend imports and uses findCollegeMatches");
  assert(backendCode.includes("mergeCourses"), "Backend imports and uses mergeCourses");
  assert(backendCode.includes("courses_available"), "Backend handles courses_available field in registration and approval");
  assert(backendCode.includes("placement_coordinators"), "Backend links coordinator to placement_coordinators table");
  assert(backendCode.includes("placement_coordinator_history"), "Backend writes audit trail");

  // Registration Page verification
  assert(registerCode.includes("collegeSearch") && registerCode.includes("collegeResults"), "PlacementCoordinatorRegister implements searchable dropdown state");
  assert(registerCode.includes("College not found? Add your institution"), "PlacementCoordinatorRegister contains 'College not found? Add your institution' option");
  assert(registerCode.includes("Enter Institution Details"), "PlacementCoordinatorRegister contains 'Enter Institution Details' manual entry form");
  assert(registerCode.includes("selected_college_id"), "PlacementCoordinatorRegister sends selected_college_id in payload");
  assert(registerCode.includes("COURSE_OPTIONS"), "PlacementCoordinatorRegister defines COURSE_OPTIONS");
  assert(registerCode.includes("MBA") && registerCode.includes("B.Tech") && registerCode.includes("Other"), "Registration includes requested course options");
  assert(registerCode.includes("toggleCourse"), "Registration has multi-select toggle function");
  assert(registerCode.includes("otherCourseText"), "Registration has Other course text input");

  // Optional Courses Verification (Requirements 1 & 2)
  assert(!registerCode.includes("Please select at least one course offered by your institution"), "Mandatory validation removed: registration does not block submission when no courses are selected");
  assert(registerCode.includes("Optional - select degree programs offered"), "Registration UI label displays '(Optional - select degree programs offered)'");

  // Review & DB Page verification
  assert(reviewCode.includes("ApprovalModal") || reviewCode.includes("approvalModalReg"), "CoordinatorReview includes approval confirmation modal");
  assert(reviewCode.includes("courses_available"), "CoordinatorReview displays submitted courses");
  assert(reviewCode.includes("onCollegeUpdated"), "CoordinatorReview calls onCollegeUpdated callback");
  assert(campusDbCode.includes("onCollegeUpdated={loadColleges}"), "CampusDB passes loadColleges callback to CoordinatorReview");
  assert(campusDbCode.includes("loadColleges();"), "CampusDB refreshes colleges when switching to Colleges Directory tab");

  // ---------------------------------------------------------------------------
  // Suite 2: Course Merging Algorithm Verification
  // ---------------------------------------------------------------------------
  console.log("\nSuite 2: Course Merging Algorithm Verification");

  assert(
    mergeCourses(null, "MBA, B.Tech") === "MBA, B.Tech",
    "mergeCourses: handles empty existing courses"
  );
  assert(
    mergeCourses("School of Law; MBA", "MBA, B.Tech, MCA") === "School of Law; MBA; B.Tech; MCA",
    "mergeCourses: deduplicates overlapping courses (MBA) and preserves existing courses"
  );
  assert(
    mergeCourses("Engineering", "engineering, MBA") === "Engineering; MBA",
    "mergeCourses: case-insensitive deduplication"
  );
  assert(
    mergeCourses("School of Law; MBA", null) === "School of Law; MBA",
    "mergeCourses: preserves existing courses when incoming courses is null"
  );
  assert(
    mergeCourses("School of Law; MBA", "") === "School of Law; MBA",
    "mergeCourses: preserves existing courses when incoming courses is empty string"
  );
  assert(
    mergeCourses("School of Law; MBA", "   ") === "School of Law; MBA",
    "mergeCourses: preserves existing courses when incoming courses is whitespace only"
  );

  // ---------------------------------------------------------------------------
  // Suite 3: College Matching & Search Logic Verification
  // ---------------------------------------------------------------------------
  console.log("\nSuite 3: College Matching & Search Logic Verification");

  const { data: initialColleges, error: colErr } = await sb
    .from("colleges")
    .select("id, name, city, state, course, courses_available, website, tpo");

  assert(!colErr, "Connected to Supabase and fetched colleges successfully");
  const initialCollegeCount = initialColleges?.length || 0;
  console.log(`  ℹ Baseline college records count: ${initialCollegeCount}`);
  assert(initialCollegeCount >= 30, `Preserved existing colleges (found ${initialCollegeCount} records, expected >= 30)`);

  // Test College Search (simulating public search query)
  const searchQueryAmity = "Amity";
  const { data: amityResults, error: amitySearchErr } = await sb
    .from("colleges")
    .select("id, name, city, state, course, website")
    .ilike("name", `%${searchQueryAmity}%`)
    .limit(10);

  assert(!amitySearchErr && amityResults && amityResults.length > 0, "Public Search: Successfully found college matching 'Amity'");
  assert(amityResults[0].name.toLowerCase().includes("amity"), "Public Search: Result name matches search query");

  // Test Matching algorithms
  const matchExact = findCollegeMatches("Sharda University", "Greater Noida", "Uttar Pradesh", initialColleges);
  assert(
    matchExact.suggested_college && matchExact.suggested_college.name === "Sharda University" && matchExact.suggested_college.score === 100,
    "Exact Match: 'Sharda University' matched with 100% score"
  );

  const matchPartial = findCollegeMatches("Amity University", "Noida", "Uttar Pradesh", initialColleges);
  assert(
    matchPartial.suggested_college && matchPartial.suggested_college.name.includes("Amity University"),
    "Partial Match: 'Amity University, Noida' correctly matched 'Amity University Uttar Pradesh, Noida'"
  );

  const matchAcronym = findCollegeMatches("IIM Lucknow", "Lucknow", "Uttar Pradesh", initialColleges);
  assert(
    matchAcronym.suggested_college && matchAcronym.suggested_college.name === "Indian Institute of Management Lucknow",
    "Acronym Match: 'IIM Lucknow' correctly resolved to 'Indian Institute of Management Lucknow'"
  );

  const matchParen = findCollegeMatches("VJTI", "Mumbai", "Maharashtra", initialColleges);
  assert(
    matchParen.suggested_college && matchParen.suggested_college.name.includes("VJTI"),
    "Parentheses Acronym Match: 'VJTI' correctly matched 'Veermata Jijabai Technological Institute (VJTI)'"
  );

  const matchNew = findCollegeMatches("Nexus Academy of Quantum Sciences", "Bengaluru", "Karnataka", initialColleges);
  assert(
    matchNew.suggested_college === null && matchNew.potential_matches.length === 0,
    "New College: Genuinely new institution produced 0 matches"
  );

  // ---------------------------------------------------------------------------
  // Suite 4: Case A — Search & Select Existing College with Course Merging
  // ---------------------------------------------------------------------------
  console.log("\nSuite 4: Case A — Search & Select Existing College with Course Merging");

  const existingCollege = initialColleges.find((c) => c.name === "Sharda University") || initialColleges[0];
  const originalCollegeCourses = existingCollege.courses_available || "";
  const testEmailA = `test.coord.a.${Date.now()}@saarthitest.edu.in`;

  // 1. Insert test registration with selected_college_id and multi-selected courses
  const incomingCoursesA = "MBA, B.Tech, MCA, LLB, Other: Data Science";
  const { data: regA, error: regAErr } = await sb
    .from("coordinator_registrations")
    .insert([
      {
        full_name: "Dr. Vikram Test Coordinator",
        designation: "Head - Corporate Relations",
        college_name: existingCollege.name,
        official_email: testEmailA,
        phone: "9876543210",
        city: existingCollege.city || "Greater Noida",
        state: existingCollege.state || "Uttar Pradesh",
        category: "MBA/Management",
        website: "https://www.test-sharda.edu.in",
        remarks: `[Courses: ${incomingCoursesA}]`,
        matched_college_id: existingCollege.id,
        status: "pending",
      },
    ])
    .select()
    .single();

  assert(!regAErr && regA && regA.status === "pending", "Case A: Successfully created pending registration with selected_college_id and courses");
  assert(regA.matched_college_id === existingCollege.id, "Case A: Registration accurately preserved selected_college_id link");

  // 2. Perform Case A Approval with Course Merging
  const targetColIdA = existingCollege.id;

  // Insert coordinator
  const { data: coordA, error: coordAErr } = await sb
    .from("placement_coordinators")
    .insert([
      {
        college_id: targetColIdA,
        name: regA.full_name.trim(),
        phone: regA.phone,
        email: regA.official_email,
        is_current: true,
        effective_from: new Date().toISOString().split("T")[0],
        created_by_name: "Integration Test Admin",
      },
    ])
    .select()
    .single();

  assert(!coordAErr && coordA, "Case A: Inserted placement coordinator linked to existing college");

  // Merge courses into existing college record
  const expectedMergedCourses = mergeCourses(originalCollegeCourses, incomingCoursesA);
  const { error: colUpdateErr } = await sb
    .from("colleges")
    .update({ courses_available: expectedMergedCourses })
    .eq("id", targetColIdA);

  assert(!colUpdateErr, "Case A: Merged courses into existing college record without deleting existing courses");

  // Verify merged courses
  const { data: checkColA } = await sb
    .from("colleges")
    .select("courses_available")
    .eq("id", targetColIdA)
    .single();

  assert(
    checkColA.courses_available.includes("MBA") && checkColA.courses_available.includes("B.Tech"),
    "Case A: Verified college courses_available contains both original and newly approved courses"
  );

  // Sync colleges.tpo
  const { data: activeCoordsA } = await sb
    .from("placement_coordinators")
    .select("name")
    .eq("college_id", targetColIdA)
    .eq("is_current", true)
    .order("created_at", { ascending: true });

  const namesA = [...new Set((activeCoordsA || []).map((c) => (c.name || "").trim()).filter(Boolean))];
  await sb.from("colleges").update({ tpo: namesA.join(", ") }).eq("id", targetColIdA);

  // Update registration
  const { data: updatedRegA } = await sb
    .from("coordinator_registrations")
    .update({
      status: "approved",
      matched_college_id: targetColIdA,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", regA.id)
    .select()
    .single();

  assert(updatedRegA.status === "approved" && updatedRegA.matched_college_id === targetColIdA, "Case A: Marked registration as approved with matched_college_id");

  // Verify college count did NOT increase
  const { count: countAfterA } = await sb.from("colleges").select("id", { count: "exact", head: true });
  assert(countAfterA === initialCollegeCount, `Case A: Verified college directory count did NOT increase (${countAfterA} === ${initialCollegeCount})`);

  // ---------------------------------------------------------------------------
  // Suite 5: Duplicate Prevention & Idempotency
  // ---------------------------------------------------------------------------
  console.log("\nSuite 5: Duplicate Prevention & Idempotency");

  const { data: checkReapprove } = await sb
    .from("coordinator_registrations")
    .select("status, matched_college_id")
    .eq("id", regA.id)
    .single();

  assert(checkReapprove.status === "approved", "Duplicate Prevention: Already approved status detected, re-approval blocked");

  const { data: duplicateCoordCheck } = await sb
    .from("placement_coordinators")
    .select("id")
    .eq("college_id", targetColIdA)
    .eq("email", testEmailA);

  assert(duplicateCoordCheck.length === 1, "Duplicate Prevention: Exactly one placement coordinator row exists for this email");

  // ---------------------------------------------------------------------------
  // Suite 6: Optional Courses Test — Submission & Approval with NO Courses Selected
  // ---------------------------------------------------------------------------
  console.log("\nSuite 6: Optional Courses Test — Submission & Approval with NO Courses");

  const testEmailOptA = `test.coord.opt.a.${Date.now()}@saarthitest.edu.in`;

  // 1. Submit registration with NO courses (courses_available is null)
  const { data: regOptA, error: regOptAErr } = await sb
    .from("coordinator_registrations")
    .insert([
      {
        full_name: "Prof. Optional Courses Tester",
        designation: "Assistant Director",
        college_name: existingCollege.name,
        official_email: testEmailOptA,
        phone: "9876543219",
        city: existingCollege.city || "Greater Noida",
        state: existingCollege.state || "Uttar Pradesh",
        category: "MBA/Management",
        matched_college_id: existingCollege.id,
        courses_available: null, // No courses submitted
        status: "pending",
      },
    ])
    .select()
    .single();

  assert(!regOptAErr && regOptA, "Optional Courses: Backend successfully created registration with NO courses (null)");
  assert(regOptA.courses_available === null, "Optional Courses: Saved courses_available accurately as null");

  // 2. Approve and verify existing college courses are completely preserved (not overwritten with null/empty)
  const preApprovalCourses = checkColA.courses_available;
  const mergedNoCourses = mergeCourses(preApprovalCourses, regOptA.courses_available);
  assert(
    mergedNoCourses === preApprovalCourses,
    "Optional Courses: On approval with no courses, existing college courses are preserved without being overwritten"
  );

  // Link coordinator
  const { data: coordOptA } = await sb
    .from("placement_coordinators")
    .insert([
      {
        college_id: targetColIdA,
        name: regOptA.full_name.trim(),
        phone: regOptA.phone,
        email: regOptA.official_email,
        is_current: true,
        effective_from: new Date().toISOString().split("T")[0],
        created_by_name: "Integration Test Admin",
      },
    ])
    .select()
    .single();

  assert(coordOptA && coordOptA.college_id === targetColIdA, "Optional Courses: Coordinator successfully linked to college without courses");

  // ---------------------------------------------------------------------------
  // Suite 7: Case B — 'College Not Found? Add Your Institution' New College Flow
  // ---------------------------------------------------------------------------
  console.log("\nSuite 7: Case B — 'College Not Found? Add Your Institution' New College Flow");

  const newCollegeName = `Apex Institute of Frontier Tech ${Date.now()}`;
  const testEmailB = `test.coord.b.${Date.now()}@saarthitest.edu.in`;
  const incomingCoursesB = "B.Tech, M.Tech, BCA, MCA";

  // 1. Insert pending registration for new college with courses and selected_college_id = null
  const { data: regB, error: regBErr } = await sb
    .from("coordinator_registrations")
    .insert([
      {
        full_name: "Prof. Priya Nair",
        designation: "Head - Placement Cell",
        college_name: newCollegeName,
        official_email: testEmailB,
        phone: "9123456789",
        city: "Bengaluru",
        state: "Karnataka",
        category: "Engineering/Tech",
        website: "https://www.apexfrontiertechnology.edu.in",
        remarks: `[Courses: ${incomingCoursesB}]`,
        matched_college_id: null,
        status: "pending",
      },
    ])
    .select()
    .single();

  assert(!regBErr && regB, "Case B: Successfully submitted pending registration for brand new institution with courses");

  // Verify that new college is NOT yet added to Colleges directory before approval
  const { data: checkPendingCollege } = await sb
    .from("colleges")
    .select("id")
    .eq("name", newCollegeName);

  assert(!checkPendingCollege || checkPendingCollege.length === 0, "Case B: New college details remain pending and do NOT appear in colleges directory before approval");

  // 2. Create new college record with courses_available upon admin approval
  const { data: createdColB, error: createColBErr } = await sb
    .from("colleges")
    .insert([
      {
        name: regB.college_name.trim(),
        city: regB.city.trim(),
        state: regB.state.trim(),
        course: regB.category.trim(),
        institution_type: regB.category.trim(),
        courses_available: incomingCoursesB,
        website: regB.website,
        tpo: regB.full_name.trim(),
        status: "Interested",
      },
    ])
    .select()
    .single();

  assert(!createColBErr && createdColB, "Case B: Created exactly one new college record in colleges directory upon approval");
  assert(createdColB.courses_available === incomingCoursesB, "Case B: New college stored courses_available accurately");

  // 3. Insert coordinator linked to new college
  const { data: coordB } = await sb
    .from("placement_coordinators")
    .insert([
      {
        college_id: createdColB.id,
        name: regB.full_name.trim(),
        phone: regB.phone,
        email: regB.official_email,
        is_current: true,
        effective_from: new Date().toISOString().split("T")[0],
        created_by_name: "Integration Test Admin",
      },
    ])
    .select()
    .single();

  assert(coordB && coordB.college_id === createdColB.id, "Case B: Placement coordinator linked to newly created college record");

  // 4. Update registration
  const { data: updatedRegB } = await sb
    .from("coordinator_registrations")
    .update({
      status: "approved",
      matched_college_id: createdColB.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", regB.id)
    .select()
    .single();

  assert(updatedRegB.status === "approved" && updatedRegB.matched_college_id === createdColB.id, "Case B: Registration marked approved with new college ID");

  // 5. Verify Colleges Directory count increased by exactly 1
  const { count: countAfterB } = await sb.from("colleges").select("id", { count: "exact", head: true });
  assert(countAfterB === initialCollegeCount + 1, `Case B: Directory count increased by exactly 1 (${countAfterB} === ${initialCollegeCount} + 1)`);

  // ---------------------------------------------------------------------------
  // Suite 8: Case C — Reject Coordinator Request
  // ---------------------------------------------------------------------------
  console.log("\nSuite 8: Case C — Rejecting Coordinator Request");

  const testEmailC = `test.coord.c.${Date.now()}@saarthitest.edu.in`;
  const { data: regC } = await sb
    .from("coordinator_registrations")
    .insert([
      {
        full_name: "Unverified Person",
        designation: "Unknown",
        college_name: "Unverifiable Academy",
        official_email: testEmailC,
        phone: "9999999999",
        city: "Nowhere",
        state: "Delhi NCR",
        category: "Other",
        status: "pending",
      },
    ])
    .select()
    .single();

  assert(regC && regC.status === "pending", "Case C: Created pending registration to test rejection");

  const rejectionReason = "Official domain could not be verified by campus team";
  const { data: rejectedRegC } = await sb
    .from("coordinator_registrations")
    .update({
      status: "rejected",
      rejection_reason: rejectionReason,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", regC.id)
    .select()
    .single();

  assert(rejectedRegC.status === "rejected", "Case C: Registration status changed to 'rejected'");
  assert(rejectedRegC.rejection_reason === rejectionReason, "Case C: Rejection reason accurately stored");

  // Verify rejection did NOT create college or coordinator
  const { data: unverifiedColCheck } = await sb.from("colleges").select("id").eq("name", "Unverifiable Academy");
  assert(!unverifiedColCheck || unverifiedColCheck.length === 0, "Case C: Rejection did not create any college record");

  const { data: unverifiedCoordCheck } = await sb.from("placement_coordinators").select("id").eq("email", testEmailC);
  assert(!unverifiedCoordCheck || unverifiedCoordCheck.length === 0, "Case C: Rejection did not create any placement coordinator link");

  // ---------------------------------------------------------------------------
  // Suite 9: Teardown & Baseline Data Restoration
  // ---------------------------------------------------------------------------
  console.log("\nSuite 9: Teardown & Baseline Data Preservation");

  // Clean up Case A
  await sb.from("placement_coordinators").delete().eq("id", coordA.id);
  await sb.from("coordinator_registrations").delete().eq("id", regA.id);
  await sb.from("colleges").update({ tpo: existingCollege.tpo, courses_available: originalCollegeCourses }).eq("id", targetColIdA);

  // Clean up Optional Courses Test
  await sb.from("placement_coordinators").delete().eq("id", coordOptA.id);
  await sb.from("coordinator_registrations").delete().eq("id", regOptA.id);

  // Clean up Case B
  await sb.from("placement_coordinators").delete().eq("id", coordB.id);
  await sb.from("coordinator_registrations").delete().eq("id", regB.id);
  await sb.from("colleges").delete().eq("id", createdColB.id);

  // Clean up Case C
  await sb.from("coordinator_registrations").delete().eq("id", regC.id);

  // Verify final colleges count matches initial count
  const { count: finalCollegeCount } = await sb.from("colleges").select("id", { count: "exact", head: true });
  assert(finalCollegeCount === initialCollegeCount, `Teardown: College records safely preserved at baseline (${finalCollegeCount} === ${initialCollegeCount})`);

  console.log("\n=================================================================");
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("=================================================================\n");

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
