/**
 * Which payment provider this build asks for.
 *
 * Configuration rather than a constant in a component, which is what it was: `'FAKE'` written
 * into two `onClick` handlers meant a second provider could exist on the server and be
 * unreachable from the product - and that is exactly what happened the day Stripe was added.
 *
 * A build-time value, because that is the mechanism a static client has. It is also a
 * placeholder for the right answer, and worth saying so: **the contract has no way to ask
 * which providers are available.** A buyer in this market should be choosing between a bank
 * transfer, a wallet and a card, and neither this module nor anything else here can offer that
 * choice, because nothing tells the client what the server is configured with. Adding it is a
 * contract change (see DESIGN.md's Known Gaps), not a component.
 */
export const paymentProvider: string = import.meta.env.VITE_PAYMENT_PROVIDER ?? 'FAKE'
