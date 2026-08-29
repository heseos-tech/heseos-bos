import { Suspense } from 'react';
import LeadsPage from '@/components/admin/LeadsPage';

export default function AdminLeadsRoute() {
  return (
    <Suspense fallback={<div className="adm-empty">Loading…</div>}>
      <LeadsPage />
    </Suspense>
  );
}
