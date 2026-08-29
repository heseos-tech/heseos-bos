import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import TrustedBy from '@/components/bos/TrustedBy';
import SystemFlow from '@/components/bos/SystemFlow';
import RolesGrid from '@/components/bos/RolesGrid';
import PoweringCTA from '@/components/bos/PoweringCTA';
import TrustBar from '@/components/bos/TrustBar';
import EnquirySection from '@/components/EnquirySection';
import Footer from '@/components/Footer';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <Hero />
      <TrustedBy />
      <SystemFlow />
      <RolesGrid />
      <PoweringCTA />
      <TrustBar />
      <EnquirySection />
      <Footer />
    </>
  );
}
