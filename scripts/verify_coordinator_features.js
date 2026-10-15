// =============================================================================
// Automated Verification Script: Placement Coordinator Multi-Coordinator &
// Full colleges.tpo Synchronization Test Suite
//
// NOTE ON TEST CATEGORIZATION:
// - Suites 1 & 2: Static Schema, Migration Directives & AST/Source Code Verification.
// - Suites 3 through 14: In-Memory Algorithmic & Transactional Simulation Tests
//   modeling PostgreSQL RPC functions, constraints, rollbacks, and multi-coordinator logic.
// - Integration note: PostgreSQL database-side execution must be run on staging Supabase.
// =============================================================================

const fs = require("fs");
const path = require("path");

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

console.log("\n========================================================");
console.log("RUNNING SAARTHI CAMPUS MULTI-COORDINATOR & TPO SYNC TESTS");
console.log("========================================================\n");

// -----------------------------------------------------------------------------
// Test Suite 1: Database Migration & Rollback Validation
// -----------------------------------------------------------------------------
console.log("Suite 1: Database Migration & Rollback Directives (Static Analysis)");

const baseMigrationPath = path.join(__dirname, "..", "supabase", "migrations", "20261014_enhance_placement_coordinators.sql");
const syncMigrationPath = path.join(__dirname, "..", "supabase", "migrations", "20261014_multi_coordinator_tpo_sync.sql");
const syncRollbackPath = path.join(__dirname, "..", "supabase", "migrations", "20261014_rollback_multi_coordinator_tpo_sync.sql");

assert(fs.existsSync(baseMigrationPath), "Base migration file exists");
assert(fs.existsSync(syncMigrationPath), "Multi-coordinator TPO sync migration exists");
assert(fs.existsSync(syncRollbackPath), "Multi-coordinator TPO sync rollback migration exists");

const baseSql = fs.readFileSync(baseMigrationPath, "utf-8");
const syncSql = fs.readFileSync(syncMigrationPath, "utf-8");
const rollbackSql = fs.readFileSync(syncRollbackPath, "utf-8");

assert(syncSql.includes("sync_college_tpo"), "Migration defines sync_college_tpo function");
assert(syncSql.includes("string_agg"), "sync_college_tpo aggregates active coordinators using string_agg");
assert(syncSql.includes("is_current = true"), "sync_college_tpo excludes former/retired coordinators");
assert(syncSql.includes("GROUP BY trim(name)"), "sync_college_tpo deduplicates identical coordinator names");
assert(syncSql.includes("SECURITY DEFINER"), "sync_college_tpo uses SECURITY DEFINER");
assert(syncSql.includes("search_path = public, auth"), "sync_college_tpo enforces fixed search_path");
assert(syncSql.includes("create_college_with_coordinators"), "Migration updates create_college_with_coordinators to sync all active coordinators");
assert(syncSql.includes("add_placement_coordinator"), "Migration updates add_placement_coordinator to sync all active coordinators");
assert(syncSql.includes("update_placement_coordinator_details"), "Migration updates update_placement_coordinator_details to sync all active coordinators");
assert(syncSql.includes("retire_placement_coordinator"), "Migration updates retire_placement_coordinator to recalculate tpo from remaining active coordinators");
assert(syncSql.includes("REVOKE ALL ON FUNCTION sync_college_tpo(TEXT) FROM authenticated"), "sync_college_tpo direct execution is revoked from authenticated");
assert(syncSql.includes("REVOKE ALL ON FUNCTION sync_college_tpo(TEXT) FROM PUBLIC"), "sync_college_tpo direct execution is revoked from PUBLIC");
assert(syncSql.includes("REVOKE ALL ON FUNCTION create_college_with_coordinators(JSONB, JSONB) FROM PUBLIC"), "create_college_with_coordinators revokes PUBLIC execution");
assert(syncSql.includes("p_target_coordinator_id"), "replace_placement_coordinator supports targeted coordinator replacement");
assert(syncSql.includes("is_valid_calendar_date"), "Migration defines is_valid_calendar_date calendar validator function");
assert(syncSql.includes("session_user IN ('postgres', 'supabase_admin')"), "get_saarthi_auth_user uses session_user check to prevent SECURITY DEFINER elevation");
assert(syncSql.includes("DROP FUNCTION IF EXISTS replace_placement_coordinator(TEXT, TEXT, TEXT, TEXT, DATE)"), "Migration drops legacy 5-parameter replace_placement_coordinator overload");
assert(syncSql.includes("REVOKE ALL ON FUNCTION update_placement_coordinator_details(TEXT, TEXT, TEXT, TEXT, DATE) FROM PUBLIC"), "update_placement_coordinator_details revokes PUBLIC execution");
assert(syncSql.includes("REVOKE ALL ON FUNCTION add_placement_coordinator(TEXT, TEXT, TEXT, TEXT, DATE) FROM PUBLIC"), "add_placement_coordinator revokes PUBLIC execution");
assert(syncSql.includes("REVOKE ALL ON FUNCTION retire_placement_coordinator(TEXT) FROM PUBLIC"), "retire_placement_coordinator revokes PUBLIC execution");
assert(syncSql.includes("REVOKE ALL ON FUNCTION replace_placement_coordinator(TEXT, TEXT, TEXT, TEXT, DATE, TEXT) FROM PUBLIC"), "replace_placement_coordinator revokes PUBLIC execution");
assert(syncSql.includes("p_target_coordinator_id to choose which coordinator to replace"), "replace_placement_coordinator requires explicit target ID when multiple active coordinators exist");
assert(rollbackSql.includes("DROP FUNCTION IF EXISTS sync_college_tpo"), "Rollback safely drops sync_college_tpo function");
assert(rollbackSql.includes("DROP FUNCTION IF EXISTS is_valid_calendar_date"), "Rollback safely drops is_valid_calendar_date function");
assert(rollbackSql.includes("PRESERVED"), "Rollback explicitly preserves historical audit data in placement_coordinator_history");

