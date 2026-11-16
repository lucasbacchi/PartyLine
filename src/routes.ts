import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("pages/HomePage.tsx"),
    route("login", "pages/LoginPage.tsx"),
    route("signup", "pages/SignupPage.tsx"),
    route("events", "pages/EventsPage.tsx"),
    route("calls", "pages/CallHistoryPage.tsx"),
    route("texts", "pages/SMSInboxPage.tsx"),
    route("org/users", "pages/OrgUsersPage.tsx"),
    route("org/settings", "pages/OrgSettingsPage.tsx"),
    route("org/new", "pages/OrgOnboardingPage.tsx"),
    route("account", "pages/AccountPage.tsx"),
    route("privacy", "pages/PrivacyPolicyPage.tsx"),
    route("terms", "pages/TermsOfServicePage.tsx"),
    route("sms-terms", "pages/SmsTermsPage.tsx"),
    route("opt-out", "pages/OptOutPage.tsx"),
    route("contact", "pages/ContactPage.tsx"),
    route("admin/debug", "pages/AdminDebugPage.tsx"),
    route("*?", "pages/404Page.tsx")
] satisfies RouteConfig;
