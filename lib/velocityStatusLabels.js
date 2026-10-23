// Plain-language names for Velocity's shipment statuses — kept free of server imports so the Admin
// Orders screen (browser) can use it too.
const LABELS = {
  pending: 'Waiting for courier', ready_for_pickup: 'Ready for pickup', pickup_scheduled: 'Pickup scheduled', not_picked: 'Pickup missed',
  in_transit: 'In transit', out_for_delivery: 'Out for delivery', delivered: 'Delivered', ndr_raised: 'Delivery attempt failed (NDR)',
  need_attention: 'Needs attention', reattempt_delivery: 'Re-attempt scheduled', cancelled: 'Shipment cancelled', lost: 'Lost',
  rto_initiated: 'Return to origin started', rto_in_transit: 'Returning to origin', rto_delivered: 'Returned to origin', rto_lost: 'Lost on return',
  rto_need_attention: 'Return needs attention', rto_cancelled: 'Return cancelled', rejected: 'Rejected',
};
export const velocityStatusLabel = (s) => LABELS[s] || String(s || '').replace(/_/g, ' ');
