import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getEmployee } from '@/lib/auth';
import TeamHome from '@/components/team/TeamHome';

export const dynamic = 'force-dynamic';

// The single Team-app route — Home, Leads and Profile all render inside TeamHome now,
// switched by ?tab= instead of a separate page each. See components/team/TeamHome.jsx.
export default async function TeamHomePage() {
  const employee = await getEmployee();
  if (!employee) redirect('/team/login');
  return (
    <Suspense fallback={null}>
      <TeamHome employee={employee} />
    </Suspense>
  );
}
