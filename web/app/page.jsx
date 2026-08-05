import { redirect } from 'next/navigation';

// There is no dashboard. A student lands in the workspace.
export default function Home() {
  redirect('/solve');
}
