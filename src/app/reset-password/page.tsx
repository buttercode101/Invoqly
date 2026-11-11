import type { Metadata } from "next";
import { ResetPasswordPanel } from "@/app/reset-password-panel";
export const metadata:Metadata={title:"Choose a new password"};
export default function ResetPasswordPage(){return <ResetPasswordPanel/>;}