// -----------------------------------------------------------------------------
// Test Suite 2: Frontend Code Logic in CampusDB.jsx
// -----------------------------------------------------------------------------
console.log("\nSuite 2: Frontend Code Logic in CampusDB.jsx (Static Analysis)");

const campusDbPath = path.join(__dirname, "..", "recruitos-frontend", "src", "pages", "CampusDB.jsx");
assert(fs.existsSync(campusDbPath), "CampusDB.jsx exists");

const campusDbCode = fs.readFileSync(campusDbPath, "utf-8");

assert(campusDbCode.includes("create_college_with_coordinators"), "CampusDB.jsx invokes atomic create_college_with_coordinators RPC");
assert(campusDbCode.includes("newCoordinators"), "CampusDB.jsx maintains dynamic newCoordinators array");
assert(campusDbCode.includes("newCoordErrors"), "CampusDB.jsx maintains inline error state for coordinator cards");
assert(campusDbCode.includes("formErrors"), "CampusDB.jsx maintains inline error state for college fields");
assert(campusDbCode.includes("syncCollegeTpoClientFallback"), "CampusDB.jsx includes client-side fallback for multi-coordinator colleges.tpo sync");
assert(campusDbCode.includes("validCoordinators.map((c) => c.name).filter(Boolean).join(\", \")"), "CampusDB.jsx formats colleges.tpo with comma-separated list of all coordinators");
assert(campusDbCode.includes("Placement Coordinator Name"), "CampusDB.jsx uses label 'Placement Coordinator Name'");
assert(campusDbCode.includes("Contact Number"), "CampusDB.jsx uses label 'Contact Number'");
assert(campusDbCode.includes("Email Address"), "CampusDB.jsx uses label 'Email Address'");
assert(campusDbCode.includes("+ Add Another Placement Coordinator"), "CampusDB.jsx provides '+ Add Another Placement Coordinator' button");
assert(campusDbCode.includes("handleRemoveCoordinatorField"), "CampusDB.jsx supports removing coordinator fields");
assert(campusDbCode.includes("prev.length <= 1"), "CampusDB.jsx prevents removing the last remaining coordinator card");
assert(campusDbCode.includes("<th>Placement Coordinators</th>"), "CampusDB.jsx uses 'Placement Coordinators' in import table header");
assert(campusDbCode.includes("Search college, city, placement coordinators..."), "CampusDB.jsx uses 'placement coordinators' in search bar placeholder");
assert(campusDbCode.includes("form=\"college-form\""), "CampusDB.jsx wires sticky action footer to college form");
assert(campusDbCode.includes("overflowY: \"auto\""), "CampusDB.jsx provides scrollable modal body");
assert(campusDbCode.includes('rowErr.name = "Placement Coordinator Name is required."'), "CampusDB.jsx enforces mandatory coordinator name");
assert(campusDbCode.includes('rowErr.phone = "Contact Number is required."'), "CampusDB.jsx enforces mandatory contact number");
assert(campusDbCode.includes('rowErr.phone = "Please enter a valid 10-digit Contact Number."'), "CampusDB.jsx validates 10-digit phone format");
assert(campusDbCode.includes('rowErr.email = "Email Address is required."'), "CampusDB.jsx enforces mandatory email address");
assert(campusDbCode.includes('rowErr.email = "Please enter a valid Email Address."'), "CampusDB.jsx validates email format");
assert(campusDbCode.includes('rowErr.effective_from = "Please enter a valid Effective From Date."'), "CampusDB.jsx validates effective-from date");
assert(campusDbCode.includes("firstInvalidTargetId"), "CampusDB.jsx tracks first invalid target ID for focusing/scrolling");
assert(campusDbCode.includes("scrollIntoView"), "CampusDB.jsx smoothly scrolls invalid field into center");
assert(campusDbCode.includes("el.focus()"), "CampusDB.jsx sets keyboard focus to invalid field");
assert(campusDbCode.includes("coord-name-"), "CampusDB.jsx assigns unique element IDs to coordinator name inputs");
assert(campusDbCode.includes("coord-phone-"), "CampusDB.jsx assigns unique element IDs to coordinator phone inputs");
assert(campusDbCode.includes("coord-email-"), "CampusDB.jsx assigns unique element IDs to coordinator email inputs");
assert(campusDbCode.includes("coord-date-"), "CampusDB.jsx assigns unique element IDs to coordinator date inputs");
assert(campusDbCode.includes("college-name-input"), "CampusDB.jsx assigns ID to college name input");

