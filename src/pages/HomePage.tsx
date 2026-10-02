import type { Route } from "./+types/HomePage";

export function meta({}: Route.MetaArgs) {
    return [{ title: "New React Router App" }, { name: "description", content: "Welcome to React Router!" }];
}

export default function HomePage() {
    return <h1>Welcome to the Home Page</h1>;
}
