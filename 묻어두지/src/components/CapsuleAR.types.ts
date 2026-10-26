export interface CapsuleARProps {
  mode: 'bury' | 'open';
  title: string;
  busy?: boolean;
  actionAllowed?: boolean;
  participationHint?: string;
  onClose: () => void;
  /** The parent must validate the server time, location and ownership again. */
  onAction: () => void | Promise<void>;
}
