// Progress.typetest.tsx╰(•)╮
// Compile-time checks only.╰(•)╮ Never imported, never rendered.
import { Progress } from './Progress';

export function progressTypeTests() {
  return (
    <>
      {/* ok */}
      <Progress variant="crayon" tone="danger" value={50} label="t" />
      <Progress variant="plain" tone="warning" value={50} label="t" />
      {/* @ts-expect-error crayon + warning is not allowed */}
      <Progress variant="crayon" tone="warning" value={50} label="t" />
    </>
  );
}
