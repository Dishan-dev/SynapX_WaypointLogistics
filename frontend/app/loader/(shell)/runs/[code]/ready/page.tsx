import { ReadyView } from "./ready-view";

// L6 · Ready to depart (Figma 1f, 12, 18 · tablet T1f).
export default async function ReadyToDepartPage(props: PageProps<"/loader/runs/[code]/ready">) {
  const { code } = await props.params;
  return <ReadyView code={code} />;
}
