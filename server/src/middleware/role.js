// The whole auth story: the sidebar sets x-demo-role, and that is taken at face
// value. There are no passwords and no sessions. The README says so plainly.
import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/errors.js';

// The header is trusted because there is nothing else to trust. What matters is
// that the check exists at all: a student cannot reach a review route, and the
// database will not accept the transition even if they somehow did.
export function requireTeacher(req, _res, next) {
  if (req.get('x-demo-role') !== 'TEACHER') {
    return next(httpError(403, 'Only a teacher can review answers.'));
  }
  return next();
}

export async function currentUser(req) {
  const role = req.get('x-demo-role') === 'TEACHER' ? 'TEACHER' : 'STUDENT';
  const user = await prisma.user.findFirst({ where: { role }, orderBy: { email: 'asc' } });

  if (!user) throw httpError(500, 'No seeded user for that role. Run the seed script.');
  return user;
}
