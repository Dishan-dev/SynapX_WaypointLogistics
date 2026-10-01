import { LogView } from "./log-view";

// L9 · Log tab: one run's activity, newest first (Figma Log tab, T1c Change log rows).
export default async function RunLogPage(props: PageProps<"/loader/runs/[code]/log">) {
  const { code } = await props.params;
  return <LogView code={code} />;
}
