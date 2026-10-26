// =============================================================================
// Test Suite: Student Registration Form & Storage Security Verification
// File: scripts/test_student_registration_form.js
// =============================================================================

const fs = require('fs');
const path = require('path');
const { createClient } = require('../recruitos-backend/node_modules/@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '..', 'recruitos-backend', '.env') });

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
  console.log('\n=================================================================');
  console.log('RUNNING STUDENT REGISTRATION FORM & SECURITY TEST SUITE');
  console.log('=================================================================\n');

  // ---------------------------------------------------------------------------
  // Suite 1: Form Structure & Section Organization
  // ---------------------------------------------------------------------------
  console.log('Suite 1: Form Structure & Section Organization');

  const applyFile = path.join(__dirname, '..', 'recruitos-frontend', 'src', 'pages', 'Apply.jsx');
  assert(fs.existsSync(applyFile), 'Apply.jsx exists');

  const code = fs.readFileSync(applyFile, 'utf8');

  // Verify the 4 organized sections
  assert(code.includes('Personal Details'), 'Section 1: "Personal Details" present');
  assert(code.includes('Education'), 'Section 2: "Education" present');
  assert(code.includes('Profile & Skills'), 'Section 3: "Profile & Skills" present');
  assert(code.includes('Resume'), 'Section 4: "Resume" present');

  // ---------------------------------------------------------------------------
  // Suite 2: Field Mandatoriness & Optionality Review
  // ---------------------------------------------------------------------------
  console.log('\nSuite 2: Field Mandatoriness & Optionality Review');

  // Genuinely essential fields required:
  assert(code.includes('Full Name *'), 'Essential field: Full Name is marked as required (*)');
  assert(code.includes('Email Address *'), 'Essential field: Email Address is marked as required (*)');
  assert(code.includes('Degree *'), 'Essential field: Degree is marked as required (*)');
  assert(code.includes('Branch / Specialization *'), 'Essential field: Branch / Specialization is marked as required (*)');
  assert(code.includes('CGPA / Percentage *'), 'Essential field: CGPA / Percentage is marked as required (*)');
  assert(code.includes('Passing Year *'), 'Essential field: Passing Year is marked as required (*)');
  assert(code.includes('Resume *') || code.includes('Select PDF File *'), 'Essential field: Resume is marked as required (*)');

  // Optional profile fields clearly marked as optional:
  assert(code.includes('Mobile Number') && code.includes('Optional'), 'Optional field: Phone number is marked as optional');
  assert(code.includes('Profile Photo') && code.includes('Optional'), 'Optional field: Profile Photo is marked as optional');
  assert(code.includes('10th Percentage') && code.includes('Optional'), 'Optional field: 10th Percentage is marked as optional');
  assert(code.includes('12th Percentage') && code.includes('Optional'), 'Optional field: 12th Percentage is marked as optional');
  assert(code.includes('Technical & Domain Skills') && code.includes('Optional'), 'Optional field: Skills is marked as optional');
  assert(code.includes('LinkedIn Profile') && code.includes('Optional'), 'Optional field: LinkedIn is marked as optional');
  assert(code.includes('GitHub / Portfolio') && code.includes('Optional'), 'Optional field: GitHub / Portfolio is marked as optional');

  // ---------------------------------------------------------------------------
  // Suite 3: File Upload Validation & Previews
  // ---------------------------------------------------------------------------
  console.log('\nSuite 3: File Upload Validation & Previews');

  // Photo validation & preview
  assert(code.includes("image/jpeg") && code.includes("image/png") && code.includes("image/webp"), 'Photo upload accepts standard image MIME types (JPEG, PNG, WebP)');
  assert(code.includes("2 * 1024 * 1024"), 'Photo upload validates 2MB maximum file size limit');
  assert(code.includes("handleRemovePhoto"), 'Photo upload provides ability to remove selected photo');
  assert(code.includes("Replace"), 'Photo upload provides ability to replace selected photo');

  // Resume validation & preview
  assert(code.includes("application/pdf") || code.includes(".pdf"), 'Resume upload validates PDF format');
  assert(code.includes("5 * 1024 * 1024"), 'Resume upload validates 5MB maximum file size limit');
  assert(code.includes("handleRemoveResume"), 'Resume upload provides ability to remove selected resume');
  assert(code.includes("Replace PDF"), 'Resume upload provides ability to replace selected resume');
  assert(code.includes("Ready for AI match"), 'Resume upload displays confirmation badge once selected');

  // ---------------------------------------------------------------------------
  // Suite 4: Workflow Feedback & Information
  // ---------------------------------------------------------------------------
  console.log('\nSuite 4: Workflow Feedback & User Information');

  assert(
    code.includes('Registration & Application Flow:') || code.includes('Registration Privacy & Process:'),
    'Form provides clear information banner explaining what happens to registration data'
  );
  assert(
    code.includes('Continue to Job Openings'),
    'Submission button clearly directs user to "Continue to Job Openings"'
  );
  assert(
    code.includes('Uploading & Analyzing Resume…'),
    'Submission button provides active feedback while upload & analysis is running'
  );
  assert(
    code.includes('Edit Profile'),
    'Step 2 provides ability to return and edit registration details'
  );

  // ---------------------------------------------------------------------------
  // Suite 5: Responsive Layout Inspection
  // ---------------------------------------------------------------------------
  console.log('\nSuite 5: Responsive Layout Inspection');

  assert(code.includes('max-width: 820px') || code.includes('max-width: 880px'), 'Desktop layout uses a balanced wider container (820px-880px instead of 480px)');
  assert(code.includes('@media (max-width: 640px)'), 'Includes mobile breakpoint (@media max-width: 640px) to collapse grids cleanly');
  assert(code.includes('box-sizing: border-box'), 'Enforces box-sizing: border-box to prevent horizontal overflow');

  // ---------------------------------------------------------------------------
  // Suite 6: Security Verification & Private Storage Inspection
  // ---------------------------------------------------------------------------
  console.log('\nSuite 6: Security Verification & Private Storage Inspection');

  const { data: buckets, error: bucketErr } = await sb.storage.listBuckets();
  assert(!bucketErr && Array.isArray(buckets), 'Connected to Supabase Storage');

  const candidateDocsBucket = buckets.find((b) => b.id === 'candidate-documents');
  assert(candidateDocsBucket && candidateDocsBucket.public === false, 'Security: candidate-documents bucket is strictly PRIVATE (public = false)');

  const backendFile = path.join(__dirname, '..', 'recruitos-backend', 'index.js');
  const backendCode = fs.readFileSync(backendFile, 'utf8');

  assert(
    backendCode.includes('app.get("/api/documents/signed-url", requireAuth'),
    'Security: /api/documents/signed-url endpoint requires authentication (requireAuth)'
  );
  assert(
    backendCode.includes('profile.role === "admin"') && backendCode.includes('profile.role === "corporate"'),
    'Security: Backend verifies authorized roles for access to candidate documents'
  );

  console.log('\n=================================================================');
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('=================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