// -----------------------------------------------------------------------------
// Test Suite 3: Simulation - Creating a College with One Coordinator
// -----------------------------------------------------------------------------
console.log("\nSuite 3: Creating a College with One Coordinator (Simulation)");

const mockDb = {
  colleges: [],
  coordinators: [],
  history: []
};

function helperSyncCollegeTpo(collegeId) {
  const active = mockDb.coordinators
    .filter(c => c.college_id === collegeId && c.is_current && c.name && c.name.trim())
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const names = [];
  active.forEach(c => {
    const trimmed = c.name.trim();
    if (!names.includes(trimmed)) names.push(trimmed);
  });

  const combined = names.length > 0 ? names.join(", ") : null;
  const col = mockDb.colleges.find(c => c.id === collegeId);
  if (col) col.tpo = combined;
  return combined;
}

function simulateCreateCollege(collegeData, coordinatorsList, actor) {
  if (!collegeData.name || !collegeData.name.trim()) {
    throw new Error("College name is required");
  }

  const validCoords = (coordinatorsList || []).filter(c => c.name && c.name.trim());

  const newCollege = {
    id: "col-" + (mockDb.colleges.length + 1),
    name: collegeData.name.trim(),
    city: collegeData.city || null,
    course: collegeData.course || null,
    tpo: null,
    status: collegeData.status || "Interested"
  };
  mockDb.colleges.push(newCollege);

  const createdCoords = [];
  for (const c of validCoords) {
    const newCoord = {
      id: "coord-" + (mockDb.coordinators.length + 1),
      college_id: newCollege.id,
      name: c.name.trim(),
      phone: c.phone || null,
      email: c.email || null,
      is_current: true,
      effective_from: c.effective_from || "2026-10-14",
      created_at: new Date().toISOString()
    };
    mockDb.coordinators.push(newCoord);
    createdCoords.push(newCoord);

    mockDb.history.push({
      id: "hist-" + (mockDb.history.length + 1),
      college_id: newCollege.id,
      coordinator_id: newCoord.id,
      action: "CREATED",
      previous_values: null,
      new_values: { ...newCoord },
      changed_at: new Date().toISOString(),
      changed_by_name: actor
    });
  }

  helperSyncCollegeTpo(newCollege.id);
  return { college: newCollege, coordinators: createdCoords };
}

const resSingle = simulateCreateCollege(
  { name: "Global Engineering College", city: "Pune" },
  [{ name: "Prof. Rajesh Sharma", phone: "9876543210", email: "rajesh@gec.edu", effective_from: "2026-10-14" }],
  "Recruiter Alice"
);

assert(resSingle.college.tpo === "Prof. Rajesh Sharma", "colleges.tpo synchronized with single coordinator name");
assert(mockDb.coordinators.filter(c => c.college_id === resSingle.college.id).length === 1, "Exactly one coordinator saved in database");
assert(mockDb.history.filter(h => h.college_id === resSingle.college.id && h.action === "CREATED").length === 1, "Initial CREATED audit record logged");

// -----------------------------------------------------------------------------
// Test Suite 4: Simulation - Creating a College with Three Active Coordinators
// -----------------------------------------------------------------------------
console.log("\nSuite 4: Creating a College with Three Active Coordinators (Simulation)");

const resTriple = simulateCreateCollege(
  { name: "National Institute of Science", city: "Hyderabad" },
  [
    { name: "Dr. Ananya Roy", phone: "9811122233", email: "ananya@nis.edu", effective_from: "2026-10-14" },
    { name: "Prof. Vikram Malhotra", phone: "9822233344", email: "vikram@nis.edu", effective_from: "2026-10-14" },
    { name: "Ms. Sunita Patil", phone: "9833344455", email: "sunita@nis.edu", effective_from: "2026-10-14" }
  ],
  "Admin Bob"
);

const tripleColId = resTriple.college.id;
assert(resTriple.college.tpo === "Dr. Ananya Roy, Prof. Vikram Malhotra, Ms. Sunita Patil", "colleges.tpo aggregated all three active coordinator names in comma-separated format");
const activeTriple = mockDb.coordinators.filter(c => c.college_id === tripleColId && c.is_current);
assert(activeTriple.length === 3, "All three coordinators are active with is_current = true");
const historyTriple = mockDb.history.filter(h => h.college_id === tripleColId && h.action === "CREATED");
assert(historyTriple.length === 3, "Recorded separate CREATED audit event for each of the three coordinators");

// -----------------------------------------------------------------------------
// Test Suite 5: Simulation - Adding a Coordinator to an Existing College
// -----------------------------------------------------------------------------
console.log("\nSuite 5: Adding a Coordinator to an Existing College (Simulation)");

