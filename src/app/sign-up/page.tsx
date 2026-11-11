import type { Metadata } from "next";
import { AuthPanel } from "@/app/auth-panel";
export const metadata:Metadata={title:"Create account"};
export default function SignUpPage(){return <AuthPanel mode="sign-up"/>;}
