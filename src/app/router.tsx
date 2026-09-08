import { createBrowserRouter } from 'react-router'
import {
  AdminLayout,
  ManagerLayout,
  PublicLayout,
  RequireManager,
  RequirePlatformAdmin,
  RequireSignedIn,
  ScannerLayout,
} from './layouts'
import { AdminPage } from '~/features/admin/AdminPage'
import { CreateOrganizationPage } from '~/features/organizations/CreateOrganizationPage'
import { DashboardPage } from '~/features/organizations/DashboardPage'
import { TeamPage } from '~/features/organizations/TeamPage'
import { EventOrdersPage } from '~/features/refunds/EventOrdersPage'
import { VenuePage } from '~/features/venues/VenuePage'
import { VenuesPage } from '~/features/venues/VenuesPage'
import { EventPage } from '~/features/events/EventPage'
import { EventsPage } from '~/features/events/EventsPage'
import { PublicEventPage } from '~/features/discovery/PublicEventPage'
import { PublicEventsPage } from '~/features/discovery/PublicEventsPage'
import { CheckoutPage } from '~/features/checkout/CheckoutPage'
import { OrderPage } from '~/features/checkout/OrderPage'
import { OrdersPage } from '~/features/tickets/OrdersPage'
import { TicketsPage } from '~/features/tickets/TicketsPage'
import { ScannerPage } from '~/features/scanner/ScannerPage'
import { RegisterPage, SignInPage, VerifyEmailPage } from '~/features/auth/AuthPages'
import { NotFoundPage } from './pages'

/**
 * Routes are grouped by the shell they belong to rather than by feature, because the
 * shell is the thing that differs most: a public page has navigation, a manager page
 * has an organization switcher, and the scanner has neither.
 *
 * The placeholders below are honest markers for the slices that follow - a page that
 * says what will be here beats a route that 404s during development.
 */
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <PublicEventsPage /> },
      { path: '/sign-in', element: <SignInPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/verify-email', element: <VerifyEmailPage /> },
      { path: '/events/:eventId', element: <PublicEventPage /> },
      {
        element: <RequireSignedIn />,
        children: [
          { path: '/events/:eventId/checkout', element: <CheckoutPage /> },
        ],
      },
      {
        element: <RequireSignedIn />,
        children: [
          { path: '/orders', element: <OrdersPage /> },
          { path: '/orders/:orderId', element: <OrderPage /> },
          { path: '/orders/:orderId/tickets', element: <TicketsPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireSignedIn />,
    children: [
      // Creating an Organization happens before there is one to manage, so it sits in the
      // public shell: the manager shell's own chrome needs a Membership this person lacks.
      {
        element: <PublicLayout />,
        children: [{ path: '/organizations/new', element: <CreateOrganizationPage /> }],
      },
      {
        element: <RequirePlatformAdmin />,
        children: [
          {
            element: <AdminLayout />,
            children: [{ path: '/admin', element: <AdminPage /> }],
          },
        ],
      },
      {
        element: <ManagerLayout />,
        children: [
          { path: '/manage', element: <DashboardPage /> },
          { path: '/manage/team', element: <TeamPage /> },
          {
            element: <RequireManager />,
            children: [
              { path: '/manage/venues', element: <VenuesPage /> },
              { path: '/manage/venues/:venueId', element: <VenuePage /> },
              { path: '/manage/events', element: <EventsPage /> },
              { path: '/manage/events/:eventId', element: <EventPage /> },
              { path: '/manage/events/:eventId/orders', element: <EventOrdersPage /> },
            ],
          },
        ],
      },
      {
        element: <ScannerLayout />,
        children: [
          { path: '/scan/:eventId', element: <ScannerPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