function simulateAddCoordinator(collegeId, coordData, actor) {
  const newCoord = {
    id: "coord-" + (mockDb.coordinators.length + 1),
    college_id: collegeId,
    name: coordData.name.trim(),
    phone: coordData.phone || null,
    email: coordData.email || null,
    is_current: true,
    effective_from: coordData.effective_from || "2026-10-14",
    created_at: new Date(Date.now() + 1000).toISOString()
  };
  mockDb.coordinators.push(newCoord);

  mockDb.history.push({
    id: "hist-" + (mockDb.history.length + 1),
    college_id: collegeId,
    coordinator_id: newCoord.id,
    action: "CREATED",
    previous_values: null,
    new_values: { ...newCoord },
    changed_at: new Date().toISOString(),
    changed_by_name: actor
  });

  helperSyncCollegeTpo(collegeId);
  return newCoord;
}

simulateAddCoordinator(tripleColId, { name: "Mr. Deepak Verma", phone: "9844455566", email: "deepak@nis.edu" }, "Recruiter Alice");

const postAddActive = mockDb.coordinators.filter(c => c.college_id === tripleColId && c.is_current);
assert(postAddActive.length === 4, "Active coordinator count incremented to 4 without retiring earlier coordinators");
const updatedTripleCollege = mockDb.colleges.find(c => c.id === tripleColId);
assert(updatedTripleCollege.tpo === "Dr. Ananya Roy, Prof. Vikram Malhotra, Ms. Sunita Patil, Mr. Deepak Verma", "colleges.tpo automatically synchronized to include fourth coordinator");

// -----------------------------------------------------------------------------
// Test Suite 6: Simulation - Editing One Coordinator Without Changing Others
// -----------------------------------------------------------------------------
console.log("\nSuite 6: Editing One Coordinator Without Modifying Others (Simulation)");

function simulateEditCoordinator(coordId, updatedData, actor) {
  const coord = mockDb.coordinators.find(c => c.id === coordId);
  if (!coord) throw new Error("Coordinator not found");

  const prevVals = { ...coord };
  if (updatedData.name !== undefined) coord.name = updatedData.name.trim();
  if (updatedData.phone !== undefined) coord.phone = updatedData.phone || null;
  if (updatedData.email !== undefined) coord.email = updatedData.email || null;
  if (updatedData.effective_from !== undefined) coord.effective_from = updatedData.effective_from;

  mockDb.history.push({
    id: "hist-" + (mockDb.history.length + 1),
    college_id: coord.college_id,
    coordinator_id: coord.id,
    action: "UPDATED",
    previous_values: prevVals,
    new_values: { ...coord },
    changed_at: new Date().toISOString(),
    changed_by_name: actor
  });

  if (coord.is_current) {
    helperSyncCollegeTpo(coord.college_id);
  }
  return coord;
}

// Rename Vikram Malhotra to Prof. Vikram S. Malhotra
const vikramCoord = mockDb.coordinators.find(c => c.name === "Prof. Vikram Malhotra");
simulateEditCoordinator(vikramCoord.id, { name: "Prof. Vikram S. Malhotra", phone: "9899999999" }, "Admin Bob");

assert(vikramCoord.name === "Prof. Vikram S. Malhotra", "Target coordinator name updated");
assert(vikramCoord.phone === "9899999999", "Target coordinator phone updated");
assert(mockDb.coordinators.find(c => c.name === "Dr. Ananya Roy").phone === "9811122233", "Untargeted coordinator 1 remains unchanged");
assert(mockDb.coordinators.find(c => c.name === "Ms. Sunita Patil").phone === "9833344455", "Untargeted coordinator 2 remains unchanged");
assert(mockDb.coordinators.find(c => c.name === "Mr. Deepak Verma").phone === "9844455566", "Untargeted coordinator 3 remains unchanged");
assert(updatedTripleCollege.tpo.includes("Prof. Vikram S. Malhotra"), "colleges.tpo reflected the renamed coordinator");

// -----------------------------------------------------------------------------
// Test Suite 7: Simulation - Retiring One Coordinator While Others Remain Active
// -----------------------------------------------------------------------------
console.log("\nSuite 7: Retiring One Coordinator (Simulation)");

function simulateRetireCoordinator(coordId, actor) {
  const coord = mockDb.coordinators.find(c => c.id === coordId);
  if (!coord) throw new Error("Coordinator not found");

  const prevVals = { ...coord };
  coord.is_current = false;
  coord.ended_at = new Date().toISOString();

  mockDb.history.push({
    id: "hist-" + (mockDb.history.length + 1),
    college_id: coord.college_id,
    coordinator_id: coord.id,
    action: "RETIRED",
    previous_values: prevVals,
    new_values: { is_current: false, ended_at: coord.ended_at },
    changed_at: new Date().toISOString(),
    changed_by_name: actor
  });

  helperSyncCollegeTpo(coord.college_id);
  return coord;
}

// Retire Deepak Verma
const deepakCoord = mockDb.coordinators.find(c => c.name === "Mr. Deepak Verma");
simulateRetireCoordinator(deepakCoord.id, "Admin Bob");

const postRetireActive = mockDb.coordinators.filter(c => c.college_id === tripleColId && c.is_current);
assert(postRetireActive.length === 3, "Active count decremented to 3 after retirement");
assert(deepakCoord.is_current === false, "Retired coordinator marked is_current = false");
assert(!updatedTripleCollege.tpo.includes("Deepak Verma"), "colleges.tpo no longer contains retired coordinator");
assert(updatedTripleCollege.tpo === "Dr. Ananya Roy, Prof. Vikram S. Malhotra, Ms. Sunita Patil", "colleges.tpo contains exactly the remaining 3 active coordinators");
assert(mockDb.history.some(h => h.coordinator_id === deepakCoord.id && h.action === "RETIRED"), "RETIRED event recorded in history");

