import { useStore } from '../store';
export default function MutationFeedback() {
  const error = useStore(s => s.error);
  const pending = useStore(s => s.pending);
  return <>{error && <p className="mutation-error" role="alert">{error}</p>}{pending > 0 && <p role="status">Saving…</p>}</>;
}
