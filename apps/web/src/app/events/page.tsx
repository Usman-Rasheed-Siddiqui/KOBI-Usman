import { redirect } from "next/navigation";

export const metadata = { title: "KOBI Pulse" };

export default function Page() {
  redirect("/pulse");
}
