import { redirect } from "next/navigation";

export const metadata = { title: "KOBI Forge" };

export default function Page() {
  redirect("/forge");
}
