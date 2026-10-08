import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { RequireAdmin, RequireAuth } from "./components/layout/Guards";
import { Layout } from "./components/layout/Layout";
import { EmptyState, Spinner } from "./components/ui/kit";
import HomePage from "./pages/Home";

// Les pages moins fréquentes sont chargées à la demande.
const ExplorePage = lazy(() => import("./pages/Explore"));
const OfferDetailPage = lazy(() => import("./pages/OfferDetail"));
const CartPage = lazy(() => import("./pages/Cart"));
const CheckoutPage = lazy(() => import("./pages/Checkout"));
const OrderConfirmationPage = lazy(() => import("./pages/OrderConfirmation"));
const NotificationsPage = lazy(() => import("./pages/Notifications"));
const AuthPages = {
  Login: lazy(() => import("./pages/Auth").then((m) => ({ default: m.LoginPage }))),
  Register: lazy(() => import("./pages/Auth").then((m) => ({ default: m.RegisterPage }))),
  Forgot: lazy(() => import("./pages/Auth").then((m) => ({ default: m.ForgotPasswordPage }))),
  Reset: lazy(() => import("./pages/Auth").then((m) => ({ default: m.ResetPasswordPage }))),
};
const AccountLayout = lazy(() => import("./pages/account/AccountLayout"));
const Account = {
  Profile: lazy(() => import("./pages/account/Sections").then((m) => ({ default: m.ProfilePage }))),
  Orders: lazy(() => import("./pages/account/Sections").then((m) => ({ default: m.OrdersPage }))),
  Services: lazy(() => import("./pages/account/Sections").then((m) => ({ default: m.ServicesPage }))),
  Bookings: lazy(() => import("./pages/account/Sections").then((m) => ({ default: m.BookingsPage }))),
  Quotes: lazy(() => import("./pages/account/Sections").then((m) => ({ default: m.QuotesPage }))),
  Favorites: lazy(() => import("./pages/account/Sections").then((m) => ({ default: m.FavoritesPage }))),
  Reviews: lazy(() => import("./pages/account/Sections").then((m) => ({ default: m.ReviewsPage }))),
  Addresses: lazy(() => import("./pages/account/Sections").then((m) => ({ default: m.AddressesPage }))),
  Settings: lazy(() => import("./pages/account/Sections").then((m) => ({ default: m.SettingsPage }))),
};
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const Admin = {
  Dashboard: lazy(() => import("./pages/admin/AdminLayout").then((m) => ({ default: m.AdminDashboard }))),
  Offers: lazy(() => import("./pages/admin/AdminOffers").then((m) => ({ default: m.AdminOffersPage }))),
  OfferForm: lazy(() => import("./pages/admin/AdminOffers").then((m) => ({ default: m.AdminOfferFormPage }))),
  Categories: lazy(() => import("./pages/admin/AdminOthers").then((m) => ({ default: m.AdminCategoriesPage }))),
  Orders: lazy(() => import("./pages/admin/AdminOthers").then((m) => ({ default: m.AdminOrdersPage }))),
  Bookings: lazy(() => import("./pages/admin/AdminOthers").then((m) => ({ default: m.AdminBookingsPage }))),
  Users: lazy(() => import("./pages/admin/AdminOthers").then((m) => ({ default: m.AdminUsersPage }))),
  Quotes: lazy(() => import("./pages/admin/AdminOthers").then((m) => ({ default: m.AdminQuotesPage }))),
};

function CategoryRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/explorer?category=${slug ?? ""}`} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="explorer" element={<ExplorePage />} />
          <Route path="categories/:slug" element={<CategoryRedirect />} />
          <Route path="offers/:slug" element={<OfferDetailPage />} />
          <Route path="panier" element={<CartPage />} />
          <Route path="commande" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
          <Route
            path="commande/confirmation/:id"
            element={<RequireAuth><OrderConfirmationPage /></RequireAuth>}
          />
          <Route path="notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
          <Route path="connexion" element={<AuthPages.Login />} />
          <Route path="inscription" element={<AuthPages.Register />} />
          <Route path="mot-de-passe-oublie" element={<AuthPages.Forgot />} />
          <Route path="reinitialiser-mot-de-passe" element={<AuthPages.Reset />} />

          <Route path="compte" element={<RequireAuth><AccountLayout /></RequireAuth>}>
            <Route index element={<Account.Profile />} />
            <Route path="commandes" element={<Account.Orders />} />
            <Route path="services" element={<Account.Services />} />
            <Route path="reservations" element={<Account.Bookings />} />
            <Route path="devis" element={<Account.Quotes />} />
            <Route path="favoris" element={<Account.Favorites />} />
            <Route path="avis" element={<Account.Reviews />} />
            <Route path="adresses" element={<Account.Addresses />} />
            <Route path="parametres" element={<Account.Settings />} />
          </Route>

          <Route path="admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<Admin.Dashboard />} />
            <Route path="offres" element={<Admin.Offers />} />
            <Route path="offres/nouvelle" element={<Admin.OfferForm />} />
            <Route path="offres/:id" element={<Admin.OfferForm />} />
            <Route path="categories" element={<Admin.Categories />} />
            <Route path="commandes" element={<Admin.Orders />} />
            <Route path="reservations" element={<Admin.Bookings />} />
            <Route path="devis" element={<Admin.Quotes />} />
            <Route path="utilisateurs" element={<Admin.Users />} />
          </Route>

          <Route
            path="*"
            element={
              <EmptyState title="Page introuvable" action={{ to: "/", label: "Retour à l'accueil" }}>
                L'adresse demandée n'existe pas ou a changé.
              </EmptyState>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
}
