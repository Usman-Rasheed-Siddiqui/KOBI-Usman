import { LoginClient } from "@/components/login-client";
import { ProfileSkeleton } from "@/components/skeletons";
import { Suspense } from "react";
export const metadata={title:"Sign in"};
export default function Page(){return <main><Suspense fallback={<ProfileSkeleton/>}><LoginClient/></Suspense></main>}
