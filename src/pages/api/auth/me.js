/**
 * Current User Session API Route
 * Returns authenticated user's info
 */
import { withAuth, apiHandler } from '@/middleware/withAuth';

async function getCurrentUser(req, res) {
  return res.status(200).json({
    success: true,
    user: req.user
  });
}

export default apiHandler({
  GET: withAuth(getCurrentUser)
});