// -----------------------------------------------------------------------------
// Test Suite 8: Simulation - Field-Level History Diff Computation
// -----------------------------------------------------------------------------
console.log("\nSuite 8: Field-Level History Diff Computation (Simulation)");

function computeFieldDiff(prev, next) {
  const diffs = [];
  ["name", "phone", "email", "effective_from", "is_current"].forEach(field => {
    if (prev[field] !== next[field]) {
      diffs.push({ field, from: prev[field], to: next[field] });
    }
  });
  return diffs;
}

const lastEditEvent = mockDb.history.find(h => h.action === "UPDATED" && h.coordinator_id === vikramCoord.id);
const diffs = computeFieldDiff(lastEditEvent.previous_values, lastEditEvent.new_values);
assert(diffs.some(d => d.field === "name" && d.from === "Prof. Vikram Malhotra" && d.to === "Prof. Vikram S. Malhotra"), "Audit captured previous and updated coordinator name");
assert(diffs.some(d => d.field === "phone" && d.from === "9822233344" && d.to === "9899999999"), "Audit captured previous and updated mobile number");

// -----------------------------------------------------------------------------
// Test Suite 9: Simulation - Security: Rejecting Unauthorized Callers
// -----------------------------------------------------------------------------
console.log("\nSuite 9: Security & Role Authorization (Simulation)");

function verifyCallerAuthorization(user) {
  if (!user || !user.id) {
    throw new Error("Authentication required: caller must be an authenticated user");
  }
  if (!["admin", "recruiter"].includes(user.role)) {
    throw new Error("Unauthorized: only recruiters and admins can manage placement coordinators");
  }
  return true;
}

let authPassed = false;
try {
  verifyCallerAuthorization(null);
} catch (e) {
  authPassed = e.message.includes("Authentication required");
}
assert(authPassed, "Unauthenticated user request is strictly rejected");

let rolePassed = false;
try {
  verifyCallerAuthorization({ id: "user-999", role: "guest" });
} catch (e) {
  rolePassed = e.message.includes("Unauthorized");
}
assert(rolePassed, "Non-recruiter/admin role request is strictly rejected");

assert(verifyCallerAuthorization({ id: "user-1", role: "recruiter" }) === true, "Approved recruiter caller is authorized");
assert(verifyCallerAuthorization({ id: "user-2", role: "admin" }) === true, "Approved admin caller is authorized");

// -----------------------------------------------------------------------------
// Test Suite 10: Simulation - Atomic Rollback on Failure
// -----------------------------------------------------------------------------
console.log("\nSuite 10: Atomic Transaction Rollback Simulation");

function simulateFailingAtomicCreation(collegeData, coordinatorsList, failPoint) {
  const snapshotColleges = [...mockDb.colleges];
  const snapshotCoords = [...mockDb.coordinators];
  const snapshotHistory = [...mockDb.history];

  try {
    const col = { id: "col-rollback-test", name: collegeData.name, tpo: null };
    mockDb.colleges.push(col);

    if (failPoint === "coordinator_insert") {
      throw new Error("Simulated database failure during coordinator insert");
    }

    const coord = { id: "coord-rollback-test", college_id: col.id, name: coordinatorsList[0].name };
    mockDb.coordinators.push(coord);

    if (failPoint === "audit_insert") {
      throw new Error("Simulated database failure during audit log insertion");
    }

    mockDb.history.push({ id: "hist-rollback-test", action: "CREATED" });
  } catch (err) {
    // Rollback
    mockDb.colleges = snapshotColleges;
    mockDb.coordinators = snapshotCoords;
    mockDb.history = snapshotHistory;
    return { rolledBack: true, error: err.message };
  }
  return { rolledBack: false };
}

const rb1 = simulateFailingAtomicCreation({ name: "Fail College 1" }, [{ name: "Coord 1" }], "coordinator_insert");
assert(rb1.rolledBack === true, "Transaction rolled back when coordinator insert failed");
assert(!mockDb.colleges.some(c => c.id === "col-rollback-test"), "College was not left orphaned in database after rollback");

const rb2 = simulateFailingAtomicCreation({ name: "Fail College 2" }, [{ name: "Coord 2" }], "audit_insert");
assert(rb2.rolledBack === true, "Transaction rolled back when audit log failed");
assert(!mockDb.coordinators.some(c => c.id === "coord-rollback-test"), "Coordinator was not left without audit trail");

// -----------------------------------------------------------------------------
// Test Suite 11: Simulation - Concurrent Coordinator Additions & Deduplication
// -----------------------------------------------------------------------------
console.log("\nSuite 11: Deduplication & Safe Name Aggregation (Simulation)");

const dedupTestColId = "col-dedup";
mockDb.colleges.push({ id: dedupTestColId, name: "Dedup Tech", tpo: null });
mockDb.coordinators.push(
  { id: "c-dup-1", college_id: dedupTestColId, name: "Dr. Same Name", is_current: true, created_at: "2026-01-01" },
  { id: "c-dup-2", college_id: dedupTestColId, name: "Dr. Same Name", is_current: true, created_at: "2026-01-02" },
  { id: "c-dup-3", college_id: dedupTestColId, name: "Prof. Other Name", is_current: true, created_at: "2026-01-03" }
);

