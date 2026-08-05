'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { currentRole, setRole } from '../lib/api';

const STUDENT_PAGES = [
  ['/solve', 'Solve'],
  ['/submissions', 'Submissions'],
  ['/doubts', 'Doubt board'],
];
const TEACHER_PAGES = [['/review', 'Review queue']];

const PEOPLE = { STUDENT: 'Aditi Sharma', TEACHER: 'Priya Raman' };

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setLocalRole] = useState('STUDENT');

  useEffect(() => setLocalRole(currentRole()), []);

  function switchTo(next) {
    setRole(next);
    setLocalRole(next);
    router.push(next === 'TEACHER' ? '/review' : '/solve');
    router.refresh();
  }

  const pages = role === 'TEACHER' ? TEACHER_PAGES : STUDENT_PAGES;

  return (
    <aside className="flex w-[232px] shrink-0 flex-col justify-between border-r border-border bg-surface">
      <div>
        <div className="border-b border-border px-5 py-5">
          <div className="text-[15px] font-semibold tracking-tight">TrustGrade</div>
          <div className="mt-0.5 text-[12px] text-muted">Assessment workspace</div>
        </div>

        <nav className="px-3 py-3">
          {pages.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? 'page' : undefined}
              className={`block rounded px-3 py-2 text-[14px] ${
                pathname === href
                  ? 'bg-accent-soft font-medium text-accent'
                  : 'text-text2 hover:bg-surface2'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-border px-5 py-4">
        <div className="font-mono text-[11px] uppercase tracking-wide text-muted">Signed in as</div>
        <div className="mt-1 text-[14px] font-medium">{PEOPLE[role]}</div>

        <label className="mt-3 block">
          <span className="sr-only">Role</span>
          <select
            value={role}
            onChange={(event) => switchTo(event.target.value)}
            className="w-full rounded border border-border-strong bg-surface px-2 py-1.5 text-[13px]"
          >
            <option value="STUDENT">Student</option>
            <option value="TEACHER">Teacher</option>
          </select>
        </label>

        <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted">
          Roles switch with a header. There is no login.
        </p>
      </div>
    </aside>
  );
}
