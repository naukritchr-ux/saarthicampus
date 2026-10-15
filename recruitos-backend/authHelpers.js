/**
 * Cryptographic Supabase JWT Authentication & Role Authorization Helpers
 * Enforces server-side token validation via supabase.auth.getUser(token).
 * Never trusts client-supplied user IDs from request headers or body.
 */

function extractBearerToken(req) {
  if (!req || !req.headers) return null;
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
    return parts[1];
  }
  return null;
}

/**
 * Validates the Supabase access token cryptographically against Supabase Auth.
 */
async function verifySupabaseToken(supabase, req) {
  const token = extractBearerToken(req);
  if (!token) {
    return { user: null, token: null, error: 'No authorization token provided' };
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return { user: null, token: null, error: error?.message || 'Invalid or expired token' };
    }
    return { user: data.user, token, error: null };
  } catch (err) {
    return { user: null, token: null, error: err.message || 'Token verification failed' };
  }
}

/**
 * Loads the user profile from the database using ONLY the verified JWT user ID.
 */
async function getRequestProfile(supabase, req) {
  if (req.profile) return req.profile;

  const { user, error } = await verifySupabaseToken(supabase, req);
  if (error || !user) return null;

  const { data: profile, error: dbError } = await supabase
    .from('profiles')
    .select('id, email, name, role, company_id, candidate_id, approved')
    .eq('id', user.id)
    .single();

  if (dbError || !profile) return null;

  req.user = user;
  req.profile = profile;
  req.userProfile = profile;
  return profile;
}

/**
 * Factory creating Express middleware tied to the Supabase client instance.
 */
function createAuthMiddleware(supabase) {
  async function requireAuth(req, res, next) {
    const profile = await getRequestProfile(supabase, req);
    if (!profile || !req.user) {
      return res.status(401).json({
        error: 'Authentication required. Please provide a valid Bearer token.',
      });
    }

    if (profile.approved !== true) {
      return res.status(403).json({
        error: 'Your account is pending admin approval.',
      });
    }

    next();
  }

  function requireRole(...allowedRoles) {
    return async function (req, res, next) {
      const profile = await getRequestProfile(supabase, req);
      if (!profile || !req.user) {
        return res.status(401).json({
          error: 'Authentication required. Please provide a valid Bearer token.',
        });
      }

      if (profile.approved !== true) {
        return res.status(403).json({
          error: 'Your account is pending admin approval.',
        });
      }

      if (!allowedRoles.includes(profile.role)) {
        return res.status(403).json({
          error: `Access denied. Requires one of: ${allowedRoles.join(', ')}`,
        });
      }

      next();
    };
  }

  const requireAdmin = requireRole('admin');
  const requireStaff = requireRole('admin', 'recruiter');
  const requireCorporate = requireRole('corporate', 'admin');

  return {
    requireAuth,
    requireRole,
    requireAdmin,
    requireStaff,
    requireCorporate,
  };
}

module.exports = {
  extractBearerToken,
  verifySupabaseToken,
  getRequestProfile,
  createAuthMiddleware,
};