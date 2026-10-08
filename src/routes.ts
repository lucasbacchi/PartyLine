import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [index("pages/HomePage.tsx"),
    route("events", "pages/events.tsx"),
     route("*?", "pages/404Page.tsx")
    ] satisfies RouteConfig;
