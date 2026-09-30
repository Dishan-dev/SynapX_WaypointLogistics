import { ChecklistView } from "./checklist-view";

// L4 · Loading checklist (Figma 1c, 1c.1, 9, 10, 16 · tablet T1c).
export default async function LoadingChecklistPage(props: PageProps<"/loader/runs/[code]">) {
  const { code } = await props.params;
  return <ChecklistView code={code} />;
}
