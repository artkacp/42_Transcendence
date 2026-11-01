// Progress.typetest.tsx╰(•)╮
// Compile-time checks only.╰(•)╮ Never imported, never rendered.
import { Progress } from './Progress';

export function progressTypeTests() {
  return (
    <>
      {/* ok */}
      <Progress tone="danger" value={50} label="t" />
      <Progress tone="success" size="sm" value={50} label="t" />
      <Progress tone="warning" value={50} label="t" />
      <Progress fluid size="sm" value={50} label="t" />
    </>
  );
}