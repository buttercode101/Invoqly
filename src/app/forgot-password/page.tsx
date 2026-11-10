import type { Metadata } from "next";
import { ForgotPasswordPanel } from "@/app/forgot-password-panel";
export const metadata:Metadata={title:"Reset your password"};
export default function ForgotPasswordPage(){return <ForgotPasswordPanel/>;}
