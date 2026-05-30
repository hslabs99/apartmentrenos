import { redirect } from "next/navigation";

export default async function AppHome() {
  redirect("/projects");
}
