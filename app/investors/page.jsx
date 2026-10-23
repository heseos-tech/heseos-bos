import { getInvestor, touchInvestor } from '@/lib/investorAccess';
import InvestorGate from '@/components/investors/InvestorGate';
import ProposalViewer from '@/components/investors/ProposalViewer';

export const dynamic = 'force-dynamic';

// /investors — the Heseos investment proposal, behind name + phone + email, the NDA and a
// WhatsApp/email one-time code. Signed in (valid cookie) → the proposal; otherwise the gate.
export default async function InvestorsPage() {
  const investor = await getInvestor();
  if (investor) {
    await touchInvestor(investor);
    return <ProposalViewer name={investor.name} />;
  }
  return <InvestorGate />;
}
