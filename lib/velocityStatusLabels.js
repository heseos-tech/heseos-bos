// Plain-language names for Velocity's shipment statuses — kept free of server imports so the Admin
// Orders screen (browser) can use it too.
const LABELS = {
  pending: 'Waiting for courier', ready_for_pickup: 'Ready for pickup', pickup_scheduled: 'Pickup scheduled', not_picked: 'Pickup missed',
  in_transit: 'In transit', out_for_delivery: 'Out for delivery', delivered: 'Delivered', ndr_raised: 'Delivery attempt failed (NDR)',
  need_attention: 'Needs attention', reattempt_delivery: 'Re-attempt scheduled', cancelled: 'Shipment cancelled', lost: 'Lost',
  rto_initiated: 'Return to origin started', rto_in_transit: 'Returning to origin', rto_delivered: 'Returned to origin', rto_lost: 'Lost on return',
  rto_need_attention: 'Return needs attention', rto_cancelled: 'Return cancelled', rejected: 'Rejected',
};
// True while the courier has NOT collected the parcel yet — the only time a shipment can be cancelled in
// Velocity and booked again. Empty status = sent to Velocity but nothing heard back yet.
// A shipment Velocity cancelled or rejected is finished — the order can simply be sent again.
export const velocityShipmentEnded = (s) => s === 'cancelled' || s === 'rejected';
const PRE_PICKUP = ['', 'pending', 'ready_for_pickup', 'pickup_scheduled', 'not_picked', 'cancel_requested', 'cancelled', 'rejected'];
export const velocityBeforePickup = (s) => PRE_PICKUP.includes(String(s || ''));
export const velocityStatusLabel = (s) => LABELS[s] || String(s || '').replace(/_/g, ' ');