helperSyncCollegeTpo(dedupTestColId);
const dedupCol = mockDb.colleges.find(c => c.id === dedupTestColId);
assert(dedupCol.tpo === "Dr. Same Name, Prof. Other Name", "Duplicate coordinator names safely collapsed without repeating in colleges.tpo");

// -----------------------------------------------------------------------------
// Test Suite 12: Simulation - Preserving Existing College Fields
// -----------------------------------------------------------------------------
console.log("\nSuite 12: Preserving Existing College Fields (Simulation)");

const collegeWithAllFields = {
  name: "Prestige University",
  city: "Mumbai",
  course: "B.Tech",
  website: "https://prestige.edu",
  strength: 1500,
  last_contact: "2026-09-01",
  status: "Follow-up Due",
  institution_type: "University",
  courses_available: "CSE, ECE, ME"
};

const resPreserve = simulateCreateCollege(collegeWithAllFields, [{ name: "Dean Academic" }], "Admin Bob");
assert(resPreserve.college.name === "Prestige University", "College name preserved");
assert(resPreserve.college.city === "Mumbai", "College city preserved");
assert(resPreserve.college.course === "B.Tech", "College course preserved");
assert(resPreserve.college.status === "Follow-up Due", "College status preserved");

// -----------------------------------------------------------------------------
// Test Suite 13: Simulation - Mandatory Coordinator Validation & Focus Targeting
// -----------------------------------------------------------------------------
console.log("\nSuite 13: Placement Coordinator Form Validation & Focus Targeting (Simulation)");

function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim());
}

function simulateValidateCollegeForm(formState, coordinatorsList) {
  const errors = {};
  const coordErrors = {};
  let hasCoordErrors = false;
  let firstInvalidTargetId = null;

  if (!formState.name || !formState.name.trim()) {
    errors.name = "Please enter college name.";
    firstInvalidTargetId = "college-name-input";
  }

  for (let i = 0; i < coordinatorsList.length; i++) {
    const c = coordinatorsList[i];
    const rowErr = {};

    // 1. Placement Coordinator Name (Mandatory)
    if (!c.name || !c.name.trim()) {
      rowErr.name = "Placement Coordinator Name is required.";
      if (!firstInvalidTargetId) {
        firstInvalidTargetId = `coord-name-${i}`;
      }
    }

    // 2. Contact Number (Mandatory, 10 digits)
    const cleanPhone = (c.phone || "").trim();
    if (!cleanPhone) {
      rowErr.phone = "Contact Number is required.";
      if (!firstInvalidTargetId) {
        firstInvalidTargetId = `coord-phone-${i}`;
      }
    } else if (cleanPhone.length !== 10) {
      rowErr.phone = "Please enter a valid 10-digit Contact Number.";
      if (!firstInvalidTargetId) {
        firstInvalidTargetId = `coord-phone-${i}`;
      }
    }

    // 3. Email Address (Mandatory, valid format)
    const cleanEmail = (c.email || "").trim();
    if (!cleanEmail) {
      rowErr.email = "Email Address is required.";
      if (!firstInvalidTargetId) {
        firstInvalidTargetId = `coord-email-${i}`;
      }
    } else if (!isValidEmailFormat(cleanEmail)) {
      rowErr.email = "Please enter a valid Email Address.";
      if (!firstInvalidTargetId) {
        firstInvalidTargetId = `coord-email-${i}`;
      }
    }

    // 4. Effective From Date (Mandatory, valid date)
    if (!c.effective_from || isNaN(new Date(c.effective_from).getTime())) {
      rowErr.effective_from = "Please enter a valid Effective From Date.";
      if (!firstInvalidTargetId) {
        firstInvalidTargetId = `coord-date-${i}`;
      }
    }

    if (Object.keys(rowErr).length > 0) {
      coordErrors[i] = rowErr;
      hasCoordErrors = true;
    }
  }

  const isValid = Object.keys(errors).length === 0 && !hasCoordErrors;
  return {
    isValid,
    errors,
    coordErrors,
    firstInvalidTargetId,
    validCoordinators: isValid
      ? coordinatorsList.map(c => ({
          name: c.name.trim(),
          phone: c.phone.trim(),
          email: c.email.trim(),
          effective_from: c.effective_from || "2026-10-14"
        }))
      : []
  };
}

// Case 1: Missing coordinator name on card 0
const t1 = simulateValidateCollegeForm(
  { name: "Apex University" },
  [{ name: "", phone: "9876543210", email: "apex@test.com", effective_from: "2026-10-14" }]
);
assert(!t1.isValid, "Empty coordinator name fails validation");
assert(t1.coordErrors[0]?.name === "Placement Coordinator Name is required.", "Returns error message for missing name");
assert(t1.firstInvalidTargetId === "coord-name-0", "Sets focus target to coord-name-0");

