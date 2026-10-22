import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("pages/HomePage.tsx"),
    route("login", "pages/LoginPage.tsx"),
    route("admin/debug", "pages/AdminDebugPage.tsx"),
    route("events", "pages/EventsPage.tsx"),
    route("*?", "pages/404Page.tsx")
] satisfies RouteConfig;
