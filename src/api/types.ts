import type { components } from './schema'

/**
 * Short names for the contract's schemas, so call sites read as domain code rather
 * than as indexing into a generated file.
 *
 * `schema.d.ts` is generated from `contracts/openapi.yaml` at build time and never
 * committed. A checked-in copy is a contract that has quietly stopped being
 * normative; regenerating on every build means a contract change that the code has
 * not caught up with fails `tsc` instead of failing a user.
 */
export type Schemas = components['schemas']

export type Money = Schemas['Money']
export type ApiErrorBody = Schemas['Error']
export type ErrorCode = Schemas['ErrorCode']

export type TokenPair = Schemas['TokenPair']
export type Me = Schemas['Me']
export type Membership = Schemas['Membership']
export type Role = Schemas['Role']
export type Organization = Schemas['Organization']

export type Venue = Schemas['Venue']
export type VenueInput = Schemas['VenueInput']
export type SeatMap = Schemas['SeatMap']
export type SeatMapSeat = Schemas['SeatMapSeat']
export type MapElement = Schemas['MapElement']

export type Event = Schemas['Event']
export type EventInput = Schemas['EventInput']
export type EventPatch = Schemas['EventPatch']
export type EventStatus = Schemas['EventStatus']
export type PricingTier = Schemas['PricingTier']
export type PublicEvent = Schemas['PublicEvent']
export type PublicEventSummary = Schemas['PublicEventSummary']
export type EventSeat = Schemas['EventSeat']
export type EventSeatMap = Schemas['EventSeatMap']
export type SeatAvailability = Schemas['SeatAvailability']

export type Order = Schemas['Order']
export type OrderSeat = Schemas['OrderSeat']
export type OrderStatus = Schemas['OrderStatus']
export type PaymentSession = Schemas['PaymentSession']
export type NextAction = Schemas['NextAction']
export type Ticket = Schemas['Ticket']
export type Refund = Schemas['Refund']
export type EventCancellation = Schemas['EventCancellation']

export type ScanResult = Schemas['ScanResult']
export type ScanOutcome = Schemas['ScanOutcome']
