export interface CapsuleARProps {
  mode: 'bury' | 'open';
  title: string;
  busy?: boolean;
  onClose: () => void;
  /** The parent must validate the server time, location and ownership again. */
  onAction: () => void | Promise<void>;
}