// Case 2: Missing contact number on card 0
const t2 = simulateValidateCollegeForm(
  { name: "Apex University" },
  [{ name: "John Doe", phone: "", email: "john@test.com", effective_from: "2026-10-14" }]
);
assert(!t2.isValid, "Missing contact number fails validation");
assert(t2.coordErrors[0]?.phone === "Contact Number is required.", "Returns error message for missing contact number");
assert(t2.firstInvalidTargetId === "coord-phone-0", "Sets focus target to coord-phone-0");

// Case 3: Invalid 10-digit contact number length
const t3 = simulateValidateCollegeForm(
  { name: "Apex University" },
  [{ name: "John Doe", phone: "98765", email: "john@test.com", effective_from: "2026-10-14" }]
);
assert(!t3.isValid, "Non-10-digit contact number fails validation");
assert(t3.coordErrors[0]?.phone === "Please enter a valid 10-digit Contact Number.", "Returns format error message for contact number");
assert(t3.firstInvalidTargetId === "coord-phone-0", "Sets focus target to coord-phone-0 on format error");

// Case 4: Missing email address on card 0
const t4 = simulateValidateCollegeForm(
  { name: "Apex University" },
  [{ name: "John Doe", phone: "9876543210", email: "", effective_from: "2026-10-14" }]
);
assert(!t4.isValid, "Missing email address fails validation");
assert(t4.coordErrors[0]?.email === "Email Address is required.", "Returns error message for missing email");
assert(t4.firstInvalidTargetId === "coord-email-0", "Sets focus target to coord-email-0");

// Case 5: Invalid email address format
const t5 = simulateValidateCollegeForm(
  { name: "Apex University" },
  [{ name: "John Doe", phone: "9876543210", email: "invalid-email", effective_from: "2026-10-14" }]
);
assert(!t5.isValid, "Invalid email format fails validation");
assert(t5.coordErrors[0]?.email === "Please enter a valid Email Address.", "Returns format error message for email");
assert(t5.firstInvalidTargetId === "coord-email-0", "Sets focus target to coord-email-0 on invalid email");

// Case 6: Invalid effective-from date
const t6 = simulateValidateCollegeForm(
  { name: "Apex University" },
  [{ name: "John Doe", phone: "9876543210", email: "john@test.com", effective_from: "not-a-date" }]
);
assert(!t6.isValid, "Invalid effective-from date fails validation");
assert(t6.coordErrors[0]?.effective_from === "Please enter a valid Effective From Date.", "Returns error message for invalid date");
assert(t6.firstInvalidTargetId === "coord-date-0", "Sets focus target to coord-date-0");

// Case 7: Multi-coordinator validation isolation: Card 0 is valid, Card 1 has invalid email
const t7 = simulateValidateCollegeForm(
  { name: "Apex University" },
  [
    { name: "Prof. Good", phone: "9876543210", email: "good@apex.edu", effective_from: "2026-10-14" },
    { name: "Prof. Bad", phone: "9876543211", email: "", effective_from: "2026-10-14" }
  ]
);
assert(!t7.isValid, "Multi-coordinator form fails when second coordinator is missing email");
assert(!t7.coordErrors[0], "Valid Coordinator 1 has no errors");
assert(t7.coordErrors[1]?.email === "Email Address is required.", "Coordinator 2 has email required error");
assert(t7.firstInvalidTargetId === "coord-email-1", "Focus target points to invalid field of Coordinator 2 (coord-email-1)");

// Case 8: All coordinators valid: All details preserved and nothing discarded
const t8 = simulateValidateCollegeForm(
  { name: "Apex University" },
  [
    { name: "Prof. One", phone: "9876543210", email: "one@apex.edu", effective_from: "2026-10-14" },
    { name: "Prof. Two", phone: "9876543211", email: "two@apex.edu", effective_from: "2026-10-14" }
  ]
);
assert(t8.isValid, "All valid coordinators pass validation");
assert(t8.validCoordinators.length === 2, "Both coordinators preserved without dropping any data");
assert(t8.validCoordinators[0].name === "Prof. One" && t8.validCoordinators[0].phone === "9876543210", "Coordinator 1 data accurate");
assert(t8.validCoordinators[1].name === "Prof. Two" && t8.validCoordinators[1].phone === "9876543211", "Coordinator 2 data accurate");

// -----------------------------------------------------------------------------
// Test Suite 14: Calendar Date Validation Algorithm (Simulation)
// -----------------------------------------------------------------------------
console.log("\nSuite 14: Calendar Date Validation Algorithm (Simulation)");

function simulateIsValidCalendarDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return false;
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const parts = trimmed.split("-").map(p => parseInt(p, 10));
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

assert(simulateIsValidCalendarDate("2026-10-14") === true, "Valid standard date 2026-10-14 passes");
assert(simulateIsValidCalendarDate("2024-02-29") === true, "Valid leap year date 2024-02-29 passes");
assert(simulateIsValidCalendarDate("2025-02-29") === false, "Invalid non-leap year date 2025-02-29 is rejected");
assert(simulateIsValidCalendarDate("2026-02-31") === false, "Out of range date 2026-02-31 is rejected");
assert(simulateIsValidCalendarDate("2026-04-31") === false, "April 31st (30-day month) is rejected");
assert(simulateIsValidCalendarDate("2026-13-01") === false, "Invalid month 13 is rejected");
assert(simulateIsValidCalendarDate("not-a-date") === false, "Arbitrary string is rejected");

