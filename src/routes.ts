import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("pages/HomePage.tsx"),
    route("admin/debug", "pages/AdminDebugPage.tsx"),
    route("*?", "pages/404Page.tsx")
] satisfies RouteConfig;
