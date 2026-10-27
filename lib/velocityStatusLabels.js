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
// Velocity and booked again. A shipment with no courier/AWB yet can never have been picked up, whatever
// status text Velocity used; with an AWB, only the statuses that mean "the courier has it" block a resend.
const PICKED_UP = ['in_transit', 'out_for_delivery', 'delivered', 'ndr_raised', 'reattempt_delivery', 'lost', 'need_attention', 'rto_initiated', 'rto_in_transit', 'rto_delivered', 'rto_lost', 'rto_need_attention'];
export const velocityBeforePickup = (status, awb) => !awb || !PICKED_UP.includes(String(status || ''));
// A shipment Velocity cancelled or rejected is finished — the order can simply be sent again.
export const velocityShipmentEnded = (s) => s === 'cancelled' || s === 'rejected';
export const velocityStatusLabel = (s) => LABELS[s] || String(s || '').replace(/_/g, ' ');
