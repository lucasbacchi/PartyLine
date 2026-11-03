import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("pages/HomePage.tsx"),
    route("login", "pages/LoginPage.tsx"),
    route("signup", "pages/SignupPage.tsx"),
    route("events", "pages/EventsPage.tsx"),
    route("org/users", "pages/OrgUsersPage.tsx"),
    route("org/settings", "pages/OrgSettingsPage.tsx"),
    route("org/new", "pages/OrgOnboardingPage.tsx"),
    route("account", "pages/AccountPage.tsx"),
    route("admin/debug", "pages/AdminDebugPage.tsx"),
    route("*?", "pages/404Page.tsx")
] satisfies RouteConfig;