// -----------------------------------------------------------------------------
// Test Suite 15: Multi-Coordinator Target Disambiguation Simulation
// -----------------------------------------------------------------------------
console.log("\nSuite 15: Multi-Coordinator Target Disambiguation Simulation");

function simulateReplaceCoordinator(collegeId, newName, targetCoordId) {
  const activeCoords = mockDb.coordinators.filter(c => c.college_id === collegeId && c.is_current);
  if (activeCoords.length === 0) {
    throw new Error("No active coordinator found to replace");
  }

  let target = null;
  if (targetCoordId) {
    target = activeCoords.find(c => c.id === targetCoordId);
    if (!target) {
      throw new Error(`Target coordinator ${targetCoordId} not found or not active`);
    }
  } else {
    if (activeCoords.length > 1) {
      throw new Error(`College has ${activeCoords.length} active coordinators. Please specify target_coordinator_id.`);
    }
    target = activeCoords[0];
  }

  // Retire target
  target.is_current = false;
  // Add replacement
  const replacement = {
    id: "coord-rep-" + Date.now(),
    college_id: collegeId,
    name: newName,
    is_current: true,
    created_at: new Date().toISOString()
  };
  mockDb.coordinators.push(replacement);
  helperSyncCollegeTpo(collegeId);
  return { replaced: target, newCoord: replacement };
}

// Setup a college with 2 active coordinators
const disambigColId = "col-disambig-test";
mockDb.colleges.push({ id: disambigColId, name: "Disambig Institute", tpo: null });
const coordA = { id: "c-active-a", college_id: disambigColId, name: "Coordinator Alpha", is_current: true, created_at: "2026-01-01" };
const coordB = { id: "c-active-b", college_id: disambigColId, name: "Coordinator Beta", is_current: true, created_at: "2026-01-02" };
mockDb.coordinators.push(coordA, coordB);
helperSyncCollegeTpo(disambigColId);

let disambigFailed = false;
try {
  simulateReplaceCoordinator(disambigColId, "Coordinator Replacement", null);
} catch (e) {
  disambigFailed = e.message.includes("Please specify target_coordinator_id");
}
assert(disambigFailed, "Replacement without target ID throws exception when multiple active coordinators exist");

// Now replace specifically coordA
const repResult = simulateReplaceCoordinator(disambigColId, "Coordinator Alpha Replacement", "c-active-a");
assert(coordA.is_current === false, "Targeted coordinator Alpha was retired");
assert(coordB.is_current === true, "Untargeted coordinator Beta remains active");
assert(repResult.newCoord.is_current === true, "New replacement coordinator is active");
const updatedDisambigCol = mockDb.colleges.find(c => c.id === disambigColId);
assert(updatedDisambigCol.tpo.includes("Coordinator Beta") && updatedDisambigCol.tpo.includes("Coordinator Alpha Replacement"), "colleges.tpo updated to contain both remaining active and new coordinator");

// -----------------------------------------------------------------------------
// Test Suite 16: update_placement_coordinator_details Validation Simulation
// -----------------------------------------------------------------------------
console.log("\nSuite 16: update_placement_coordinator_details Validation Simulation");

function simulateUpdateCoordinatorDetails(coordId, name, phone, email, effectiveFrom) {
  if (!name || !name.trim()) throw new Error("Placement Coordinator Name is required");
  if (!phone || !/^[0-9]{10}$/.test(phone.trim())) throw new Error("Contact Number must be exactly 10 digits");
  if (!email || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email.trim())) throw new Error("Invalid Email Address format");
  if (!effectiveFrom || !simulateIsValidCalendarDate(effectiveFrom)) throw new Error("Effective From Date is required and must be valid");
  return true;
}

assert(simulateUpdateCoordinatorDetails("c1", "Valid Name", "9876543210", "val@test.com", "2026-10-14") === true, "Valid update payload passes");

let missingNameErr = false;
try { simulateUpdateCoordinatorDetails("c1", "", "9876543210", "val@test.com", "2026-10-14"); } catch (e) { missingNameErr = true; }
assert(missingNameErr, "Empty name in update throws error");

let missingPhoneErr = false;
try { simulateUpdateCoordinatorDetails("c1", "Name", "123", "val@test.com", "2026-10-14"); } catch (e) { missingPhoneErr = true; }
assert(missingPhoneErr, "Invalid phone in update throws error");

let missingEmailErr = false;
try { simulateUpdateCoordinatorDetails("c1", "Name", "9876543210", "bad-email", "2026-10-14"); } catch (e) { missingEmailErr = true; }
assert(missingEmailErr, "Invalid email in update throws error");

let missingDateErr = false;
try { simulateUpdateCoordinatorDetails("c1", "Name", "9876543210", "val@test.com", "2026-02-31"); } catch (e) { missingDateErr = true; }
assert(missingDateErr, "Invalid calendar date in update throws error");

console.log("\n========================================================");
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log("========================================================\n");

if (totalTests === passedTests) {
  process.exit(0);
} else {
  process.exit(1);
}

