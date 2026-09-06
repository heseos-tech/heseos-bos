import TeamHome from '@/components/team/TeamHome';

// The single Team-app route — Home, Leads and Profile all render inside TeamHome now, switched
// by ?tab= instead of a separate page each. See components/team/TeamHome.jsx.
//
// No server-side auth check here any more — see ../layout.jsx: TeamAppShell checks the session
// client-side instead, and TeamHome reads the signed-in employee from context
// (useEmployeeSession()) once that check resolves.
export default function TeamHomePage() {
  return <TeamHome />;
}
