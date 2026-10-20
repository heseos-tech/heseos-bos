// app/book-installation/[token]/page.jsx — see lib/installBooking.js. Token-gated (HMAC), not session-gated.
import { notFound } from 'next/navigation';
import { dbGetById } from '@/lib/db';
import {
  verifyInstallBookingToken, bookingBlockReason, istDate, earliestBookingDate, bookableDates, BOOKING_MAX_DAYS, BOOKING_SLOTS,
} from '@/lib/installBooking';
import BookInstallationForm from '@/components/BookInstallationForm';

export const dynamic = 'force-dynamic';

export default async function BookInstallationPage({ params }) {
  const { token } = await params;
  const orderId = verifyInstallBookingToken(token);
  if (!orderId) notFound();
  const order = await dbGetById('orders', orderId);
  if (!order) notFound();

  const firstName = order.customerName ? String(order.customerName).trim().split(/\s+/)[0] : '';
  const items = (Array.isArray(order.items) ? order.items : []).map((i) => ({ name: i.name || i.title || 'Item', qty: Number(i.qty) || 1 }));

  return (
    <div className="hp-root">
      <BookInstallationForm
        token={token}
        orderId={order.id}
        firstName={firstName}
        items={items}
        address={order.deliveryAddress || ''}
        blocked={bookingBlockReason(order)}
        current={order.installDate ? { date: order.installDate, slot: order.installSlot || '' } : null}
        minDate={earliestBookingDate()}
        quickDates={bookableDates(12)}
        maxDate={istDate(BOOKING_MAX_DAYS)}
        slots={BOOKING_SLOTS}
      />
    </div>
  );
}
