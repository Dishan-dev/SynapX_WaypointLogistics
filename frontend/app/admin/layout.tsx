"use client";

import React from "react";
import { RoleGuard } from "@/components/auth/role-guard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["admin"]} fallbackTitle="Administrator Privileges Required">
      {children}
    </RoleGuard>
  );
}
