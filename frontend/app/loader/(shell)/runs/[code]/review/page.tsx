import { ReviewView } from "./review-view";

// L6 · Confirm & release (Figma 1e, 11, 17 · tablet T1e).
export default async function ConfirmReleasePage(props: PageProps<"/loader/runs/[code]/review">) {
  const { code } = await props.params;
  return <ReviewView code={code} />;
}
