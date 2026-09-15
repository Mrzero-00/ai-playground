export interface AudioRecorderProps {
  disabled?: boolean;
  /** Read/copy the temporary m4a file before this promise resolves. */
  onRecorded: (uri: string) => Promise<void> | void;
  onBusyChange?: (busy: boolean) => void;
  onError?: (message: string) => void;
}
