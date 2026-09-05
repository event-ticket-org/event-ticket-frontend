import { createBrowserRouter } from 'react-router'
import {
  AdminLayout,
  ManagerLayout,
  PublicLayout,
  RequirePlatformAdmin,
  RequireSignedIn,
  ScannerLayout,
} from './layouts'
import { AdminPage } from '~/features/admin/AdminPage'
import { CreateOrganizationPage } from '~/features/organizations/CreateOrganizationPage'
import { RegisterPage, SignInPage, VerifyEmailPage } from '~/features/auth/AuthPages'
import { HomePage, NotFoundPage, PlaceholderPage } from './pages'

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
      { path: '/', element: <HomePage /> },
      { path: '/sign-in', element: <SignInPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/verify-email', element: <VerifyEmailPage /> },
      { path: '/events/:eventId', element: <PlaceholderPage what="The public event page and seat picker" slice="3" /> },
      {
        element: <RequireSignedIn />,
        children: [
          { path: '/orders', element: <PlaceholderPage what="Your orders and tickets" slice="3" /> },
          { path: '/orders/:orderId', element: <PlaceholderPage what="An order's tickets, with their QR codes" slice="3" /> },
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
          { path: '/manage', element: <PlaceholderPage what="The organization dashboard" slice="2" /> },
          { path: '/manage/venues', element: <PlaceholderPage what="Venues and the seat map editor" slice="2" /> },
          { path: '/manage/events', element: <PlaceholderPage what="Events, pricing and publishing" slice="2" /> },
        ],
      },
      {
        element: <ScannerLayout />,
        children: [
          { path: '/scan/:eventId', element: <PlaceholderPage what="The door scanner" slice="4" /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
