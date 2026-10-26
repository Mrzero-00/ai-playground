export interface CapsuleARProps {
  title: string;
  busy?: boolean;
  /** False while the server gate (time, place, attendance) is not satisfied. */
  actionAllowed?: boolean;
  /** Why the gate is closed, shown under the prompt. */
  gateHint?: string;
  onClose: () => void;
  /** The parent must validate the server time, location and ownership again. */
  onAction: () => void | Promise<void>;
}
