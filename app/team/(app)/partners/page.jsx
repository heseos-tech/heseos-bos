'use client';
import PartnersScreen from '@/components/team/PartnersScreen';

// Reuses TeamAppShell's own auth guard (../layout.jsx) — PartnersScreen doesn't need the
// signed-in employee itself (app/api/team/partners scopes the list server-side from the
// session), unlike TasksScreen which needs employee.id client-side for its assigneeId filter.
export default function TeamPartnersPage() {
  return <PartnersScreen backHref="/team/home" />;
}
