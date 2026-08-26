// Single source of truth for COSCA's departments/offices — used by:
//  - the Department login page's "Department Office" dropdown (App.tsx)
//  - the PPO Settings "Create New System Account" form (components/SettingsModal.tsx)
//  - the account list table's Department column (components/SettingsModal.tsx)
//
// `value` is the stable internal id stored on the account (and sent by the
// login page) — it must stay in sync between account creation and login,
// which is exactly why both places import it from here instead of keeping
// their own separate copies.
export interface DepartmentOffice {
  value: string;
  fullName: string;
}

export const DEPARTMENT_OFFICES: DepartmentOffice[] = [
  { value: "vpaa", fullName: "Office of the Vice President for Academic Affairs (VPAA)" },
  { value: "cfo", fullName: "Christian Formation Office (CFO)" },
  { value: "registrar", fullName: "Registrar Office" },
  { value: "finance-accounting", fullName: "Finance and Accounting Department" },
  { value: "guidance-counseling", fullName: "Guidance and Counseling Office" },
  { value: "scholarship", fullName: "Scholarship Office" },
  { value: "nstp", fullName: "National Service Training Program (NSTP)" },
  { value: "school-clinic", fullName: "School Clinic Office" },
  { value: "cahs", fullName: "College of Allied Health Sciences (CAHS)" },
  { value: "clia-ed", fullName: "College of Liberal Arts-Education (CLIA-ED)" },
  { value: "ccje", fullName: "College of Criminal Justice Education (CCJE)" },
  { value: "cbe", fullName: "College of Business Education (CBE)" },
  { value: "basic-ed-elem", fullName: "Basic Education (Elementary)" },
  { value: "basic-ed-jshs", fullName: "Basic Education (Junior and Senior High School levels)" },
];

// Display-label lookup, keyed by the dropdown's internal value.
export const DEPT_OFFICE_LABELS: Record<string, string> = Object.fromEntries(
  DEPARTMENT_OFFICES.map((d) => [d.value, d.fullName])
);
