// recruitos-backend/candidateValidation.js
// Centralised validation rules for Candidate Registration / Application (12 mandatory fields)

function validateCandidatePayload(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, field: 'general', error: 'Request body must be a valid JSON object.' };
  }

  const {
    name, email, phone, degree, branch, cgpa, passing_year,
    college_id, college_other, tenth_percentage, twelfth_percentage,
    skills, resume_url
  } = body;

  // 1. Full Name *
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return { valid: false, field: 'name', error: 'Full Name is required (minimum 2 characters).' };
  }

  // 2. Email Address *
  if (!email || typeof email !== 'string') {
    return { valid: false, field: 'email', error: 'Email Address is required.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { valid: false, field: 'email', error: 'Please enter a valid email address.' };
  }

  // 3. Mobile Number *
  if (!phone) {
    return { valid: false, field: 'phone', error: 'Mobile Number is required (must be 10 digits).' };
  }
  const cleanPhone = String(phone).replace(/\D/g, '');
  if (cleanPhone.length !== 10) {
    return { valid: false, field: 'phone', error: 'Mobile Number must be exactly 10 digits.' };
  }

  // 4. Degree *
  if (!degree || typeof degree !== 'string' || degree.trim().length === 0) {
    return { valid: false, field: 'degree', error: 'Degree is required. Please select your degree.' };
  }

  // 5. Branch / Specialization *
  if (!branch || typeof branch !== 'string' || branch.trim().length === 0) {
    return { valid: false, field: 'branch', error: 'Branch / Specialization is required.' };
  }

  // 6. CGPA / Percentage *
  if (cgpa === undefined || cgpa === null || cgpa === '' || isNaN(Number(cgpa))) {
    return { valid: false, field: 'cgpa', error: 'CGPA / Percentage is required.' };
  }
  const numCgpa = Number(cgpa);
  if (numCgpa <= 0 || numCgpa > 100) {
    return { valid: false, field: 'cgpa', error: 'CGPA / Percentage must be a valid number between 0.1 and 100.' };
  }

  // 7. Passing Year *
  if (passing_year === undefined || passing_year === null || passing_year === '' || isNaN(Number(passing_year))) {
    return { valid: false, field: 'passing_year', error: 'Passing Year is required.' };
  }
  const numYear = Number(passing_year);
  if (!Number.isInteger(numYear) || numYear < 1990 || numYear > 2040) {
    return { valid: false, field: 'passing_year', error: 'Passing Year must be a valid 4-digit year (between 1990 and 2040).' };
  }

  // 8. College / University *
  const hasCollegeId = college_id && typeof college_id === 'string' && college_id.trim().length > 0;
  const hasCollegeOther = college_other && typeof college_other === 'string' && college_other.trim().length > 0;
  if (!hasCollegeId && !hasCollegeOther) {
    return { valid: false, field: 'college', error: 'College / University is required. Please select from directory or enter college name.' };
  }

  // 9. 10th Percentage *
  if (tenth_percentage === undefined || tenth_percentage === null || tenth_percentage === '' || isNaN(Number(tenth_percentage))) {
    return { valid: false, field: 'tenth_percentage', error: '10th Percentage is required.' };
  }
  const numTenth = Number(tenth_percentage);
  if (numTenth <= 0 || numTenth > 100) {
    return { valid: false, field: 'tenth_percentage', error: '10th Percentage must be between 1% and 100%.' };
  }

  // 10. 12th / Diploma Percentage *
  if (twelfth_percentage === undefined || twelfth_percentage === null || twelfth_percentage === '' || isNaN(Number(twelfth_percentage))) {
    return { valid: false, field: 'twelfth_percentage', error: '12th / Diploma Percentage is required.' };
  }
  const numTwelfth = Number(twelfth_percentage);
  if (numTwelfth <= 0 || numTwelfth > 100) {
    return { valid: false, field: 'twelfth_percentage', error: '12th / Diploma Percentage must be between 1% and 100%.' };
  }

  // 11. Technical / Domain Skills *
  let skillsArray = [];
  if (Array.isArray(skills)) {
    skillsArray = skills.map((s) => String(s).trim()).filter(Boolean);
  } else if (typeof skills === 'string') {
    skillsArray = skills.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (skillsArray.length === 0) {
    return { valid: false, field: 'skills', error: 'Technical / Domain Skills are required (please list at least one skill).' };
  }

  // 12. Resume PDF (maximum 5 MB) *
  if (!resume_url || typeof resume_url !== 'string' || resume_url.trim().length === 0) {
    return { valid: false, field: 'resume_url', error: 'Resume PDF URL is required.' };
  }
  const lowerResume = resume_url.trim().toLowerCase();
  if (!lowerResume.endsWith('.pdf') && !lowerResume.includes('/resumes/')) {
    return { valid: false, field: 'resume_url', error: 'Resume must be a valid PDF document.' };
  }

  return { valid: true, cleanPhone, skillsArray };
}

module.exports = {
  validateCandidatePayload,
};
