// The whole auth story: the sidebar sets x-demo-role, and that is taken at face
// value. There are no passwords and no sessions. The README says so plainly.
import { prisma } from '../lib/prisma.js';

export async function currentUser(req) {
  const role = req.get('x-demo-role') === 'TEACHER' ? 'TEACHER' : 'STUDENT';
  const user = await prisma.user.findFirst({ where: { role }, orderBy: { email: 'asc' } });

  if (!user) {
    const error = new Error('No seeded user for that role. Run the seed script.');
    error.status = 500;
    throw error;
  }
  return user;
}
