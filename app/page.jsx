import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import Products from '@/components/Products';
import EnquirySection from '@/components/EnquirySection';
import Footer from '@/components/Footer';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <Hero />
      <HowItWorks />
      <Products />
      <EnquirySection />
      <Footer />
    </>
  );
}
